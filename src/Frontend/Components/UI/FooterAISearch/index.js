import React from 'react'
import { View, TouchableOpacity, StyleSheet } from 'react-native'
import LinearGradient from 'react-native-linear-gradient'
import images from 'assets/Image'
import MyIcon from 'frontend/Components/UI/MyIcon'
import MyButton from 'frontend/Components/UI/MyButton'
import GlassView from 'frontend/Components/UI/GlassView'
import { NavigationActions } from 'src/navigation/NavigationService'
import { NAME_SCREEN } from 'common/constants/navigation'
import { AI_SEARCH_SESSION } from 'common/aiSearchHistory'
import { Colors, pixelByWidth, pixelByHeight, getSafeAreaValues, getSizeImgSquare } from 'common/styles'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import I18n from 'assets/Lang'
import MyTextTicker from 'frontend/Components/UI/MyTextTicker'

const BTN_SIZE = getSizeImgSquare('large')
const PADDING_TOP = pixelByHeight(8)
const SAFE_BOTTOM = getSafeAreaValues().bottom
// Exported so the host list can pad its bottom by the footer height — the footer
// floats over the list so tokens can scroll underneath it (iOS 26 style).
export const FOOTER_AISEARCH_HEIGHT = BTN_SIZE + PADDING_TOP + SAFE_BOTTOM

// Scrim behind the floating footer: a fade zone above the buttons darkens the
// tokens scrolling underneath. Anchored to Colors.BLACK (00 = transparent, CC ≈ 80%).
const SCRIM_FADE = pixelByHeight(40)
const SCRIM_COLORS = [`${Colors.BLACK}00`, `${Colors.BLACK}CC`, `${Colors.BLACK}CC`]
const SCRIM_LOCATIONS = [0, SCRIM_FADE / (SCRIM_FADE + FOOTER_AISEARCH_HEIGHT), 1]

const styles = StyleSheet.create({
  // Floats over the list so tokens scroll underneath and fade into the scrim.
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: pixelByWidth(24),
    paddingHorizontal: pixelByWidth(16),
    paddingTop: PADDING_TOP,
    paddingBottom: SAFE_BOTTOM
  },
  // Extends above the buttons (negative top) for a gradual fade into dark.
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: -SCRIM_FADE
  },
  roundBtn: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    paddingHorizontal: 0
  },
  searchWrap: {
    flex: 1,
    height: BTN_SIZE,
    borderRadius: 24
  },
  searchInner: {
    flex: 1,
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: pixelByWidth(8),
    paddingHorizontal: pixelByWidth(16)
  },
  searchIcon: {
    width: getSizeImgSquare('small'),
    height: getSizeImgSquare('small')
  },
  searchLabel: {
    color: Colors.TEXT_MEDIUM
  }
})

/**
 * @param {Function} onPressHiddenTokens - Callback when the hide-tokens button is pressed
 * @param {Function} onPressScan - Callback when the scan/WalletConnect button is pressed
 * @param {Function} [onPressSearch] - Callback when the search bar is pressed
 * @param {boolean} [hideScan] - Whether to hide the scan button
 * @param {boolean} [hideSearch] - Whether to hide the search bar
 * @param {string} [placeholder] - Placeholder text for the search bar
 */
const FooterAISearch = ({
  onPressHiddenTokens,
  onPressScan,
  onPressSearch,
  hideScan = false,
  hideSearch = false,
  placeholder = I18n.t('v2.aiSearch.searchPlaceholder')
}) => {
  const handlePressSearch = onPressSearch || (() => NavigationActions.navigate(NAME_SCREEN.aiSearch, { sessionKey: AI_SEARCH_SESSION.general }))

  return (
    <MyViewPage style={styles.container}>
      <LinearGradient
        colors={SCRIM_COLORS}
        locations={SCRIM_LOCATIONS}
        style={styles.scrim}
        pointerEvents='none'
      />
      <MyButton
        noMinWidth
        size='small'
        style={styles.roundBtn}
        onPress={onPressHiddenTokens}
      >
        <MyIcon variant='title' uri={images.UIV2.icons.eyeHide} />
      </MyButton>
      <>

        {!hideSearch && (
          <TouchableOpacity activeOpacity={0.8} style={styles.searchWrap} onPress={handlePressSearch}>
            <GlassView interactive effect='clear' style={styles.searchWrap}>
              <View style={styles.searchInner}>
                <MyIcon uri={images.UIV2.icons.aiChat} style={styles.searchIcon} />
                <View
                  style={{
                    flex: 1
                  }}
                >
                  <MyTextTicker style={styles.searchLabel}>{placeholder}</MyTextTicker>
                </View>
              </View>
            </GlassView>
          </TouchableOpacity>
        )}

        {!hideScan && (
          <MyButton
            noMinWidth
            size='small'
            style={styles.roundBtn}
            onPress={onPressScan}
          >
            <MyIcon variant='title' uri={images.UIV2.icons.home.walletConnect} />
          </MyButton>
        )}
      </>

    </MyViewPage>
  )
}

export default FooterAISearch
