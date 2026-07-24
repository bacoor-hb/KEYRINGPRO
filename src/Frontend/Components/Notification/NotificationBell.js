import React from 'react'
import { View, StyleSheet } from 'react-native'
import MyButton from 'frontend/Components/UI/MyButton'
import MyIcon from 'frontend/Components/UI/MyIcon'
import MyText from 'frontend/Components/UI/MyText'
import useNotifications from 'frontend/Hooks/useNotifications'
import NotificationDrawer from './NotificationDrawer'
import images from 'assets/Image'
import { Colors, getHeightHeader, getHeightScreen } from 'common/styles'

export default function NotificationBell ({ func }) {
  const { unreadList } = useNotifications()

  if (!unreadList.length) return null

  const handlePress = () => {
    func?.openDrawer({
      heightDrawer: getHeightScreen() - getHeightHeader(true),
      children: <NotificationDrawer />
    })
  }

  return (
    <View style={styles.wrapper}>
      <MyButton
        noMinWidth
        size='small'
        isCircleBtn
        onPress={handlePress}
        activeOpacity={0.7}
        style={{ paddingHorizontal: 0 }}
        label={<MyIcon variant='title' uri={images.UIV2.icons.notiMedium} />}
      />
      <View style={styles.badge}>
        <MyText fontSize={12} fontWeight='700' className='text-white'>
          {unreadList.length > 9 ? '9+' : unreadList.length}
        </MyText>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative'
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.RED_TEXT,
    borderWidth: 1,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center'
  }
})
