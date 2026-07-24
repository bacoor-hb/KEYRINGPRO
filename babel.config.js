module.exports = {
  presets: [['@react-native/babel-preset', { unstable_transformProfile: 'hermes-stable' }], 'nativewind/babel'],
  plugins: [
    // 'react-native-worklets/plugin',
    [
      'module-resolver',
      {
        root: ['./'],
        extensions: ['.js', '.ios.js', '.android.js', '.json', '.ts', '.tsx'],
        alias: {
          common: './src/Common',
          controller: './src/Controller',
          assets: './src/Assets',
          frontend: './src/Frontend'
        }
        // resolvePath (sourcePath, currentFile, opt) {
        //   var path = require('path')
        //   if (
        //     sourcePath === 'react-native' &&
        //     !(
        //       (
        //         currentFile.includes('node_modules/react-native/') || // macos/linux paths
        //         currentFile.includes('node_modules\\react-native\\')
        //       ) // windows path
        //     ) &&
        //     !(
        //       currentFile.includes('resolver/react-native/') ||
        //       currentFile.includes('resolver\\react-native\\')
        //     )
        //   ) {
        //     return path.resolve(__dirname, 'resolver/react-native')
        //   }
        //   var resolve = require('babel-plugin-module-resolver').resolvePath(sourcePath, currentFile, opt)
        //   return resolve
        // }
      }
    ],
    '@babel/plugin-proposal-logical-assignment-operators',
    '@babel/plugin-transform-named-capturing-groups-regex',
    '@babel/plugin-transform-numeric-separator',
    '@babel/plugin-proposal-export-namespace-from',
    'react-native-reanimated/plugin',
    'react-native-worklets/plugin'
  ],
  env: {
    production: {
      plugins: ['transform-remove-console']
    }
  }
}
