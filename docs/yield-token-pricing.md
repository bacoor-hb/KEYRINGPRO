# Pricing tokens with `yieldProtocol` (yield / vault tokens)

> Scope: how the app computes **priceUSD** and **valueUSD** for tokens that the
> Keyring API tags with `yieldProtocol` / `yieldAsset`.
> Main code: [src/Services/TokenListV2/index.js](../src/Services/TokenListV2/index.js)
> plus `keyring-agent-core` (`src/services/lending/yieldTokenValue.ts`).

> **Quick lookup:** need to know *which API / contract / function is called* → sections
> [2b](#2b-lookup-table-which-api-which-contract-which-function) and
> [6b](#6b-detailed-trace-per-case--what-is-called-where-and-why). Need the *why* → sections 1–5.
> Debugging → section 8 (case table) and section 10 (trace logs).

---

## 1. The root problem: the units of `balance` and `price` don't match

The token API (Keyring/Pantograph) returns a `price` field for every token. For a
normal token `valueUSD = balanceFormatted × price` is correct. For a yield token it
is **not** — and that's why tagged tokens split into two different groups:

| Group | `yieldProtocol` | `balanceOf` returns | API `price` is the price of | Convert needed? |
|---|---|---|---|---|
| **Share-based vault (ERC-4626)** | `spark`, `spark-ethereum`, `morpho-v2` | **SHARES** (vault decimals, usually 18) | **UNDERLYING** (e.g. USDC, 6 decimals) | ✅ Yes |
| **Oracle-priced shares** | `spark-l2-susds` | SHARES (bridged sUSDS, no `convertToAssets`) | UNDERLYING (USDS) | ✅ Yes, via the SSR oracle |
| **Rebasing receipt** | `aave-v3`, `compound-v3` | **ALREADY UNDERLYING** (balance grows on its own) | UNDERLYING | ❌ **Absolutely not** |

Real measured examples:
- 1 steakUSDC = 1.0354 USDC
- 1 Spark sUSDC = 1.1051 USDC

Taking `shares × price(USDC)` directly under-reports the position by **exactly the
accrued yield** (~3.5% and ~10.5% in the two examples above), and that error **grows
over time** because the share count stays fixed while the value per share rises.

Conversely, converting a rebasing receipt (aave-v3) by mistake **inflates** the
balance — its balance is already denominated in the underlying.

### Source of truth: an allow-list, not inference

The decision "is this token share-based?" is **not** based on whether `yieldProtocol`
is present, but on an allow-list in core:

```ts
// keyring-agent-core/src/services/lending/yieldTokenValue.ts
const SHARE_BASED_PROTOCOLS = new Set(['spark', 'spark-ethereum', 'spark-l2-susds', 'morpho-v2'])
export function isShareBasedProtocol(yieldProtocol) { ... }
```

The app **imports** this function instead of keeping its own copy — a copy would
drift and a new protocol would silently be treated wrong. The allow-list **fails
closed**: an unknown protocol → no conversion → the value is only slightly stale,
never wrong by the share ratio.

---

## 2. Architecture: core owns all pricing, the app owns identity

Core owns **both** the planning and the RPC execution. The app only describes the
token and passes in its own RPC endpoint:

```
valueYieldTokens(chainId, inputs, { rpcUrl })
   → Map<key, { underlyingAmount, valueUSD, pricePerTokenUSD, converted }>

resolveTokenPriceUSD(chainId, token, { rpcUrl })   → number | null   (price of 1 unit)
getTokenPriceUSD(chainId, address, { rpcUrl })     → number | null   (core fetches metadata itself)
```

Internally core still runs the same two pure functions — they are **still exported**
and remain the place where the arithmetic is unit-tested:

```
planYieldTokenConversions(inputs) → { calls, rateKeys }
        ↓ core executes them via multicallRead
applyYieldConversions(inputs, plan, returns) → Map<key, YieldTokenValue>
```

> **History:** the app used to have its own `executeRawCalls` (an `aggregate3` encoder
> plus a sequential fallback), nearly duplicating core's `multicallRead`. It was
> deleted — core already has a full RPC stack (per-chain client cache, `fallback()`
> transport, ad-hoc chains for unknown chain ids).

**RPC:** the app passes `getRpcUrlByChain(chainId)` as `{ rpcUrl }`. Core **prioritizes**
that endpoint but **still keeps** the chain's other endpoints behind it as backup — so
the paid RPC goes first without becoming a single point of failure.

**Key invariant — identity stays in the app.** `valueYieldTokens` prices tokens
**exactly as described**; it never re-fetches tags itself. That is deliberate: the app
resolves `yieldProtocol`/`yieldAsset` from four sources only it can see (live API →
field on the token → tagPatch → Redux snapshot). If core fetched them, it would only
see the **first** source and would lose the tag of a vault restored from a snapshot →
no conversion → exactly the yield missing. The boundary: **whoever owns identity
describes it**.

`getTokenPriceUSD` is a legitimate exception — it's for screens that only have an
address (detail, swap target, search row), where there is no richer identity to respect.

**Safety guarantees** (verified with real tests):
- Unknown chain / broken RPC / `rpcUrl` undefined → falls back to `balance × price`,
  `converted: false`, **never throws**.
- Results are always **index-aligned** with `plan.calls`; a failed call → `null`.
- The returned Map always has an entry for **every** input token, converted or not.

### Two call kinds, decoded differently

| Kind | Call | Decode |
|---|---|---|
| ERC-4626 | `convertToAssets(rawBalance)` on the token itself | the return **is** assets |
| `spark-l2-susds` | `susdsRateCall(chain)` → that chain's SSR oracle | the return is a **ray-scaled rate (1e27)**, must be multiplied by shares via `convertSusdsShares` |

`plan.rateKeys` lists the keys of the second kind. Decoding a ray as assets would
report a balance ~10^27× too large. Callers **don't need** to care about `rateKeys` —
it's still one round-trip, and `applyYieldConversions` tells them apart.

`spark-l2-susds` is special because bridged sUSDS on L2 is a plain ERC-20: `asset()`,
`totalAssets()`, `convertToAssets()` and `rateProvider()` **all revert** (the real vault
lives on mainnet). So we must ask a per-chain oracle — which is why the input is
required to carry a `chain` field.

---

## 2b. Lookup table: which API, which contract, which function

### API (HTTP)

| Endpoint | Called from | Query | Returns | Used for |
|---|---|---|---|---|
| `GET {API_BASE}/keyrings/tokens/all/{chainId}` | app: [`fetchAllCustomApiTokens`](../src/Services/TokenListV2/index.js#L119) via `BaseAPI.getData` | `limit=200&page=N` | `{ items, total, currentPage, totalPage, nextPage }` | **Discovery list** for a whole chain (builds the token list whose balances we read over RPC) |
| same endpoint | app: [`fetchKeyringTokensWithStatus`](../src/Services/TokenListV2/index.js#L273) | `addresses=0xa,0xb,…` (≤100 addr/request) | same envelope, only the requested tokens | **Authoritative lookup** — price + metadata + `yieldProtocol`/`yieldAsset` |
| same endpoint | app, when the wallet holds no ERC20 | `isTop=true&limit=200&page=1` | first page | only to get the NATIVE row |
| same endpoint | core: [`PantographService.getYieldPricingTokens`](../../keyring-agent-core/src/services/PantographService.ts#L332) | `addresses=…` | array of rows | backs `getTokenPriceUSD(chainId, address)` when the caller only has an address |

Important fields in each `items[i]`:

```jsonc
{
  "address": "0xsusdc…",           // vault contract, lowercase (null = native)
  "symbol": "susdc",
  "decimals": 18,                 // decimals of the SHARE
  "price": 0.9997,                // ⚠ price of the UNDERLYING (USDC), not of the share
  "yieldProtocol": "spark",       // undefined | null | 'spark' | 'morpho-v2' | 'aave-v3' | …
  "yieldAsset": { "address": "0xUSDC…", "decimals": "6" }  // decimals is a STRING
}
```

### Contracts (RPC)

| Token kind | Contract called | Function | Args | Return | Decode |
|---|---|---|---|---|---|
| ERC-4626 (`spark`, `spark-ethereum`, `morpho-v2`) | **the vault token itself** (`token.address`) | `convertToAssets(uint256)` | `rawBalance` (raw shares) | `uint256 assets` | assets at `yieldAsset.decimals` scale |
| `spark-l2-susds` | **that chain's SSR oracle** (hard table in core) | `getConversionRate()` | — | `uint256` **ray (1e27)** | must go through `convertSusdsShares(shares, rate, shareDecimals, assetDecimals)` |
| Batch wrapper | **Multicall3** `0xcA11bde05977b3631167028862bE2a173976CA11` | `aggregate3` | array of `(target, allowFailure, callData)` | `(bool success, bytes returnData)[]` | positional; failure → `null` |
| Balance (targeted refresh) | ERC20 token | `balanceOf(address)` | wallet | `uint256` | raw shares |
| Native balance | Multicall3 | `getEthBalance(address)` | wallet | `uint256` wei | 18 decimals |

Per-chain SSR oracle — [`SSR_ORACLE_BY_CHAIN`](../../keyring-agent-core/src/services/lending/sparkPsm.ts#L151):

| Chain | Oracle (SSRAuthOracle) |
|---|---|
| Base (8453 / `0x2105`) | `0x65d946e533748A998B1f0E430803e39A6388f7a1` |
| Arbitrum One (42161 / `0xa4b1`) | `0xEE2816c1E1eed14d444552654Ed3027abC033A36` |
| Optimism (10 / `0xa`) | `0x6E53585449142A5E6D5fC918AE6BEa341dC81C68` |
| Unichain (130 / `0x82`) | `0x1566BFA55D95686a823751298533D42651183988` |

> A chain missing from the table → `susdsRateCall()` returns `null` → the token is
> dropped from the plan (fail closed). Better to miss the yield than to convert with
> another chain's oracle.

### Who makes the RPC calls, and with which client

| Path | Client | Notes |
|---|---|---|
| Conversion (`valueYieldTokens`) | **core** `multicallRead` → `getPublicClient(chainId, { rpcUrl })` | the app passes `getRpcUrlByChain(Number(chainId))`; core puts this URL **first** in the list while the chain's other endpoints stay behind it as backup |
| Balance discovery (`fetchChainTokensViaMulticall`) | **app** `ViemWeb3.getPublicClient(chainId)` | multicall3 |
| Targeted refresh (`refreshTokenBalances`) | **app** `ViemWeb3.getPublicClient(chainId)` | multicall if the chain is in `MULTICALL3_CHAIN_IDS`, otherwise `Promise.all` of individual `readContract` calls |

## 3. Conditions for a token to be converted (`isShareBasedYieldToken`)

**All** of these must hold, in this order:

1. `isShareBasedProtocol(yieldProtocol)` — present in the allow-list.
2. `yieldAsset.decimals` parses (`parseAssetDecimals`).
3. If it's `spark-l2-susds`: `chain` must be present and that chain must have a PSM3/oracle.
4. `priceUSD` is finite and `> 0`.
5. (in `planYieldTokenConversions`) `rawBalance > 0n`.

### Why each condition exists

- **`yieldAsset.decimals`**: the API returns decimals as a **string** (`"6"`, `"18"`),
  so it needs `Number()`. But `Number(null) === 0` and `Number('') === 0` — both are
  finite and would **slip past** `Number.isFinite`. Reading a 6-decimal amount at
  scale 0 **inflates it a million-fold**, turning a $1.03 position into $1,034,435.
  So a missing value is **rejected outright**, never defaulted.
- **`priceUSD > 0`**: the whole point of converting is to produce a USD value; with no
  price we'd spend an RPC call to compute `x × 0`. Worse: writing `price = 0` would
  **overwrite** the caller's last-known-price fallback, turning a priced row into a
  worthless one that the dust filter then hides.
- **`rawBalance > 0n`**: there is nothing to scale. But such a token **still needs a
  per-share price** — handled separately by the zero-balance branch (section 5).

If any condition fails, the token continues with `balance × price` untouched
(`converted: false`).

---

## 4. Results written back onto the token entry

After a successful conversion, `applyYieldTokenValues` writes two fields:

```js
{
  ...t,
  valueUSD: v.valueUSD,             // underlyingAmount × priceUSD(underlying)
  priceUSD: v.pricePerTokenUSD,     // = valueUSD / balanceFormatted  → price PER SHARE
  isYieldConverted: true
}
```

**Why `priceUSD` is stored per-share** (rather than keeping the underlying price):
1. The UI row's unit price then matches the total (`price × balance = value`).
2. A subsequent balance-only refresh can recompute `balance × price` **correctly**
   without another chain read.

**Important consequence — `priceUSD` has changed units.** After conversion, that
token's `priceUSD` is **no longer the underlying price**. Anywhere downstream that
feeds `priceUSD` into another conversion computes `underlying units × price of 1 SHARE`
→ inflating the position by exactly the share/underlying ratio (~10% for a mature
vault), and **compounding on every refresh**. That is the reason the `isYieldConverted`
flag exists and the reason for the two defenses in sections 6.2 and 7.

---

## 5. Yield identity (`yieldProtocol` / `yieldAsset`): three states

This is the easiest part to get wrong. `yieldProtocol` has **three** values with three
different meanings:

| Value | Meaning | Behavior |
|---|---|---|
| `undefined` | **Nobody has answered yet** | Must ask again (backfill) on every refresh |
| `null` | Answered: **"not a vault"** | Don't ask again (except for custom tokens) |
| `'spark'`… | Answered: it is a vault | Use it directly |

Which is why you **cannot** use `||` or `??` to chain the fallback — they skip over
`null` and re-ask forever. The code always checks `=== undefined` explicitly.

### Which sources may write `null`, and which may not

- **Address lookup** (`fetchKeyringTokens(chainId, [addresses])`) is **authoritative**:
  a healthy batch with no tag → write `null` ("not a vault").
- **The whole-chain discovery list** (`fetchAllCustomApiTokens`) is **NOT** authoritative:
  it omits tags even for real vaults. So `transformMulticallEntry` writes
  `yieldProtocol: keyring?.yieldProtocol` **RAW**, without `|| null`.

  > Historical bug: this used to write `|| null`. As a result, the first full refresh
  > after an app update **overwrote the "not asked yet" state with a wrong "not a
  > vault" verdict** — and no later pass revisited it, permanently locking vaults
  > added before yield support shipped out of conversion.

- **Degraded batch** (`pricingDegraded`, i.e. the price list came back incomplete) →
  write `undefined`, because it hasn't actually **answered**.

### `resolveYieldIdentity` — take identity as a PAIR

```js
const identity = resolveYieldIdentity([keyring, t, tagPatch[t.metaKey], prev])
```

Priority order: **live API entry → field stored on the token itself → tagPatch from an
address lookup → snapshot**.

Two rules:
1. The **first source with an answer** (including `null`) supplies **both** fields. That
   way one source's `yieldProtocol` is never scaled by another source's
   `yieldAsset.decimals`.
2. The only exception: a source that answers with a protocol but no `yieldAsset` may
   borrow the asset from a source that **agrees on the same protocol** — otherwise the
   conversion would fail closed for missing decimals.

### Identity backfill (`unknownIdentity` in `applyYieldTokenValues`)

Any token that **no LIVE source** answered for is re-asked **by address** (the
authoritative source) in a single batched call:

```js
const unknownIdentity = tokens.filter((t) => {
  if (t.contractAddress === NATIVE) return false
  if (keyringByMetaKey[t.metaKey]?.yieldProtocol !== undefined) return false
  if (t.yieldProtocol !== undefined) return false
  const snap = snapshot[t.metaKey]
  if (snap?.yieldProtocol === undefined) return true   // nobody has ever answered
  return !!snap.isCustom                                // answered, but possibly stale
})
```

The key point: **custom tokens are always re-asked**, even when already `null`. Reason:
their verdict was written at *add token* time, and the API is allowed to change it (a
real case: the user added a vault **before** the API listed/tagged it). On chains where
the discovery list omits tags, nothing else would ever ask again.

The answer is written onto the token (`tagPatch`) so the commit **persists** it — the
steady state costs **no extra calls**. A failed/empty lookup writes nothing and asks
again next time.

---

## 6. Full execution flow

### 6.1 Full refresh (all sources) → `applyYieldTokenValues`

All four balance paths end at the same function — deliberately placed in a "shared
tail", because doing it per-source would have shipped the Alchemy path without
conversion:

```
fetchChainTokensViaMoralis   ─┐
fetchChainTokensViaAlchemy   ─┼→ buildTokensFromRows ─→ applyYieldTokenValues
fetchChainTokensViaMulticall ─┼──────────────────────→ applyYieldTokenValues
fetchChainTokensViaSequentialRpc ─┴──────────────────→ applyYieldTokenValues
                                                             ↓
                                                     commitChainTokens (merge + Redux)
```

Inside `applyYieldTokenValues(chainId, tokens, keyringByMetaKey, snapshotByMetaKey)`:

```
1. unknownIdentity  → fetchKeyringTokens by address → tagPatch
2. inputs = tokens.map(...)  // resolveYieldIdentity + rawBalance + chain
3. plan = planYieldTokenConversions(inputs)
4. zeroBalanceVaults = share-based + rawBalance <= 0 + price > 0
     → resolveKeyringTokenPriceUSD(1 share) for each  → perShareByKey
5. If plan.calls === 0 && zeroBalanceVaults === 0
     → return tokens (with tagPatch if any)            [no RPC spent]
6. values = await valueYieldTokens(chainId, inputs, { rpcUrl: getRpcUrlByChain(chainId) })
     // core plans + multicalls + folds; the app no longer calls RPC here
8. tokens.map: perShare > 0        → { priceUSD: perShare, valueUSD: 0, isYieldConverted: true }
               v.converted         → { valueUSD, priceUSD: pricePerTokenUSD, isYieldConverted: true }
               otherwise           → unchanged (balance × price)
```

**The zero-balance branch** (step 4): core plans no call for balance = 0 (nothing to
scale), but the token **still needs a unit price in the right units**. The stored price
is the API's UNDERLYING price — wrong units, and exactly what makes the detail screen
(which uses `resolveKeyringTokenPriceUSD`, pricing a synthetic 1 share) **disagree with**
the token list. Only manually added tokens reach here at balance 0; the rest were
already dropped as "not held".

### 6.2 Snapshot recovery (`snapshotTokenAsKeyringEntry`)

When the API list comes back incomplete, the app rebuilds entries from the snapshot.
There is one seemingly small but critical line here:

```js
price: t.isYieldConverted ? 0 : t.priceUSD
```

Because a converted vault's `priceUSD` is **per-share**, while downstream treats the
`price` field as the **underlying** price. Feeding it straight through would convert
underlying units at the price of one share → inflating by exactly the share/underlying
ratio, **compounding on every recovery**. Passing `0` makes the conversion skip (no
usable price) and the price fallback at commit keeps the stored per-share number → the
row stays in the right units, just **lagging on yield** until the API recovers.

`yieldProtocol` / `yieldAsset` are still carried through, so a vault restored from a
snapshot is still recognized as share-based.

### 6.3 Commit merge (`commitChainTokens`)

```js
isYieldConverted: pricingDegraded ? !!(t.isYieldConverted || prevT.isYieldConverted) : !!t.isYieldConverted,
yieldProtocol:    t.yieldProtocol !== undefined ? t.yieldProtocol : prevT.yieldProtocol,
yieldAsset:       t.yieldAsset    !== undefined ? t.yieldAsset    : prevT.yieldAsset,
```

- `isYieldConverted` reflects **THIS** fetch — a stale flag must not outlive the
  conversion it describes. Except when degraded: that pass **runs no conversion at all**
  (entries are rebuilt from the snapshot itself), so the old verdict still holds.
  Clearing it would mark a per-share price as "not converted", and the next snapshot
  recovery would feed that price into a conversion as if it were the underlying price
  (see 6.2).
- Identity: live answers first; the snapshot only fills in when live has **nothing to
  say** — including filling in its own `undefined`, so a token added before yield
  support **keeps asking** until someone answers.

### 6.4 Targeted refresh after send/swap (`refreshTokenBalances`)

This path only re-reads a few token balances (faster than waiting for the indexer). But
**`balanceOf` alone can never see yield**: the share count doesn't change as the vault
earns, so `shares × cached price` returns **the exact same number forever**. Hence this
path has two extra blocks:

**a) Backfill identity for untagged tokens** — collected into `untaggedMetaKeys`:

```js
if (addr !== NATIVE && (existing.yieldProtocol === undefined ||
    (existing.isCustom && existing.yieldProtocol === null))) untaggedMetaKeys.push(metaKey)
```

Selected by **missing tag, not by balance** — tokens added by an older build carry no
tag, and nothing else revisits them. They must be re-asked whether or not they have a
balance, because the re-pricing block below selects on `yieldProtocol`. The backfill
runs **BEFORE** re-pricing so a freshly tagged token is converted in the same pass.

If the API answers for none of them → **leave `undefined`**, don't write `null`.

**b) Re-price the vaults just touched** (`touchedVaults`):

```js
const touchedVaults = tokens.filter(
  (t) => (updates[t.metaKey] || addedMetaKeys.has(t.metaKey)) && isShareBasedProtocol(t.yieldProtocol)
)
```

Uses `isShareBasedProtocol`, **not** a bare `yieldProtocol` test — a bare test would
also catch rebasing receipts (aave-v3 / compound-v3) and scale a number that needs no
scaling.

Then re-fetch the **underlying** price from the API (don't reuse the stored `priceUSD`,
which is per-share) and only convert vaults for which the API **actually returned a
fresh price**:

```js
const priced = touchedVaults
  .filter((t) => toNumber(byMetaKey[t.metaKey]?.price) > 0)
  .map((t) => ({ ...t, priceUSD: toNumber(byMetaKey[t.metaKey].price) }))
```

With no fresh underlying price there is **nothing safe to convert** → keep the interim
`shares × cached price` value. The whole block is wrapped in `try/catch`: a flaky
RPC/API may only make a position **slightly stale**, never zero it.

### 6.5 Manually added token (`AddTokenDrawer`)

```js
const { priceUSD, isYieldConverted } = await _resolvePriceUSD(chainId, contractAddr, tokenData)
```

- No `yieldProtocol` → use the API price directly, `isYieldConverted: false`.
- Has one → `resolveKeyringTokenPriceUSD` reads on-chain and returns **per-share**.
- Conversion fails (RPC error, missing `yieldAsset`) → fall back to the API price; the
  value is merely **stale**, not wrong by the share ratio, and the next full refresh
  fixes it.

Custom tokens get full `yieldProtocol` / `yieldAsset` / `isYieldConverted` so they are
first-class citizens of the yield path.

---

## 6b. Detailed trace per case — what is called, where, and why

Each case below follows the actual execution order: **which API → which fields → fed
into what → which contract / function → decode → written onto which token entry**.

---

### Case A — Open the app, wallet holds 12.5 sUSDC on Base (share-based, non-zero balance)

Assume `chainId = 8453`, wallet `0xUSER`, sUSDC token `0xSUSDC…`.
> The numbers below are **illustrative, based on a real measured ratio** (1 share ≈
> 1.105 USDC), not an on-chain snapshot at a specific block.

**Step 1 — get the balance.** Base is in `SUPPORTED_CHAINS_BY_SERVICE_MORALIS`, so it
takes the Moralis path ([`fetchChainTokensViaMoralis`](../src/Services/TokenListV2/index.js#L899)):

```
GET {SERVICE_MORALIS_API}/wallets/0xUSER/tokens?chain=base&limit=100&exclude_native=false&cursor=…
→ row: { token_address: '0xSUSDC…', balance: '12500000000000000000', decimals: 18, usd_price: 0.9997 }
```

`normalizeMoralisRow` normalizes it into a neutral row:
`{ contractAddress: '0xSUSDC…', balance: '12500000000000000000', balanceFormatted: 12.5, priceUSD: 0.9997 }`.

**Step 2 — get price + metadata + yield tag.** [`buildTokensFromRows`](../src/Services/TokenListV2/index.js#L511)
collects all contract addresses and asks the API **by address** (authoritative):

```
GET {API_BASE}/keyrings/tokens/all/8453?addresses=0xSUSDC…,0xUSDC…,…&limit=200&page=1
→ items[i] = { address: '0xSUSDC…', decimals: 18, price: 0.9997,
               yieldProtocol: 'spark', yieldAsset: { address: '0xUSDC…', decimals: '6' } }
```

`findKeyringMatch` pairs the Moralis row with the API item by address, then
[`buildTokenEntry`](../src/Services/TokenListV2/index.js#L446) creates the entry:

```js
{ metaKey: '8453:0xSUSDC…', balance: '12500000000000000000', balanceFormatted: 12.5,
  decimals: 18, priceUSD: 0.9997, valueUSD: 12.496,   // ⚠ currently WRONG: shares × underlying price
  yieldProtocol: 'spark', yieldAsset: { decimals: '6' } }
```

**Step 3 — fix the value.** [`applyYieldTokenValues`](../src/Services/TokenListV2/index.js#L646):

1. `unknownIdentity`: this token already has `yieldProtocol` from the live API → **not**
   re-asked.
2. Build the core input:
   ```js
   { key: '8453:0xSUSDC…', address: '0xSUSDC…', rawBalance: 12500000000000000000n,
     decimals: 18, priceUSD: 0.9997, yieldProtocol: 'spark',
     yieldAsset: { decimals: '6' }, chain: 8453 }
   ```
3. `valueYieldTokens(8453, inputs, { rpcUrl: getRpcUrlByChain(8453) })` → inside core:
   - `planYieldTokenConversions` → 1 call:
     ```
     target:   0xSUSDC…            (the vault itself)
     callData: convertToAssets(12500000000000000000)
               = 0x07a2d13a + abi.encode(uint256 12500000000000000000)
     ```
   - `multicallRead('8453', calls, rpcUrl)` → calls Multicall3
     `0xcA11bde05977b3631167028862bE2a173976CA11.aggregate3([...])` in **one round-trip**.
   - The chain returns: `assets = 13813750` (uint256).
   - `applyYieldConversions` decodes:
     ```
     underlyingAmount = 13813750 / 10^6            = 13.81375 USDC   (yieldAsset.decimals = 6)
     valueUSD         = 13.81375 × 0.9997          = 13.80960
     pricePerTokenUSD = 13.80960 / 12.5            = 1.104768        ← price of 1 SHARE
     converted        = true
     ```
4. Written back onto the token:
   ```js
   { ...t, valueUSD: 13.8096, priceUSD: 1.104768, isYieldConverted: true }
   ```

**Result:** the UI shows `12.5 sUSDC × $1.1048 = $13.81`. Skipping step 3 would show
`$12.50` — missing exactly $1.31 of accrued yield.

---

### Case B — Same wallet but holding bridged sUSDS on Base (`spark-l2-susds`)

Differs from Case A at **step 3.3 only**. Bridged sUSDS is a plain ERC-20: calling
`convertToAssets` on it would **revert** (the real vault is on Ethereum). So core
branches:

```js
// planYieldTokenConversions
if (token.yieldProtocol === 'spark-l2-susds') {
  const call = susdsRateCall(token.chain)   // chain = 8453
  // → { target: '0x65d946e533748A998B1f0E430803e39A6388f7a1',   ← Base's SSR oracle
  //     callData: getConversionRate() }
  rateKeys.push(token.key)                  // mark "this return is a RATE, not assets"
}
```

The chain returns `rate = 1053812340000000000000000000` (ray, 1e27). Because the key is
in `rateKeys`, `applyYieldConversions` does **not** treat it as assets:

```js
convertSusdsShares(rawShares, rateRay, shareDecimals=18, assetDecimals=18)
  assets   = rawShares × rateRay / 1e27
  exponent = 18 - 18 = 0 → unchanged
```

Only then `toAmount(assets, 18)` → `underlyingAmount` (USDS) → `× price` → `valueUSD`.

> Decoding the ray as assets would report a balance ~10²⁷× too large. That is why
> `rateKeys` exists and why the input **must** carry `chain`.

If the wallet is on a Spark chain with no deployed oracle (absent from
`SSR_ORACLE_BY_CHAIN`) → `susdsRateCall` returns `null` → `isShareBasedYieldToken` is
false → the token continues with `balance × price`, `converted: false`.

---

### Case C — aUSDC (`aave-v3`) — tagged but NOT converted

```
API returns: { yieldProtocol: 'aave-v3', price: 0.9998, decimals: 6 }
balanceOf → 20014230  (already USDC; the aToken rebases 1:1)
```

`isShareBasedProtocol('aave-v3')` → **false** (not in
`SHARE_BASED_PROTOCOLS = { spark, spark-ethereum, spark-l2-susds, morpho-v2 }`).

→ `planYieldTokenConversions` creates no call → **0 RPC**.
→ `applyYieldConversions` returns `unconverted`: `valueUSD = 20.01423 × 0.9998`, `converted: false`.
→ The token keeps `priceUSD` = the API price, with no `isYieldConverted`.

Converting it by mistake: `convertToAssets(20014230)` on the aToken would revert or
(worse, on a contract with a same-named function) scale a number that was already in
the right units → inflation.

---

### Case D — User-added vault with balance = 0 (the zero-balance branch)

Only **custom tokens** survive at balance 0 (`keepAtZeroBalance` in
[`transformMulticallEntry`](../src/Services/TokenListV2/index.js#L359)); ordinary tokens
are dropped as "not held".

Core plans **no** call for `rawBalance = 0n` (nothing to scale), but the token still
needs a **unit price in the right units**. So the app runs a separate branch:

```js
const zeroBalanceVaults = inputs.filter(
  (i) => i.rawBalance <= 0n && isShareBasedProtocol(i.yieldProtocol) && Number(i.priceUSD) > 0
)
// → for each: resolveKeyringTokenPriceUSD(8453, { address, decimals, price, yieldProtocol, yieldAsset })
```

Inside core's `resolveTokenPriceUSD`, it builds a synthetic balance of **exactly 1 share**:

```js
rawBalance: 10n ** BigInt(18)   // = 1000000000000000000, i.e. exactly 1 share
→ convertToAssets(1e18) → assets = 1104768
→ underlyingAmount = 1.104768 ;  valueUSD = 1.104768 × 0.9997 = 1.104436
→ pricePerTokenUSD = 1.104436 / 1 = 1.104436   ← the price of 1 share
```

Written back: `{ priceUSD: 1.104436, valueUSD: 0, isYieldConverted: true }`.
`valueUSD` is 0 **by definition** (nothing held), not because a read failed.

---

### Case E — After sending 5 sUSDC, a targeted refresh runs

[`refreshTokenBalances(address, 8453, ['0xSUSDC…'])`](../src/Services/TokenListV2/index.js#L1576):

**1. Read the new balance.** Base is in `MULTICALL3_CHAIN_IDS`, so one round-trip:

```js
client.multicall({
  contracts: [{ address: '0xSUSDC…', abi: erc20Abi, functionName: 'balanceOf', args: ['0xUSER'] }],
  multicallAddress: '0xcA11bde05977b3631167028862bE2a173976CA11'
})
→ 7500000000000000000n   (7.5 shares)
```

Writes an **interim** value: `valueUSD = 7.5 × priceUSD_cached(1.104768) = 8.2858`.
> Note: the stored `priceUSD` is **per-share** (Case A overwrote it), so this
> multiplication is in the right units. That is exactly why section 4 stores per-share.

**2. Backfill tags** (if `yieldProtocol === undefined`, or it's custom and `=== null`):

```
GET {API_BASE}/keyrings/tokens/all/8453?addresses=<tokens missing a tag>
→ write { yieldProtocol: k.yieldProtocol || null, yieldAsset: k.yieldAsset || null }
```

If the API returns no row for a token → **leave it `undefined`**, don't write `null`.

**3. Re-price the vaults just touched.** `balanceOf` alone can never see yield (the
share count doesn't change as the vault earns), so we must re-ask for the **underlying
price**:

```js
const touchedVaults = tokens.filter((t) => (updates[t.metaKey] || addedMetaKeys.has(t.metaKey))
                                        && isShareBasedProtocol(t.yieldProtocol))
const fresh = await fetchKeyringTokens(8453, [...addresses])   // ← again /keyrings/tokens/all/8453?addresses=
const priced = touchedVaults
  .filter((t) => toNumber(byMetaKey[t.metaKey]?.price) > 0)     // only vaults the API RETURNED a fresh price for
  .map((t) => ({ ...t, priceUSD: toNumber(byMetaKey[t.metaKey].price) }))  // ← OVERWRITE with the UNDERLYING price
await applyYieldTokenValues(8453, priced, byMetaKey)            // → convertToAssets(7.5e18) again
```

Why `priceUSD` must be overwritten with the API price: the conversion takes the
**underlying price** as input. Leaving the stored per-share price would compute
`underlying units × price of 1 SHARE` → ~10% inflation, **compounding on every refresh**.

No fresh price from the API → `priced` is empty → keep the interim value from step 1
(slightly stale, not wrong). The whole block is wrapped in `try/catch`.

---

### Case F — The UI asks for a single token's price (TokenDetail / Swap / Send)

The caller already has the API row → use
[`resolveKeyringTokenPriceUSD`](../src/Services/TokenListV2/index.js#L882):

```js
resolveKeyringTokenPriceUSD('8453', { address, decimals: 18, price: 0.9997,
                                      yieldProtocol: 'spark', yieldAsset: { decimals: '6' } })
```

→ core's `resolveTokenPriceUSD` → not share-based means **return the API price
directly, 0 RPC**; share-based runs exactly like Case D (synthetic 1 share) → `$1.1048`.

The caller **only has an address**, no API row → use core's `getTokenPriceUSD`, which
fetches for itself:

```
PantographService.getYieldPricingTokens(8453, ['0xSUSDC…'])
  → GET {PANTOGRAPH_BASE}/keyrings/tokens/all/8453?addresses=0xSUSDC…
  → find the row matching the address (skipping the native row, which has none)
→ then into resolveTokenPriceUSD as above
```

Real measurement: Base sUSDC → `$1.1062` (per-share) instead of `$0.9997`; Base USDC →
`$0.999637`, 0 RPC.

A failed read on a vault returns **`null`** (no fallback to the API price, because that
price is in the wrong units) → the caller falls back to the token-list snapshot, which
already holds the per-share price.

---

### Case G — Chain with no Moralis/Alchemy (the multicall discovery path)

For example custom chain 988. With no indexer, the token list must be built by hand:

**1.** `GET {API_BASE}/keyrings/tokens/all/988?limit=200&page=1` (then page 2, 3… via
`nextPage`) — [`fetchAllCustomApiTokens`](../src/Services/TokenListV2/index.js#L119).
If `total > 1500` (`DISCOVERY_LIST_MAX_TOKENS`) → **give up**, read only the native balance.

**2.** For each token in the list, read the balance via Multicall3:
`balanceOf(0xUSER)` for ERC20, `getEthBalance(0xUSER)` for native.

**3.** [`transformMulticallEntry`](../src/Services/TokenListV2/index.js#L359) builds the
entry — and this is the critical line:

```js
yieldProtocol: keyring?.yieldProtocol,   // RAW, NOT `|| null`
```

Because the discovery list is **not authoritative** about yield tags: it omits them even
for real vaults. Writing `|| null` would record a wrong "not a vault" verdict and lock
it in permanently (the historical bug, see section 5).

**4.** `applyYieldTokenValues` sees `yieldProtocol === undefined` → adds it to
`unknownIdentity` → re-asks **by address** (authoritative):

```
GET {API_BASE}/keyrings/tokens/all/988?addresses=<tokens nobody has answered for>
→ tagPatch[metaKey] = { yieldProtocol: k.yieldProtocol || null, yieldAsset: k.yieldAsset || null }
```

The answer is written onto the token and **persisted** through the commit → no extra
calls next time.

---

### Case H — API list degraded, entries rebuilt from the snapshot

`fetchKeyringTokensWithStatus` returns `ok: false` (a chunk/page failed) →
`pricingDegraded = true`.
[`snapshotTokenAsKeyringEntry`](../src/Services/TokenListV2/index.js#L1046) builds a
synthetic entry from the snapshot:

```js
price: t.isYieldConverted ? 0 : t.priceUSD   // ← a per-share price must NOT be fed back as an underlying price
```

`price: 0` → `isShareBasedYieldToken` fails the `priceUSD > 0` condition → **conversion
skipped** → the price fallback at commit keeps the stored per-share value. The row stays
**in the right units**, just lagging on yield until the API recovers.

In [`commitChainTokens`](../src/Services/TokenListV2/index.js#L1426):

```js
isYieldConverted: pricingDegraded ? !!(t.isYieldConverted || prevT.isYieldConverted) : !!t.isYieldConverted
```

When degraded, **no conversion runs at all**, so the old verdict still holds. Clearing it
would mark a per-share price as "not converted", and the next recovery would feed it into
a conversion as an underlying price → inflation.

## 7. `resolveKeyringTokenPriceUSD` — the price layer for the UI

Used by: `useGetTokenPrice`, `useGetTokenSearchByChain`, TokenDetail, Send, Exchange,
Swap & Send, pay-link preview, AddTokenDrawer, and the zero-balance branch in section 6.1.

It is now a **thin wrapper** around core's `resolveTokenPriceUSD` — the export name is
kept because service callers pass in a Keyring API row, and the `chainId` they hold may
be a string from a react-query key.

How it works (inside core): it runs the conversion on a synthetic balance of **exactly 1
share**:

```js
rawBalance: 10n ** BigInt(decimals)   // decimals already Math.trunc'd exactly once
→ pricePerTokenUSD = the price of 1 share
```

> If you only have an **address** and no API row, use core's `getTokenPriceUSD(chainId,
> address, { rpcUrl })` directly — it fetches the metadata itself and returns the
> per-share price. Verified against the real API + RPC: Base sUSDC → `$1.1062`
> (per-share) instead of `$0.9997` (the underlying USDC price); Base USDC →
> `$0.999637`, no RPC spent.

The result is therefore a **unit price that needs no wallet balance** — correct even for
a vault the user doesn't hold at all (e.g. a token they're about to swap INTO).

Return values:

| Case | Returns |
|---|---|
| Not share-based (`plan.calls === 0`) | the API price untouched, **0 RPC** |
| Share-based, conversion OK | `pricePerTokenUSD` (per-share) |
| Share-based, **read fails / throws** | **`null`** |
| Invalid `decimals` | the API price |
| Price `<= 0` | `null` |

Returning `null` on a failed vault read is **deliberate**: the API price there is
definitely in the wrong units, so **no price beats a wrong price**. The caller falls back
to its own token-list snapshot, which already holds the converted per-share price.

---

## 8. Summary table of cases

| # | Case | Result |
|---|---|---|
| 1 | Ordinary token, untagged | `balance × price`, no RPC |
| 2 | Rebasing receipt (`aave-v3`, `compound-v3`) | `balance × price` — **no conversion**; the price chart still renders normally |
| 3 | Share-based, all conditions met, balance > 0 | `convertToAssets` → `valueUSD` + per-share `priceUSD`, `isYieldConverted: true` |
| 4 | `spark-l2-susds` with `chain` | read the SSR oracle → `convertSusdsShares` |
| 5 | `spark-l2-susds` **missing `chain`** | no conversion (better slightly short than converted with another chain's oracle) |
| 6 | Share-based, **missing `yieldAsset.decimals`** | no conversion (avoids a 10^6 error) |
| 7 | Share-based, `priceUSD <= 0` | no conversion (preserves the caller's last-known-price fallback) |
| 8 | Share-based, **balance = 0** (custom tokens only) | no `convertToAssets`; zero-balance branch → per-share `priceUSD`, `valueUSD: 0`, `isYieldConverted: true` |
| 9 | Share-based, **RPC read fails** | `converted: false` → keep the old value; **never zeroed** |
| 10 | API list degraded (`pricingDegraded`) | rebuilt from snapshot, old metadata kept, old `isYieldConverted` holds, identity written as `undefined` |
| 11 | Snapshot recovery of a converted vault | `price: 0` into the transform → conversion skipped, old per-share kept (lagging yield, right units) |
| 12 | Token added by an older build (no tag) | `undefined` → backfill asks by address on every refresh until someone answers |
| 13 | Custom token written `null`, then newly tagged by the API | custom tokens are **always** re-asked → picks up the new tag, converts from that pass on |
| 14 | Token written `null` (not custom) | not re-asked — the verdict is settled |
| 15 | Discovery list omits a real vault's tag | write RAW `undefined` (not `|| null`) → backfill/snapshot recovers it; `withSnapshotDiscovery` also inherits tags from the snapshot |
| 16 | After send/swap (targeted refresh) | backfill tags → fetch a fresh underlying price → reconvert; with no fresh price, keep the interim value |
| 17 | Manually adding a vault token | per-share `resolveKeyringTokenPriceUSD` right at add time; on failure, use the API price |
| 18 | UI asks for one vault's price (detail / swap / send) | convert on a synthetic 1 share; read failure → `null` so the caller falls back to the snapshot |

---

## 9. The chart on TokenDetail

Two different flags answering two different questions:

```js
// "is the price series in the wrong units?" → if so, do NOT draw the price chart
const isYieldToken = (yieldAsset && Object.keys(yieldAsset).length > 0) || isShareBasedProtocol(yieldProtocol)

// "is there an APY to plot?" → broader, includes rebasing receipts
const hasYieldProtocol = !!yieldProtocol
```

- `isYieldToken === true` → the (underlying) price history **doesn't match** the
  per-share price → show no-data instead of drawing a wrong line. (Temporary, until the
  API has per-share history.)
- `hasYieldProtocol === true` → there is a lending market → draw the **APY chart**
  (`useGetLendingTokenInfo`).
- Check `Object.keys(yieldAsset).length > 0` rather than `!!yieldAsset`, because `!!{}`
  is `true` and would blank the chart for ordinary tokens.
- Also check `isShareBasedProtocol` because the two tags are stored together but **can
  arrive separately**: a token from an older build has neither tag until a mount-refresh
  backfills it, and that refresh can fail.

---

## 10. Debugging

```js
// src/Services/TokenListV2/index.js
const DEBUG_YIELD = false   // set to __DEV__ to enable tracing
```

When enabled it logs:
- `chain X: N tokens, M tagged, K eligible for conversion`
- For each tagged token: `convert` / `skip` with the **specific skip reason** (rebasing /
  no usable price / no balance / missing `yieldAsset.decimals`) — because "tagged but not
  converted" is the case most often mistaken for a bug. The skip reason comes from core's
  `isShareBasedProtocol`, so it can't diverge from the actual decision.
- `read via aggregate3 (single round-trip)` or `sequential RPC (batches of 8)`, plus
  `X/Y succeeded`.
- Each conversion: `shares × $price = $old → underlying × $price = $new (price per share $Z)`.

### Common symptoms

| Symptom | Likely cause |
|---|---|
| Log says `N tokens, 0 tagged` | the discovery list carries no tags; check whether `withSnapshotDiscovery` and the backfill actually ran |
| A vault's value doesn't move after earning yield | only a targeted refresh ran with no fresh underlying price (case 16), or we're in the degraded state |
| Detail screen and token list disagree on price | one side uses the API (underlying) price, the other per-share — check `isYieldConverted` |
| A position is inflated by roughly ~10% and keeps growing | a per-share price was fed back into a conversion as an underlying price — check sections 6.2 / 6.3 / 7 |
| A position is short by exactly the yield | the vault isn't being converted — run the trace and read the skip reason |

---

## 11. Invariants (don't break these)

1. **Never convert a rebasing receipt.** Always use `isShareBasedProtocol` from core;
   never test `yieldProtocol` bare, never keep a local copy of the allow-list.
2. **After conversion, `priceUSD` is PER-SHARE.** It must never be fed back as an
   underlying-price input anywhere.
3. **`null` ≠ `undefined`.** Don't use `||` / `??` to chain identity fallbacks.
4. **The whole-chain discovery list is not authoritative** about yield tags — don't write
   `|| null`.
5. **Fail closed.** Failed read, missing decimals, missing price → keep the old value /
   return `null`; **never zero a position** and never guess.
6. **Custom tokens are always re-asked for identity.** The verdict from add-time may be
   stale.
7. `yieldProtocol` and `yieldAsset` always travel **as a pair** from the same source.
