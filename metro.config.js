const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')

const { withNativeWind } = require('nativewind/metro')
const defaultConfig = getDefaultConfig(__dirname)
/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    // extraNodeModules: nodeLibs,
    // 1. Let Metro resolve modern package `exports`
    unstable_enablePackageExports: true,
    // 2. Accept the module formats viem ships
    sourceExts: [...defaultConfig.resolver.sourceExts, 'cjs', 'mjs'],
    // Allow require() of .lottie files (dotlottie-react-native)
    assetExts: [...defaultConfig.resolver.assetExts, 'lottie'],
    // 3. Package entry-point lookup order
    resolverMainFields: ['sbmodern', 'react-native', 'browser', 'main'],
    extraNodeModules: {
      crypto: require.resolve('crypto-browserify'),
      stream: require.resolve('stream-browserify'),
      http: require.resolve('stream-http'),
      https: require.resolve('https-browserify'),
      os: require.resolve('os-browserify/browser')
    }
  }
}

const configDefault = mergeConfig(defaultConfig, config)

module.exports = withNativeWind(configDefault, { input: './global.css' })
