import React, { useState, useCallback } from 'react'
import I18n from 'assets/Lang'
import { Modal, View, ActivityIndicator, TouchableOpacity } from 'react-native'
import { Colors } from 'common/styles'
import MyText from 'frontend/Components/UI/MyText'
import MyButton from 'frontend/Components/UI/MyButton'
import { signX402 } from './signX402'
import styles from './styles'

// Known small-unit decimals so the card can show a human amount; falls back to
// the raw value for unknown assets.
const DECIMALS = { USDC: 6, USDT: 6, DAI: 18, WETH: 18, ETH: 18 }
const short = (a) => (a && a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || '')
const fmtAmount = (amount, asset) => {
  const d = DECIMALS[(asset || '').toUpperCase()]
  if (d == null) return `${amount} ${asset || ''}`.trim()
  const n = Number(amount) / 10 ** d
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${asset}`
}

/**
 * Modal driven by the core's inline x402 signer. While `chat()` is awaiting a
 * signature, the core calls the host signer, which surfaces this sheet. The user
 * approves → we sign the typed data with their wallet → resolve with the
 * signature; the core then re-calls the paid API and answers. Cancel → resolve
 * with null (the core reports the payment was declined).
 */
export default function X402SignModal ({ request, walletAddress, onResolve }) {
  const [signing, setSigning] = useState(false)
  const [error, setError] = useState('')

  const visible = !!request
  const display = request?.display || {}

  const approve = useCallback(async () => {
    setError('')
    setSigning(true)
    try {
      const signature = await signX402(request.typedData, walletAddress)
      setSigning(false)
      onResolve?.(signature)
    } catch (e) {
      setSigning(false)
      setError(e?.message || I18n.t('v2.x402.couldNotSign'))
    }
  }, [request, walletAddress, onResolve])

  const cancel = useCallback(() => {
    if (signing) return
    setError('')
    onResolve?.(null)
  }, [signing, onResolve])

  return (
    <Modal visible={visible} transparent animationType='slide' onRequestClose={cancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <MyText variant='subTitle' fontWeight={700} style={styles.title}>{I18n.t('v2.x402.approvePayment')}</MyText>
          <MyText variant='small' className='text-medium' style={styles.subtitle}>
            {I18n.t('v2.x402.dataRequiresPayment')}
          </MyText>

          <MyText variant='title' fontWeight={700} style={styles.amount}>
            {fmtAmount(display.amount, display.asset)}
          </MyText>

          <View style={styles.divider} className='bg-box-small' />

          <View style={styles.row}>
            <MyText variant='small' className='text-medium' style={styles.rowLabel}>{I18n.t('v2.network.title')}</MyText>
            <MyText variant='small' className='font-medium' style={styles.rowValue}>{display.networkLabel || display.network}</MyText>
          </View>
          <View style={styles.row}>
            <MyText variant='small' className='text-medium' style={styles.rowLabel}>{I18n.t('v2.x402.payTo')}</MyText>
            <MyText variant='small' className='font-medium' style={styles.rowValue}>{short(display.payTo)}</MyText>
          </View>
          {!!display.description && (
            <View style={styles.row}>
              <MyText variant='small' className='text-medium' style={styles.rowLabel}>For</MyText>
              <MyText variant='small' className='font-medium' style={styles.rowValue} numberOfLines={2}>{display.description}</MyText>
            </View>
          )}

          {!!error && <MyText variant='small' style={[styles.errorText, { color: Colors.RED || '#ef4444' }]}>{error}</MyText>}

          {signing ? (
            <View style={styles.payingRow}>
              <ActivityIndicator color={Colors.WHITE} />
              <MyText className='text-medium'>Signing…</MyText>
            </View>
          ) : (
            <>
              <MyButton className='w-full' style={styles.ctaWrap} activeOpacity={0.8} variant='primary' onPress={approve}>
                <MyText fontWeight={700}>Approve &amp; pay</MyText>
              </MyButton>
              <TouchableOpacity style={styles.cancel} activeOpacity={0.7} onPress={cancel}>
                <MyText className='text-medium'>{I18n.t('Initial.cancel')}</MyText>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  )
}
