import { TouchableWithoutFeedback } from 'react-native'
import I18n from 'assets/Lang'
import React, { useState } from 'react'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import createStyles from './styles'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import images from 'assets/Image'
import { useSelector } from 'react-redux'
import MyButton from 'frontend/Components/UI/MyButton'
import { fontSize } from 'common/styles'
import InputCustom from 'frontend/Components/UI/InputCustom'
import { FIELD_MIN_HEIGHT } from 'frontend/Screen/TokenDetailScreen/Component/SendToken/styles'
const MAX_CHARACTERS = 50

// Reusable across two call sites:
// - AccountDetail passes `_this` (uses activeAccount + _this.handleUpdateNameLabel).
// - The add-account success flow passes `account` + `initialName` + `onSave` to
//   edit a freshly created account that isn't the activeAccount.
const EditLabel = ({ _this, account: accountProp, initialName, onSave }) => {
  const handleUpdateNameLabel = onSave || _this?.handleUpdateNameLabel
  const { activeAccount } = useSelector(state => state)
  const account = accountProp || activeAccount?.account
  const styles = createStyles()
  const nameInitial = (initialName != null ? initialName : account?.name) || ''
  const [name, setName] = useState(nameInitial)

  return (
    <TouchableWithoutFeedback>
      <MyViewPage style={styles.container}>
        <TitleDrawer
          title={I18n.t('v2.accountDetail.editLabel')}
          leftIcon={images.UIV2.icons.editBrand}
          rightElement={(
            nameInitial !== name && name && (
              <MyButton onPress={() => handleUpdateNameLabel(name)} label={I18n.t('Initial.save')} disableLiquidGlass size='small' />
            )
          )}
        />

        <InputCustom
          // typeInput='area'
          placeholder={I18n.t('v2.accountDetail.enterNewLabel')}
          defaultValue=''
          value={name}
          maxLength={MAX_CHARACTERS}
          hinText={I18n.t('v2.accountDetail.charactersMaximum', { count: MAX_CHARACTERS - (name || '').length })}
          onChangeText={(value) => setName(value)}
          errorConfig={{
            style: {
              fontSize: fontSize('default')
            }
          }}
          inputWrapperConfig={{
            style: {
              minHeight: FIELD_MIN_HEIGHT
            }
          }}
        />

      </MyViewPage>
    </TouchableWithoutFeedback>

  )
}

export default EditLabel
