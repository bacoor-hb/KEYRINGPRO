import React, { useContext } from 'react'
import { View, Text } from 'react-native'
import styles from './styles'
import { Icon } from 'frontend/Components/Common/Icon'
import I18n from 'assets/Lang'
import images from 'assets/Image'
import { ThemeContext } from 'frontend/Contexts/ThemeContext'
import Button from 'frontend/Components/Common/Button'
import { ImageRender } from 'frontend/Components/Common/ImageRender'
import { NavigationActions } from 'src/navigation/NavigationService'
const ModalImport = props => {
  const { closeModal, isError = false, nameChain = '' } = props

  const closeModalCustom = () => {
    closeModal()
    NavigationActions.reset('home')
  }

  const { modeTheme, styleTheme } = useContext(ThemeContext)

  return (
    <View style={[styles.container, styleTheme, styles[`container${modeTheme}`]]}>
      <View style={styles.rowSuccessInfo}>
        {
          isError
            ? <Icon name='close-circle' style={styles.iconUnCheckedIcon} />
            : <ImageRender uri={images.success} style={styles.iconCheckedIcon} resizeMode='contain' />
        }
        <View>
          <Text style={[styles.titleReset, styleTheme.txtStyle]}>{isError ? I18n.t('Initial.accountImportErr') : I18n.t('Initial.accountCreate')}</Text>
          <Text style={styles.desTxt}>{isError ? I18n.t('Initial.accountErrDes').replace('{chain}', nameChain) : I18n.t('Initial.accountCreateDes')}</Text>
          <Button
            onPress={closeModalCustom}
            style={[styles.buttonClose]}
            label={I18n.t('Initial.close')}
          />
        </View>
      </View>
    </View>
  )
}

export default ModalImport
