import React from 'react'
import WalletActionForm from '../WalletActionForm'
import { buildTokenTransferTx } from '../WalletActionForm/buildTx'
import { checkTokenBalance } from '../WalletActionForm/preCheck'
import { X402_PATH } from '../WalletActionForm/x402Gate'

// The agent resolves the token's decimals; 18 is the ERC-20 default when it
// couldn't (the amount field caps its precision to the same).
const decimalsOf = (parameters) =>
  parameters?.decimals != null ? Number(parameters.decimals) : 18

/**
 * Send an ERC-20 token. The agent resolves `contract_address` from a symbol
 * whenever it can, so the contract field is usually pre-filled and the user
 * only enters amount + recipient. Submitting signs and broadcasts directly —
 * see WalletActionForm.
 */
export default function SendTokenForm ({ props, language, ...txProps }) {
  const symbol = props?.parameters?.token_symbol || ''

  return (
    <WalletActionForm
      {...txProps}
      props={props}
      language={language}
      spendable={props?.parameters?.spendable}
      spendableUsd={props?.parameters?.spendableUsd}
      spendableSymbol={symbol}
      quickPercents={[25, 50, 75, 100]}
      x402Path={X402_PATH.sendToken}
      // What this send is about to move. The x402 approval sheet sets it aside
      // before judging whether the fee is covered, for the case where the fee is
      // charged in the very token being sent — sending your whole USDC balance
      // leaves nothing for a USDC fee, however healthy `balanceOf` still looks
      // at that moment.
      //
      // The amount stays HUMAN here on purpose. The sheet scales it by the fee
      // token's real on-chain decimals, which it has and this form does not:
      // `parameters.decimals` is the agent's, and its 18 fallback would
      // overstate a 6-decimal token by a factor of a trillion.
      spend={({ values, chainId }) => ({
        chainId,
        assetAddress: values.contract_address,
        amount: values.amount
      })}
      fields={[
        {
          key: 'contract_address',
          type: 'address',
          // Resolved from the symbol the user asked for — locked, since a
          // contract address can't be eyeballed for correctness and editing one
          // character silently sends a different token. Stays editable when the
          // agent couldn't resolve it and the user must paste it themselves.
          lockWhenPrefilled: true,
          label: (t) => t('walletActionTokenContract'),
          placeholder: (t) => t('walletActionEnterContract')
        },
        {
          key: 'amount',
          type: 'amount',
          symbol,
          label: (t) => t('walletActionTokenAmount'),
          placeholder: (t) => t('enterAmount')
        },
        {
          key: 'to_address',
          type: 'address',
          label: (t) => t('walletActionReceiver'),
          placeholder: (t) => t('walletActionEnterAddress')
        }
      ]}
      submitLabel={(t) => t('walletActionSendToken')}
      // First check: ask the token contract itself whether this wallet holds
      // enough. The contract address is user-editable here, so the agent's
      // `spendable` may not even describe the token actually being sent.
      preCheck={({ values, walletAddress, chainId, language }) =>
        checkTokenBalance({
          chainId,
          from: walletAddress,
          contractAddress: values.contract_address,
          amount: values.amount,
          symbol,
          language
        })}
      buildTxs={({ values, parameters }) =>
        buildTokenTransferTx({
          contractAddress: values.contract_address,
          toAddress: values.to_address,
          amount: values.amount,
          decimals: decimalsOf(parameters)
        })}
    />
  )
}
