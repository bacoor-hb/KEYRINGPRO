import ReduxService from './redux'
import { deepRemoveFields, isObject, isValidEVMAddressFormat, lowerCase } from './function'
import { chainType } from './constants/chain'
import { getDataFromSecureStorage, storeDataToSecureStorage } from './storage/secureStorage'
import { KEYSTORE } from './constants/redux'
import {
  hasPassword as vaultHasPassword,
  isUnlocked as vaultIsUnlocked,
  isEncryptedEntry,
  encryptPrivateKey as vaultEncryptPrivateKey,
  decryptPrivateKey as vaultDecryptPrivateKey,
  requestUnlock as vaultRequestUnlock
} from './secureVault'
import { STANDARD_CHAIN } from './constants/app'
import { ACCOUNT_TYPE } from './constants/account'

/**
 * Derive an account's `accountType` from its (possibly legacy) flags.
 *  - An account that already carries `accountType` keeps it (idempotent — safe
 *    to run on re-migration or on backups produced by newer app versions).
 *  - `isFromKeyCard` ⇒ COLD (key lives on an external NFC keycard).
 *  - otherwise ⇒ HOT (private key generated/imported on-device).
 * VIEW_ONLY is never derived here — that flag never existed on legacy data, so
 * it is only set explicitly when the user imports a watch-only address.
 *
 * @param {object} account a single accountListRedux item
 * @returns {string} one of ACCOUNT_TYPE
 */
export const resolveAccountType = (account) => {
  if (account?.accountType) return account.accountType
  if (account?.isFromKeyCard) return ACCOUNT_TYPE.COLD
  return ACCOUNT_TYPE.HOT
}

/**
 * Register an EVM address as a view-only account (no private key held). Mirrors
 * the other account builders (createNewWalletDataV2 / importPrivateKey) but
 * never touches secure storage — there's no key to store.
 *
 * @param {string} address an EVM address (0x…40 hex)
 * @param {string} accountName display name
 * @returns {object|null} the account entry, or null on invalid/duplicate address
 */
export const registerViewOnlyAccount = (address, accountName) => {
  try {
    if (!isValidEVMAddressFormat(address)) return null
    const addressLower = lowerCase(address)

    const currentAccountList = ReduxService.getAccountList() || []
    // Skip if this address is already tracked (any account type).
    if (currentAccountList.some((a) => lowerCase(a?.address) === addressLower)) return null

    const accountData = {
      chain: STANDARD_CHAIN.Evm,
      address: addressLower,
      name: accountName,
      status: true,
      accountType: ACCOUNT_TYPE.VIEW_ONLY
    }

    ReduxService.setAccountList([...currentAccountList, accountData])
    return accountData
  } catch (e) {
    return null
  }
}

/**
 *
 * @param {string} url Ex: https://keyring.app/open-keyring-app?function=export_key_from_nfc
 * @returns
 */
export const isExportKeyFromNfc = (url) => {
  return (url || '').includes('open-keyring-app?function=export_key_from_nfc')
}

export const remove0xFromPrivateKey = (privateKey) => {
  try {
    const isNeedCut = privateKey.startsWith('0x')
    if (isNeedCut) return privateKey.substring(2, privateKey.length)
    return privateKey
  } catch (error) {
    return privateKey
  }
}

export const add0xToPrivateKey = (privateKey) => {
  try {
    const isNeedAdd = !privateKey.startsWith('0x')
    if (isNeedAdd) return '0x' + privateKey
    return privateKey
  } catch (error) {
    return privateKey
  }
}

/**
 * Resolve an account's private key by address.
 * Reads from the dedicated LIST_PRIVATE_KEY_BY_ADDRESS secure store first
 * (decrypting the entry when it is vault-encrypted), and falls back to the
 * privateKey field on the account list when there is no dedicated entry.
 *
 * @param {*} address
 * @param {boolean} [include0x]
 * @returns {string}
 */
export const getPrivateKeyByAddress = (address, include0x = false) => {
  try {
    let privateKey = ''

    // [1st priority] Try to get private key from LIST_PRIVATE_KEY_BY_ADDRESS in secure storage if exist
    const listPrivateKeyByAddress = getDataFromSecureStorage(KEYSTORE.LIST_PRIVATE_KEY_BY_ADDRESS, {})
    const entry = listPrivateKeyByAddress?.[lowerCase(address)]

    if (isEncryptedEntry(entry)) {
      if (!vaultIsUnlocked()) {
        vaultRequestUnlock()
        return ''
      }
      try {
        privateKey = vaultDecryptPrivateKey(entry)
      } catch (e) {
        return ''
      }
    } else {
      privateKey = entry || ''
    }

    if (privateKey) {
      return include0x ? add0xToPrivateKey(privateKey) : remove0xFromPrivateKey(privateKey)
    }

    // Fallback: read the private key from the account list entry when there is
    // no dedicated LIST_PRIVATE_KEY_BY_ADDRESS entry.
    const accountListInSecureStorage = getDataFromSecureStorage(KEYSTORE.SET_ACCOUNT_LIST, [])

    const accountInfoFromSecureStorage = accountListInSecureStorage.find(account => lowerCase(account.address) === lowerCase(address))

    privateKey = accountInfoFromSecureStorage?.privateKey || ''

    return include0x ? add0xToPrivateKey(privateKey) : remove0xFromPrivateKey(privateKey)
  } catch (error) {
    return ''
  }
}

export const storePrivateKeyByAddress = (address, privateKey) => {
  try {
    const listPrivateKeyByAddress = getDataFromSecureStorage(KEYSTORE.LIST_PRIVATE_KEY_BY_ADDRESS, {})
    if (listPrivateKeyByAddress?.[lowerCase(address)]) {
      return true
    }

    let value = privateKey
    if (vaultHasPassword()) {
      if (!vaultIsUnlocked()) {
        vaultRequestUnlock()
        return false
      }
      value = vaultEncryptPrivateKey(privateKey)
    }

    listPrivateKeyByAddress[lowerCase(address)] = value
    storeDataToSecureStorage(KEYSTORE.LIST_PRIVATE_KEY_BY_ADDRESS, listPrivateKeyByAddress)
    return true
  } catch (error) {
    // throw error
    return false
  }
}

export const removePrivateKeyByAddress = (address) => {
  try {
    const listPrivateKeyByAddress = getDataFromSecureStorage(KEYSTORE.LIST_PRIVATE_KEY_BY_ADDRESS, {})
    if (listPrivateKeyByAddress?.[lowerCase(address)]) {
      delete listPrivateKeyByAddress[lowerCase(address)]
      storeDataToSecureStorage(KEYSTORE.LIST_PRIVATE_KEY_BY_ADDRESS, listPrivateKeyByAddress)
    }
    return true
  } catch (error) {
    // throw error
    return false
  }
}

/**
 * Does this account entry itself declare that its key lives on an NFC card?
 * Looks ONLY at the object handed in — nothing on this device — so it is also the
 * right question to ask of an entry coming from a backup file, where the device's
 * own account list says nothing about it.
 *
 * Two witnesses, and only two: `isFromKeyCard` (written by every app version) and
 * `accountType`, which is the V2 spelling of the same fact — old backups predate
 * it, newer ones carry both. `passwordFile` is NOT consulted even though it has
 * always been written alongside isFromKeyCard: that pairing is a convention, not
 * an invariant (importPrivateKey takes the two as independent arguments), and a
 * false positive here is unrecoverable — the account would demand a tap from a
 * card that does not exist, and a restore would drop its key for good.
 *
 * @param {object} account a single account entry
 * @returns {boolean}
 */
export const hasKeyCardFlags = (account) => {
  return !!(account && (account.isFromKeyCard || account.accountType === ACCOUNT_TYPE.COLD))
}

/**
 * Is this account's private key held on an external NFC keycard (⇒ every signing
 * or key-reading flow must ask for a card tap)?
 *
 * Accepts EITHER an account entry or a bare address, because the callers have
 * one or the other: the account screens hold the entry, the signing paths only
 * know the address they are signing for.
 *
 * Fail-closed by design: an address-only answer depends on a list lookup, and
 * that lookup can legitimately miss — legacy BTC/Solana entries carry a
 * `rootAddress` pointing at the EVM account of the same card, which the user
 * may have deleted. So when given an entry, ask the entry ITSELF first, then its
 * own address, and only then its root address. One source saying "keycard" is
 * enough.
 *
 * @param {object|string} accountOrAddress an accountListRedux entry, or an address
 * @returns {boolean}
 */
export const isAccountFromKeyCard = (accountOrAddress) => {
  try {
    if (!accountOrAddress) return false

    const accountListInSecureStorage = getDataFromSecureStorage(KEYSTORE.SET_ACCOUNT_LIST, [])
    const findByAddress = (address) => {
      if (!address) return null
      return accountListInSecureStorage.find(account => lowerCase(account.address) === lowerCase(address))
    }

    if (typeof accountOrAddress === 'string') {
      return hasKeyCardFlags(findByAddress(accountOrAddress))
    }

    const account = accountOrAddress
    if (hasKeyCardFlags(account)) return true
    if (hasKeyCardFlags(findByAddress(account.address))) return true
    // Root = the EVM account of the same card. Checked last, and only as a hint:
    // it may well have been deleted, which is precisely why the entry's own flags
    // are consulted above rather than trusting this lookup alone.
    if (account.rootAddress && lowerCase(account.rootAddress) !== lowerCase(account.address)) {
      return hasKeyCardFlags(findByAddress(account.rootAddress))
    }
    return false
  } catch (error) {
    return false
  }
}

export const getKeyCardPassword = (address) => {
  try {
    const accountListInSecureStorage = getDataFromSecureStorage(KEYSTORE.SET_ACCOUNT_LIST, [])

    const accountInfoFromSecureStorage = accountListInSecureStorage.find(account => lowerCase(account.address) === lowerCase(address))

    return accountInfoFromSecureStorage?.passwordFile || ''
  } catch (error) {
    // throw error
    return ''
  }
}

/**
 * Move any private keys stored on the account list into the dedicated
 * KEYSTORE.LIST_PRIVATE_KEY_BY_ADDRESS secure store, then strip the privateKey
 * field from the account list / WalletConnect entries. No-op once migrated.
 */
export const migratePrivateKeyToSeparateSecureDataInSecureStorage = async () => {
  try {
    const listAccountRedux = getDataFromSecureStorage(KEYSTORE.SET_ACCOUNT_LIST, [])

    const isExistingPrivateKeyToMigrate = listAccountRedux.some((account) => {
      return account.privateKey
    })

    // Case already migrated => ignore
    if (!isExistingPrivateKeyToMigrate) {
      return
    }

    let listPrivateKeyByAddress = getDataFromSecureStorage(KEYSTORE.LIST_PRIVATE_KEY_BY_ADDRESS, {})

    if (!isObject(listPrivateKeyByAddress)) {
      listPrivateKeyByAddress = {}
    }

    // Get list private key from key SET_ACCOUNT_LIST (accountListRedux)
    // to store it to SecureStorage with key LIST_PRIVATE_KEY_BY_ADDRESS
    (listAccountRedux || []).forEach((account) => {
      const addressLowerCase = lowerCase(account?.address || '')
      if (!listPrivateKeyByAddress?.[addressLowerCase] && account?.privateKey) {
        listPrivateKeyByAddress[addressLowerCase] = account.privateKey
      }
    })

    // Store list private key to secure storage
    if (isObject(listPrivateKeyByAddress, true)) {
      const storeResult = storeDataToSecureStorage(KEYSTORE.LIST_PRIVATE_KEY_BY_ADDRESS, listPrivateKeyByAddress)
      const listPrivateKeyByAddressAfterStore = getDataFromSecureStorage(KEYSTORE.LIST_PRIVATE_KEY_BY_ADDRESS, {})

      // Reconfirm store result before removing privateKey field from accountListRedux
      if (storeResult && isObject(listPrivateKeyByAddressAfterStore, true)) {
        // Keys are now safely in the dedicated store, so strip the privateKey /
        // privateKeyInput fields from these entries.
        try {
          const listDataKeyForRemovePrivateKeyField = [
            KEYSTORE.SET_WALLET_CONNECT,
            KEYSTORE.SET_ACCOUNT_LIST
          ]

          for (const dataKey of listDataKeyForRemovePrivateKeyField) {
            const dataFromSecureStorage = getDataFromSecureStorage(dataKey, null)
            if (dataFromSecureStorage) {
              storeDataToSecureStorage(dataKey, deepRemoveFields(dataFromSecureStorage, ['privateKey', 'privateKeyInput']))
            }
          }
        } catch (error) {
          // do nothing
        }
      }
    }
  } catch (error) {
    // throw error
  }
}

/**
 * [v6.0.0 - UI big update] Migrate listAccountRedux to the new shape.
 *  - Keep btc / solana items as-is
 *  - Collapse all EVM items of the same address into a single item with chain = 'evm' (no chainId)
 *  - Collect every EVM chain seen into ACTIVE_EVM_CHAIN_IDS (e.g. [1, 137, 42161])
 *
 * Pure function — does not mutate input, does not persist anything.
 *
 * @param {Array} listAccount current accountListRedux value
 * @returns {{ migratedList: Array, activeEvmChainIds: number[] }}
 */
export const migrateAccountListToV2 = (listAccount = []) => {
  const activeEvmChainIdsSet = new Set()
  const evmAddressSeen = new Set()
  const migratedList = []

  for (const item of listAccount || []) {
    if (!item || !item.chain) continue

    if (item.chain === chainType.btc || item.chain === chainType.solana) {
      migratedList.push({ ...item, accountType: resolveAccountType(item) })
      continue
    }

    // Resolve chainId: item.chainId is the canonical field; fall back to
    // blockchainListRedux lookup by chain field for any custom chains added via deeplink.
    let resolvedChainId = Number(item.chainId)
    if (!Number.isFinite(resolvedChainId) || resolvedChainId <= 0) {
      const blockchainListRedux = ReduxService.getReduxDataByKey('blockchainListRedux', {})
      const matched = Object.values(blockchainListRedux || {}).find(
        (info) => info?.chain === item.chain || info?.chainType === item.chain
      )
      resolvedChainId = matched?.chainId ? Number(matched.chainId) : NaN
    }
    if (Number.isFinite(resolvedChainId) && resolvedChainId > 0) {
      activeEvmChainIdsSet.add(resolvedChainId)
    } else {
      // console.warn('[migrateAccountListToV2] cannot resolve chainId for chain:', item.chain)
    }

    const addressKey = lowerCase(item.address || '')
    if (evmAddressSeen.has(addressKey)) continue
    evmAddressSeen.add(addressKey)

    const { chainId: _omitChainId, ...rest } = item
    migratedList.push({ ...rest, chain: STANDARD_CHAIN.Evm, accountType: resolveAccountType(item) })
  }

  // Sort: default chains first (in fixed priority order — ETH leads), then custom chains by chainId asc
  const DEFAULT_CHAIN_ID_PRIORITY = [1, 56, 137, 43114, 10, 42161, 8453, 59144, 130, 250, 1666600000, 66, 88]
  const activeEvmChainIds = Array.from(activeEvmChainIdsSet).sort((a, b) => {
    const ai = DEFAULT_CHAIN_ID_PRIORITY.indexOf(a)
    const bi = DEFAULT_CHAIN_ID_PRIORITY.indexOf(b)
    if (ai !== -1 && bi !== -1) return ai - bi
    if (ai !== -1) return -1
    if (bi !== -1) return 1
    return a - b
  })

  // Sort accounts: EVM (ETH-led, already unified into chain='evm') → BTC → Solana.
  // Stable sort preserves the original within-group order (e.g. wallet-index order).
  const CHAIN_GROUP_ORDER = { evm: 0, [chainType.btc]: 1, [chainType.solana]: 2 }
  migratedList.sort((a, b) => (CHAIN_GROUP_ORDER[a.chain] ?? 99) - (CHAIN_GROUP_ORDER[b.chain] ?? 99))

  return { migratedList, activeEvmChainIds }
}
