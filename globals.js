import { NativeModules, Platform } from 'react-native'

global.isDev = true
global.space = ' '
global.ISIOS = Platform.OS === 'ios'
// True when this iOS build runs on a Mac ("Designed for iPad/iPhone" on Apple
// Silicon, or Mac Catalyst). Use it only for the UIKit-on-macOS quirks that need
// a different path.
//
// Nothing in JS can answer this. On macOS the app reports Platform.OS 'ios',
// Platform.constants.isMacCatalyst false, interfaceIdiom 'phone' (it runs in
// iPhone compatibility mode) and a synthetic "iPad8,6" model — indistinguishable
// from a real iPad Pro 12.9-inch (3rd gen) running the iPhone app. So the flag
// comes from NSProcessInfo.isiOSAppOnMac, exposed by our own native module
// (ios/NativeModules/RCTPlatformInfo). react-native-device-info can't be used:
// its Mac check only runs in the iPad-idiom branch of getDeviceType().
//
// Resolved lazily on first read, not at import time: this module is evaluated
// before the RN runtime is fully up, and reading a native module that early can
// silently yield undefined and cache a wrong `false`.
let isMacResolved
Object.defineProperty(global, 'ISMAC', {
  configurable: true,
  get () {
    if (isMacResolved === undefined) {
      isMacResolved = global.ISIOS && NativeModules.PlatformInfo?.isiOSAppOnMac === true
    }
    return isMacResolved
  }
})

// https://rnfirebase.io/migrating-to-v22#enabling-deprecation-strict-modes
global.RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true
