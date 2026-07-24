import React from 'react'
import I18n from 'assets/Lang'
import { View, TouchableOpacity } from 'react-native'
import MyText from 'frontend/Components/UI/MyText'
import MyIcon from 'frontend/Components/UI/MyIcon'
import images from 'assets/Image'

import styles from './styles'
import StatusMessage from 'frontend/Components/UI/StatusMessage'

// The account name is always a read-only label — the summary never lets the
// name be edited inline. `onEditName` (import / view-only flows) adds a trailing
// edit button that opens the stacked EditLabel drawer; when absent (auto-generated
// account, private key import) the name shows the default label with no edit
// affordance. `onCopyAddress` likewise adds a copy button to the address row.
//
// Each row's divider lives on the text column (fieldMain) only, so it never runs
// underneath the trailing action button.
const CreatedAccountSummary = ({ address, accountName, onCopyAddress, onEditName, title = I18n.t('v2.accountModal.createdNewAccount'), addressLabel = I18n.t('v2.accountModal.newAccountAddress') }) => {
  const canCopy = typeof onCopyAddress === 'function'
  const canEditName = typeof onEditName === 'function'

  return (
    <View>
      <StatusMessage
        variant='success'
        title={title}
        titleConfig={{ variant: 'subTitle', className: 'text-green' }}
        style={styles.successHeader}
      />

      <View style={styles.field}>
        <MyText className='text-low'>{addressLabel}</MyText>
        <View style={styles.fieldRow}>
          <View style={styles.fieldMain}>
            <MyText className='text-medium' style={styles.fieldValue}>
              {address}
            </MyText>
          </View>
          {canCopy ? (
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.fieldAction}
              className='bg-black flex justify-center items-center rounded-full overflow-hidden'
              onPress={() => onCopyAddress(address)}
            >
              <MyIcon uri={images.UIV2.icons.copyWhite} variant='small' />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.field}>
        <MyText className='text-low'>{I18n.t('v2.accountDetail.accountName')}</MyText>
        <View style={styles.fieldRow}>
          <View style={styles.fieldMain}>
            <MyText className='text-medium' style={styles.fieldValue}>
              {accountName}
            </MyText>
          </View>
          {canEditName ? (
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.fieldAction}
              className='bg-black flex justify-center items-center rounded-full overflow-hidden'
              onPress={onEditName}
            >
              <MyIcon uri={images.UIV2.icons.editWhite} variant='small' />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  )
}

export default CreatedAccountSummary
