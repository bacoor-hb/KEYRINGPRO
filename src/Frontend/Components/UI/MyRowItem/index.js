import React from 'react'
import { TouchableOpacity, View } from 'react-native'
import MyIcon from 'frontend/Components/UI/MyIcon'
import createStyles from './styles'
import { mergeStyle } from 'common/tailwind'

const MyRowItem = ({ lefIcon, containerContentStyle = {}, bottomContent, noPadding = false, onPress = null, noBorder, disable = false, children, ...props }) => {
  const styles = createStyles()
  // `disable` dims the row and blocks the press in one prop, so callers don't have to
  // wire up both the opacity style and the `onPress ? null : ...` guard themselves.
  const handlePress = disable ? null : onPress
  const Container = handlePress ? TouchableOpacity : View

  return (
    <Container activeOpacity={1} {...props} onPress={handlePress} style={[styles.container, disable && styles.disabled, mergeStyle(props.style)]}>
      <View style={[styles.wrapperContainer, mergeStyle(props.style)]}>

        {lefIcon && (
          <>
            {typeof lefIcon === 'string' || typeof lefIcon === 'number' ? (
              <MyIcon value={lefIcon} />
            ) : (
              lefIcon
            )}

          </>
        )}
        <View style={[styles.containerContent, noBorder && { borderBottomWidth: 0 }, noPadding && { paddingVertical: 0 }, mergeStyle(containerContentStyle)]}>
          {children}
        </View>
      </View>
      {
        bottomContent && (
          <View style={styles.containerBottomContent}>
            {lefIcon && (
              <View style={{ opacity: 0, height: 0 }}>
                {typeof lefIcon === 'string' || typeof lefIcon === 'number' ? (
                  <MyIcon value={lefIcon} />
                ) : (
                  lefIcon
                )}

              </View>
            )}
            <View style={{ flex: 1 }}>
              {bottomContent}
            </View>
          </View>
        )
      }

    </Container>
  )
}

export default MyRowItem
