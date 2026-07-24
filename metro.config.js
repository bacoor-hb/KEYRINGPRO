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
    // 1. Cho phép Metro đọc các export hiện đại
    unstable_enablePackageExports: true,
    // 2. Ưu tiên các định dạng file mà viem sử dụng
    sourceExts: [...defaultConfig.resolver.sourceExts, 'cjs', 'mjs'],
    // Cho phép require() file .lottie (dotlottie-react-native)
    assetExts: [...defaultConfig.resolver.assetExts, 'lottie'],
    // 3. Giải quyết vấn đề tìm kiếm file
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
