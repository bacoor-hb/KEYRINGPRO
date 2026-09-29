import React from 'react'
import { Platform } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
// import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { navigationRef } from './NavigationService'

// Import screens
import WelcomeScreen from 'frontend/Screen/WelcomeScreen'
import BackUpWalletScreen from 'frontend/Screen/BackUpWalletScreen'
import SetPasswordScreen from 'frontend/Screen/SetPasswordScreen'
import QrCodeScreen from 'frontend/Screen/QrCodeScreen'
import CrashAppScreen from 'frontend/Screen/CrashAppScreen'
import ScanScreen from 'frontend/Screen/ScanScreen'
import KeyCardOperation from 'frontend/Screen/KeyCardOperation'
import EnterPassNFCScreen from 'frontend/Screen/EnterPassNFCScreen'
import LiquidityManagement from 'frontend/Screen/LiquidityManagement'
import WalletConnectPayLinkScreen from 'frontend/Screen/WalletConnectPayLinkScreen'
import NFCTagOperationScreen from 'frontend/Screen/NFCTagOperation'
import SecurityScreen from 'frontend/Screen/Security'
import AddAccountScreen from 'frontend/Screen/AddAccount'
import AccountDetailScreen from 'frontend/Screen/AccountDetail'
import HomeScreen from 'frontend/Screen/HomeScreen'
import NetworkScreen from 'frontend/Screen/Network'
import { NAME_SCREEN } from 'common/constants/navigation'
import SettingScreen from 'frontend/Screen/Setting'
import ExportToNFCTagScreen from 'frontend/Screen/ExportToNFCTag'
import WalletConnectScreen from 'frontend/Screen/WalletConnect'
import SendReceivedHistory from 'frontend/Screen/SendReceivedHistory'
import ViewPrivateKeyScreen from 'frontend/Screen/ViewPrivateKey'
import SecurityUpgradeScreen from 'frontend/Screen/SecurityUpgradeScreen'
import UnlockScreen from 'frontend/Screen/UnlockScreen'
import TokenListScreen from 'frontend/Screen/TokenList'
import TokenDetailScreen from 'frontend/Screen/TokenDetailScreen'
import AISearchScreen from 'frontend/Screen/AISearch'
import WalletConnectRequestHost from 'frontend/Components/WalletConnectRequestHost'

// Old screen, will remove after new screen is ready
// import RestoreWalletScreen from 'frontend/Screen/RestoreWalletScreen'
// import SafetyTipsScreen from 'frontend/Screen/SafetyTipsScreen'

const Stack = createNativeStackNavigator()
// const Tab = createBottomTabNavigator()

const defaultScreenOptions = {
  headerShown: false,
  // Android only. react-native-screens reads the transition duration from static XML
  // resources, so `animationDuration` (iOS-only) is ignored there: `slide_from_right`
  // is pinned to config_mediumAnimTime (400ms). `ios_from_right` is a different preset
  // backed by config_shortAnimTime (200ms) with an iOS-like parallax on the outgoing
  // screen. iOS keeps `slide_from_right` so its transition is untouched.
  animation: Platform.select({ android: 'ios_from_right', ios: 'slide_from_right' }),
  animationDuration: 100 // Bug here: https://github.com/react-navigation/react-navigation/issues/12377

}

const AppNavigator = ({ initialRouteName = NAME_SCREEN.welcome }) => {
  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={defaultScreenOptions}
      >
        <Stack.Screen name={NAME_SCREEN.welcome} component={WelcomeScreen} />
        <Stack.Screen name={NAME_SCREEN.backUpWallet} component={BackUpWalletScreen} />
        <Stack.Screen name={NAME_SCREEN.setPassword} component={SetPasswordScreen} />
        <Stack.Screen name='qrCodeScreen' component={QrCodeScreen} />
        <Stack.Screen name='crashAppScreen' component={CrashAppScreen} />
        <Stack.Screen name={NAME_SCREEN.liquidityManagement} component={LiquidityManagement} />
        {/* <Stack.Screen name='recommendationDetailScreen' component={RecommendationDetailScreen} /> */}
        {/* <Stack.Screen name='selectAccountToBuyScreen' component={SelectAccountToBuyScreen} /> */}
        <Stack.Screen name='scanScreen' component={ScanScreen} />
        <Stack.Screen name='keyCardOperation' component={KeyCardOperation} />
        <Stack.Screen name='enterPassNFCScreen' component={EnterPassNFCScreen} />
        <Stack.Screen name={NAME_SCREEN.walletConnectPay} component={WalletConnectPayLinkScreen} />
        {/* <Stack.Screen name='generateAccountPasskey' component={GenerateAccountPasskey} /> */}
        {/* <Stack.Screen name="safetyTipsScreen" component={SafetyTipsScreen} /> */}

        {/* add new Page */}
        <Stack.Screen name={NAME_SCREEN.home} component={HomeScreen} options={{ animation: 'fade' }} />
        <Stack.Screen name={NAME_SCREEN.network} component={NetworkScreen} />
        <Stack.Screen name={NAME_SCREEN.nFCTagOperation} component={NFCTagOperationScreen} />
        <Stack.Screen name={NAME_SCREEN.security} component={SecurityScreen} />
        <Stack.Screen name={NAME_SCREEN.addAccount} component={AddAccountScreen} />
        <Stack.Screen name={NAME_SCREEN.accountDetail} component={AccountDetailScreen} />
        <Stack.Screen name={NAME_SCREEN.settings} component={SettingScreen} />
        <Stack.Screen name={NAME_SCREEN.exportToNFCTag} component={ExportToNFCTagScreen} />
        <Stack.Screen name={NAME_SCREEN.walletConnect} component={WalletConnectScreen} />
        <Stack.Screen name={NAME_SCREEN.sendHistory} component={SendReceivedHistory} initialParams={{ typeScreen: 'send' }} />
        <Stack.Screen name={NAME_SCREEN.receivedHistory} component={SendReceivedHistory} initialParams={{ typeScreen: 'received' }} />
        <Stack.Screen name={NAME_SCREEN.createAccount} component={AddAccountScreen} />
        <Stack.Screen name={NAME_SCREEN.viewPrivateKey} component={ViewPrivateKeyScreen} />
        <Stack.Screen name={NAME_SCREEN.securityUpgrade} component={SecurityUpgradeScreen} />
        <Stack.Screen name={NAME_SCREEN.unlock} component={UnlockScreen} />
        <Stack.Screen name={NAME_SCREEN.tokenList} component={TokenListScreen} />
        <Stack.Screen name={NAME_SCREEN.tokenDetail} component={TokenDetailScreen} />
        <Stack.Screen name={NAME_SCREEN.aiSearch} component={AISearchScreen} options={{ animation: 'fade', gestureEnabled: false }} />
      </Stack.Navigator>
      <WalletConnectRequestHost />
    </NavigationContainer>
  )
}

export default AppNavigator
