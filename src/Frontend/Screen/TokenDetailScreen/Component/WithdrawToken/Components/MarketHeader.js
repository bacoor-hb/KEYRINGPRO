import React from 'react'
import { View, TouchableOpacity, Linking, Image } from 'react-native'

import MyText from 'frontend/Components/UI/MyText'
import { ImageRender } from 'frontend/Components/Common/ImageRender'

import images from 'assets/Image'
import I18n from 'assets/Lang'
import { Colors, pixelByHeight } from 'common/styles'
import { handleOpenExplorerUserAddress } from 'common/chain'

import { getProtocolLogo, getProtocolLabel } from '../protocolLogo'
import styles from '../styles'
import MyTextTicker from 'frontend/Components/UI/MyTextTicker'

/**
 * Which market this position belongs to, and where a withdrawal is sent.
 *
 * Two read-only blocks: the protocol row (name, receipt ticker, live APY, and a
 * link to the protocol's own page) and the pool / vault address the call goes
 * to. Nothing here depends on the amount being withdrawn, which is why it lives
 * apart from the form.
 *
 * @param {object} token       The receipt token the wallet holds (icon, symbol).
 * @param {object} lendingInfo Market metadata from `useGetLendingTokenInfo`.
 * @param {string} contract    Pool / vault address the withdrawal is sent to.
 * @param {number} chainId     Chain, for the explorer link.
 */
const MarketHeader = ({ token, lendingInfo, contract, chainId }) => {
  // Only when core resolved a URL for this market — discovered (uncurated)
  // markets carry none, and a dead link is worse than no link.
  const protocolUrl = lendingInfo?.protocolUrl

  // This row identifies the PROTOCOL, so it shows the protocol's own logo when
  // we ship one. Null for anything outside the four bundled families — then the
  // receipt token's icon stands in, which is at least the right market.
  const protocolLogo = getProtocolLogo(lendingInfo)

  // The title names the PROTOCOL, so it is not `lendingInfo.name` — for Morpho
  // that field carries the vault's name. See getProtocolLabel.
  const protocolLabel = getProtocolLabel(lendingInfo)

  const openSupplyInfo = () => {
    if (!protocolUrl) return
    Linking.openURL(protocolUrl).catch(() => {})
  }

  const apy = Number(lendingInfo?.currentApyPercent)

  return (
    <>
      <View style={styles.marketRow}>
        {/* A bundled logo is a local `require`d asset, not a URL, so it renders
            through Image directly — ImageRender's `uri` path is for the remote
            token icon it falls back to. */}
        {protocolLogo
          ? (
            <Image
              source={protocolLogo}
              style={styles.protocolIcon}
              resizeMode='contain'
            />
          )
          : (
            <ImageRender
              uri={token?.iconUrl}
              uriDefault={images.UIV2.icons.unknowToken}
              style={styles.protocolIcon}
              resizeMode='cover'
            />
          )}
        <View style={styles.marketTextWrap}>
          <MyText variant='subTitle' className='text-white'>
            {protocolLabel}
          </MyText>
          <View style={styles.marketMetaRow}>
            <MyText style={{ color: Colors.TEXT_MEDIUM }}>
              {token?.symbol ? `${token.symbol}: ` : ''}
            </MyText>
            {Number.isFinite(apy) ? (
              <MyText style={{ color: Colors.GREEN_TEXT }}>
                {/* toFixed, NOT formatNumberBro: that helper hardcodes
                    `trimMantissa: true`, so a 4.10% market renders "4.1%" and a
                    4.00% one renders "4%". A rate reads as a rate at a fixed 2
                    decimals, and it has to match the APY the card above shows.
                    `apy` is already Number.isFinite-gated by the caller. */}
                {I18n.t('v2.withdrawToken.apy', { value: apy.toFixed(2) })}
              </MyText>
            ) : null}
            {protocolUrl ? (
              <View
                style={{
                  flexDirection: 'row',
                  flex: 1
                }}>
                <MyText style={{ color: Colors.TEXT_MEDIUM }}> | </MyText>
                <TouchableOpacity
                  style={{
                    flex: 1
                  }}
                  activeOpacity={0.8}
                  onPress={openSupplyInfo}>
                  <MyTextTicker className='text-brand'>
                    {I18n.t('v2.withdrawToken.supplyInfo')}
                  </MyTextTicker>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>
      </View>
      <View
        style={{
          gap: pixelByHeight(14),
          marginVertical: pixelByHeight(14)
        }}
      >
        <MyText variant='subTitle' className='text-medium' style={styles.sectionTitle}>
          {I18n.t('v2.withdrawToken.sendToContract', {
            protocol: lendingInfo?.protocol || lendingInfo?.name || ''
          })}
        </MyText>
        <View>

          <TouchableOpacity
            style={styles.addressRow}
            activeOpacity={0.7}
            onPress={() => handleOpenExplorerUserAddress(contract, chainId)}
          >
            <MyText fontWeight={400} variant='subTitle' className='text-brand'>{contract}</MyText>
          </TouchableOpacity>
          <View style={styles.divider} />
        </View>

      </View>

    </>
  )
}

export default MarketHeader
