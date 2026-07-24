import React from 'react'
import { View, Text, Keyboard, TouchableWithoutFeedback, TouchableOpacity } from 'react-native'
import styles from './styles'
import I18n from 'assets/Lang'
import { ThemeContext } from 'frontend/Contexts/ThemeContext'
import { width } from 'common/styles'

export default function Template (p) {
  const {
    onChangeEnterPIN,
    onDeleteNumber,
    pincodeSize
  } = p.func

  const {
    fileName,
    enterPin
  } = p.state

  const ThreeButtonGroup = props => {
    const { value } = props
    const isDisable = enterPin.length === pincodeSize
    return (
      <ThemeContext.Consumer>{(context) => {
        return (
          <View style={styles.ThreeButtonGroup}>
            <TouchableOpacity disabled={isDisable && value[0] !== '.'} style={styles[`buttonBox${context.modeTheme}`]} onPress={onChangeEnterPIN(value[0])}>
              <Text style={[styles.buttonText, { color: context.styleTheme.color }]}>{value[0]}</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={isDisable} style={styles[`buttonBox${context.modeTheme}`]} onPress={onChangeEnterPIN(value[1])}>
              <Text style={[styles.buttonText, { color: context.styleTheme.color }]}>{value[1]}</Text>
            </TouchableOpacity>
            <TouchableOpacity disabled={isDisable && value[2] !== 'x'} style={styles[`buttonBox${context.modeTheme}`]} onPress={value[2] === 'x' ? onDeleteNumber() : onChangeEnterPIN(value[2])}>
              <Text style={[styles.buttonText, { color: context.styleTheme.color }]}>{value[2]}</Text>
            </TouchableOpacity>
          </View>
        )
      }}
      </ThemeContext.Consumer>
    )
  }

  const TwoButtonGroup = props => {
    const { value } = props
    const isDisable = enterPin.length === pincodeSize
    return (
      <ThemeContext.Consumer>{(context) => {
        return (
          <View style={styles.ThreeButtonGroup}>
            <TouchableOpacity disabled={isDisable} style={styles[`buttonBoxZero${context.modeTheme}`]} onPress={onChangeEnterPIN(value[0])}>
              <Text style={[styles.buttonText, { color: context.styleTheme.color }]}>{value[0]}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles[`buttonBox${context.modeTheme}`]} onPress={onDeleteNumber()}>
              <Text style={[styles.buttonText, { color: context.styleTheme.color }]}>{value[1]}</Text>
            </TouchableOpacity>
          </View>
        )
      }}
      </ThemeContext.Consumer>
    )
  }

  return (
    <ThemeContext.Consumer>{(context) => {
      return (
        <TouchableWithoutFeedback
          keyboardShouldPersistTaps='handled'
          onPress={Keyboard.dismiss}>
          <View style={styles.container}>
            <Text style={[styles.titleText, context.styleTheme.txtStyle]}>{fileName}</Text>
            <View style={styles.middleBox}>
              <Text style={[styles.enterPassTxt, { color: context.styleTheme.color }]}>{I18n.t('NFC.enterPass')}</Text>
              <View style={styles.EnteredCodeBox}>
                <View style={styles.circleNumberGroup}>

                  {
                    [...Array(pincodeSize).keys()].map(index => {
                      return (
                        <View
                          style={[styles.codeBox, {
                            ...pincodeSize > 4 ? {
                              height: width(10),
                              width: width(10)
                            } : {}
                          }]}
                          key={index}>
                          <Text style={[styles.codeTxt, { color: context.styleTheme.color }]}>{enterPin[index] ? '*' : '-'}</Text>
                        </View>
                      )
                    })
                  }
                </View>
              </View>
            </View>

            <View style={styles.InputCodeArea}>
              <ThreeButtonGroup value={[1, 2, 3]} />
              <ThreeButtonGroup value={[4, 5, 6]} />
              <ThreeButtonGroup value={[7, 8, 9]} />
              <TwoButtonGroup value={[0, 'x']} />
            </View>
          </View>
        </TouchableWithoutFeedback>
      )
    }}
    </ThemeContext.Consumer>
  )
}
