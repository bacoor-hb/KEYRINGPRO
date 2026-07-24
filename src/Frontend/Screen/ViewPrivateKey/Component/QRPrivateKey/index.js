import { View } from 'react-native'
import I18n from 'assets/Lang'
import React, { useContext } from 'react'
import { ThemeContext } from 'frontend/Contexts/ThemeContext'
import { MODE_THEME } from 'common/constants/app'
import createStyles from './styles'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import QRCode from 'react-native-qrcode-svg'
import { width } from 'common/styles'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import MyButton from 'frontend/Components/UI/MyButton'
import images from 'assets/Image'
import MyActionRow from 'frontend/Components/UI/MyActionRow'

const QRPrivateKey = ({ privateKey = '', onCopy }) => {
  const { modeTheme } = useContext(ThemeContext)
  const isDarkMode = modeTheme === MODE_THEME.DARK_MODE
  const styles = createStyles(isDarkMode)

  return (
    <MyViewPage className='flex items-center' style={[styles.container]}>
      <TitleDrawer
        containerConfig={{
          style: { paddingBottom: 0 }
        }}
        leftIcon={images.UIV2.icons.viewPrivateKey}
        title={I18n.t('v2.viewPrivateKey.qrPrivateKey')}
        rightElement={(
          <MyButton
            size='small'
            label={I18n.t('Initial.copy')}
            style={{ minWidth: 100 }}
            onPress={() => onCopy && onCopy(privateKey)}
          />
        )}
      />
      <View className='w-full'>
        <MyActionRow
          titleClassName='text-medium'
          title={privateKey}
        />
      </View>
      <View className='bg-white p-5 rounded-2xl' style={[styles.containerQR]}>
        <QRCode
          value={privateKey}
          size={width(50)}
          logoBackgroundColor='transparent'
        />
      </View>
    </MyViewPage>
  )
}

export default QRPrivateKey
