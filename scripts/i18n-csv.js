#!/usr/bin/env node
/**
 * i18n CSV export/import for src/Assets/Lang/Translations<LANG>.js
 *
 * Usage:
 *   node scripts/i18n-csv.js export JP   # Translations{EN,JP}.js -> TranslationsJP.csv
 *   node scripts/i18n-csv.js import JP   # TranslationsJP.csv        -> TranslationsJP.js
 *
 * CSV columns: Key, English (reference), <LANG>
 *  - Key   : dotted path into the nested object (e.g. v2.common.max). Do NOT edit.
 *  - English: source string for reference. Editing it has no effect on import.
 *  - <LANG>: the column the translation team fills in. This is what import writes back.
 *
 * Notes:
 *  - Import MERGES onto the current Translations<LANG>.js: only keys present in the
 *    CSV are updated/added; keys the CSV doesn't carry (e.g. added by dev after the
 *    CSV was exported) are kept, so they don't get lost on round-trip.
 *  - Rows whose <LANG> cell is empty are skipped -> the existing value is kept
 *    (an empty cell never blanks/removes an already-translated key).
 *  - Array values are exported as a JSON string ("[...]") and parsed back on import.
 *  - CSV is UTF-8 with BOM so Excel shows non-latin text correctly.
 */
const fs = require('fs')
const path = require('path')

const LANG_DIR = process.env.LANG_DIR || path.join(__dirname, '..', 'src', 'Assets', 'Lang')

function loadTranslations (lang) {
  const file = path.join(LANG_DIR, `Translations${lang}.js`)
  if (!fs.existsSync(file)) return {} // new language with no file yet -> merge onto empty base
  const src = fs.readFileSync(file, 'utf8')
    .replace(/^\/\/.*\n/, '') // drop a leading banner comment if present
    .replace(/export\s+default\s*/, 'module.exports = ')
  const m = { exports: {} }
  new Function('module', 'exports', src)(m, m.exports) // eslint-disable-line no-new-func
  return m.exports
}

function flatten (obj, prefix, out) {
  for (const key of Object.keys(obj)) {
    const val = obj[key]
    const full = prefix ? `${prefix}.${key}` : key
    if (val && typeof val === 'object' && !Array.isArray(val)) flatten(val, full, out)
    else out[full] = Array.isArray(val) ? JSON.stringify(val) : String(val)
  }
}

function csvEscape (s) {
  s = String(s == null ? '' : s)
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

function parseCsv (text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  const rows = []
  let row = []
  let field = ''
  let i = 0
  let inQuotes = false
  while (i < text.length) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue }
        inQuotes = false; i++; continue
      }
      field += c; i++; continue
    }
    if (c === '"') { inQuotes = true; i++; continue }
    if (c === ',') { row.push(field); field = ''; i++; continue }
    if (c === '\r') { i++; continue }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue }
    field += c; i++
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows
}

function setDeep (obj, dottedKey, value) {
  const parts = dottedKey.split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]
    if (typeof cur[p] !== 'object' || cur[p] === null) cur[p] = {}
    cur = cur[p]
  }
  cur[parts[parts.length - 1]] = value
}

// U+2028/U+2029 are legal in ES2019+ string literals, so only \\ ' CR LF need escaping.
function jsQuote (s) {
  s = String(s)
  // Prefer double quotes when the text has an apostrophe but no double quote,
  // so "You agree to {{name}}'s" stays clean instead of becoming '...\'s'.
  const useDouble = s.includes("'") && !s.includes('"')
  const quote = useDouble ? '"' : "'"
  let body = s
    .replace(/\\/g, '\\\\')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
  body = useDouble ? body.replace(/"/g, '\\"') : body.replace(/'/g, "\\'")
  return quote + body + quote
}

function serialize (val, indent) {
  const pad = '  '.repeat(indent)
  const padIn = '  '.repeat(indent + 1)
  if (Array.isArray(val)) {
    if (!val.length) return '[]'
    return '[\n' + val.map(v => padIn + serialize(v, indent + 1)).join(',\n') + '\n' + pad + ']'
  }
  if (val && typeof val === 'object') {
    const keys = Object.keys(val)
    if (!keys.length) return '{}'
    return '{\n' + keys.map(k => padIn + k + ': ' + serialize(val[k], indent + 1)).join(',\n') + '\n' + pad + '}'
  }
  return jsQuote(val)
}

function doExport (lang) {
  const en = {}
  const target = {}
  flatten(loadTranslations('EN'), '', en)
  flatten(loadTranslations(lang), '', target)

  // target order first, then any EN-only keys (need translating) appended
  const keys = []
  const seen = new Set()
  for (const k of Object.keys(target)) { keys.push(k); seen.add(k) }
  for (const k of Object.keys(en)) if (!seen.has(k)) keys.push(k)

  const rows = [`Key,English,${lang}`]
  for (const k of keys) rows.push([csvEscape(k), csvEscape(en[k]), csvEscape(target[k])].join(','))

  const outPath = path.join(LANG_DIR, `Translations${lang}.csv`)
  fs.writeFileSync(outPath, '﻿' + rows.join('\r\n') + '\r\n', 'utf8')
  const missing = keys.filter(k => target[k] === undefined).length
  console.log(`Exported ${outPath}\n  rows: ${keys.length} | untranslated (empty ${lang}): ${missing}`)
}

function doImport (lang) {
  const csvPath = path.join(LANG_DIR, `Translations${lang}.csv`)
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'))
  const header = rows.shift()
  const keyIdx = header.indexOf('Key')
  const valIdx = header.indexOf(lang)
  if (keyIdx < 0 || valIdx < 0) throw new Error(`CSV must have "Key" and "${lang}" columns`)

  // Merge onto the CURRENT file, not a blank object: keys the CSV doesn't carry
  // (e.g. added by dev after the CSV was exported) survive the round-trip.
  const out = loadTranslations(lang)
  let count = 0
  let skipped = 0
  for (const r of rows) {
    const key = r[keyIdx]
    let val = r[valIdx]
    if (!key) continue
    if (val === undefined || val === '') { skipped++; continue } // empty cell -> keep existing value
    val = val.replace(/\r\n?/g, '\n') // normalize editor CRLF -> LF
    if (/^\[[\s\S]*\]$/.test(val.trim())) {
      try { val = JSON.parse(val) } catch (e) { /* keep as string */ }
    }
    setDeep(out, key, val)
    count++
  }

  const outPath = path.join(LANG_DIR, `Translations${lang}.js`)
  const banner = `// Auto-generated from Translations${lang}.csv by scripts/i18n-csv.js\n`
  fs.writeFileSync(outPath, banner + 'export default ' + serialize(out, 0) + '\n', 'utf8')
  console.log(`Imported ${outPath}\n  keys written: ${count} | skipped (empty): ${skipped}`)
}

// --- all-languages mode: one wide CSV with a column per language ---
const ALL_CSV = 'TranslationsALL.csv'

function listLangs () {
  // EN first (source), then the rest alphabetically
  const langs = fs.readdirSync(LANG_DIR)
    .map(f => (f.match(/^Translations([A-Za-z0-9]+)\.js$/) || [])[1])
    .filter(Boolean)
    .sort()
  return ['EN', ...langs.filter(l => l !== 'EN')]
}

function doExportAll () {
  const langs = listLangs()
  const flat = {}
  for (const l of langs) { flat[l] = {}; flatten(loadTranslations(l), '', flat[l]) }

  // key union: EN order first, then any extra keys from other languages
  const keys = []
  const seen = new Set()
  for (const l of langs) {
    for (const k of Object.keys(flat[l])) if (!seen.has(k)) { keys.push(k); seen.add(k) }
  }

  const rows = [['Key', ...langs].map(csvEscape).join(',')]
  for (const k of keys) rows.push([csvEscape(k), ...langs.map(l => csvEscape(flat[l][k]))].join(','))

  const outPath = path.join(LANG_DIR, ALL_CSV)
  fs.writeFileSync(outPath, '﻿' + rows.join('\r\n') + '\r\n', 'utf8')
  const missing = langs.map(l => `${l}:${keys.filter(k => flat[l][k] === undefined).length}`).join(' ')
  console.log(`Exported ${outPath}\n  rows: ${keys.length} | langs: ${langs.length}\n  untranslated per lang -> ${missing}`)
}

function doImportAll () {
  const rows = parseCsv(fs.readFileSync(path.join(LANG_DIR, ALL_CSV), 'utf8'))
  const header = rows.shift()
  const keyIdx = header.indexOf('Key')
  if (keyIdx < 0) throw new Error('CSV must have a "Key" column')
  const langCols = header.map((h, i) => ({ lang: h, i })).filter(c => c.i !== keyIdx && c.lang)

  for (const { lang, i } of langCols) {
    // Merge onto the current file so dev-added keys missing from the CSV survive.
    const out = loadTranslations(lang)
    let count = 0
    for (const r of rows) {
      const key = r[keyIdx]
      let val = r[i]
      if (!key || val === undefined || val === '') continue // empty cell -> keep existing value
      val = val.replace(/\r\n?/g, '\n')
      if (/^\[[\s\S]*\]$/.test(val.trim())) {
        try { val = JSON.parse(val) } catch (e) { /* keep as string */ }
      }
      setDeep(out, key, val)
      count++
    }
    const outPath = path.join(LANG_DIR, `Translations${lang}.js`)
    const banner = `// Auto-generated from ${ALL_CSV} by scripts/i18n-csv.js\n`
    fs.writeFileSync(outPath, banner + 'export default ' + serialize(out, 0) + '\n', 'utf8')
    console.log(`Imported ${outPath}  (${count} keys)`)
  }
}

const [mode, lang] = process.argv.slice(2)
if (!mode || !lang || !['export', 'import'].includes(mode)) {
  console.error('Usage:\n  node scripts/i18n-csv.js <export|import> <LANG>   e.g. export JP\n  node scripts/i18n-csv.js <export|import> all       (all languages, one wide CSV)')
  process.exit(1)
}
if (lang.toLowerCase() === 'all') {
  if (mode === 'export') doExportAll()
  else doImportAll()
} else if (mode === 'export') doExport(lang)
else doImport(lang)
