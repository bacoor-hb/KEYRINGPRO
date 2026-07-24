import React, { useMemo } from 'react'
import { View, TouchableOpacity } from 'react-native'
import { connect } from 'react-redux'
import { formatDate, handleOpenUrl, isArrayWithData } from 'common/function'
import useGetNameFunctionDecoded from 'frontend/Hooks/useGetNameFunctionDecoded'
import MyText from 'frontend/Components/UI/MyText'
import createStyles from './styles'

// New-design WalletConnect history item. The hash/method/explorer-link LOGIC is
// copied from manageRequestScreenV2's HistoryHash (kept intact); only the UI is
// rebuilt to the new design. Pin support is dropped (not in the new design).
const HistoryCard = (props) => {
  const styles = createStyles()
  const { historyItem, blockchainListRedux } = props
  const { time = '', hash = '', chainId, methodName, payload = { params: [] } } = historyItem

  const hashArr = isArrayWithData(hash, false) ? hash : [hash]

  const { isLoading: isLoadingDecodeDataData, requestMethodName } = useGetNameFunctionDecoded(payload)

  const getNameFunctionTx = useMemo(() => {
    try {
      if (historyItem?.methodName !== 'Unknown') {
        return historyItem?.methodName
      }
      if (isLoadingDecodeDataData) {
        return historyItem?.methodName
      }
      return requestMethodName || historyItem?.methodName || 'Unknown'
    } catch (error) {
      return historyItem?.methodName || 'Unknown'
    }
  }, [isLoadingDecodeDataData, requestMethodName, historyItem])

  const onRouteHashScan = (hashItem) => {
    try {
      if (blockchainListRedux?.[chainId]?.explorer) {
        const link = blockchainListRedux[chainId].explorer + `/tx/${hashItem}`
        handleOpenUrl(link)
      }
      if (blockchainListRedux?.[chainId]?.linkScanHash) {
        const link = blockchainListRedux[chainId].linkScanHash + `${hashItem}`
        handleOpenUrl(link)
      }
    } catch (e) {
      // do nothing
    }
  }

  return (
    <View style={styles.card} className='bg-box-secondary'>
      {/* Timestamp + confirmed method name */}
      <View style={styles.section}>
        <MyText variant='small' className='text-low'>{formatDate(time)}</MyText>
        {methodName ? (
          <MyText fontWeight={700}>{getNameFunctionTx}</MyText>
        ) : null}
      </View>

      {/* Transaction hash(es) — tap to open the chain explorer */}
      {hashArr.map((eachHash, index) => (
        <View key={index} style={styles.section}>
          <MyText variant='small' className='text-medium'>
            {`TXD ${hashArr.length > 1 ? index + 1 : ''}`}
          </MyText>
          <TouchableOpacity activeOpacity={0.8} onPress={() => onRouteHashScan(eachHash)}>
            <MyText className='text-brand'>
              {eachHash}
            </MyText>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  )
}

const mapStateToProps = (state) => ({
  blockchainListRedux: state.blockchainListRedux
})

export default connect(mapStateToProps)(HistoryCard)
