
import { useEffect } from 'react'
import { lowerCase } from 'common/function'
import BigNumber from 'bignumber.js'
import createStyles from './styles'
import { View } from 'react-native'
import MyText from 'frontend/Components/UI/MyText'
import MyIcon from 'frontend/Components/UI/MyIcon'
import images from 'assets/Image'
import I18n from 'assets/Lang'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import TitleScreen from 'frontend/Components/UI/TitleScreen'
import MyBalance from 'frontend/Components/UI/MyBalance'
import { NavigationActions } from 'src/navigation/NavigationService'
import { NAME_SCREEN } from 'common/constants/navigation'
import TokenIconWithChain from 'frontend/Components/UI/TokenIconWithChain'
import FiatBalance from 'frontend/Components/UI/FiatBalance'
import useComponentHeights from 'frontend/Hooks/useComponentHeights'
import { pixelByHeight } from 'common/styles'
import { zeroAddress } from 'viem'
import MyRowItem from 'frontend/Components/UI/MyRowItem'
import MyTextTicker from 'frontend/Components/UI/MyTextTicker'
import { isNativeToken } from 'common/tokens'
import { refreshAccountTokens } from 'src/Services/TokenListV2'
import ReduxService from 'common/redux'
import { REDUX_KEY } from 'common/constants/redux'

export const getBalanceTokenByAddress = (addressToken, chainId) => {
  const accountTokenListRedux = ReduxService.getReduxDataByKey('accountTokenListRedux')
  const activeAccount = ReduxService.getReduxDataByKey(REDUX_KEY.activeAccount)
  const { account } = activeAccount
  const token = (accountTokenListRedux[account.address].tokens || []).find(token => {
    let addressTokenUser = token.contractAddress

    if (isNativeToken(addressTokenUser, chainId)) {
      addressTokenUser = zeroAddress
    }

    if (
      token.chainId?.toString() === chainId?.toString() &&
        lowerCase(addressToken) === lowerCase(addressTokenUser)
    ) {
      return true
    }
    return false
  })

  if (!token) {
    refreshAccountTokens(account.address, { chainIds: [chainId] })
  }

  return token || {}
}

const PaymentPage = ({ _this }) => {
  const { handleTokenSelect, state } = _this
  const { infoTokens, isBackToScanScreen, optionsPayments, chainId, paymentOptions } = state
  const styles = createStyles()
  const { onLayoutHeaderAnchor } = useComponentHeights()

  useEffect(() => {
    if (isBackToScanScreen) {
      NavigationActions.reset(NAME_SCREEN.home)
    }
  }, [isBackToScanScreen])

  const getTotalAmountPaid = () => {
    return BigNumber(paymentOptions?.info?.amount?.value || 0).multipliedBy(0.01).toString()
  }

  const renderTokenList = () => {
    const listData = (optionsPayments || {})[chainId] || []

    return (
      <View>
        {
          listData.map((item, index) => {
            const token = item.token
            const address = token.address
            const decimals = token?.decimals || 18
            const symbol = token?.assetSymbol
            let iconToken = token?.iconUrl ?? images.UIV2.icons.unknowToken
            // const iconToken = 'https://api.walletconnect.com/assets/v1/image/token/ETH/md'
            const tokenOfUser = getBalanceTokenByAddress(address, chainId)
            if (tokenOfUser.iconUrl) {
              item.token.iconUrl = tokenOfUser.iconUrl
              iconToken = tokenOfUser.iconUrl
            }

            return (
              <MyRowItem
                key={`token-${address}-${index}`}
                lefIcon={(
                  <TokenIconWithChain chainId={infoTokens?.chainId} tokenIconUri={iconToken} />
                )}
                onPress={() => handleTokenSelect(item)}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <MyText variant='subTitle' fontWeight={700}>{symbol}</MyText>
                    <MyTextTicker>
                      <MyBalance className='text-medium' fractionDigits={decimals} value={tokenOfUser?.balanceFormatted || '0'} />
                    </MyTextTicker>

                  </View>
                  <MyIcon style={styles.iconArrowRight} uri={images.UIV2.icons.arrowRightLow} variant='small' />
                </View>
              </MyRowItem>
            )
          })
        }
      </View>
    )
  }

  return (
    <MyViewPage isSetHeightLayout style={styles.container}>
      <View
        style={{
          paddingBottom: pixelByHeight(12)
        }}
        onLayout={onLayoutHeaderAnchor}>
        <TitleScreen
          title='WalletConnect Pay'
          style={
            { paddingBottom: 0, minHeight: 0 }
          }
        />
        <FiatBalance variant='title' fontWeight={700} valueUSD={getTotalAmountPaid()} />

      </View>

      <MyRowItem>
        <MyText variant='subTitle' fontWeight={700} className='text-medium'>
          {I18n.t('Initial.WalletConnectPay.selectTokenToPay')}
        </MyText>
      </MyRowItem>
      {renderTokenList()}

    </MyViewPage>
  )
}

export default PaymentPage
