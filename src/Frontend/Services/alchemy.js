import { ALCHEMY_ENDPOINT } from 'common/constants/alchemy'
import { sanitizeUrl } from 'common/function'
import { KEY_STORE_ID, REQUEST_TYPE } from 'common/constants/app'
import { getDataByKeyStore } from 'common/storage/secureStorage'

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
}

export default AlchemyApi
