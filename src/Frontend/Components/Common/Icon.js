import React from 'react'
import { width, Colors } from 'common/styles'
import { IconType } from 'common/constants/app'
import { Ionicons } from '@react-native-vector-icons/ionicons'
import { AntDesign } from '@react-native-vector-icons/ant-design'
import { MaterialDesignIcons } from '@react-native-vector-icons/material-design-icons'
export const Icon = ({
  name,
  Type = IconType.Ionicons,
  size = width(8),
  color = Colors.TEXT,
  style
}) => {
  return (
    Type === IconType.Ionicons ? (
      <Ionicons name={name} size={size} color={color} style={style} />
    ) : Type === IconType.AntDesign ? (
      <AntDesign name={name} size={size} color={color} style={style} />
    ) : Type === IconType.Material ? (
      <MaterialDesignIcons name={name} size={size} color={color} style={style} />
    ) : <></>
  )
}
