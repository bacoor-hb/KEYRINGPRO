import React from 'react'
import { getChainInfo } from 'common/function'
import WalletActionForm from '../WalletActionForm'
import { buildNativeTx } from '../WalletActionForm/buildTx'
import { checkNativeBalance } from '../WalletActionForm/preCheck'
import { X402_PATH } from '../WalletActionForm/x402Gate'

/**
 * Send the chain's native coin (ETH/BNB/MATIC/…). `parameters.native_symbol`,
 * `to_address` and `amount` arrive pre-filled whenever the agent could resolve
 * them; anything missing is asked for here. Submitting signs and broadcasts
 * directly — see WalletActionForm.
 *
 * `parameters.spendable` is the agent's gas-aware figure (balance − a silent gas
 * reserve), so picking 100% can never leave the user unable to pay for the send
 * itself. Absent when the agent could not read the balance — the quick-pick
 * chips and the spendable line then stay hidden.
 */
export default function SendNativeForm ({ props, language, ...txProps }) {
  // The agent supplies `native_symbol` (ETH/BNB/MATIC/…) when it can resolve it.
  // Fall back to the chain's own native symbol so the amount field and spendable
  // line stay labelled even if it's absent. `chainId` arrives HEX ("0xa") but
  // getChainInfo indexes by the DECIMAL number, so normalize before the lookup.
  const chainNativeSymbol = () => {
    const n = Number(props?.chainId)
    const id = Number.isFinite(n) ? n : props?.chainId
    return getChainInfo(id)?.nativeCurrency?.symbol || ''
  }
  const symbol = props?.parameters?.native_symbol || chainNativeSymbol()

  return (
    <WalletActionForm
      {...txProps}
      props={props}
      language={language}
      spendable={props?.parameters?.spendable}
      spendableUsd={props?.parameters?.spendableUsd}
      spendableSymbol={symbol}
      quickPercents={[25, 50, 75, 100]}
      x402Path={X402_PATH.sendNative}
      fields={[
        {
          key: 'amount',
          type: 'amount',
          symbol,
          label: (t) => t('walletActionAmount'),
          placeholder: (t) => t('enterAmount')
        },
        {
          key: 'to_address',
          type: 'address',
          label: (t) => t('walletActionReceiver'),
          placeholder: (t) => t('walletActionEnterAddress')
        }
      ]}
      submitLabel={(t) => t('walletActionSendNative')}
      // First check: the wallet's live native balance has to cover the amount.
      // `spendable` already gated the input, but it was resolved when the agent
      // built the message and can be stale by the time the user submits.
      preCheck={({ values, walletAddress, chainId, language }) =>
        checkNativeBalance({
          chainId,
          from: walletAddress,
          amount: values.amount,
          symbol,
          language
        })}
      buildTxs={({ values }) =>
        buildNativeTx({ toAddress: values.to_address, amount: values.amount })}
    />
  )
}
