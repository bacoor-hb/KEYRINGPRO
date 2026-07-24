/* eslint-disable no-undef */
// Inline the function to avoid importing the entire function.js module
// which has many native/RN dependencies that don't work in a Jest environment.
// This must be kept in sync with the implementation in src/Common/function.js
const removeSensitiveKeysFromString = (text) => {
  return (text || '')
    // EVM private key: 0x + 64 hex chars OR standalone 64 hex chars
    .replace(/(?:0x)?[A-Fa-f0-9]{64,}/g, '[REDACTED]')
    // Solana secret key: base58, 87-88 chars
    .replace(/[1-9A-HJ-NP-Za-km-z]{87,}/g, '[REDACTED]')
    // Bitcoin WIF key: starts with L, K, or 5, 51-52 base58 chars
    .replace(/[LK5][1-9A-HJ-NP-Za-km-z]{50,}/g, '[REDACTED]')
}

// ==================== SAMPLE KEYS FOR TESTING ====================
// These are NOT real keys - generated for testing purposes only

// EVM private key (64 hex chars, no 0x)
const EVM_KEY_NO_PREFIX = '8aea06658833a591045283412f3682b768a76fd792835ef0d9b6cb811f348a29'
// EVM private key (66 chars, with 0x)
const EVM_KEY_WITH_PREFIX = '0x8aea06658833a591045283412f3682b768a76fd792835ef0d9b6cb811f348a29'
// Solana secret key (88 base58 chars)
const SOLANA_KEY_88 = '3n5yAeTVZxfBASDApGw8y4gAMmPmpCJRYPfnwQc7S3ZBT6kMpLPqk5bsMTuLcoomgowp11P44aVP5G9wY9kQo4iD'
// Solana secret key (87 base58 chars)
const SOLANA_KEY_87 = 'wBqpZM9xaSheZzJSMawUHDgZ7miWfSsxmfVF5BJKgbKz4MNEVTeBFJLpBwUQkKhXiJEYXmVSMSPeZnGpSNNMCKq'
// Bitcoin WIF key compressed (52 chars, starts with K)
const BTC_WIF_K = 'KwDiBf89QgGbjEhKnhXJuH7LrciVrZi3qYjgd9M7rFU73sVHnoWn'
// Bitcoin WIF key compressed (52 chars, starts with L)
const BTC_WIF_L = 'L1sjyrfaupUt8hF4gbQ4CaXYgo7BnwcmEn3fShRpFHJg88rWa9N9'
// Bitcoin WIF key uncompressed (51 chars, starts with 5)
const BTC_WIF_5 = '5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ'

describe('removeSensitiveKeysFromString', () => {
  // ==================== NULL / EMPTY INPUT ====================
  describe('handles null/empty input', () => {
    it('should return empty string for null', () => {
      expect(removeSensitiveKeysFromString(null)).toBe('')
    })

    it('should return empty string for undefined', () => {
      expect(removeSensitiveKeysFromString(undefined)).toBe('')
    })

    it('should return empty string for empty string', () => {
      expect(removeSensitiveKeysFromString('')).toBe('')
    })
  })

  // ==================== SAFE TEXT (NO REDACTION) ====================
  describe('does NOT redact safe text', () => {
    it('should not redact normal error messages', () => {
      const msg = 'Error: network timeout at https://rpc.example.com'
      expect(removeSensitiveKeysFromString(msg)).toBe(msg)
    })

    it('should not redact short hex strings', () => {
      const msg = 'tx hash: 0xabcdef1234567890'
      expect(removeSensitiveKeysFromString(msg)).toBe(msg)
    })

    it('should not redact Ethereum addresses (40 hex chars)', () => {
      const msg = 'from address: 0xb8b64a283394855cd61d5e4229aee7276b2f55e2'
      expect(removeSensitiveKeysFromString(msg)).toBe(msg)
    })

    it('should not redact normal page names or device info', () => {
      const msg = 'Page: HomeScreen, Device: iPhone 15 Pro'
      expect(removeSensitiveKeysFromString(msg)).toBe(msg)
    })

    it('should not redact short base58 strings', () => {
      const msg = 'address: 7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y'
      expect(removeSensitiveKeysFromString(msg)).toBe(msg)
    })
  })

  // ==================== EVM PRIVATE KEY ====================
  describe('redacts EVM private keys', () => {
    it('should redact 64 hex chars without 0x prefix', () => {
      const msg = `Error with key ${EVM_KEY_NO_PREFIX} failed`
      expect(removeSensitiveKeysFromString(msg)).toBe('Error with key [REDACTED] failed')
    })

    it('should redact 66 chars with 0x prefix', () => {
      const msg = `Error with key ${EVM_KEY_WITH_PREFIX} failed`
      expect(removeSensitiveKeysFromString(msg)).toBe('Error with key [REDACTED] failed')
    })

    it('should redact EVM key at start of string', () => {
      const msg = `${EVM_KEY_NO_PREFIX} caused error`
      expect(removeSensitiveKeysFromString(msg)).toBe('[REDACTED] caused error')
    })

    it('should redact EVM key at end of string', () => {
      const msg = `error key: ${EVM_KEY_WITH_PREFIX}`
      expect(removeSensitiveKeysFromString(msg)).toBe('error key: [REDACTED]')
    })

    it('should redact EVM key concatenated with colon (no space)', () => {
      const msg = `key:${EVM_KEY_NO_PREFIX}`
      expect(removeSensitiveKeysFromString(msg)).toBe('key:[REDACTED]')
    })

    it('should redact EVM key concatenated with equals sign', () => {
      const msg = `privateKey=${EVM_KEY_NO_PREFIX}`
      expect(removeSensitiveKeysFromString(msg)).toBe('privateKey=[REDACTED]')
    })

    it('should redact multiple EVM keys in one string', () => {
      const msg = `key1: ${EVM_KEY_NO_PREFIX} key2: ${EVM_KEY_WITH_PREFIX}`
      expect(removeSensitiveKeysFromString(msg)).toBe('key1: [REDACTED] key2: [REDACTED]')
    })

    it('should redact EVM key embedded in JSON-like string', () => {
      const msg = `{"privateKey":"${EVM_KEY_NO_PREFIX}","address":"0xabc"}`
      expect(removeSensitiveKeysFromString(msg)).toBe('{"privateKey":"[REDACTED]","address":"0xabc"}')
    })
  })

  // ==================== SOLANA SECRET KEY ====================
  describe('redacts Solana secret keys', () => {
    it('should redact 88-char Solana key', () => {
      const msg = `Solana error: ${SOLANA_KEY_88}`
      expect(removeSensitiveKeysFromString(msg)).toBe('Solana error: [REDACTED]')
    })

    it('should redact 87-char Solana key', () => {
      const msg = `Solana error: ${SOLANA_KEY_87}`
      expect(removeSensitiveKeysFromString(msg)).toBe('Solana error: [REDACTED]')
    })

    it('should redact Solana key without space separator', () => {
      const msg = `key=${SOLANA_KEY_88}`
      expect(removeSensitiveKeysFromString(msg)).toBe('key=[REDACTED]')
    })

    it('should redact Solana key in JSON-like string', () => {
      const msg = `{"secretKey":"${SOLANA_KEY_88}"}`
      expect(removeSensitiveKeysFromString(msg)).toBe('{"secretKey":"[REDACTED]"}')
    })
  })

  // ==================== BITCOIN WIF KEY ====================
  describe('redacts Bitcoin WIF keys', () => {
    it('should redact WIF key starting with K (52 chars)', () => {
      const msg = `BTC key: ${BTC_WIF_K}`
      expect(removeSensitiveKeysFromString(msg)).toBe('BTC key: [REDACTED]')
    })

    it('should redact WIF key starting with L (52 chars)', () => {
      const msg = `BTC key: ${BTC_WIF_L}`
      expect(removeSensitiveKeysFromString(msg)).toBe('BTC key: [REDACTED]')
    })

    it('should redact WIF key starting with 5 (51 chars)', () => {
      const msg = `BTC key: ${BTC_WIF_5}`
      expect(removeSensitiveKeysFromString(msg)).toBe('BTC key: [REDACTED]')
    })

    it('should redact WIF key without space separator', () => {
      const msg = `wif=${BTC_WIF_K}`
      expect(removeSensitiveKeysFromString(msg)).toBe('wif=[REDACTED]')
    })

    it('should redact WIF key in JSON-like string', () => {
      const msg = `{"wifKey":"${BTC_WIF_L}"}`
      expect(removeSensitiveKeysFromString(msg)).toBe('{"wifKey":"[REDACTED]"}')
    })
  })

  // ==================== MIXED / MULTIPLE KEYS ====================
  describe('handles mixed key types', () => {
    it('should redact EVM + Solana keys in same string', () => {
      const msg = `evm: ${EVM_KEY_NO_PREFIX} sol: ${SOLANA_KEY_88}`
      const result = removeSensitiveKeysFromString(msg)
      expect(result).not.toContain(EVM_KEY_NO_PREFIX)
      expect(result).not.toContain(SOLANA_KEY_88)
    })

    it('should redact EVM + BTC keys in same string', () => {
      const msg = `evm: ${EVM_KEY_WITH_PREFIX} btc: ${BTC_WIF_K}`
      const result = removeSensitiveKeysFromString(msg)
      expect(result).not.toContain(EVM_KEY_WITH_PREFIX)
      expect(result).not.toContain(BTC_WIF_K)
    })

    it('should redact all 3 key types in one string', () => {
      const msg = `evm:${EVM_KEY_NO_PREFIX} sol:${SOLANA_KEY_88} btc:${BTC_WIF_5}`
      const result = removeSensitiveKeysFromString(msg)
      expect(result).not.toContain(EVM_KEY_NO_PREFIX)
      expect(result).not.toContain(SOLANA_KEY_88)
      expect(result).not.toContain(BTC_WIF_5)
    })
  })

  // ==================== EDGE CASES ====================
  describe('edge cases', () => {
    it('should redact key embedded in error stack trace', () => {
      const msg = `TypeError: Cannot read property of undefined\n    at signTransaction (key=${EVM_KEY_NO_PREFIX})\n    at Object.send`
      expect(removeSensitiveKeysFromString(msg)).not.toContain(EVM_KEY_NO_PREFIX)
    })

    it('should redact key in URL-like string', () => {
      const msg = `https://example.com/api?key=${EVM_KEY_NO_PREFIX}&chain=1`
      expect(removeSensitiveKeysFromString(msg)).not.toContain(EVM_KEY_NO_PREFIX)
    })

    it('should redact key adjacent to other word chars', () => {
      const msg = `errorKey${EVM_KEY_NO_PREFIX}endOfMsg`
      expect(removeSensitiveKeysFromString(msg)).not.toContain(EVM_KEY_NO_PREFIX)
    })

    it('should handle string with only a private key', () => {
      expect(removeSensitiveKeysFromString(EVM_KEY_NO_PREFIX)).toBe('[REDACTED]')
      expect(removeSensitiveKeysFromString(EVM_KEY_WITH_PREFIX)).toBe('[REDACTED]')
      expect(removeSensitiveKeysFromString(SOLANA_KEY_88)).toBe('[REDACTED]')
      expect(removeSensitiveKeysFromString(BTC_WIF_K)).toBe('[REDACTED]')
    })

    it('should preserve surrounding text after redaction', () => {
      const msg = `[ERROR] key=${EVM_KEY_NO_PREFIX} on page=HomeScreen`
      const result = removeSensitiveKeysFromString(msg)
      expect(result).toContain('[ERROR]')
      expect(result).toContain('on page=HomeScreen')
      expect(result).not.toContain(EVM_KEY_NO_PREFIX)
    })

    it('should handle crash report format', () => {
      const crashMsg = `
        **************** iOS [5.4.0 - 100] ****************
        Device Name: iPhone
        Error Name: TypeError
        Error Message: invalid key ${EVM_KEY_WITH_PREFIX}
        Error Stack: at func (file.js:10)
        ****************
      `
      const result = removeSensitiveKeysFromString(crashMsg)
      expect(result).not.toContain(EVM_KEY_WITH_PREFIX)
      expect(result).toContain('Device Name: iPhone')
      expect(result).toContain('TypeError')
    })
  })
})
