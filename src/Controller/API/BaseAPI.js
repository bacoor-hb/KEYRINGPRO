import QueryString from 'query-string'
import {
  REQUEST_TYPE,
  errOverTime,
  CURRENCY_DATA
} from 'common/constants/app'
import { KEYSTORE } from 'common/constants/redux'
import settings from 'controller/settings'
import { isObject } from 'common/function'
import Keys from 'react-native-keys'
import { getDataFromSecureStorage } from 'common/storage/secureStorage'
export default class BaseAPI {
  static async getDataDebridge (apiPath, queryParams, isCustomLink = false, customAuthenToken = null, isShowError = false) {
    const isIgnoreAuth = true
    return this.postGateWay(apiPath, REQUEST_TYPE.GET, undefined, queryParams, undefined, customAuthenToken, isCustomLink, isShowError, isIgnoreAuth)
  }

  static async getData (apiPath, queryParams, isCustomLink = false, customAuthenToken = null, isShowError = false) {
    return this.postGateWay(apiPath, REQUEST_TYPE.GET, undefined, queryParams, undefined, customAuthenToken, isCustomLink, isShowError)
  }

  static async postData (apiPath, postBody, queryParams, isCustomLink = false, customAuthenToken = null) {
    return this.postGateWay(apiPath, REQUEST_TYPE.POST, postBody, queryParams, undefined, customAuthenToken, isCustomLink)
  }

  static async putData (apiPath, putBody, queryParams, isCustomLink = false, customAuthenToken = null) {
    return this.postGateWay(apiPath, REQUEST_TYPE.PUT, putBody, queryParams, undefined, customAuthenToken, isCustomLink)
  }

  static async convertUSD2NewCurrency (to, from = CURRENCY_DATA.USD.code, amount = 1, format = 1) {
    try {
      const queryData = { from, to, amount, format }
      const customAuth = Keys.secureFor('CUSTOM_AUTH_FOR_LAYER_API')
      const data = await this.postGateWay('layer-api', REQUEST_TYPE.GET, null, queryData, 30000, customAuth)
      return (data && data.result) || 0
    } catch (error) {
      return 0
    }
  }

  /**
   *
   * @param {mixed} configs 'key_name'|[key_name1, key_name2]
   */
  static async getApiSettingByKey (configs = '') {
    const queryData = { configs }
    return this.postGateWay('setting/custom', REQUEST_TYPE.GET, null, queryData)
  }

  static async getAppSettings () {
    return this.postGateWay('setting/others')
  }

  static async getBlockChainList () {
    // chains_v4: remove tomo, one, fantom, heco from list chain default
    // chains_v5: remove okt from list chain default
    // chains_v6: set unichain to default supported chain
    return this.postGateWay('keyring/chains_v6', REQUEST_TYPE.GET)
  }

  static async getBlockChainWithChainId (chainId) {
    return this.postGateWay(`keyring/chain-search_v6?chainId=${chainId}`, REQUEST_TYPE.GET)
  }

  static async getNotificationList () {
    return this.postGateWay('keyring/notification-app', REQUEST_TYPE.GET)
  }

  static async postGateWay (url, method = REQUEST_TYPE.GET, postBody, queryParams, timeOutCustom = 30000, customAuth = null, isCustomLink = false, isShowError = false, isIgnoreAuth = false) {
    const callApi = new Promise(async (resolve, reject) => {
      try {
        const params = {
          method,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
          }
        }

        if (!isIgnoreAuth) {
          if (isObject(customAuth, true)) {
            // Custom auth is an object with custom headers
            params.headers = {
              ...params.headers,
              ...customAuth
            }
          } else {
            const token = customAuth || getDataFromSecureStorage(KEYSTORE.TOKEN_JWT)
            if (token) {
              params.headers.Authorization = 'Bearer ' + token
            }
          }
        }

        if (postBody) {
          params.body = JSON.stringify(postBody)
        }
        let queryStr = ''
        if (queryParams) {
          queryStr = '?' + QueryString.stringify(queryParams)
        }

        const response = await fetch((isCustomLink ? '' : (settings().server.api)) + url + queryStr, params)
        const responJson = await response.json()

        if (response.status === 200 || response.status === 201 || isCustomLink) {
          resolve(responJson)
        } else if (isShowError) {
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
