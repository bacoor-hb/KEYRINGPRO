import React from 'react'
import WalletActionForm from '../WalletActionForm'
import { buildNftTransferTx } from '../WalletActionForm/buildTx'
import { checkNftOwnership } from '../WalletActionForm/preCheck'

/**
 * Transfer an NFT the user owns. Submitting signs and broadcasts directly —
 * see WalletActionForm.
 *
 * The agent resolves the collection + token id from the user's own NFTs (and
 * points them at the NFT website when several match), so in practice only the
 * recipient is left to fill. `amount` is editions and applies to ERC-1155 only —
 * ERC-721 forces 1 — so it stays optional here.
 */
export default function SendNftForm ({ props, language, ...txProps }) {
  const { parameters = {} } = props || {}
  const isErc1155 = String(parameters.token_standard || '').toLowerCase() === 'erc1155'

  return (
    <WalletActionForm
      {...txProps}
      props={props}
      language={language}
      fields={[
        {
          key: 'contract_address',
          type: 'address',
          // Locked when the agent resolved it (usually from the NFT the user
          // picked) — see the same field in SendTokenForm.
          lockWhenPrefilled: true,
          label: (t) => 'NFT Contract',
          placeholder: (t) => t('walletActionEnterContract')
        },
        {
          key: 'token_id',
          type: 'text',
          // A token id is a whole number (uint256) — digits only.
          integer: true,
          label: (t) => 'NFT ID',
          placeholder: (t) => t('walletActionEnterTokenId')
        },
        // Editions only mean something for ERC-1155; ERC-721 is always a single
        // token, so the field would be a confusing no-op there.
        ...(isErc1155
          ? [{
            key: 'amount',
            type: 'amount',
            // Editions are a whole count of copies — no fractional amounts.
            integer: true,
            optional: true,
            label: (t) => t('walletActionEditions'),
            placeholder: (t) => t('walletActionEditionsDefault')
          }]
          : []),
        {
          key: 'to_address',
          type: 'address',
          label: (t) => t('walletActionReceiver'),
          placeholder: (t) => t('walletActionEnterAddress')
        }
      ]}
      submitLabel={(t) => 'Send NFT'}
      // First check: the wallet has to actually own the token. The agent picked
      // it from the user's NFTs, but that snapshot ages — it may have been sold
      // or transferred since, and "you no longer own this" is a far better
      // message than a bare failed gas estimate.
      preCheck={({ values, walletAddress, chainId, language }) =>
        checkNftOwnership({
          chainId,
          from: walletAddress,
          contractAddress: values.contract_address,
          tokenId: values.token_id,
          amount: values.amount,
          isErc1155,
          language
        })}
      buildTxs={({ values, walletAddress }) =>
        buildNftTransferTx({
          contractAddress: values.contract_address,
          // safeTransferFrom takes the current owner explicitly — that's the
          // connected wallet the agent built this action for.
          fromAddress: walletAddress,
          toAddress: values.to_address,
          tokenId: values.token_id,
          amount: values.amount,
          isErc1155
        })}
    />
  )
}
