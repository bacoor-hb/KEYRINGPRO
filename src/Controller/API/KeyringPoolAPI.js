import settings from 'controller/settings'
import BaseAPI from './BaseAPI'

export default class KeyringPoolAPI {
  static async getData (apiPath, queryParams) {
    const isCustomLink = apiPath.startsWith('https')

    const apiPathFinal = isCustomLink ? apiPath : `${settings().server.apiKeyringPool}/${apiPath}`

    return BaseAPI.getData(apiPathFinal, queryParams, true)
  }

  static async postData (apiPath, postBody, queryParams, customAuthenToken) {
    const isCustomLink = apiPath.startsWith('https')

    const apiPathFinal = isCustomLink ? apiPath : `${settings().server.apiKeyringPool}/${apiPath}`

    return BaseAPI.postData(apiPathFinal, postBody, queryParams, true, customAuthenToken)
  }

  static async putData (apiPath, putBody, queryParams, customAuthenToken) {
    const isCustomLink = apiPath.startsWith('https')

    const apiPathFinal = isCustomLink ? apiPath : `${settings().server.apiKeyringPool}/${apiPath}`
    return BaseAPI.putData(apiPathFinal, putBody, queryParams, true, customAuthenToken)
  }
}
