import React, { useContext, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity
} from 'react-native'
import { ImageRender } from 'frontend/Components/Common/ImageRender'
import { ThemeContext } from 'frontend/Contexts/ThemeContext'
import { Colors, DarkColors, pixelByWidth } from 'common/styles'
import { convertAddressArrToString } from 'common/function'
import images from 'assets/Image'
import I18n from 'assets/Lang'
import Button from 'frontend/Components/Common/Button'
import { MODE_THEME } from 'common/constants/app'
import createStyles from './styles'
import { ScrollView } from 'react-native-gesture-handler'

const SignatureRequestDrawer = ({ heightContainer, address, networkIcon, message, onSign, onReject }) => {
  const [isLoading, setIsLoading] = useState(false)
  const { modeTheme, styleTheme } = useContext(ThemeContext)
  const isDarkMode = modeTheme === MODE_THEME.DARK_MODE
  const styles = createStyles(isDarkMode)
  const bgColor = isDarkMode ? '#171F2A' : Colors.WHITE
  const textColor = styleTheme.color
  const subTextColor = styleTheme.subColor

  return (
    <View style={[styles.container, { backgroundColor: bgColor, height: heightContainer }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: pixelByWidth(20) }}>
        <View />
        {/* <View style={styles.handle} /> */}
        <View />
        <View />

        {/* <TouchableOpacity activeOpacity={1} onPress={onClose}>
          <ImageRender uri={images.icCloseGrayBg} style={{ width: height(3), height: height(3) }} />
        </TouchableOpacity> */}
      </View>
      <View style={{ paddingHorizontal: pixelByWidth(20) }}>
        <View style={styles.containerLogo}>
          <ImageRender uri={images.walletConnectIcon} style={styles.logo} />
        </View>

        <View style={styles.centerContent}>
          <Text style={[styles.title, { color: textColor }]}>{I18n.t('Initial.WalletConnectPay.signatureRequest')}</Text>
          <Text style={[styles.description, { color: subTextColor }]}>
            {I18n.t('WalletConnect.signatureRequestDesc')}
          </Text>
        </View>
        <View style={[styles.addressBox]}>
          <ImageRender uri={networkIcon} style={styles.networkIcon} />
          <Text style={[styles.addressText, { color: textColor }]}>
            {convertAddressArrToString([address])}
          </Text>
        </View>
        <View style={styles.messageHeader}>
          <Text style={[styles.messageLabel, { color: textColor }]}>{I18n.t('Initial.WalletConnectPay.messageFrom')}</Text>
          <View style={styles.wcBadge}>
            <View style={{ backgroundColor: Colors.BLUE, borderRadius: pixelByWidth(20), padding: pixelByWidth(4.5), marginHorizontal: 4, justifyContent: 'center', alignItems: 'center' }}>
              <ImageRender uri={images.footerScanDarkmode} style={styles.wcBadgeIcon} />
            </View>
            <Text style={[styles.wcBadgeText, { color: textColor }]}>{I18n.t('Initial.WalletConnectPay.wc')}</Text>
          </View>
        </View>

      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.messageBox]}>
          <Text style={[styles.messageText, { color: subTextColor }]}>

            {JSON.stringify(JSON.parse(message), null, 2)}
          </Text>
        </View>

      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.rejectButton, { borderColor: isDarkMode ? DarkColors.GRAY4 : Colors.GRAY2, opacity: isLoading ? 0.5 : 1 }]}
          onPress={onReject}
          disabled={isLoading}
        >
          <Text style={[styles.rejectText, { color: textColor }]}>{I18n.t('Initial.reject')}</Text>
        </TouchableOpacity>
        <Button
          isLoading={isLoading}
          label={I18n.t('WalletConnect.sign')}
          onPress={() => {
            setIsLoading(true)
            onSign()
          }}
          style={styles.signButton}
        />

      </View>
    </View>
  )
}

export default SignatureRequestDrawer
