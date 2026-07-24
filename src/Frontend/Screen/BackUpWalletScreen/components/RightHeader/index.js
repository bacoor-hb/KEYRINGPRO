import React from 'react'
import I18n from 'assets/Lang'
import MyButton from 'frontend/Components/UI/MyButton'

const RightHeader = ({ handleCreate, isDisabled = false, isLoading = false }) => {
  return (
    <MyButton
      isUseHeader
      isLoading={isLoading}
      isDisable={isDisabled}
      onPress={handleCreate}
      size='small'
      style={{ }}
      label={I18n.t('Initial.create')}
    />
  )
}

export default RightHeader
