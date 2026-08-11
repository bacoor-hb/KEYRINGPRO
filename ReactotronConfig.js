import { TurboModuleRegistry } from 'react-native'
import Reactotron from 'reactotron-react-native'
import { reactotronRedux } from 'reactotron-redux'

const scriptURL = TurboModuleRegistry.getEnforcing('SourceCode').getConstants().scriptURL
const scriptHostname = scriptURL.split('://')[1].split(':')[0]

const reactotronConfig = Reactotron.configure({
  name: 'KeyingPro',
  host: scriptHostname
})
  .useReactNative()
  .use(reactotronRedux())
  // .use(networking({
  //   ignoreUrls: /\/(generate_204)$/
  // }))
  .connect()

export default reactotronConfig
