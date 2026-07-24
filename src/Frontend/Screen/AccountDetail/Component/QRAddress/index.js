import { TouchableOpacity, View } from 'react-native'
import React from 'react'
import createStyles from './styles'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import QRCode from 'react-native-qrcode-svg'
import { width } from 'common/styles'
import Clipboard from '@react-native-clipboard/clipboard'
import I18n from 'assets/Lang'
import { useSelector } from 'react-redux'

const QRAddress = ({ _this, address }) => {
  const { activeAccount } = useSelector(state => state)
  const { account } = activeAccount
  const { showAlert } = _this
  const styles = createStyles()

  const handleCopy = () => {
    Clipboard.setString(account.address)
    // showAlert(null, I18n.t('Initial.copyDone', { value: I18n.t('Initial.address') }), {
    // })
    showAlert(I18n.t('Initial.copyDone', { value: I18n.t('Initial.address') }), null, {
      type: 'toast'
    })
  }

  return (
    <MyViewPage className='flex items-center' style={[styles.container]}>
      <TouchableOpacity activeOpacity={1} onPress={handleCopy}>
        <View className='bg-white p-5 rounded-2xl'>
          <QRCode
            value={address}
            size={width(50)}
            logoBackgroundColor='transparent'
          />
        </View>
      </TouchableOpacity>
    </MyViewPage>
  )
}

export default QRAddress
