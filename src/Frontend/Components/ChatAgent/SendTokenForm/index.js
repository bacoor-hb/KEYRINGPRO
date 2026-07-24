import React from 'react'
import WalletActionForm from '../WalletActionForm'
import { buildTokenTransferTx } from '../WalletActionForm/buildTx'
import { checkTokenBalance } from '../WalletActionForm/preCheck'

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
      spendableSymbol={symbol}
      quickPercents={[25, 50, 75, 100]}
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
      submitLabel={(t) => 'Send Token'}
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
          // The agent resolves the token's decimals; 18 is the ERC-20 default
          // when it couldn't (the amount field caps its precision to the same).
          decimals: parameters.decimals != null ? Number(parameters.decimals) : 18
        })}
    />
  )
}
