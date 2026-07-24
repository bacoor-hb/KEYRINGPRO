import QueryString from 'query-string'
import {
  REQUEST_TYPE,
  errOverTime,
  BRIDE_API
} from 'common/constants/app'
import { KEYSTORE } from 'common/constants/redux'
import settings from 'controller/settings'
import { getDataFromSecureStorage } from 'common/storage/secureStorage'
export default class BrideAPI {
  static async getData (type, queryBody, isCustomLink = false, customAuthenToken = null) {
    return this.postGateWay(type, REQUEST_TYPE.GET, undefined, queryBody, undefined, customAuthenToken, isCustomLink)
  }

  static async postData (type, body, queryBody, isCustomLink = false, customAuthenToken = null) {
    return this.postGateWay(type, REQUEST_TYPE.POST, body, queryBody, undefined, customAuthenToken, isCustomLink)
  }

  static async putData (type, body) {
    return this.postGateWay(type, REQUEST_TYPE.PUT, body)
  }

  static getTokenPrices = async (chainId) => {
    const apiUrl = `${BRIDE_API.TOKEN_PRICE}/${chainId}`
    return this.postGateWay(apiUrl, REQUEST_TYPE.GET, null, null, null, null, true)
  }

  static getTokenList = async (chainId) => {
    const apiUrl = `${BRIDE_API.TOKEN_LIST}/${chainId}`
    return this.postGateWay(apiUrl, REQUEST_TYPE.GET, null, null, null, null, true)
  }

  static async postGateWay (url, method = REQUEST_TYPE.GET, body, queryBody, timeOutCustom = 30000, customAuth = null, isCustomLink = false) {
    const callApi = new Promise(async (resolve, reject) => {
      try {
        const token = customAuth || getDataFromSecureStorage(KEYSTORE.TOKEN_JWT)
        const params = {
          method,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: token ? 'Bearer ' + token : ''
          }
        }

        if (body) {
          params.body = JSON.stringify(body)
        }
        let queryStr = ''
        if (queryBody) {
          queryStr = '?' + QueryString.stringify(queryBody)
        }

        const response = await fetch((isCustomLink ? '' : (settings().server.api)) + url + queryStr, params)
        const responJson = await response.json()

        if (response.status === 200 || response.status === 201) {
          resolve(responJson)
        }
        resolve(null)
      } catch (error) {
        reject(error)
      }
    })
    // Close promise if over time
    const callRemove = new Promise(function (resolve, reject) {
      setTimeout(() => {
        return reject(errOverTime)
      }, timeOutCustom)
    })

    return Promise.race([callApi, callRemove]).then((result) => {
      return result
    }).catch((e) => {
      if (e === 'OverTime') {
        // EventRegister.emit('internetChange', I18n.t('Initial.connectErr'))
      }
      return null
    })
  }
}
