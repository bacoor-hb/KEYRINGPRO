import React from 'react'
import { width, Colors } from 'common/styles'
import SpinnerKit from 'react-native-spinkit'

const Spinner = ({ type = 'Bounce', size = width(7), color = Colors.WHITE, style }) => {
  return (
    <SpinnerKit type={type} size={size} color={color} style={style} isVisible />
  )
}

export default Spinner
