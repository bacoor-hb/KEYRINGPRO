import { Platform } from 'react-native'

global.isDev = true
global.space = ' '
global.ISIOS = Platform.OS === 'ios'

// https://rnfirebase.io/migrating-to-v22#enabling-deprecation-strict-modes
global.RNFB_SILENCE_MODULAR_DEPRECATION_WARNINGS = true
