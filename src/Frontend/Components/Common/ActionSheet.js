/* eslint-disable react-native/no-unused-styles */
import React, { useContext } from 'react'
import { View, FlatList, StyleSheet, TouchableOpacity, Text, ScrollView } from 'react-native'
import { height, width, DarkColors, Colors, homeIndicatorHeight, scale, MYWIDTH, MYHEIGHT, heightScreenNotHeader, commonRowBackground } from 'common/styles'
import { isArrayWithData, keyExtractor } from 'common/function'
import Button from './Button'
import { ThemeContext } from 'frontend/Contexts/ThemeContext'

const styles = StyleSheet.create({

  containerInfo: {
    position: 'absolute',
    borderTopRightRadius: 10,
    borderTopLeftRadius: 10,
    width: width(100),
    left: 0,
    right: 0,
    paddingVertical: height(1.5),
    bottom: 0,
    justifyContent: 'flex-start',
    alignItems: 'center',
    alignSelf: 'center',
    zIndex: 99,
    paddingBottom: homeIndicatorHeight,
    maxHeight: heightScreenNotHeader
  },
  containerInfoLightmode: {
    position: 'absolute',
    width: width(100),
    backgroundColor: 'white'
  },
  containerInfoDarkmode: {
    position: 'absolute',
    width: width(100),
    backgroundColor: DarkColors.BACKGROUND_BOX
  },

  contentContainerStyle: {
    width: width(100),
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    paddingHorizontal: width(4)
  },
  subTitleLightmode: {
    color: Colors.GRAY1,
    marginBottom: height(2)
  },
  subTitleDarkmode: {
    color: DarkColors.TEXT2,
    marginBottom: height(2)
  },
  rightViewOption: {
    height: '100%',
    position: 'absolute',
    paddingVertical: height(1),
    paddingHorizontal: width(0),
    right: width(4),
    top: 0,
    justifyContent: 'center',
    alignItems: 'center'
  },
  rowContainer: {
    textAlign: 'left',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    // marginBottom: height(0.5),
    backgroundColor: 'transparent',
    width: width(92 - 8),
    height: height(8),
    borderRadius: 0,
    paddingLeft: 0
  },
  buttonTextLightmode: {
    textAlign: 'left',
    color: Colors.TEXT,
    fontSize: width(4.5)
  },
  buttonTextDarkmode: {
    textAlign: 'left',

    color: DarkColors.WHITE,
    fontSize: width(4.5)
  },
  buttonInside: {
    textAlign: 'left'
  },
  backgroundBlur: {
    height: MYHEIGHT,
    width: MYWIDTH,
    position: 'relative',
    backgroundColor: 'transparent'
  },
  backgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0
  },
  txtTitleBox: {
    width: width(100),
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: width(4),
    marginVertical: height(3)
  },
  txtTitle: {
    textAlign: 'left',
    fontSize: width(5.5)
  },
  tokenIcon: {
    marginRight: width(3),
    width: width(5.5),
    height: width(5.5)
  },
  lineClose: {
    width: width(15),
    borderRadius: scale(3.5),
    height: scale(3.5),
    marginBottom: height(1.5),
    alignSelf: 'center'
  },
  lineCloseLightmode: {
    backgroundColor: '#BDBDBD'
  },
  lineCloseDarkmode: {
    backgroundColor: '#49535E'
  },
  rowOddLightmode: {
    backgroundColor: '#F2F2F2'
  },
  rowOddDarkmode: {
    backgroundColor: '#242D36'
  }
})

const ActionSheet = (props) => {
  const {
    backdropPressToClose,
    showSwpipeIconBottomSheet,
    closeSheet,
    sheetData,
    sheetTitle,
    options
  } = props

  const {
    srollViewStyle
  } = options

  const { modeTheme } = useContext(ThemeContext)

  const onPress = (item) => () => {
    closeSheet()
    item.action()
  }

  const renderItem = ({ item, index }) => {
    return (
      <TouchableOpacity
        activeOpacity={1}
        style={[
          styles.contentContainerStyle,
          commonRowBackground[modeTheme][index % 2],
          { borderBottomWidth: 0 },
          item.contentContainerStyle

        ]}
      >
        {item?.customsRow
          ? (
            <View style={[styles.rowContainer, { width: '100%' }, item.rowContainer]}>
              {item.customsRow}
            </View>
          )
          : (
            <>
              <Button
                isDisable={item.isDisable}
                styleInside={styles.buttonInside}
                textStyle={[styles[`buttonText${modeTheme}`], item.textStyle]}
                style={[styles.rowContainer, item.subTitle ? { height: height(6) } : null]}
                onPress={onPress(item)}
                label={item.name}
              />
              {item.subTitle ? (
                <TouchableOpacity activeOpacity={0.7} onPress={onPress(item)}>
                  <Text style={styles[`subTitle${modeTheme}`]}>{item.subTitle}</Text>
                </TouchableOpacity>
              ) : null}
              {item.rightViewOption ? (
                <View style={[styles.rightViewOption, item.subTitle ? { height: height(6) } : {}]}>
                  {item.rightViewOption}
                </View>
              ) : null}
            </>

          )}

      </TouchableOpacity>
    )
  }

  return (
    <View style={styles.backgroundContainer}>
      <TouchableOpacity style={styles.backgroundBlur} onPress={backdropPressToClose ? closeSheet : () => null} />
      <View style={[styles.containerInfo, styles[`containerInfo${modeTheme}`]]}>
        {
          showSwpipeIconBottomSheet ? (
            <View style={[styles.lineClose, styles[`lineClose${modeTheme}`]]} />
          ) : null
        }

        {sheetTitle}

        {
          isArrayWithData(sheetData, false) ? (
            <ScrollView style={srollViewStyle}>
              <FlatList
                data={sheetData}
                extraData={sheetData}
                renderItem={renderItem}
                scrollEnabled={false}
                showsVerticalScrollIndicator={false}
                keyExtractor={keyExtractor}
              />
            </ScrollView>
          ) : (
            sheetData
          )
        }

      </View>
    </View>

  )
}

export default ActionSheet
