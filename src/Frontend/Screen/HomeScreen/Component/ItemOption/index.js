import MyActionRow from 'frontend/Components/UI/MyActionRow'
import createStyles from '../../styles'
import { View } from 'react-native'
import MyIcon from 'frontend/Components/UI/MyIcon'
import images from 'assets/Image'
import { pixelByWidth } from 'common/styles'

const ItemOption = ({ rightContent, ...props }) => {
  const styles = createStyles()

  return (
    <MyActionRow
      // flexShrink:1 lets a long rightContent (e.g. token balance) shrink and
      // truncate instead of overrunning the row's title label.
      rightElement={(
        <View className='flex flex-row items-center justify-center' style={{ gap: pixelByWidth(12), flexShrink: 1 }}>
          {rightContent}
          <View style={[styles.iconArrow]}>
            <MyIcon
              resizeMode='contain'
              uri={images.UIV2.icons.arrowRightLow}
              variant='small'
            />
          </View>
        </View>
      )}
      iconConfig={{ style: { alignItems: 'flex-start', width: 'auto' } }}
      {...props}
    />
  )
}

export default ItemOption
