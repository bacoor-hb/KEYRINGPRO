import React, { useState, useEffect } from 'react'
import { View, TextInput, TouchableOpacity, Keyboard } from 'react-native'
import LottieView from 'lottie-react-native'
import BigNumber from 'bignumber.js'
import I18n from 'assets/Lang'
import images from 'assets/Image'
import { getLength } from 'common/function'
import { Colors } from 'common/styles'
import AllChainServices from 'controller/AllChainServices'
import MyText from 'frontend/Components/UI/MyText'
import MyButton from 'frontend/Components/UI/MyButton'
import createStyles from './styles'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import MyViewPage from 'frontend/Components/UI/MyViewPage'

const styles = createStyles()

// New-design "Edit spending cap" drawer. The balance fetch + amount-normalisation
// LOGIC is copied verbatim from manageRequestScreenV2's ModalEditApproveTokenAmount
// (kept intact); only the UI is rebuilt to the new design. Opened (stacked) from
// RequestCard via _this.openDrawer.
const EditSpendingCapDrawer = ({
  chainTypeOrChainId,
  tokenAddress,
  tokenDecimals,
  tokenSymbol,
  userAddress,
  onChangeApproveAmount,
  onClose
}) => {
  const [currentTokenBalance, setCurrentTokenBalance] = useState()
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)
  const [newApproveAmount, setNewApproveAmount] = useState()

  useEffect(() => {
    (async () => {
      setIsLoadingBalance(true)
      const currentTokenBalance = await AllChainServices.getTokenBalanceByChain(chainTypeOrChainId, tokenAddress, userAddress, tokenDecimals)

      // Remove trailing zeros while preserving precision
      const formattedBalance = BigNumber(currentTokenBalance).decimalPlaces(Number(tokenDecimals), BigNumber.ROUND_DOWN).toString()
      setCurrentTokenBalance(formattedBalance)
      setIsLoadingBalance(false)
    })()
  }, [])

  const onUpdateNewApproveAmount = () => {
    onChangeApproveAmount(newApproveAmount)
    onClose && onClose()
  }

  const handleOnChangeApproveAmount = (amount) => {
    if (amount) {
      // Replace comma with dot
      const normalizedAmount = amount.replace(',', '.')

      if (normalizedAmount.includes('.')) {
        const parts = normalizedAmount.split('.')

        if (parts.length > 1) {
          const decimalPart = parts[1]

          if (decimalPart && decimalPart.length > Number(tokenDecimals)) {
            const limitedAmount = parts[0] + '.' + decimalPart.substring(0, Number(tokenDecimals))
            setNewApproveAmount(limitedAmount)
            return
          }
        }
      }

      setNewApproveAmount(normalizedAmount)
      return
    }

    setNewApproveAmount(amount)
  }

  return (
    <MyViewPage style={styles.container}>
      <TitleDrawer
        title={I18n.t('WalletConnect.editSpendingCap')}
        leftIcon={images.UIV2.icons.editBrand}
        rightElement={(
          <MyButton
            disableLiquidGlass
            size='small'
            label={I18n.t('Initial.save')}
            isDisable={getLength(newApproveAmount) === 0}
            onPress={onUpdateNewApproveAmount}
          />
        )}
      />

      <View style={styles.body}>
        {/* Amount field: bottom-line only (no icon, no surrounding box) + round Max */}
        <View style={styles.fieldLine}>
          <View style={styles.amountCol}>
            {!newApproveAmount && (
              <View style={styles.amountPlaceholderWrap} pointerEvents='none'>
                <MyText style={styles.amountPlaceholder}>{I18n.t('Initial.amount')}</MyText>
              </View>
            )}
            <TextInput
              value={newApproveAmount}
              onChangeText={handleOnChangeApproveAmount}
              keyboardType='numeric'
              style={styles.amountInput}
            />
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.maxBtn}
            onPress={() => {
              Keyboard.dismiss()
              setNewApproveAmount(currentTokenBalance)
            }}>
            <MyText variant='small' className='text-brand'>{I18n.t('Initial.max')}</MyText>
          </TouchableOpacity>
        </View>

        {/* Balance row */}
        <View style={styles.balanceRow}>
          <MyText style={{ color: Colors.TEXT_MEDIUM }}>{tokenSymbol} {I18n.t('Initial.balance')}</MyText>
          {isLoadingBalance ? (
            <LottieView
              style={styles.balanceLoading}
              source={images.threeDotsWhiteLoading}
              autoPlay
              loop />
          ) : (
            <View style={styles.balanceValueRow}>
              <MyText numberOfLines={1} style={{ color: Colors.TEXT_MEDIUM }}>
                {BigNumber(currentTokenBalance).decimalPlaces(8, BigNumber.ROUND_DOWN).toString()} {tokenSymbol}
              </MyText>
            </View>
          )}
        </View>
      </View>
    </MyViewPage>
  )
}

export default EditSpendingCapDrawer
