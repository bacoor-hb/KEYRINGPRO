import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import styles from '../styles'
import { ImageRender } from 'frontend/Components/Common/ImageRender'
import WalletDetailScreen from 'frontend/Screen/WalletDetailScreen'
import { formatNumberBro } from 'common/function'

class BoxCoin extends React.PureComponent {
  onRouter = () => {
    const { thisMain, item } = this.props
    thisMain.entryPopup = 'bottom'
    thisMain.popup = <WalletDetailScreen selectedToken={item} />
    thisMain.openModal()
  }

  render () {
    const { item } = this.props
    return (
      <TouchableOpacity activeOpacity={1} onPress={this.onRouter} style={styles.boxCoins}>
        <ImageRender uri={item.image} style={styles.imgCoin} />
        <View style={styles.leftView}>
          <Text style={styles.titleCoin}>{item.name}</Text>
          <Text style={styles.desText}>{formatNumberBro(item.balance) + ' ' + item.symbol}</Text>
        </View>
      </TouchableOpacity>
    )
  }
}
export default BoxCoin
