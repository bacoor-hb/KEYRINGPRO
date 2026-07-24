import React from 'react'
import MyButton from 'frontend/Components/UI/MyButton'
import I18n from 'assets/Lang'

const RightHeader = ({ handleOtherNetwork }) => {
  return (
    <MyButton
      isUseHeader
      onPress={handleOtherNetwork}
      size='small'
      label={I18n.t('v2.network.otherNetwork')}
    />
  )
}

export default RightHeader
