import { View, TouchableOpacity } from 'react-native'
import React from 'react'
import { cn } from 'common/tailwind'
import StatusMessage from '../StatusMessage'
import MyActionRow from '../MyActionRow'
import createStyles from './styles'
import MyText from '../MyText'
import { handleOpenUrl } from 'common/function'
import images from 'assets/Image'
import MyIcon from '../MyIcon'

/**
 * @param {StepTimeLineItem[]} data - Array of timeline step items
 * @param {string} [className] - Tailwind class for the container
 * @param {StyleProp<ViewStyle>} [style] - Container inline style
 */
const StepTimeLine = ({ data, className, style }) => {
  const styles = createStyles()

  const renderLine = () => {
    return (
      <View style={styles.containerLine}>
        <View style={styles.line} />
      </View>
    )
  }
  const renderDefault = (item, index) => {
    return (
      <MyActionRow
        key={`step-${index}`}
        noBorder
        leftElement={renderLine()}
        {...item}
      />
    )
  }

  const renderHash = (item, index) => {
    return (
      <MyActionRow
        key={`step-${index}`}
        noBorder
        leftElement={renderLine()}
        title={(
          <View style={styles.containerTxh}>
            <View style={{ flex: 1 }}>
              <TouchableOpacity
                onPress={() => {
                  if (item?.hashLink) {
                    handleOpenUrl(item.hashLink)
                  }
                }}>
                <MyText className='text-brand' {...item.hashConfig}>
                  {item.hash}
                </MyText>

              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.containerCopy}>
              <MyIcon variant='small' uri={images.UIV2.icons.copyWhite} />
            </TouchableOpacity>
          </View>
        )}

      />
    )
  }

  const renderProcess = (item, index) => {
    return (
      <MyActionRow
        key={`step-${index}`}
        noBorder
        leftElement={renderLine()}
        {...item}
      />
    )
  }

  const renderStatus = (item, index) => {
    <StatusMessage
      key={`step-${index}`}
      className='items-center'
      titleConfig={{
        className: 'text-green'
      }}
      style={{ alignItems: 'center', justifyContent: 'center' }}
      variant='success'
      {...item}
    />
  }

  const renderItem = (item, index) => {
    switch (true) {
      case item.status !== undefined:
        return renderStatus(item.status, index)
      case item.hash !== undefined:
        return renderHash(item.hash, index)
      case item.process !== undefined:
        return renderProcess(item.process, index)
      default:
        return renderDefault(item.default, index)
    }
  }
  return (
    <View className={cn('w-full  flex flex-col', className)} style={style}>
      {data?.map((item, index) => renderItem(item, index))}
    </View>
  )
}

export default StepTimeLine
