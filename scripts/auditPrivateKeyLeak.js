#!/usr/bin/env node

/**
 * Private Key Security Audit Script
 *
 * Scans the codebase for potential private key leaks:
 * - Private key sent via network calls (fetch, axios, postData)
 * - Private key logged (console.log, Reactotron, etc.)
 * - Private key in analytics/crash reporting
 * - Private key in insecure storage (AsyncStorage, MMKV)
 * - Private key injected into WebView or postMessage
 * - Private key sent via WebSocket
 * - Missing removeSensitiveKeysFromString in remote logging
 *
 * Usage: node scripts/auditPrivateKeyLeak.js   (or: yarn audit:pk-leak)
 */

const fs = require('fs')
const path = require('path')

// ─── CONFIG ────────────────────────────────────────────────────────────────────

const SRC_DIR = path.resolve(__dirname, '..', 'src')

// All variable name patterns that could hold private key material
const PRIVATE_KEY_VAR_PATTERNS = [
  'privateKey',
  'private_key',
  'privKey',
  'priv_key',
  'secretKey',
  'secret_key',
  'signingKey',
  'signing_key',
  'ownerPrivateKey',
  'rawPrivateKey',
  'privateKeyDecrypt',
  'privateKeyEvm',
  'privateKeySolana',
  'privateKeyEvmOrSolanaOrBitcoin',
  'privateKeyEvmInit',
  'privateKeyInput',
  'privateKeyHash',
  'privateKeyEVM',
  'privateKeyDecryptFromAirDropBandWeb',
  '\\bpk\\b',
  '\\bwif\\b',
  'wifKey',
  'pkey'
]

// Patterns that indicate the key is being sent to a remote endpoint
const NETWORK_CALL_PATTERNS = [
  'fetch\\(',
  'axios',
  '\\.postData\\(',
  '\\.getData\\(',
  '\\.post\\(',
  '\\.get\\(',
  '\\.put\\(',
  '\\.patch\\(',
  '\\.delete\\(',
  'XMLHttpRequest',
  'sendBeacon'
]

// Patterns that indicate logging
const LOGGING_PATTERNS = [
  'console\\.log',
  'console\\.warn',
  'console\\.error',
  'console\\.info',
  'console\\.debug',
  'console\\.trace',
  'Reactotron\\.log',
  'Reactotron\\.logImportant',
  'Reactotron\\.display',
  'Reactotron\\.warn',
  'Reactotron\\.error',
  'logDebug\\(',
  'debugInfo\\('
]

// Patterns for analytics / crash reporting
const ANALYTICS_PATTERNS = [
  'Sentry\\.',
  'captureException',
  'captureMessage',
  'crashlytics',
  'analytics\\(',
  'firebase\\.analytics',
  'trackEvent',
  'logEvent'
]

// Patterns for insecure storage
const INSECURE_STORAGE_PATTERNS = [
  'AsyncStorage\\.setItem',
  'AsyncStorage\\.multiSet',
  'MMKV\\.set',
  'localStorage\\.',
  'sessionStorage\\.'
]

// Patterns for IPC / injection leaks
const IPC_PATTERNS = [
  'postMessage\\(',
  'WebView.*injectedJavaScript',
  'injectJavaScript\\(',
  '\\.emit\\(.*privateKey',
  'socket\\.send',
  'ws\\.send'
]

// ─── SEVERITY ──────────────────────────────────────────────────────────────────

const SEVERITY = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  INFO: 'INFO'
}

// ─── HELPERS ───────────────────────────────────────────────────────────────────

const IGNORED_DIRS = ['node_modules', '__tests__', '.git', 'build', 'Pods', 'android/build', 'ios/build']
const SCAN_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx']

function isIgnoredPath (fullPath) {
  const segments = fullPath.split(path.sep)
  return IGNORED_DIRS.some(ignored => {
    const ignoredSegments = ignored.split('/')
    // Check if the ignored pattern appears as consecutive segments in the path
    // Only match within src/ tree (after 'src' segment)
    const srcIndex = segments.indexOf('src')
    const searchFrom = srcIndex >= 0 ? srcIndex : 0
    for (let i = searchFrom; i <= segments.length - ignoredSegments.length; i++) {
      const match = ignoredSegments.every((seg, j) => segments[i + j] === seg)
      if (match) return true
    }
    return false
  })
}

function getAllFiles (dir, files = []) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!isIgnoredPath(fullPath)) {
          getAllFiles(fullPath, files)
        }
      } else if (SCAN_EXTENSIONS.includes(path.extname(entry.name))) {
        files.push(fullPath)
      }
    }
  } catch (_err) {
    // skip unreadable dirs
  }
  return files
}

function getRelativePath (filePath) {
  return path.relative(path.resolve(__dirname, '..'), filePath)
}

function escapeRegex (str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Build a single regex to match any private key variable name
function buildKeyVarRegex () {
  const parts = PRIVATE_KEY_VAR_PATTERNS.map(p => {
    // Already a regex pattern (contains \b or special chars)
    if (p.includes('\\b') || p.includes('\\(')) return p
    return escapeRegex(p)
  })
  return new RegExp(`(${parts.join('|')})`, 'i')
}

// ─── RULES ─────────────────────────────────────────────────────────────────────

const keyVarRegex = buildKeyVarRegex()

function lineContainsKeyVar (line) {
  return keyVarRegex.test(line)
}

function isCommentLine (line) {
  const trimmed = line.trim()
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')
}

function isImportOrExportLine (line) {
  const trimmed = line.trim()
  return trimmed.startsWith('import ') || trimmed.startsWith('export ')
}

function isDeleteLine (line) {
  return /delete\s+\w+\.\s*privateKey/.test(line)
}

/**
 * RULE 1: Private key variable near a network call on the same line or adjacent lines
 */
function checkNetworkLeaks (lines, filePath) {
  const findings = []
  const networkRegex = new RegExp(`(${NETWORK_CALL_PATTERNS.join('|')})`, 'i')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (isCommentLine(line) || isImportOrExportLine(line) || isDeleteLine(line)) continue
    if (!lineContainsKeyVar(line)) continue
    if (!networkRegex.test(line)) continue

    // Ignore known safe patterns:
    // - removeSensitiveKeysFromString wrapping the key
    if (/removeSensitiveKeysFromString/.test(line)) continue
    // - deepRemoveFields stripping privateKey
    if (/deepRemoveFields/.test(line)) continue

    findings.push({
      severity: SEVERITY.CRITICAL,
      rule: 'NETWORK_LEAK',
      file: getRelativePath(filePath),
      line: i + 1,
      code: line.trim(),
      message: 'Private key variable appears on the same line as a network call'
    })
  }
  return findings
}

/**
 * RULE 2: Private key variable near logging statements
 */
function checkLoggingLeaks (lines, filePath) {
  const findings = []
  const loggingRegex = new RegExp(`(${LOGGING_PATTERNS.join('|')})`, 'i')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (isCommentLine(line)) continue
    if (!lineContainsKeyVar(line)) continue
    if (!loggingRegex.test(line)) continue

    findings.push({
      severity: SEVERITY.CRITICAL,
      rule: 'LOGGING_LEAK',
      file: getRelativePath(filePath),
      line: i + 1,
      code: line.trim(),
      message: 'Private key variable appears in a logging statement'
    })
  }
  return findings
}

/**
 * RULE 3: Private key in analytics / crash report
 */
function checkAnalyticsLeaks (lines, filePath) {
  const findings = []
  const analyticsRegex = new RegExp(`(${ANALYTICS_PATTERNS.join('|')})`, 'i')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (isCommentLine(line)) continue
    if (!lineContainsKeyVar(line)) continue
    if (!analyticsRegex.test(line)) continue

    findings.push({
      severity: SEVERITY.CRITICAL,
      rule: 'ANALYTICS_LEAK',
      file: getRelativePath(filePath),
      line: i + 1,
      code: line.trim(),
      message: 'Private key variable appears in analytics/crash reporting call'
    })
  }
  return findings
}

/**
 * RULE 4: Private key stored in insecure storage
 */
function checkInsecureStorage (lines, filePath) {
  const findings = []
  const storageRegex = new RegExp(`(${INSECURE_STORAGE_PATTERNS.join('|')})`, 'i')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (isCommentLine(line)) continue
    if (!lineContainsKeyVar(line)) continue
    if (!storageRegex.test(line)) continue

    findings.push({
      severity: SEVERITY.HIGH,
      rule: 'INSECURE_STORAGE',
      file: getRelativePath(filePath),
      line: i + 1,
      code: line.trim(),
      message: 'Private key variable appears in insecure storage operation'
    })
  }
  return findings
}

/**
 * RULE 5: Private key in IPC / WebView injection / postMessage
 */
function checkIPCLeaks (lines, filePath) {
  const findings = []
  const ipcRegex = new RegExp(`(${IPC_PATTERNS.join('|')})`, 'i')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (isCommentLine(line)) continue
    if (!lineContainsKeyVar(line)) continue
    if (!ipcRegex.test(line)) continue

    findings.push({
      severity: SEVERITY.HIGH,
      rule: 'IPC_LEAK',
      file: getRelativePath(filePath),
      line: i + 1,
      code: line.trim(),
      message: 'Private key variable appears in IPC/WebView/postMessage call'
    })
  }
  return findings
}

/**
 * RULE 6: Remote logging without removeSensitiveKeysFromString
 *
 * Checks that any function sending data to remote endpoints (fetch, postData)
 * that includes error messages or log strings uses removeSensitiveKeysFromString.
 */
function checkRemoteLoggingMissingSanitizer (lines, filePath) {
  const findings = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (isCommentLine(line)) continue

    // Look for direct chatwork/remote API calls that send data
    // Note: remoteDebugLog() already sanitizes internally, so skip it
    const isDirectRemoteCall = /api\.chatwork\.com/.test(line)
    const isRemoteDebugLogCall = /remoteDebugLog/.test(line)

    if (!isDirectRemoteCall && !isRemoteDebugLogCall) continue

    // remoteDebugLog sanitizes internally - only flag if error data is passed
    // and the caller doesn't sanitize before calling
    if (isRemoteDebugLogCall) {
      // remoteDebugLog already calls removeSensitiveKeysFromString on its log param
      // So this is safe - skip it
      continue
    }

    // Check surrounding context (10 lines before) for removeSensitiveKeysFromString
    const contextStart = Math.max(0, i - 15)
    const contextEnd = Math.min(lines.length - 1, i + 5)
    const contextBlock = lines.slice(contextStart, contextEnd + 1).join('\n')

    // If context contains error message interpolation but no sanitizer
    if (/error\??\.(message|name|stack)/.test(contextBlock) && !/removeSensitiveKeysFromString/.test(contextBlock)) {
      findings.push({
        severity: SEVERITY.HIGH,
        rule: 'UNSANITIZED_REMOTE_LOG',
        file: getRelativePath(filePath),
        line: i + 1,
        code: line.trim(),
        message: 'Remote logging sends error data without removeSensitiveKeysFromString sanitization'
      })
    }
  }
  return findings
}

/**
 * RULE 7: Private key in JSON.stringify
 */
function checkJSONStringify (lines, filePath) {
  const findings = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (isCommentLine(line)) continue
    if (!lineContainsKeyVar(line)) continue
    if (!/JSON\.stringify/.test(line)) continue
    // Ignore deepRemoveFields patterns
    if (/deepRemoveFields/.test(line)) continue

    findings.push({
      severity: SEVERITY.MEDIUM,
      rule: 'JSON_STRINGIFY_KEY',
      file: getRelativePath(filePath),
      line: i + 1,
      code: line.trim(),
      message: 'Private key variable appears in JSON.stringify - verify this is not sent over network'
    })
  }
  return findings
}

/**
 * RULE 8: Private key passed to function that is NOT a known safe function
 */
function checkUnknownFunctionCall (lines, filePath) {
  const findings = []

  // Known safe functions that receive private key as parameter
  // NOTE: keep this list in sync with the codebase. Entries for functions that
  // no longer exist are harmless but add nothing; entries for CURRENT functions
  // that legitimately receive a private key locally are what actually suppress
  // false-positive LOW noise. V2 is EVM-only (Solana is derived from the EVM
  // key), so the legacy BTC/Harmony/WIF/mini-key conversion helpers were dropped.
  const SAFE_FUNCTIONS = [
    'encryptPrivateKey',
    'decryptPrivateKey',
    'remove0xFromPrivateKey',
    'add0xToPrivateKey',
    'getPrivateKeyByAddress',
    'storePrivateKeyByAddress',
    'removePrivateKeyByAddress',
    'isValidPrivateKeyFormat',
    'removeSensitiveKeysFromString',
    'deepRemoveFields',
    'decryptBackupFileContent',
    'verifyCorrectWalletByPk',
    'convertPrKeyBase',
    // Crypto/signing libs — local sign, only the signature/signed tx leaves
    'ethers\\.Wallet',
    'Keypair\\.fromSecretKey',
    'privateKeyToAccount',
    'bs58\\.decode',
    'bs58\\.encode',
    'signTransaction',
    'signTypedData',
    'signPersionalMessage',
    'signMessage',
    'simulateTransaction',
    'postBaseSendTxs',
    'postBaseSendTxsForWalletConnect',
    'postBaseSendTxsForSwap',
    'sendEthTokenTxs',
    'sendTransaction',
    // Account generation (EVM only)
    'generateEvmAccountFromPrivateKeyEvm',
    // Crypto lib internals (local-only operations)
    'isHexString',
    'fromSecretKey',
    'PrivateKey',
    'isValid',
    'Account',
    'Wallet',
    'decode',
    // Storage
    'Clipboard\\.setString',
    'setString',
    'storeDataToSecureStorage',
    'getDataFromSecureStorage',
    // NFC
    'importPrivateKey',
    'handleExportPrivateKeyToNFCCard',
    'onConvertAccountToKeyCard',
    // UI callbacks that receive a key for local display/copy (user-initiated)
    'onCopy',
    'test',
    // Other safe local ops
    'delete ',
    'toLowerCase',
    'includes',
    'startsWith',
    'substring',
    'toString',
    'trim',
    'replace',
    'length'
  ]

  const safeRegex = new RegExp(`(${SAFE_FUNCTIONS.join('|')})`, 'i')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (isCommentLine(line) || isImportOrExportLine(line) || isDeleteLine(line)) continue

    // Check for pattern: someUnknownFunction(privateKey) or someUnknownFunction(pk)
    const funcCallWithKey = line.match(/(\w+)\s*\(\s*(?:.*,\s*)?(privateKey|secretKey|pk|wifKey|wif|pkey)\s*[,)]/)
    if (!funcCallWithKey) continue

    const funcName = funcCallWithKey[1]
    if (safeRegex.test(funcName)) continue
    // Skip common JS keywords
    if (['if', 'else', 'return', 'switch', 'case', 'while', 'for', 'catch', 'throw', 'new', 'await', 'typeof', 'const', 'let', 'var', 'async', 'function', 'static'].includes(funcName)) continue

    findings.push({
      severity: SEVERITY.LOW,
      rule: 'UNKNOWN_FUNC_WITH_KEY',
      file: getRelativePath(filePath),
      line: i + 1,
      code: line.trim(),
      message: `Private key passed to unrecognized function: ${funcName}() - verify this is safe`
    })
  }
  return findings
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────

function runAudit () {
  const startTime = Date.now()

  console.log('')
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║           🔐 PRIVATE KEY SECURITY AUDIT                    ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log('')
  console.log(`Scanning: ${SRC_DIR}`)
  console.log('')

  const files = getAllFiles(SRC_DIR)
  console.log(`Found ${files.length} source files to scan`)
  console.log('')

  let allFindings = []

  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const lines = content.split('\n')

      allFindings = allFindings.concat(
        checkNetworkLeaks(lines, filePath),
        checkLoggingLeaks(lines, filePath),
        checkAnalyticsLeaks(lines, filePath),
        checkInsecureStorage(lines, filePath),
        checkIPCLeaks(lines, filePath),
        checkRemoteLoggingMissingSanitizer(lines, filePath),
        checkJSONStringify(lines, filePath),
        checkUnknownFunctionCall(lines, filePath)
      )
    } catch (_err) {
      // skip unreadable files
    }
  }

  // ─── REPORT ──────────────────────────────────────────────────────────────────

  const bySeverity = {
    [SEVERITY.CRITICAL]: allFindings.filter(f => f.severity === SEVERITY.CRITICAL),
    [SEVERITY.HIGH]: allFindings.filter(f => f.severity === SEVERITY.HIGH),
    [SEVERITY.MEDIUM]: allFindings.filter(f => f.severity === SEVERITY.MEDIUM),
    [SEVERITY.LOW]: allFindings.filter(f => f.severity === SEVERITY.LOW),
    [SEVERITY.INFO]: allFindings.filter(f => f.severity === SEVERITY.INFO)
  }

  const severityIcon = {
    [SEVERITY.CRITICAL]: '🔴',
    [SEVERITY.HIGH]: '🟠',
    [SEVERITY.MEDIUM]: '🟡',
    [SEVERITY.LOW]: '🔵',
    [SEVERITY.INFO]: 'ℹ️ '
  }

  const printFindings = (findings) => {
    for (const f of findings) {
      console.log(`  ${severityIcon[f.severity]} [${f.severity}] ${f.rule}`)
      console.log(`     File: ${f.file}:${f.line}`)
      console.log(`     Code: ${f.code.substring(0, 120)}${f.code.length > 120 ? '...' : ''}`)
      console.log(`     ${f.message}`)
      console.log('')
    }
  }

  if (allFindings.length === 0) {
    console.log('┌──────────────────────────────────────────────────────────────┐')
    console.log('│  ✅ NO PRIVATE KEY LEAKS DETECTED                           │')
    console.log('│                                                              │')
    console.log('│  All checks passed:                                          │')
    console.log('│  • No private key in network calls                           │')
    console.log('│  • No private key in logging statements                      │')
    console.log('│  • No private key in analytics/crash reporting               │')
    console.log('│  • No private key in insecure storage                        │')
    console.log('│  • No private key in IPC/WebView/postMessage                 │')
    console.log('│  • Remote logging properly sanitized                         │')
    console.log('│  • No suspicious JSON.stringify with keys                    │')
    console.log('└──────────────────────────────────────────────────────────────┘')
  } else {
    console.log('┌──────────────────────────────────────────────────────────────┐')
    console.log('│  ⚠️  FINDINGS DETECTED                                      │')
    console.log('└──────────────────────────────────────────────────────────────┘')
    console.log('')
    console.log(`  Total: ${allFindings.length} finding(s)`)
    console.log(`  🔴 Critical: ${bySeverity[SEVERITY.CRITICAL].length}`)
    console.log(`  🟠 High:     ${bySeverity[SEVERITY.HIGH].length}`)
    console.log(`  🟡 Medium:   ${bySeverity[SEVERITY.MEDIUM].length}`)
    console.log(`  🔵 Low:      ${bySeverity[SEVERITY.LOW].length}`)
    console.log('')

    for (const severity of [SEVERITY.CRITICAL, SEVERITY.HIGH, SEVERITY.MEDIUM, SEVERITY.LOW, SEVERITY.INFO]) {
      if (bySeverity[severity].length > 0) {
        console.log(`── ${severity} (${bySeverity[severity].length}) ${'─'.repeat(50 - severity.length)}`)
        console.log('')
        printFindings(bySeverity[severity])
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
  console.log('──────────────────────────────────────────────────────────────')
  console.log(`  Scanned ${files.length} files in ${elapsed}s`)
  console.log('──────────────────────────────────────────────────────────────')
  console.log('')

  // Exit with error code if CRITICAL findings
  if (bySeverity[SEVERITY.CRITICAL].length > 0) {
    process.exit(1)
  }
}

runAudit()
