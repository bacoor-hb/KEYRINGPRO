import { StyleSheet } from 'react-native'
import { width, pixelByHeight, pixelByWidth, getSafeAreaValues } from 'common/styles'

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start'
  },
  headerArea: {
    width: '100%',
    alignItems: 'center',
    paddingTop: getSafeAreaValues().top
  },
  body: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-start',
    alignItems: 'center',
    position: 'relative'
  },
  scroll: {
    flex: 1,
    width: '100%'
  },
  // Expand the ScrollView frame on both sides (negative margin); the
  // scrollContent padding below offsets it back. Keeps button position while
  // moving the clip boundary outside the button edges, so the liquid glass
  // press effect isn't cut off.
  scrollClipFix: {
    marginHorizontal: -pixelByWidth(8)
  },
  scrollContent: {
    alignItems: 'center',
    flexGrow: 1,
    justifyContent: 'flex-start',
    gap: pixelByHeight(14),
    paddingBottom: pixelByHeight(14),
    paddingHorizontal: pixelByWidth(8)
  },
  imgLaunch: {
    marginBottom: pixelByHeight(22),
    height: width(75 * (686 / 676)),
    minWidth: width(75),
    maxWidth: width(75),
    resizeMode: 'contain'
  },
  content: {
    width: '100%',
    flex: 1,
    justifyContent: 'center',
    gap: pixelByHeight(16)
  },
  introText: {
    textAlign: 'center',
    lineHeight: pixelByHeight(22)
  },
  buttonGroup: {
    width: '100%',
    gap: pixelByHeight(14)
  },
  footer: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: getSafeAreaValues().bottom
  },
  policyRow: {
    flexDirection: 'row',
    paddingBottom: 0
  }
})

export default styles
