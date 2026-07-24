import QueryString from 'query-string'
import { REQUEST_TYPE, errOverTime } from 'common/constants/app'
import { KEYSTORE } from 'common/constants/redux'
import settings from 'controller/settings'
import { getDataFromSecureStorage } from 'common/storage/secureStorage'

export default class NagemonAPI {
  static async getAuth () {
    return this.postGateWay('auth/KEYRING', REQUEST_TYPE.GET)
  }

  static async postGateWay (url, method = REQUEST_TYPE.GET, body, queryBody, timeOutCustom = 3000) {
    const callApi = new Promise(async (resolve, reject) => {
      try {
        const token = (getDataFromSecureStorage(KEYSTORE.TOKEN_JWT))
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
        const response = await fetch(settings().server.nagemonAPI + url + queryStr, params)
        const responJson = await response.json()
        if (response.status === 200) {
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
