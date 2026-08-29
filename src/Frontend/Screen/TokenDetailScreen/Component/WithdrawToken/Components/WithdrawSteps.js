import React from 'react'
import { View, TouchableOpacity } from 'react-native'

import MyText from 'frontend/Components/UI/MyText'
import MyIcon from 'frontend/Components/UI/MyIcon'
import MyDotsLoading from 'frontend/Components/UI/MyDotsLoading'
import StatusMessage from 'frontend/Components/UI/StatusMessage'
import TxStepIcon from 'frontend/Components/UI/TxStepIcon'

import images from 'assets/Image'
import I18n from 'assets/Lang'
import { handleOpenExplorerHash, handleOpenExplorerUserAddress } from 'common/chain'

import styles from '../styles'
import { WITHDRAW_STEP } from '../useWithdrawFlow'

/**
 * The withdrawal's progress timeline: what is happening, the hash once it exists,
 * and the settled result.
 *
 * Structure and styling deliberately mirror the Send drawer's own timeline
 * (`SendToken.renderSteps`) — same step icons, same connector line, same
 * StatusMessage result rows — so the two signable operations on this screen
 * report progress identically.
 *
 * Rendered from `step` alone, with no state of its own, so the screen keeps the
 * whole state machine in one place.
 *
 * @param {string} step      Current WITHDRAW_STEP.
 * @param {string} [hash]    Transaction hash, once broadcast.
 * @param {string} [error]   Failure message, when the run errored.
 * @param {boolean} busy     Whether something is still in flight.
 * @param {number} chainId   Chain the tx was broadcast on (for the explorer link).
 * @param {string} [walletAddress] The signer — used for the explorer fallback
 *   shown while no hash exists yet.
 * @param {Function} onCopyHash Copies the explorer URL for the hash.
 */
const WithdrawSteps = ({ step, hash, error, busy, chainId, walletAddress, onCopyHash }) => {
  if (step === WITHDRAW_STEP.IDLE) return null

  return (
    <View style={styles.stepWrap}>
      {/* Withdrawing */}
      <View style={styles.stepRow}>
        <TxStepIcon uri={images.UIV2.icons.withdraw_white} />
        <View style={{ flex: 1 }}>
          <View style={styles.stepTitleRow}>
            <MyText fontWeight={700}>{I18n.t('v2.withdrawToken.withdrawing')}</MyText>
            {!hash && busy && <MyDotsLoading source={images.threeDotsWhiteLoading} />}
          </View>
          <MyText className='text-medium'>{I18n.t('v2.sendToken.approxTime')}</MyText>
        </View>
      </View>

      {/* Hash — tap to open the explorer, or copy the explorer URL. */}
      {hash ? (
        <View style={styles.stepRow}>
          <View style={styles.stepLineCol}>
            <View style={styles.stepLine} />
          </View>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => handleOpenExplorerHash(hash, chainId)}
          >
            <MyText className='text-brand'>{hash}</MyText>
          </TouchableOpacity>
          <TouchableOpacity onPress={onCopyHash} style={styles.copyBtn}>
            <MyIcon variant='small' uri={images.UIV2.icons.copyWhite} />
          </TouchableOpacity>
        </View>
      ) : null}

      {/* No hash yet → "Checking explorer" fallback (opens explorer at our
          address), the same escape hatch the Send drawer offers: the tx may well
          be in flight while the broadcast response is still outstanding, so the
          user is pointed at their own address rather than left with nothing to
          look up. */}
      {(!hash && busy) ? (
        <View style={styles.stepRow}>
          <View style={styles.stepLineCol}>
            <View style={styles.stepLine} />
          </View>
          <View style={{ flex: 1 }}>
            <MyText className='text-medium'>
              {I18n.t('v2.sendToken.checkExplorerHint')}
            </MyText>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleOpenExplorerUserAddress(walletAddress, chainId)}
            >
              <MyText className='text-brand'>{I18n.t('Initial.checkingExplorer')}</MyText>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Broadcast, still unconfirmed. */}
      {((!!hash && step === WITHDRAW_STEP.WITHDRAWING)) ? (
        <View style={styles.stepRow}>
          <TxStepIcon uri={images.UIV2.icons.icon_waiting_for_confirm_outline} />
          <MyText fontWeight={700}>{I18n.t('Initial.waitingCofirmation')}</MyText>
          <MyDotsLoading source={images.threeDotsWhiteLoading} />
        </View>
      ) : null}

      {/* Connector down to the result when no hash row carried the line — a run
          that failed before broadcasting never produced one. */}
      {(!hash && (step === WITHDRAW_STEP.DONE || step === WITHDRAW_STEP.ERROR)) ? (
        <View style={styles.stepConnectorCol}>
          <View style={styles.stepLine} />
        </View>
      ) : null}

      {step === WITHDRAW_STEP.DONE ? (
        <StatusMessage
          variant='success'
          title={I18n.t('Initial.success')}
          titleConfig={{ className: 'text-green', variant: 'subTitle' }}
          style={styles.statusResult}
        />
      ) : null}

      {step === WITHDRAW_STEP.ERROR ? (
        <StatusMessage
          variant='error'
          title={I18n.t('v2.common.fail')}
          titleConfig={{ className: 'text-red', variant: 'subTitle' }}
          message={error || I18n.t('v2.sendToken.txFailed')}
          style={styles.statusResult}
        />
      ) : null}
    </View>
  )
}

export default WithdrawSteps
