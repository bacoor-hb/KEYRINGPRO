# KEYRING PRO

KEYRING PRO is a self-custodial crypto wallet for iOS and Android, built with
React Native. It supports EVM chains, WalletConnect v2, NFC hardware cards
(KeyCard), a built-in AI assistant and DeFi (swap, bridge).

Website: [keyring.app](https://keyring.app)

## Features

- **Self-custodial, multi-account** — private-key hot wallets, view-only
  accounts, and NFC KeyCard hardware-backed accounts
- **Multi-chain (EVM)** — 20 built-in networks: Ethereum, Optimism, BNB Chain,
  Base, Arbitrum, Avalanche, Polygon, Unichain, Plasma, HyperEVM, Stable,
  Mantle, Celo, MegaETH, Gnosis, Katana, Monad, Ink, Tempo and Robinhood — plus
  any other EVM network you add yourself
- **WalletConnect v2** — per-account dApp connections with a built-in
  connection-safety assessment
- **DeFi** — liquidity pool management (view positions, add liquidity),
  token swap and cross-chain bridge
- **Tokens & NFTs** — send/receive ERC-20 tokens and NFTs, add custom tokens,
  view balances and transaction history
- **Built-in AI assistant** — chat with an on-chain AI agent that helps perform
  wallet actions with user approval, such as adding liquidity to a pool or sending tokens
- **Security-first** — new-account private keys are generated with viem's
  `generatePrivateKey` (cryptographically secure RNG). Each private key is
  encrypted with the user's password and stored in an encrypted secure store.
  That store is itself encrypted with a strong random key generated per-user at
  install time and held in the OS keychain. Encrypted wallet backup, biometric
  unlock, auto-lock, dark-mode-only UI.

## Tech stack

- React Native 0.81 (New Architecture, Hermes) — JavaScript only, no TypeScript
- Redux + Redux Thunk, dual storage (Async Storage for app state,
  Secure Storage for keys and vaults)
- Ethers.js 5.x for wallet/signing, viem 2.x for on-chain reads, multicall,
  and generating new-account private keys (`generatePrivateKey`, backed by a
  cryptographically secure RNG)
- React Navigation 7 (native stack)

## Project structure

```
src/
├── Common/       # Shared utilities, constants, chain definitions
├── Controller/   # Business logic: Redux, API services, Web3
├── Frontend/     # UI: screens, components, hooks
├── Services/     # Domain services: swap, bridge
└── navigation/   # React Navigation routes
```

## Getting started

See **[SETUP.md](SETUP.md)** for the full guide: prerequisites, environment
variables (`.env`), native secrets (`keys.release.json`), Firebase config and
signing. All secrets are provided by you via the `*.example` templates — none
are included in this repository.

Quick version:

```bash
yarn install
cp .env.example .env                          # then fill in your values
cp keys.release.example.json keys.release.json
yarn pod        # iOS pods
yarn ios        # or: yarn android
```

## Scripts

```bash
yarn start            # Metro bundler
yarn ios / android    # build & run
yarn audit:pk-leak    # scan source for accidental private-key leaks
```

`yarn audit:pk-leak` is only a best-effort guard to reduce the chance of a
developer committing a key by mistake — it is a heuristic scan, **not** a
guarantee that the source is free of secrets. Do not rely on it as your only
safeguard.

## Security

This is wallet software — please handle vulnerabilities responsibly.
If you find a security issue, **do not open a public issue**; report it
privately to [support@bacoor.co](mailto:support@bacoor.co).

## License

[GPL-3.0](LICENSE) — see the [LICENSE](LICENSE) file for details.
