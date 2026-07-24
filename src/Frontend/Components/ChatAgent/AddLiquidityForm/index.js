import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  TextInput,
  TouchableOpacity,
  ScrollView
} from 'react-native'
import BigNumber from 'bignumber.js'
import { Colors, pixelByWidth } from 'common/styles'
import I18n, { resolveLocale } from 'assets/Lang'
import MyText from 'frontend/Components/UI/MyText'
import GlassView from 'frontend/Components/UI/GlassView'
import styles from './styles'
import MyButton from 'frontend/Components/UI/MyButton'
import MyTextTicker from 'frontend/Components/UI/MyTextTicker'

const tt = (key, locale, opts) => I18n.t(`chatAgent.${key}`, { ...(opts || {}), locale: resolveLocale(locale) })

// Cut `n` to `d` decimals through BigNumber so float artifacts (the classic
// 0.1 + 0.2) can never leak into a displayed or derived value. Truncates
// (ROUND_DOWN) and strips trailing zeros — mirrors `fmt`'s convention.
const toFixedDown = (n, d) => {
  const bn = BigNumber(n)
  return bn.isFinite() ? bn.decimalPlaces(d, BigNumber.ROUND_DOWN).toFixed() : ''
}

// Round an amount down to 8 decimals. Quick-picks / balance checks use this so
// float rounding can never push the value above the user's real balance.
const AMOUNT_DECIMALS = 8
const toAmountDown = (n) => toFixedDown(n, AMOUNT_DECIMALS)

// Keep a numeric input as a positive decimal string: digits + a single dot, no
// sign — so the value can never be negative or non-numeric. A typed comma (some
// keyboards/locales use it as the decimal mark) is normalized to a dot.
const sanitizePrice = (v) => {
  const out = String(v).replace(/,/g, '.').replace(/[^0-9.]/g, '')
  const i = out.indexOf('.')
  return i === -1 ? out : out.slice(0, i + 1) + out.slice(i + 1).replace(/\./g, '')
}

// Display a token amount/price truncated (no rounding) to 8 decimals via
// BigNumber, with thousands grouping.
const fmt = (n, d = 8) => {
  const bn = BigNumber(n)
  return bn.isFinite() ? bn.decimalPlaces(d, BigNumber.ROUND_DOWN).toFormat() : '—'
}

const tokenLabel = (pool) =>
  pool?.token0?.symbol && pool?.token1?.symbol
    ? `${pool.token0.symbol}/${pool.token1.symbol}`
    : pool?.address?.slice(0, 8) + '…'

export default function AddLiquidityForm ({ props, onSend, language }) {
  const t = (key, opts) => tt(key, language, opts)

  const { chain, pool, inputToken, priceBounds, prefillRange } = props
  const feeLabel = pool?.feePercent != null ? `${pool.feePercent}%` : ''

  const clampToBounds = (v) => {
    if (!priceBounds) return v
    return BigNumber.min(BigNumber.max(v, priceBounds.min), priceBounds.max)
  }

  const hasPrefill =
    !!prefillRange &&
    prefillRange.minPrice != null &&
    prefillRange.maxPrice != null &&
    prefillRange.strategy !== 'full'

  const [minPriceInput, setMinPriceInputRaw] = useState(
    hasPrefill ? String(prefillRange.minPrice) : ''
  )
  const [maxPriceInput, setMaxPriceInputRaw] = useState(
    hasPrefill ? String(prefillRange.maxPrice) : ''
  )
  const [minTouched, setMinTouched] = useState(false)
  const [maxTouched, setMaxTouched] = useState(false)
  const setMinPriceInput = (v) => { setMinTouched(true); setMinPriceInputRaw(v) }
  const setMaxPriceInput = (v) => { setMaxTouched(true); setMaxPriceInputRaw(v) }
  // Treat a 0 / missing prefill as empty so the field shows its placeholder
  // instead of a literal "0" before the user types.
  const [amount, setAmount] = useState(
    inputToken?.prefillAmount ? String(inputToken.prefillAmount) : ''
  )

  useEffect(() => {
    if (inputToken?.prefillAmount) {
      setAmount(String(inputToken.prefillAmount))
    }
  }, [inputToken?.prefillAmount])

  useEffect(() => {
    if (prefillRange?.minPrice != null && prefillRange?.maxPrice != null &&
        prefillRange.strategy !== 'full') {
      setMinPriceInputRaw(String(prefillRange.minPrice))
      setMaxPriceInputRaw(String(prefillRange.maxPrice))
    }
  }, [prefillRange?.minPrice, prefillRange?.maxPrice, prefillRange?.strategy])

  const curPrice = pool?.currentPrice || 0
  const sanitizeRate = (v, { allowNegative = true } = {}) => {
    let out = String(v).replace(allowNegative ? /[^0-9.-]/g : /[^0-9.]/g, '')
    if (allowNegative) out = out.replace(/(?!^)-/g, '')
    const firstDot = out.indexOf('.')
    if (firstDot !== -1) {
      out = out.slice(0, firstDot + 1) + out.slice(firstDot + 1).replace(/\./g, '')
      const [i, d] = out.split('.')
      out = i + '.' + (d ?? '').slice(0, 2)
    }
    return out
  }
  // Min: rate is % decrease from current → price = current × (1 − r/100)
  // Max: rate is % increase from current → price = current × (1 + r/100)
  const priceToRateStr = (priceStr, side) => {
    const p = BigNumber(priceStr)
    if (!p.isFinite() || curPrice <= 0) return ''
    const diffPct = p.minus(curPrice).div(curPrice).times(100)
    return toFixedDown(side === 'min' ? diffPct.negated() : diffPct, 2)
  }
  const rateToPrice = (rateStr, side) => {
    const r = BigNumber(rateStr)
    if (!r.isFinite() || curPrice <= 0) return ''
    const delta = r.div(100)
    const factor = side === 'min' ? BigNumber(1).minus(delta) : BigNumber(1).plus(delta)
    return toFixedDown(BigNumber(curPrice).times(factor), 8)
  }

  const [minRateInput, setMinRateInput] = useState(() => priceToRateStr(minPriceInput, 'min'))
  const [maxRateInput, setMaxRateInput] = useState(() => priceToRateStr(maxPriceInput, 'max'))
  const rateEditing = useRef(null)

  useEffect(() => {
    if (rateEditing.current === 'min') return
    setMinRateInput(priceToRateStr(minPriceInput, 'min'))
  }, [minPriceInput, curPrice])
  useEffect(() => {
    if (rateEditing.current === 'max') return
    setMaxRateInput(priceToRateStr(maxPriceInput, 'max'))
  }, [maxPriceInput, curPrice])

  // Max rate ceiling = max % increase from priceBounds.max vs curPrice (fallback 1000%)
  const maxRateCeiling = (priceBounds && curPrice > 0)
    ? Math.max(1, Math.floor(((priceBounds.max - curPrice) / curPrice) * 100))
    : 1000

  // Min rate ceiling = 100 (100% decrease → price = 0 is valid)
  const minRateCeiling = 100

  const clampRate = (clean, ceiling) => {
    if (clean === '' || clean === '.') return clean
    const n = BigNumber(clean)
    if (!n.isFinite()) return clean
    if (n.lt(1)) return clean // allow partial input (e.g. "1.", "0.5") — validated at rangeError
    if (n.gt(ceiling)) return String(ceiling)
    return clean
  }

  const onChangeMinRate = (v) => {
    const clean = clampRate(sanitizeRate(v, { allowNegative: false }), minRateCeiling)
    rateEditing.current = 'min'
    setMinRateInput(clean)
    const p = rateToPrice(clean, 'min')
    if (p !== '') setMinPriceInput(p)
  }
  const onChangeMaxRate = (v) => {
    const clean = clampRate(sanitizeRate(v, { allowNegative: false }), maxRateCeiling)
    rateEditing.current = 'max'
    setMaxRateInput(clean)
    const p = rateToPrice(clean, 'max')
    if (p !== '') setMaxPriceInput(p)
  }

  // Editing a price field directly releases the rate-edit lock so the % syncs
  // back from the price. Without this, the lock set while typing a % would stay
  // on and the price/% pair would drift out of sync.
  const onChangeMinPrice = (v) => {
    rateEditing.current = null
    setMinPriceInput(sanitizePrice(v))
  }
  const onChangeMaxPrice = (v) => {
    rateEditing.current = null
    setMaxPriceInput(sanitizePrice(v))
  }

  const computedRange = (() => {
    const minP = BigNumber(minPriceInput)
    const maxP = BigNumber(maxPriceInput)
    return {
      minPrice: !minP.isFinite() ? BigNumber(0) : BigNumber.max(0, priceBounds ? BigNumber.min(minP, priceBounds.max) : minP),
      maxPrice: !maxP.isFinite() ? BigNumber(0) : clampToBounds(maxP)
    }
  })()

  const parsedAmount = BigNumber(amount)
  const validAmount = parsedAmount.isFinite() && parsedAmount.gt(0)

  // USD value of the entered amount, shown next to the section title. Null when
  // there's no valid amount or the token has no price so we can hide it.
  const priceUsd = inputToken?.priceUsd
  const usdAmount = validAmount && priceUsd > 0 ? parsedAmount.times(priceUsd) : null

  // Amount must not exceed what the user can actually spend. Compared with
  // BigNumber to avoid float precision pushing a valid 100% pick over balance.
  const spendableBn = BigNumber(inputToken?.spendable)
  const exceedsBalance = validAmount && spendableBn.isFinite() && parsedAmount.gt(spendableBn)

  const parsedMin = BigNumber(minPriceInput)
  const parsedMax = BigNumber(maxPriceInput)
  const minEmpty = minPriceInput === '' || !parsedMin.isFinite()
  const maxEmpty = maxPriceInput === '' || !parsedMax.isFinite()

  // Relational/validity error — only meaningful once both prices are filled.
  let rangeError = null
  if (!minEmpty && !maxEmpty) {
    if (parsedMin.lt(0) || parsedMax.lte(0)) {
      rangeError = t('priceMustBePositive')
    } else if (parsedMin.gte(parsedMax)) {
      rangeError = t('minLessThanMax')
    } else if (curPrice > 0 && parsedMin.gt(curPrice)) {
      // Min is "% below current"; a min above current would make that % negative.
      rangeError = t('minBelowCurrent')
    } else if (curPrice > 0 && parsedMax.lt(curPrice)) {
      rangeError = t('maxAboveCurrent')
    } else if (priceBounds && parsedMax.gt(priceBounds.max)) {
      rangeError = t('maxExceedsRange', { max: fmt(priceBounds.max) })
    }
  }

  // What to actually show: the relational error when both filled, otherwise a
  // "required" hint only for a field the user has already touched (so typing max
  // alone doesn't immediately complain that min is empty).
  const displayedRangeError =
    rangeError ||
    (minTouched && minEmpty && t('enterMinPrice')) ||
    (maxTouched && maxEmpty && t('enterMaxPrice')) ||
    null

  const canSubmit =
    validAmount &&
    !exceedsBalance &&
    !inputToken?.warning &&
    !minEmpty &&
    !maxEmpty &&
    !rangeError &&
    computedRange.minPrice.lt(computedRange.maxPrice)

  const handleSubmit = () => {
    if (!canSubmit) return
    const msg = t('confirmAddLiquidityMessage', {
      pair: tokenLabel(pool),
      symbol: inputToken?.symbol || '',
      // Human-readable chain name (e.g. "Ethereum") so the sent message reads
      // naturally. The pool address pins the exact chain + fee tier, and the
      // agent maps the name → hex when calling preview-add-liquidity.
      chainName: chain.name,
      fee: feeLabel,
      pool: pool.address,
      amount: parsedAmount.toFixed(),
      minPrice: computedRange.minPrice.toFixed(),
      maxPrice: computedRange.maxPrice.toFixed()
    })
    onSend(msg)
  }

  return (
    <View style={styles.card}>

      <View style={styles.formBox}>
        {/* Pool header */}
        <View className='flex flex-row' style={styles.poolHeader}>
          <View className='flex-1'>
            <MyTextTicker variant='subTitle' fontWeight={700}>
              {tokenLabel(pool)}
            </MyTextTicker>
          </View>

          <View style={styles.poolMeta}>
            <GlassView style={styles.tag}>
              <MyText variant='small' className='text-medium'>{chain?.name}</MyText>
            </GlassView>
            {!!feeLabel && (
              <GlassView style={styles.tag}>
                <MyText variant='small' className='text-medium'>{feeLabel}</MyText>
              </GlassView>
            )}
          </View>
        </View>

        <View style={styles.divider} className='bg-box-small' />

        {/* Current price */}
        <View style={styles.row}>
          <MyText variant='small'>{t('currentPrice')}</MyText>
          <MyText variant='small' className='font-medium'>
            {fmt(pool?.currentPrice)}{' '}
            <MyText variant='small' className='text-medium'>
              {pool?.token1?.symbol}/{pool?.token0?.symbol}
            </MyText>
          </MyText>
        </View>

        {/* Range section */}
        <MyText variant='small' className='font-semibold' style={styles.sectionTitle}>{t('priceRange')} ({t('tokenBPerTokenA')})</MyText>

        {/* Price range rows: Max on top, Min below */}
        <View style={styles.rangeRow}>
          <MyText variant='small' className='font-semibold' style={styles.rangeRowLabel}>{t('max')}</MyText>
          <GlassView effect='clear' style={styles.rangeRowInput}>
            <TextInput
              style={styles.rangeRowInputText}
              className='text-white font-medium'
              value={maxPriceInput}
              onChangeText={onChangeMaxPrice}
              keyboardType='decimal-pad'
              placeholder={t('enterAmount')}
              placeholderTextColor={Colors.TEXT_LOW}
            />
          </GlassView>
          <MyText className='text-medium' style={styles.rangeArrow}>↑</MyText>
          <GlassView effect='clear' style={styles.rateChip}>
            <TextInput
              style={styles.rateChipText}
              className='text-white font-medium'
              value={maxRateInput}
              onChangeText={onChangeMaxRate}
              keyboardType='numbers-and-punctuation'
              placeholder={t('rate')}
              placeholderTextColor={Colors.TEXT_LOW}
            />
          </GlassView>
          <MyText variant='small' className='text-medium'>%</MyText>
        </View>

        <View style={styles.rangeRow}>
          <MyText variant='small' className='font-semibold' style={styles.rangeRowLabel}>{t('min')}</MyText>
          <GlassView effect='clear' style={styles.rangeRowInput}>
            <TextInput
              style={styles.rangeRowInputText}
              className='text-white font-medium'
              value={minPriceInput}
              onChangeText={onChangeMinPrice}
              keyboardType='decimal-pad'
              placeholder={t('enterAmount')}
              placeholderTextColor={Colors.TEXT_LOW}
            />
          </GlassView>
          <MyText className='text-medium' style={styles.rangeArrow}>↓</MyText>
          <GlassView effect='clear' style={styles.rateChip}>
            <TextInput
              style={styles.rateChipText}
              className='text-white font-medium'
              value={minRateInput}
              onChangeText={onChangeMinRate}
              keyboardType='numbers-and-punctuation'
              placeholder={t('rate')}
              placeholderTextColor={Colors.TEXT_LOW}
            />
          </GlassView>
          <MyText variant='small' className='text-medium'>%</MyText>
        </View>

        <View style={styles.errorSlot}>
          {!!displayedRangeError && (
            <MyText variant='small' className='text-red-text' style={styles.errorText}>{displayedRangeError}</MyText>
          )}
        </View>

        {/* Amount input */}
        <View style={[styles.sectionTitle]} className='flex flex-row'>
          <MyText variant='small' className='font-semibold'>
            {t('amountOf', { symbol: inputToken?.symbol || '' })}
          </MyText>
          {usdAmount != null && (
            <MyText
              variant='small'
              className='text-low'
              style={{
                paddingLeft: pixelByWidth(4)
              }}>
              (~${toFixedDown(usdAmount, 2)})
            </MyText>
          )}
        </View>
        <GlassView effect='clear' style={styles.inputRow}>
          <TextInput
            style={styles.amountInput}
            className='text-white font-semibold'
            value={amount}
            onChangeText={(v) => setAmount(sanitizePrice(v))}
            keyboardType='decimal-pad'
            placeholder='0.0'
            placeholderTextColor={Colors.TEXT_LOW}
          />
          <MyText className='text-medium font-medium'>
            {inputToken?.symbol}
          </MyText>
        </GlassView>
        <View style={styles.errorSlot}>
          {exceedsBalance && (
            <MyText variant='small' className='text-red-text' style={styles.errorText}>
              {t('insufficientBalance')}
            </MyText>
          )}
        </View>

        {/* Quick-pick chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickRow}
        >
          {(inputToken?.quickRates || []).map((r) => (
            <TouchableOpacity
              key={r.percent}
              activeOpacity={0.7}
              onPress={() => setAmount(toAmountDown(r.amount))}
            >
              <GlassView interactive style={styles.quickChip}>
                <MyText variant='small' className='font-semibold'>{r.percent}%</MyText>
              </GlassView>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Balance info */}
        <View style={styles.balanceRow}>
          <MyText variant='small' className='text-medium'>
            {t('spendable')}:{' '}
            <MyText variant='small' className='font-medium'>
              {fmt(inputToken?.spendable)} {inputToken?.symbol}
            </MyText>
            {inputToken?.spendableUsd != null && (
              <MyText variant='small' className='text-low'>
                {' '}(~${toFixedDown(inputToken.spendableUsd, 2)})
              </MyText>
            )}
          </MyText>
        </View>

        {/* Warning */}
        {!!inputToken?.warningMessage && (
          <View style={styles.alertBox} className='border-yellow'>
            <MyText variant='small' className='text-yellow'>{inputToken.warningMessage}</MyText>
          </View>
        )}

        {/* Submit */}
        <MyButton
          className='w-full'
          style={[styles.submitBtnWrap, !canSubmit && styles.submitBtnDisabled]}
          activeOpacity={0.8}
          disabled={!canSubmit}
          variant='primary'
          onPress={handleSubmit}
        >
          <MyText fontWeight={700}>{t('addLiquidity')}</MyText>

        </MyButton>
      </View>

    </View>
  )
}
