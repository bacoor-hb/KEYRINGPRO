import QuickCrypto from 'react-native-quick-crypto'
import { Buffer } from 'buffer'

// Shared low-level crypto primitives for PBKDF2-SHA512 key derivation and
// AES-256-GCM authenticated encryption. Used by:
//  - secureVault (per-entry encryption inside LIST_PRIVATE_KEY_BY_ADDRESS)
//  - backup (whole-file encryption for the v2 backup envelope)
//
// Callers wrap these in their own envelope/storage shape. This module exposes
// raw Buffer outputs so each caller can encode (base64 / hex / nested object)
// however suits their format.

export const PBKDF2_ITERATIONS_DEFAULT = 900000
export const KEY_LENGTH = 32
export const SALT_LENGTH = 32
export const IV_LENGTH = 12
export const DIGEST = 'sha512'
export const CIPHER_ALGO = 'aes-256-gcm'
export const KDF_ALGO_NAME = 'PBKDF2-SHA512'
export const CIPHER_ALGO_NAME = 'AES-256-GCM'

export const randomBytes = (n) => QuickCrypto.randomBytes(n)

export const derivePbkdf2 = (password, salt, iterations = PBKDF2_ITERATIONS_DEFAULT) => {
  return new Promise((resolve, reject) => {
    QuickCrypto.pbkdf2(password, salt, iterations, KEY_LENGTH, DIGEST, (err, key) => {
      if (err) return reject(err)
      resolve(key)
    })
  })
}

export const encryptAesGcm = (plaintext, key) => {
  const iv = QuickCrypto.randomBytes(IV_LENGTH)
  const cipher = QuickCrypto.createCipheriv(CIPHER_ALGO, key, iv)
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(plaintext, 'utf8')), cipher.final()])
  const tag = cipher.getAuthTag()
  return { iv, tag, ciphertext }
}

export const decryptAesGcm = ({ iv, tag, ciphertext }, key) => {
  const decipher = QuickCrypto.createDecipheriv(CIPHER_ALGO, key, iv)
  decipher.setAuthTag(tag)
  const dec = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return dec.toString('utf8')
}
