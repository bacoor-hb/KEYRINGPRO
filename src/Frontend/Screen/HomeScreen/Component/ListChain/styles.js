import { Colors, getSizeImgSquare } from 'common/styles'
import { StyleSheet } from 'react-native'

const createStyles = () => {
  return StyleSheet.create({
    // Step (layout box) between stacked icons. Narrower than the icon's visible
    // sizeImageSquare(18) so each icon (absolute, left:0) overflows right and
    // overlaps the next. The `- 2` pulls each icon further left by the LITERAL
    // 2px ring: the icon's visible width is `inner + 2px border`, and since the
    // inner is `sizeImageSquare(18) - 2` the border must be added back into the
    // overlap as a plain 2 (not scaled) to keep the original overlap amount.
    containerIconChain: {
      width: getSizeImgSquare('small') / 1.3 - 2,
      height: getSizeImgSquare('small'),
      position: 'relative'
    },
    containerContentIconChain: {
      position: 'absolute',
      left: 0,
      borderRadius: 100,
      backgroundColor: Colors.BLACK
    }
  })
}

export default createStyles
