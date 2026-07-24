import { Buffer } from 'buffer'
import DeviceInfo from 'react-native-device-info'
import {
  randomBytes,
  derivePbkdf2,
  encryptAesGcm,
  decryptAesGcm,
  SALT_LENGTH,
  PBKDF2_ITERATIONS_DEFAULT,
  KDF_ALGO_NAME,
  CIPHER_ALGO_NAME
} from './cryptoVault'

// v2 backup file format. The whole top-level object IS the envelope —
// kdf + cipher meta plus the encrypted ciphertext live alongside each other,
// so a parser has everything it needs in one place to decrypt.
//
// Decrypted ciphertext is a JSON object with `schemaVersion` + payload fields
// (accounts, activeEvmChainIds, accountTokenList, ...). The payload schema
// version is independent from the envelope version — bump payload version when
// fields change, bump envelope version when crypto changes.
//
// Legacy backup files (older AES-encrypted format) have no `envelope`
// key — detectBackupFormat() routes by inspecting top-level structure.

export const BACKUP_MAGIC = 'KEYRING_BACKUP'
export const ENVELOPE_VERSION = 2
export const PAYLOAD_SCHEMA_VERSION = 1

/**
 * Create an encrypted backup file string.
 *
 * @param {object} args
 * @param {string} args.password user-entered backup password
 * @param {object} args.walletData decrypted payload (must NOT include schemaVersion — added here)
 * @returns {Promise<string>} JSON string ready to write to disk
 */
export const createBackupV2 = async ({ password, walletData }) => {
  if (!password) throw new Error('Backup password is required')
  if (!walletData || typeof walletData !== 'object') throw new Error('walletData must be an object')

  const salt = randomBytes(SALT_LENGTH)
  const key = await derivePbkdf2(password, salt, PBKDF2_ITERATIONS_DEFAULT)

  const payload = { schemaVersion: PAYLOAD_SCHEMA_VERSION, ...walletData }
  const { iv, tag, ciphertext } = encryptAesGcm(JSON.stringify(payload), key)

  const envelope = {
    magic: BACKUP_MAGIC,
    version: ENVELOPE_VERSION,
    createdAt: new Date().toISOString(),
    appVersion: `${DeviceInfo.getVersion()} (${DeviceInfo.getBuildNumber()})`,
    kdf: {
      algo: KDF_ALGO_NAME,
      iterations: PBKDF2_ITERATIONS_DEFAULT,
      salt: salt.toString('base64')
    },
    cipher: {
      algo: CIPHER_ALGO_NAME,
      iv: iv.toString('base64'),
      tag: tag.toString('base64')
    },
    ciphertext: ciphertext.toString('base64')
  }

  return JSON.stringify({ envelope })
}

/**
 * Decrypt + parse a v2 backup file. Returns the walletData payload (without the
 * schemaVersion wrapper key — caller checks payload.schemaVersion separately).
 *
 * @param {object} args
 * @param {string} args.content raw file content
 * @param {string} args.password user-entered password
 * @returns {Promise<object>} { schemaVersion, accounts, ... }
 * @throws on bad magic / unsupported version / wrong password (auth tag mismatch)
 */
export const parseBackupV2 = async ({ content, password }) => {
  if (!password) throw new Error('Backup password is required')
  const parsed = JSON.parse(content)
  const env = parsed?.envelope
  if (!env || env.magic !== BACKUP_MAGIC) throw new Error('Not a v2 backup file')
  if (env.version !== ENVELOPE_VERSION) throw new Error(`Unsupported envelope version: ${env.version}`)

  const key = await derivePbkdf2(
    password,
    Buffer.from(env.kdf.salt, 'base64'),
    env.kdf.iterations
  )
  const plaintext = decryptAesGcm({
    iv: Buffer.from(env.cipher.iv, 'base64'),
    tag: Buffer.from(env.cipher.tag, 'base64'),
    ciphertext: Buffer.from(env.ciphertext, 'base64')
  }, key)
  return JSON.parse(plaintext)
}

/**
 * Inspect file content (without decrypting) to decide which restore path to use.
 * Legacy files use the older AES-encrypted format — they are not JSON
 * with a top-level `envelope` key.
 *
 * @param {string} content
 * @returns {'v2' | 'legacy'}
 */
export const detectBackupFormat = (content) => {
  try {
    const parsed = JSON.parse(content)
    if (parsed?.envelope?.magic === BACKUP_MAGIC) return 'v2'
  } catch (error) {
    // Legacy files aren't valid JSON — fall through.
  }
  return 'legacy'
}
