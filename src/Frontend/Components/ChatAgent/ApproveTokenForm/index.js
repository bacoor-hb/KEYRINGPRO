import React from 'react'
import WalletActionForm from '../WalletActionForm'
import { buildApproveTx } from '../WalletActionForm/buildTx'

/**
 * Grant an ERC-20 allowance to a spender. Submitting signs and broadcasts
 * directly — see WalletActionForm.
 *
 * `amount` is optional on purpose: an omitted amount means an UNLIMITED
 * allowance (max uint256), and "0" is a revoke. So the field must be
 * submittable while empty — hence no spendable/quick-picks here either, since
 * an allowance is a cap, not a spend, and may exceed the current balance.
 */
export default function ApproveTokenForm ({ props, language, ...txProps }) {
  const symbol = props?.parameters?.token_symbol || ''

  return (
    <WalletActionForm
      {...txProps}
      props={props}
      language={language}
      fields={[
        {
          key: 'contract_address',
          type: 'address',
          // Locked when the agent resolved it — see SendTokenForm.
          lockWhenPrefilled: true,
          label: (t) => t('walletActionTokenContract'),
          placeholder: (t) => t('walletActionEnterContract')
        },
        {
          // Deliberately NOT locked even when pre-filled: this is who gets to
          // spend the user's tokens. It's the field an approve exists to
          // authorize, so the user keeps full control over it.
          key: 'spender_address',
          type: 'address',
          label: (t) => t('walletActionSpender'),
          placeholder: (t) => t('walletActionEnterAddress')
        },
        {
          key: 'amount',
          type: 'amount',
          symbol,
          optional: true,
          label: (t) => t('walletActionAllowance'),
          placeholder: (t) => t('walletActionUnlimited')
        }
      ]}
      submitLabel={(t) => t('walletActionApprove')}
      buildTxs={({ values, parameters }) =>
        buildApproveTx({
          contractAddress: values.contract_address,
          spenderAddress: values.spender_address,
          // Empty → unlimited; the encoder owns that rule.
          amount: values.amount,
          decimals: parameters.decimals != null ? Number(parameters.decimals) : 18
        })}
    />
  )
}
