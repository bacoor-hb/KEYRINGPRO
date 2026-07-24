import { View, TouchableOpacity } from 'react-native'
import React, { useMemo } from 'react'
import MySelectDropdown from 'frontend/Components/UI/MySelectDropdown'
import MyIcon from 'frontend/Components/UI/MyIcon'
import images from 'assets/Image'
import { useSelector } from 'react-redux'
import { handleOpenUrl, jsonStr2Obj } from 'common/function'
import { getSizeImgSquare, height, pixelByWidth, width } from 'common/styles'
import MyActionRow from 'frontend/Components/UI/MyActionRow'
import MyText from 'frontend/Components/UI/MyText'
import I18n from 'assets/Lang'
import { STANDARD_CHAIN } from 'common/constants/app'
import { LIST_DEFAULT_CHAIN_ID } from 'common/constants/chain'
import ReduxService from 'common/redux'
import { ACCOUNT_TYPE } from 'common/constants/account'
import { arbitrum, avalanche, base, bsc, linea, mainnet, optimism, polygon, unichain } from 'viem/chains'

const ViewExplorer = ({ typeView = 'blockScan' }) => {
  const { blockchainListRedux, activeAccount } = useSelector(state => state)
  const { account } = activeAccount
  const address = account?.address
  const isAccountEVM = account.chain === STANDARD_CHAIN.Evm
  const isAccountViewOnly = account.accountType === ACCOUNT_TYPE.VIEW_ONLY

  const blockchain = useMemo(() => {
    const linkApprovalObject = jsonStr2Obj(ReduxService.getSettingOther('tokenApprovalCheckerLink'))
    let chainList = []
    if (typeView === 'nftViewer') {
      chainList = [
        mainnet.id,
        optimism.id,
        bsc.id,
        polygon.id,
        arbitrum.id,
        avalanche.id,
        base.id,
        linea.id,
        unichain.id
      ]
      chainList = chainList.map(chainId => {
        const chain = blockchainListRedux[chainId]
        if (chain) {
          return chain
        }
        return null
      })
    } else {
      chainList = LIST_DEFAULT_CHAIN_ID
      chainList = chainList.map(chainId => {
        const chain = blockchainListRedux[chainId]
        const link = linkApprovalObject[chainId]
        if (chain && link) {
          return chain
        }
        return null
      })
    }

    chainList = chainList.filter((item) => !!item)

    return chainList
  }, [blockchainListRedux, typeView])

  const handleViewExplorer = (chainId) => {
    if (!isAccountEVM) {
      return
    }
    if (typeView === 'blockScan') {
      const url = `https://blockscan.com/address/${account.address}`
      handleOpenUrl(url)
    }
    if (typeView === 'nftViewer') {
      handleOpenUrl(`https://nft.keyring.app/nft-list/${chainId}/${address}`)
    }

    if (typeView === 'revoke' && !isAccountViewOnly) {
      const linkApprovalObject = jsonStr2Obj(ReduxService.getSettingOther('tokenApprovalCheckerLink'))
      const link = linkApprovalObject[chainId].replace('{address}', address).trim()
      handleOpenUrl(link)
    }
  }

  const renderLabel = () => {
    let text
    if (typeView === 'blockScan') {
      text = I18n.t('v2.accountDetail.blockscan')
    }
    if (typeView === 'nftViewer') {
      text = 'KEYRING NFT'
    }

    if (typeView === 'revoke') {
      text = I18n.t('v2.accountDetail.revoke')
    }
    return <MyText className='text-medium'>{text}</MyText>
  }

  if (typeView === 'blockScan') {
    return (
      <TouchableOpacity activeOpacity={1} onPress={() => handleViewExplorer(STANDARD_CHAIN.Evm)} className='flex items-center flex-row flex-1 justify-between'>
        {renderLabel()}
        <MyIcon
          uri={images.UIV2.icons.explorerLink}
          variant='small'
        />
      </TouchableOpacity>
    )
  }

  return (
    <MySelectDropdown
      dropUp={typeView === 'nftViewer'}
      disabled={!isAccountEVM || (isAccountViewOnly && typeView === 'revoke')}
      showsVerticalScrollIndicator
      onSelect={chain => handleViewExplorer(chain.chainId)}
      data={Object.values(blockchain)}
      dropdownStyle={{
        width: width(100) - pixelByWidth(16) * 2,
        left: pixelByWidth(16),
        height: height(25),
        paddingVertical: 0,
        paddingLeft: 0
      }}
      renderItem={(chainInfo, index) => {
        const isLast = index === Object.values(blockchain).length - 1

        return (
          <MyActionRow
            isSelectDropdown
            noBorder={isLast}
            title={chainInfo?.name}
            leftElement={(
              <View className='overflow-hidden relative rounded-full' style={{ width: getSizeImgSquare('large'), alignItems: 'flex-end' }}>
                <MyIcon uri={chainInfo?.icon} isBorderIcon variant='medium' />
              </View>
            )}
          />
        )
      }}
    >
      <View style={{ opacity: isAccountViewOnly && typeView === 'revoke' ? 0.5 : 1 }} className='flex items-center flex-row flex-1 justify-between'>
        {renderLabel()}
        <MyIcon
          uri={images.UIV2.icons.explorerLink}
          variant='small'
        />
      </View>
    </MySelectDropdown>
  )
}

export default ViewExplorer
