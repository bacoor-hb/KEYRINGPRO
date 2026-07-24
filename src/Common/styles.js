import { Dimensions, Platform, PixelRatio, StatusBar } from 'react-native'
import DeviceInfo from 'react-native-device-info'
import ReduxService from './redux'
import { initialWindowMetrics } from 'react-native-safe-area-context'
import { getHeightScreenAndroid } from 'frontend/Components/SafeViewAreaWrapper'
// import ExtraDimensions from 'react-native-extra-dimensions-android'
const CORE_RATIO = 667 / 375
export const MYWIDTH = Dimensions.get('window').width
export const MYHEIGHT = Dimensions.get('window').height
const MYSCALE = CORE_RATIO / (MYHEIGHT / MYWIDTH)
const guidelineBaseWidth = 375

export const width = num => PixelRatio.roundToNearestPixel(MYWIDTH * (num / 100))
export const height = num => PixelRatio.roundToNearestPixel(MYHEIGHT * (num / 100))
export const scale = (size) => PixelRatio.roundToNearestPixel(MYWIDTH / guidelineBaseWidth * size)
export const heightScale = num => PixelRatio.roundToNearestPixel(MYHEIGHT * (num * MYSCALE / 100))
export const isIphoneX = Platform.OS === 'ios' && (MYHEIGHT >= 812)
export const isNotchAndroid = Platform.OS === 'android' && DeviceInfo.hasNotch()
export const statusBarHeightAndroid = StatusBar.currentHeight || heightScale(isNotchAndroid ? 5 : 1.5)
export const topNavBar = ISIOS ? (isIphoneX ? 44 : 20) : 0
// export const heightHeader = (width(12.5) + topNavBar / 1.5) + height(3)
// export const heightHeader = ISIOS ? (isIphoneX ? 95 : 65) : 56
export const heightHeader = height(12) // 11% height of screen - contain info account (name, address)
export const safePaddingTopUnderHeader = ISIOS ? heightHeader - topNavBar : heightHeader
// export const SOFT_MENU_BAR_HEIGHT = Platform.OS === 'android' ? ExtraDimensions.get('SOFT_MENU_BAR_HEIGHT') : 0
export const SOFT_MENU_BAR_HEIGHT = 0
export const heightFullScreen = Dimensions.get('screen').height
export const heightScreenNotHeader = Platform.OS === 'android' ? (heightFullScreen - SOFT_MENU_BAR_HEIGHT - heightHeader - statusBarHeightAndroid) : height(100) - heightHeader

// footer
const homeIndicatorIOS = 34
const homeIndicatorAndroid = 34
const heightFooterIOS = 49 + (isIphoneX ? homeIndicatorIOS : 0)
const heightFooterAndroid = 56
export const homeIndicatorHeight = ISIOS ? homeIndicatorIOS : homeIndicatorAndroid
export const heightFooter = ISIOS ? heightFooterIOS : heightFooterAndroid

export const Font = {
  EN: {
    GEIST: 'Geist-Regular',
    GEIST_MEDIUM: 'Geist-Medium',
    GEIST_BOLD: 'Geist-Bold'
  },
  JP: {
    LINE_SEED_REGULAR: 'LINESeedJPApp_TTF-Regular',
    LINE_SEED_BOLD: 'LINESeedJPApp_TTF-Bold'
  },
  KR: {
    LINE_SEED_REGULAR: 'LINESeedSansKR-Regular',
    LINE_SEED_BOLD: 'LINESeedSansKR-Bold'
  },
  TH: {
    LINE_SEED_REGULAR: 'LINESeedSansTHApp-Regular',
    LINE_SEED_BOLD: 'LINESeedSansTHApp-Bold'
  },
  TW: {
    LINE_SEED_REGULAR: 'LINESeedTW_TTF-Regular',
    LINE_SEED_BOLD: 'LINESeedTW_TTF-Bold'
  }
}

export const Colors = {
  WHITE: '#FFFFFF',
  WHITE3: '#F4F4FC',
  GRAY3: '#F2F2F2',
  GRAY2: '#E0E0E0',
  GRAY: '#BDBDBD',
  GRAY1: '#828282',
  NOT_ACTIVE: '#555555',
  DARK_BLUE: '#535E7A',
  TEXT: '#333333',
  BLUE4: '#171F2A',
  BLACK: '#050508',
  BOX_SECONDARY: '#09090A',
  BLUE: '#2D8DED',
  BLUE1: '#2F80ED',
  BLUE5: '#00A3FF',
  HEADERLINE: '#00E8B4',
  GREEN1: '#00C398',
  GREEN: '#27AE60',
  GREEN_TEXT: '#00D36C',
  RED: '#FF3D4A',
  RED_TEXT: '#FF3D4A',
  ORANGE: '#FF9900',
  YELLOW: '#F2C94C',
  YELLOW2: 'rgba(242, 201, 76, 0.3)',
  RED015: 'rgba(233, 51, 36, 0.15)',
  BG_BOX_SMALL: '#28292E',
  BG_BOX_SECONDARY: '#09090A',
  TEXT_MEDIUM: '#BABEC4',
  TEXT_LOW: '#767F8C',
  BRAND: '#2D8DED',
  BG_INPUT_FIELD: '#121314',
  BG_MAIN_DRAWER: '#212229',
  BG_BACK_DROP_MODAL: 'rgba(0,0,0,0.2)',
  BG_ICON_NO_BG: '#4C515A80'
}

export const DarkColors = {
  WHITE: '#FFFFFF',
  GRAY2: '#E0E0E0',
  GRAY: '#BDBDBD',
  GRAY1: '#828282',
  TEXT2: '#8B98A4',
  GRAY4: '#49535E',
  TEXT1: '#535E7A',
  BLUE2: '#242D36',
  BLACK: '#000000',
  BACKGROUND: '#11161D',
  BACKGROUND_BOX: '#181F2A',
  BLUE: '#00A3FF',
  BLUE1: '#2F80ED',
  GREEN: '#00E8B4',
  RED: '#FF4545CC',
  RED_TEXT: '#FF3D4A',
  YELLOW: '#F2C94C',
  ORANGE: '#F28626'
}

/**
 * Common style for app
 *
 * These styles are based on iPhone 11 screen size
 * Other device screen sizes will be auto scale
 * Scale = 4.13793 (based on iPhone 11)
 * Example:
 *    _100px: width(24.2) => width(24.2) = 100 / 4.13793 = 24.2
 */
const size = {}

const margin = {
  mt: {},
  ml: {},
  mr: {},
  mb: {}
}
const padding = {
  pt: {},
  pl: {},
  pr: {},
  pb: {}
}
for (let i = 1; i <= 200; i++) {
  size[`_${i}px`] = width(i / 4.13793)

  margin.mt[`_${i}px`] = { marginTop: size[`_${i}px`] }
  margin.ml[`_${i}px`] = { marginLeft: size[`_${i}px`] }
  margin.mr[`_${i}px`] = { marginRight: size[`_${i}px`] }
  margin.mb[`_${i}px`] = { marginBottom: size[`_${i}px`] }

  padding.pt[`_${i}px`] = { paddingTop: size[`_${i}px`] }
  padding.pl[`_${i}px`] = { paddingLeft: size[`_${i}px`] }
  padding.pr[`_${i}px`] = { paddingRight: size[`_${i}px`] }
  padding.pb[`_${i}px`] = { paddingBottom: size[`_${i}px`] }
}

export const { mt, ml, mr, mb } = margin
export const { pt, pl, pr, pb } = padding

export const commonSize = {
  ...size,
  text: size._16px,
  title: size._24px,
  icon: {
    width: size._24px,
    height: size._24px
  },
  iconHeader: {
    width: size._100px,
    height: size._100px
  },
  iconSize: {
    width: 28, // 28 is icon size in footer
    height: 28 // 28 is icon size in footer
  }
}

export const flex = {
  1: {
    flex: 1
  },
  row: {
    display: 'flex',
    flexDirection: 'row'
  },
  col: {
    display: 'flex',
    flexDirection: 'column'
  },
  justifyCenter: {
    justifyContent: 'center'
  },
  justifyStart: {
    justifyContent: 'flex-start'
  },
  justifyEnd: {
    justifyContent: 'flex-end'
  },
  justifyBetween: {
    justifyContent: 'space-between'
  },
  justifyArount: {
    justifyContent: 'space-around'
  },
  itemsCenter: {
    alignItems: 'center'
  },
  itemsStart: {
    alignItems: 'flex-start'
  },
  itemsEnd: {
    alignItems: 'flex-end'
  }
}

export const commonRowBackground = {
  Lightmode: {
    // even row
    0: {
      backgroundColor: Colors.GRAY2,
      borderColor: Colors.GRAY2,
      borderBottomWidth: 1
    },
    // odd row
    1: {
      backgroundColor: Colors.GRAY3,
      borderColor: Colors.GRAY2,
      borderBottomWidth: 1
    }
  },
  Darkmode: {
    // even row
    0: {
      backgroundColor: DarkColors.BLUE2,
      borderColor: DarkColors.GRAY4,
      borderBottomWidth: 1
    },
    // odd row
    1: {
      backgroundColor: DarkColors.BACKGROUND_BOX,
      borderColor: DarkColors.GRAY4,
      borderBottomWidth: 1
    }
  }
}

/**
 * Convert pixel to height screen: pixel size in design figma
 * @param {number} pixel - The pixel value to convert
 * @param {boolean} noConvert - Whether to convert the pixel value
 * @returns {number} The height value in pixels
 */
export const pixelByHeight = (pixel) => {
  return pixel
}

/**
 * Convert pixel to width screen: pixel size in design figma
 * @param {number} pixel - The pixel value to convert
 * @param {boolean} noConvert - Whether to convert the pixel value
 * @returns {number} The width value in pixels
 */
export const pixelByWidth = (pixel) => {
  return pixel
}

// How many design-pixels smaller a number's decimal part renders vs its integer
// part. Single knob shared by MyText (variant path, via `isUseDecimal`) and
// MyNumber (explicit-fontSize path) so every formatted number — % changes,
// totals, balances — shrinks its decimals by the same step. Bump to make the
// effect more pronounced everywhere at once.
export const DECIMAL_DOWN_PIXEL = 0

// CJK locales whose glyphs read a touch large at the Latin base size — shrink
// their text by 1px. Read from `localeRedux` (the app's language key: 'jp' /
// 'cn' / 'cn2'), so it live-updates when the user switches language.
const COMPACT_FONT_LOCALES = ['jp', 'cn', 'cn2']
export const localeFontDelta = () => {
  const locale = ReduxService.getReduxDataByKey('localeRedux')
  return COMPACT_FONT_LOCALES.includes(locale) ? -1.3 : 0
}

/**
 * font size by width
 * @param {number} pixel - The pixel value to convert or small (14px), default (16.5px), subTitle (18px), title (30px), titleLarge (33px)
 * @param {boolean} noConvert - Whether to convert the pixel value
 * @param {boolean} skipLocaleScale - Skip the per-locale -1px tweak (used by
 *   sizeImageSquare so icon/image sizes never shrink with the CJK locales)
 * @returns {number} The width value in pixels
 * @note sizeUp: 13 -> 14, 15 -> 16.5, 27 -> 30
 * @note variant: fontSize(15) -> fontSize('default')
 */
export const fontSize = (pixel = 'default', noConvert = false, skipLocaleScale = false) => {
  // Per-locale text tweak: CJK locales render 1px smaller. Excluded from image
  // sizing via skipLocaleScale (see sizeImageSquare).
  const delta = skipLocaleScale ? 0 : localeFontDelta()

  if (typeof pixel === 'string') {
    switch (pixel) {
      case 'small':
        return 14 + delta
      case 'default':
        return 16.5 + delta
      case 'subTitle':
        return 18 + delta
      case 'title':
        return 30 + delta
      case 'titleLarge':
        return 33 + delta
    }
  }

  // const onePixel = width(1 / 4.13793)
  // const minSize = 12
  // const pixelUp = pixel - 12

  // if (noConvert) {
  //   return pixel
  // }
  // if (pixel < minSize) {
  //   return pixel * onePixel
  // }

  // pixelUp = pixelUp * 1.3 // up to 20% by pixel

  // return (minSize * onePixel) + (pixelUp * onePixel)
  // return pixel * onePixel

  return pixel + delta
}

/**
 * size image square by width
 * @param {number} pixel - The pixel value to convert
 * @param {boolean} usePixelByHeight - Whether to use pixelByHeight for calculation
 * @param {boolean} noConvert - Whether to convert the pixel value
 * @returns {number} The width value in pixels
 * @note sizeImageSquare(40)(before) -> getSizeImgSquare('large')(after)
 */
export const sizeImageSquare = (pixel, usePixelByHeight = false, noConvert = false) => {
  if (usePixelByHeight) {
    return pixelByHeight(pixel, noConvert)
  }
  // Image/icon squares must NOT shrink with the CJK locales — skip the -1px tweak.
  return fontSize(pixel, noConvert, true)
}

/**
 * size image square by width
 * @param {string} variant - small (20px) | medium (28px) | title (26px) | large (44px) | extraLarge(52px)
 * @param {number} sizeCustom - Custom size image
 * @note sizeUpto: 18 -> 20, 24 -> 28, 40 ->44
 * @note variant: sizeImageSquare(40)(before) -> getSizeImgSquare('large')(after)
 */
export const getSizeImgSquare = (variant = 'medium', sizeCustom) => {
  if (sizeCustom) {
    return sizeImageSquare(sizeCustom)
  }

  switch (variant) {
    case 'small':
      return sizeImageSquare(20)
    case 'medium':
      return sizeImageSquare(28)
    case 'title':
      return sizeImageSquare(26)
    case 'large':
      return sizeImageSquare(44)
    case 'extraLarge':
      return sizeImageSquare(52)
  }
}

export const getSafeAreaValues = (defaultValueBottom = 24, defaultValueTop = 24) => {
  let bottom = defaultValueBottom
  let top = defaultValueTop

  try {
    bottom = initialWindowMetrics.insets?.bottom
    top = initialWindowMetrics.insets?.top

    if (bottom < defaultValueBottom) {
      bottom = defaultValueBottom
    }

    if (top < defaultValueTop) {
      top = defaultValueTop
    }

    if (!ISIOS) {
      top = 10
    }

    return {
      ...initialWindowMetrics.insets,
      bottom,
      top

    }
  } catch (error) {
    if (!ISIOS) {
      top = 10
    }
    return {
      bottom: defaultValueBottom,
      top: defaultValueTop
    }
  }
}

export const getHeightScreen = () => {
  if (ISIOS) {
    return height(100)
  }
  const heightScreenAndroid = getHeightScreenAndroid()

  return heightScreenAndroid || height(100)
}

// design is 62px
export const getHeightHeader = (addSafeAreaTop = false, heightByPixel = 62) => {
  const onePixel = 1
  if (addSafeAreaTop) {
    return heightByPixel * onePixel + getSafeAreaValues().top
  }

  return heightByPixel * onePixel
}

// 16 is  padding-top for content
export const PADDING_TOP_CONTAINER_DRAWER = 16
// design is 64px
export const getHeightHeaderDrawer = (isHashBorder = true) => {
  if (isHashBorder) {
    return pixelByHeight(70 - PADDING_TOP_CONTAINER_DRAWER)
  }
  return pixelByHeight(70)
}

/**
 * Get the appropriate font family based on the current locale and font weight.
 *
 * @param {number} [fontWeight=400|500|700] - The desired font weight (e.g., 400, 500, 700).
 * @returns {string} The font family name corresponding to the current locale and specified font weight.
 */
export const getFontFamily = (fontWeight = 400) => {
  // Normalize to number so callers can pass '700' (string) or 700 safely.
  // Without this, strict comparisons below silently fall back to Regular.
  fontWeight = Number(fontWeight) || 400

  const locale = ReduxService.getReduxDataByKey('localeRedux')

  switch (locale) {
    case 'jp':
      return fontWeight === 700 ? Font.JP.LINE_SEED_BOLD : Font.JP.LINE_SEED_REGULAR
    case 'kr':
      return fontWeight === 700 ? Font.KR.LINE_SEED_BOLD : Font.KR.LINE_SEED_REGULAR
    case 'th':
      return fontWeight === 700 ? Font.TH.LINE_SEED_BOLD : Font.TH.LINE_SEED_REGULAR
    case 'cn':
    case 'cn2':
      return fontWeight === 700 ? Font.TW.LINE_SEED_BOLD : Font.TW.LINE_SEED_REGULAR
    default:
      return fontWeight === 700 ? Font.EN.GEIST_BOLD : fontWeight === 500 ? Font.EN.GEIST_MEDIUM : Font.EN.GEIST
  }
}
