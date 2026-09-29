import { ALCHEMY_ENDPOINT } from 'common/constants/alchemy'
import { sanitizeUrl } from 'common/function'
import { KEY_STORE_ID, REQUEST_TYPE } from 'common/constants/app'
import { getDataByKeyStore } from 'common/storage/secureStorage'

// Transfer categories the recipient check asks for. Kept in parity with the
// Moralis fallback, which matches native_transfers, erc20_transfers, nft_transfers
// AND internal_transactions — dropping the NFT ones here would make Alchemy report
// "first time" for a recipient Moralis reports as "sent before".
const PAIR_CHECK_CATEGORIES = ['external', 'erc20', 'erc721', 'erc1155']

// `internal` is only served on Ethereum and Polygon; asking for it anywhere else
// fails the WHOLE call, which would push a perfectly good chain onto the slow
// fallback. It only ever matters when the sender is a contract (a Smart Account
// or multisig) — an EOA is never the `from` of an internal transfer.
const CHAIN_IDS_WITH_INTERNAL_TRANSFERS = new Set([1, 137])

class AlchemyApi {
  static async callRequest (chainId, url, body, opt = {}) {
    const endpoint = ALCHEMY_ENDPOINT[chainId]
    const method = opt.method || REQUEST_TYPE.GET

    let urlFinal = `https://${endpoint}.g.alchemy.com/v2`
    if (url) {
      urlFinal = `${urlFinal}/${url}`
    }
    urlFinal += `/${getDataByKeyStore(KEY_STORE_ID.ALCHEMY_API_KEY)}`
    urlFinal = sanitizeUrl(urlFinal)

    const req = await fetch(urlFinal, {
      ...opt,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...opt?.headers
      },
      body: JSON.stringify(body)
    })

    const res = await req.json()
    return res
  }

  static async getHistoryTransferByAddress (chainId, address, isSend = false) {
    try {
      const queryObj = {
        fromBlock: '0x0',
        withMetadata: true,
        category: [
          'external',
          'erc20'
        ],
        order: 'desc',
        maxCount: '0x14'
      }

      if (isSend) {
        queryObj.fromAddress = address
      } else {
        queryObj.toAddress = address
      }

      if (chainId?.toString() === '1' || chainId?.toString() === '137') {
        queryObj.category.push('internal')
      }

      const payload = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'alchemy_getAssetTransfers',
        params: [queryObj]
      }

      const result = await this.callRequest(chainId, null, payload, { method: REQUEST_TYPE.POST })

      return result?.result?.transfers || []
    } catch (error) {
      return []
    }
  }

  // How many times has `from` sent anything to `to` on this chain?
  //
  // The pair filter is the whole point: `fromAddress` and `toAddress` are ANDed
  // server-side, so this is ONE request whose latency does NOT grow with the
  // wallet's history. The Moralis fallback has no counterparty filter and has to
  // page through the entire ledger to answer the same question.
  //
  // THROWS on any failure — deliberately, unlike getHistoryTransferByAddress
  // above. The caller has to tell "never sent" apart from "couldn't ask" to know
  // whether to fall back; swallowing an outage into 0 would show the recipient as
  // brand new. Alchemy answers 403 for a chain that is not enabled on the key,
  // which is exactly such a case and NOT an empty result.
  static async countTransfersBetween (chainId, from, to) {
    if (!ALCHEMY_ENDPOINT[chainId]) {
      throw new Error(`Alchemy has no node for chain ${chainId}`)
    }

    const category = [...PAIR_CHECK_CATEGORIES]
    if (CHAIN_IDS_WITH_INTERNAL_TRANSFERS.has(Number(chainId))) {
      category.push('internal')
    }

    const payload = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'alchemy_getAssetTransfers',
      params: [{
        fromBlock: '0x0',
        toBlock: 'latest',
        fromAddress: from,
        toAddress: to,
        category,
        // A contract call that moves no native value is still a send TO this
        // recipient, and the API default (true) would drop it.
        excludeZeroValue: false,
        withMetadata: false,
        order: 'desc',
        // The UI only separates "once" from "more than once", so a handful of rows
        // settles it. A larger page costs the same but returns more JSON to parse.
        maxCount: '0xa'
      }]
    }

    const res = await this.callRequest(chainId, null, payload, { method: REQUEST_TYPE.POST })

    // A successful call always carries `result.transfers`, even when empty, so a
    // missing `result` means the node refused rather than found nothing.
    if (res?.error || !res?.result) {
      throw new Error(res?.error?.message || `alchemy_getAssetTransfers failed on chain ${chainId}`)
    }

    // One transaction can produce SEVERAL transfer rows — a swap emits an
    // `external` and an `erc20` row under the same hash — so count distinct
    // hashes. The copy below counts times sent, not rows.
    const transfers = res.result.transfers || []
    return new Set(transfers.map((transfer) => transfer.hash)).size
  }
}

export default AlchemyApi
