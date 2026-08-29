import React, { memo } from 'react'
import { View, TouchableOpacity, Linking } from 'react-native'

import MyText from 'frontend/Components/UI/MyText'
import GlassView from 'frontend/Components/UI/GlassView'
import I18n, { resolveLocale } from 'assets/Lang'

import styles from './styles'

const tt = (key, locale, opts) => I18n.t(`chatAgent.${key}`, { ...(opts || {}), locale: resolveLocale(locale) })

/**
 * Format a percent for display: always two decimals, never trimmed.
 *
 * `toFixed`, deliberately, and NOT `formatNumberBro` — that helper hardcodes
 * `trimMantissa: true`, so a 4.10% market renders "4.1%" and a 4.00% one renders
 * "4%". Rates read as rates at a fixed two decimals, and these must line up
 * column-wise down the list to be comparable at a glance, which is the entire
 * job of this component. Matches the convention in the withdraw screen's
 * MarketHeader for the same reason.
 *
 * The core has already rounded these (see `displayNumbers.ts`); this only fixes
 * the width.
 *
 * Returns null for anything that is not actually a number, so the caller can
 * show a dash. `typeof`, NOT `Number.isFinite(Number(value))`: the core sends
 * `null` when a market's rate could not be read, and `Number(null)` is 0, which
 * is finite — so that check would print "0.00%" for a missing rate and pass it
 * off as a real (and terrible) one. The same trap catches '' .
 */
const formatApy = (value) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return `${value.toFixed(2)}%`
}

/**
 * One market: its rank, its name (opening the protocol's page for it), its live
 * APY as a bullet line, and the button that asks the agent about it.
 *
 * Laid out to read as a numbered list rather than as a boxed card — no frame, no
 * fill — because that is what it is: the numbering and the bullet carry the
 * structure, the same way the markdown list this replaced did. What changed is
 * only WHERE the button sits.
 *
 * And that is the whole reason this is a component at all. Message-level
 * `actionButtons` are a flat strip the chat stacks below the entire reply, so a
 * five-market list would be read as five names and then met with five buttons to
 * match back up by name. Here each button sits under the market it acts on, and
 * there is nothing to match.
 */
const MarketCard = ({ market, index, showChain, onPick }) => {
  const url = market.protocolUrl
  const apy = formatApy(market.apyPercent)

  // Only when core resolved a URL for this market — an unmapped chain or an
  // unknown market kind carries none, and a dead link is worse than no link.
  const openProtocol = () => {
    if (!url) return
    Linking.openURL(url).catch(() => {})
  }

  const NameWrap = url ? TouchableOpacity : View

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        {/* The list number, in its own fixed-width column so every name starts
            on the same x whether the rank is "1." or "10.". */}
        <MyText style={styles.rank}>
          {`${index + 1}.`}
        </MyText>
        <NameWrap
          style={styles.nameWrap}
          {...(url ? { onPress: openProtocol, activeOpacity: 0.7 } : {})}
        >
          {/* Plain text with an ellipsis, deliberately NOT MyTextTicker. That
              component loops a scrolling marquee unconditionally, and this list
              can run to 40 rows — 40 perpetual animations inside a scrolling
              chat. The gallery that does use it is a capped 2-column grid.
              Market names are short enough to fit, and the ellipsis handles the
              rare long vault name. */}
          <MyText fontWeight={700} numberOfLines={1} style={styles.name}>
            {market.name}
          </MyText>
        </NameWrap>
      </View>

      {/* Indented under the name, matching the numbered-list shape. */}
      <View style={styles.bulletRow}>
        <MyText style={styles.bulletDot}>
          •
        </MyText>
        <MyText style={styles.bulletText} numberOfLines={1}>
          {/* A null APY means the rate was unavailable. Shown as a dash rather
              than as 0%, which would read as a real (and terrible) rate. */}
          {`${tt('lendingProtocolApy', market.language)}: ${apy || '—'}`}
        </MyText>
      </View>

      {/* The chain only earns a line when the list actually spans more than one;
          otherwise the reply above already named it once and repeating it on
          every row is noise. */}
      {!!(showChain && market.chain) && (
        <View style={styles.bulletRow}>
          <MyText style={styles.bulletDot}>
            •
          </MyText>
          <MyText style={styles.bulletText} numberOfLines={1}>
            {market.chain}
          </MyText>
        </View>
      )}

      {/* "More detail" — its label is a bare word by design, since the market's
          name is already directly above it. */}
      <CardButton label={market.detailLabel} onPress={() => onPick(market.detailPrompt)} />
      {/* "Supply" — absent when the core could not offer one, either because the
          app cannot encode a deposit for this market's protocol or because no
          prompt could be built. The row then shows the detail button alone
          rather than a button that would fail at signing. */}
      <CardButton label={market.supplyLabel} onPress={() => onPick(market.supplyPrompt)} />
    </View>
  )
}

/**
 * One pill under a market row. Renders nothing unless it has BOTH a label to
 * show and a prompt to send — a button that cannot say what it does, or cannot
 * do anything, is worse than no button.
 *
 * Same pill as the message-level action buttons (see ChatAgent/styles.js),
 * because it does the same thing: submits a prompt as the next turn.
 */
const CardButton = ({ label, onPress }) => {
  if (!label) return null
  return (
    <TouchableOpacity activeOpacity={0.8} style={styles.buttonWrap} onPress={onPress}>
      <GlassView interactive effect='clear' style={styles.button}>
        {/* numberOfLines is the safety net: the wording comes from the model,
            and a long vault name in a "Supply <name>" label would otherwise
            wrap the pill to two lines. */}
        <MyText style={styles.buttonText} numberOfLines={1}>
          {label}
        </MyText>
      </GlassView>
    </TouchableOpacity>
  )
}

/**
 * The lending-market shortlist, rendered as cards from the `LendingMarketList`
 * UIPayload emitted by the agent's get-lending-markets tool.
 *
 * Each row carries ONE figure — the live supply APY — plus two buttons: "More
 * detail", which opens that market's full picture (size, recent average, reward
 * split, platform score), and "Supply", which starts a deposit.
 *
 * The thinness of the row is the design, not a gap: a list is scanned to narrow
 * a field, and a market is judged one at a time. The Supply button sitting here
 * anyway is a product decision — it does not move money, it opens the amount
 * form, which re-checks balance and encoding and still needs the user to type an
 * amount and sign.
 *
 * props: { chain, multiChain, markets: [{ name, protocol, protocolUrl, chain,
 *                                         apyPercent, detailPrompt, detailLabel,
 *                                         supplyPrompt, supplyLabel }] }
 */
const LendingMarketList = ({ props, onSend, language }) => {
  const markets = Array.isArray(props?.markets) ? props.markets : []
  if (markets.length === 0) return null

  // Only a list actually spanning several chains needs each card to say where
  // its market lives; otherwise the reply above already named the chain once.
  //
  // Read from the core's own flag rather than inferred from `chain === 'all'`:
  // that field describes the REQUEST (was a scope applied), and an unscoped
  // request whose markets all land on one chain would print the same redundant
  // chain on every card.
  const showChain = props?.multiChain === true

  // Takes the PROMPT rather than the market: each row has two buttons that send
  // different prompts for the same market, so the market alone no longer says
  // which one was tapped.
  const onPick = (prompt) => {
    if (typeof onSend !== 'function' || !prompt) return
    // The prompt is composed by the agent and may be synthetic English — pass
    // the payload's language so the next turn's reply stays in the user's
    // language, the same way action buttons and the NFT picker do.
    onSend(prompt, language)
  }

  return (
    <View style={styles.container}>
      {markets.map((market, idx) => (
        <MarketCard
          // Two vaults never share a detail prompt (it ends with the vault's own
          // address), so this stays stable across re-renders.
          key={`${market.detailPrompt || market.name}-${idx}`}
          market={{ ...market, language }}
          // The visible rank. Taken from the render position rather than sent by
          // the core: the list is already in ranked order, and a second source
          // for the same number is a second thing that can disagree with it.
          index={idx}
          showChain={showChain}
          // Passed through as-is: the card calls it with whichever prompt the
          // tapped button carries.
          onPick={onPick}
        />
      ))}
    </View>
  )
}

export default memo(LendingMarketList)
