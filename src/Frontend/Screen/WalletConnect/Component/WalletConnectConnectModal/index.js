import React, { useEffect, useMemo, useState } from 'react'
import { View, TouchableOpacity } from 'react-native'
// ScrollView from react-native-gesture-handler so these nested scrolls cooperate with
// the drawer's pan gesture — the plain RN ScrollView won't scroll inside the drawer on
// Android (iOS is fine).
import { ScrollView } from 'react-native-gesture-handler'
import LottieView from 'lottie-react-native'
import { useSelector, useDispatch } from 'react-redux'
import MyText from 'frontend/Components/UI/MyText'
import MyIcon from 'frontend/Components/UI/MyIcon'
import MyButton from 'frontend/Components/UI/MyButton'
import ChainIcon from 'frontend/Components/UI/ChainIcon'
import ChainRow from 'frontend/Screen/Network/Component/ChainRow'
import AvatarAccount from 'frontend/Components/UI/AvatarAccount'
import images from 'assets/Image'
import I18n from 'assets/Lang'
import { getSizeImgSquare, pixelByWidth } from 'common/styles'
import { LIST_DEFAULT_CHAIN_ID } from 'common/constants/chain'
import { ACCOUNT_TYPE } from 'common/constants/account'
import { handleOpenUrl, convertAddressArrToString } from 'common/function'
import BaseAPI from 'controller/API/BaseAPI'
import StorageReduxAction from 'controller/Redux/actions/storageAction'
import {
  assessWalletConnectUrl,
  WC_VERIFY_STATE
} from 'src/Services/WalletConnectAssess'
import styles from './styles'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import ScrollViewBlurHeader from 'frontend/Components/UI/ScrollViewBlurHeader'

const DEFAULT_CHAIN_ID_SET = new Set(LIST_DEFAULT_CHAIN_ID.map(Number))

// Unique eip155 chainIds (numbers) the dApp asks for (required + optional).
const getProposalChainIds = (proposal) => {
  const { requiredNamespaces = {}, optionalNamespaces = {} } = proposal?.params || {}
  const set = new Set()
  ;[requiredNamespaces?.eip155, optionalNamespaces?.eip155].forEach((ns) => {
    if (Array.isArray(ns?.chains)) {
      ns.chains.forEach((c) => {
        const parts = String(c).split(':')
        if (parts[0] === 'eip155' && parts[1]) set.add(Number(parts[1]))
      })
    }
  })
  return [...set]
}

// Split a string at its LAST dot → [base, ext] (ext keeps the leading '.').
const splitLastDot = (s) => {
  const i = String(s || '').lastIndexOf('.')
  return i >= 0 ? [s.slice(0, i), s.slice(i)] : [String(s || ''), '']
}

// Diff one part of `cur` against `cop` by common prefix + common suffix; the
// middle (the differing chars) is flagged red.
const diffSegments = (cur, cop) => {
  let p = 0
  while (p < cur.length && p < cop.length && cur[p] === cop[p]) p++
  let curEnd = cur.length
  let copEnd = cop.length
  while (curEnd > p && copEnd > p && cur[curEnd - 1] === cop[copEnd - 1]) { curEnd--; copEnd-- }
  const segs = []
  if (p > 0) segs.push({ text: cur.slice(0, p), red: false })
  if (curEnd > p) segs.push({ text: cur.slice(p, curEnd), red: true })
  if (curEnd < cur.length) segs.push({ text: cur.slice(curEnd), red: false })
  return segs
}

// Split currentSite into colored segments: the chars that differ from the official
// `copiedSite` (the look-alike trick) are red. base + TLD are diffed separately so
// the common structural '.' stays unhighlighted.
const diffHighlightUrl = (currentSite, copiedSite) => {
  const [curBase, curExt] = splitLastDot(currentSite)
  const [copBase, copExt] = splitLastDot(copiedSite)
  return [...diffSegments(curBase, copBase), ...diffSegments(curExt, copExt)]
}

// The URL-row icon depends on the verification verdict.
const getUrlIcon = (state) => {
  switch (state) {
    case WC_VERIFY_STATE.OFFICIAL:
      return images.UIV2.icons.successBlue
    case WC_VERIFY_STATE.PHISHING_API:
    case WC_VERIFY_STATE.AI_PHISHING:
      return images.UIV2.icons.wcPhishing
    default:
      // ERROR + LOADING fall back to the neutral website/globe icon.
      return images.UIV2.icons.browserBlue
  }
}

/**
 * dApp connection-confirmation modal (replaces the old multi-account/multi-chain
 * WalletConnectPopupV2). The account is the current one. Only chains supported by
 * Keyring (default list ∪ Keyring chain API) are offered:
 *   - if any are already active in the app → connect exactly those (read-only);
 *   - otherwise → let the user pick which to connect; picked chains are added to
 *     the active list + blockchainListRedux before connecting.
 *
 * Props:
 *   proposal                     — the WC session proposal (source of requested chains)
 *   siteIcon, siteName, siteUrl  — dApp metadata from the WC proposal
 *   onApprove(chainIds)          — approve with the chosen chainIds (parent closes the modal)
 *   onReject()                   — reject (also wired to dismiss in the parent)
 */
const WalletConnectConnectModal = ({
  proposal,
  siteIcon,
  siteName,
  siteUrl,
  isFromDeepLink,
  onApprove,
  onReject
}) => {
  // Computed inside the component (not at module load) so the strings resolve in
  // the CURRENT locale — a module-level object would freeze them to whatever
  // locale was active when this file was first imported.
  const TEXT = {
    selectAccount: I18n.t('v2.wcConnect.selectAccount'),
    addNetworkConnect: I18n.t('v2.wcConnect.addNetworkConnect'),
    noNetworkWarning: I18n.t('v2.wcConnect.noNetworkWarning'),
    noSupportedChains: I18n.t('v2.wcConnect.noSupportedChains'),
    phishingSuffix: I18n.t('v2.wcConnect.phishingSuffix'),
    officialUrlLabel: I18n.t('v2.wcConnect.officialUrlLabel'),
    reasons: I18n.t('v2.wcConnect.reasons'),
    keyFeatures: I18n.t('v2.wcConnect.keyFeatures'),
    aiResponse: I18n.t('v2.wcConnect.aiResponse'),
    legendTitle: I18n.t('v2.wcConnect.legendTitle'),
    legendVerified: I18n.t('v2.wcConnect.legendVerified'),
    legendNotVerified: I18n.t('v2.wcConnect.legendNotVerified'),
    legendPhishing: I18n.t('v2.wcConnect.legendPhishing'),
    disclaimer1: I18n.t('v2.wcConnect.disclaimer1'),
    disclaimer2: I18n.t('v2.wcConnect.disclaimer2'),
    errorLine1: I18n.t('v2.wcConnect.errorLine1'),
    errorLine2: I18n.t('v2.wcConnect.errorLine2')
  }
  const [verify, setVerify] = useState({ state: WC_VERIFY_STATE.LOADING })
  const [approving, setApproving] = useState(false)

  const activeEvmChainIds = useSelector((s) => s.activeEvmChainIdsRedux)
  const blockchainList = useSelector((s) => s.blockchainListRedux)
  const accountListRedux = useSelector((s) => s.accountListRedux)
  const accountCurrent = useSelector((s) => s.accountCurrent)
  const dispatch = useDispatch()

  // Mobile deep-link connect has no "current account" context, so the user picks
  // one here (desktop already connects with the account it's viewing). EVM-only
  // (v2). Both hot and cold (NFC) accounts can be connected.
  const evmAccounts = useMemo(
    () => (accountListRedux || []).filter(
      (a) => a?.chain === 'evm' && a?.address &&
        (a?.accountType === ACCOUNT_TYPE.HOT || a?.accountType === ACCOUNT_TYPE.COLD)
    ),
    [accountListRedux]
  )
  // No account is pre-selected — the user must tap one before Connect enables.
  const [selectedAccount, setSelectedAccount] = useState(null)
  // The account the session connects with.
  const connectAccount = isFromDeepLink ? selectedAccount : accountCurrent

  // dApp-requested chains; null apiChains => still loading the Keyring chain API.
  const proposalChainIds = useMemo(() => getProposalChainIds(proposal), [proposal])
  const [apiChains, setApiChains] = useState(null)
  const [selectedSet, setSelectedSet] = useState(() => new Set())

  useEffect(() => {
    let alive = true
    assessWalletConnectUrl(siteUrl, {
      // Server-confirmed OFFICIAL arrives here first → flip the icon immediately,
      // the AI description fills in the info card when the final result resolves.
      onPartial: (partial) => { if (alive) setVerify(partial) }
    }).then((result) => {
      if (alive) setVerify(result)
    })
    return () => { alive = false }
  }, [siteUrl])

  // Keyring chain API → map chainId -> chain item (defines the "other" supported chains).
  useEffect(() => {
    let alive = true
    BaseAPI.getBlockChainList()
      .then((res) => {
        if (!alive) return
        const map = {}
        Object.values(res || {}).forEach((c) => { if (c?.chainId) map[Number(c.chainId)] = c })
        setApiChains(map)
      })
      .catch(() => { if (alive) setApiChains({}) })
    return () => { alive = false }
  }, [])

  const activeSet = useMemo(() => new Set((activeEvmChainIds || []).map(Number)), [activeEvmChainIds])

  // Supportable = requested chains that are default OR present in the Keyring API.
  // null while the API is loading.
  const supportableChainIds = useMemo(() => {
    if (!apiChains) return null
    return proposalChainIds.filter((id) => DEFAULT_CHAIN_ID_SET.has(id) || apiChains[id])
  }, [proposalChainIds, apiChains])
  const isChainsLoading = supportableChainIds === null

  // Supportable chains already active in the app. When any exist we connect
  // exactly these (read-only) and skip the picker.
  const matchedActive = useMemo(
    () => (supportableChainIds || []).filter((id) => activeSet.has(id)),
    [supportableChainIds, activeSet]
  )
  const hasMatchedActiveChains = matchedActive.length > 0
  // Otherwise (no active match): supportable chains the user can pick to add+connect.
  const pickerChainIds = useMemo(
    () => (supportableChainIds || []).filter((id) => !activeSet.has(id)),
    [supportableChainIds, activeSet]
  )

  // The chains that will actually be connected.
  const finalChainIds = hasMatchedActiveChains ? matchedActive : [...selectedSet]

  const isPhishing = verify.state === WC_VERIFY_STATE.AI_PHISHING
  // Spinner in the info card while the verdict is loading OR while the icon is
  // already OFFICIAL (server-confirmed) but the AI description is still pending.
  const isLoading = verify.state === WC_VERIFY_STATE.LOADING || verify.aiPending

  const toggleSelect = (id) => {
    setSelectedSet((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleApprove = () => {
    if (approving || finalChainIds.length === 0) return
    setApproving(true)

    // No active match → add the picked chains to the active list + blockchain info
    // before connecting (same shape as Network/OtherNetwork.handleAdd).
    if (!hasMatchedActiveChains) {
      const nextActive = [...(activeEvmChainIds || []).map(Number)]
      const nextBlockchain = { ...(blockchainList || {}) }
      let blockchainChanged = false
      for (const id of finalChainIds) {
        if (!nextActive.includes(id)) nextActive.push(id)
        if (!nextBlockchain[id]) {
          const chainItem = apiChains?.[id]
          if (!chainItem) continue
          const chain = String(chainItem.chain || '').toLowerCase()
          nextBlockchain[id] = {
            ...chainItem,
            chain,
            chainId: id,
            keyChain: `${chain}${id}`,
            isCustomChainData: true,
            isSupportedChain: false
          }
          blockchainChanged = true
        }
      }
      dispatch(StorageReduxAction.setActiveEvmChainIds(nextActive))
      if (blockchainChanged) dispatch(StorageReduxAction.setBlockChainList(nextBlockchain))
    }

    // Pass the URL verdict computed here so the connected session stores it — the
    // dApp detail modal reads it back without re-running the server/AI assessment.
    onApprove && onApprove(finalChainIds, connectAccount, verify.state)
  }

  // `segments` (optional): render the url with the look-alike chars highlighted red
  // (diff vs the official site); otherwise plain `label`.
  const renderUrlRow = (icon, label, segments) => (
    <View style={styles.urlRow}>
      <View className='flex flex-row justify-center' style={{ width: getSizeImgSquare('large') }}>
        <MyIcon uri={icon} variant='medium' />
      </View>
      <View style={styles.urlRowInner}>
        <MyText style={styles.urlText} numberOfLines={1}>
          {segments
            ? segments.map((seg, i) => (
              <MyText key={i} className={seg.red ? 'text-red-text' : 'text-medium'}>{seg.text}</MyText>
            ))
            : label}
        </MyText>
      </View>
    </View>
  )

  // The website-summary card is ALWAYS shown except when the Keyring API flags the
  // URL as phishing (PHISHING_API). While loading → spinner. When the AI summary
  // exists → show it (+ "AI-Generated Response"; red for AI_PHISHING). When there's
  // no AI message yet (the AI API isn't wired up) → the "couldn't retrieve" copy.
  const renderInfoCard = () => {
    if (verify.state === WC_VERIFY_STATE.PHISHING_API) return null

    if (isLoading) {
      return (
        <View style={styles.infoCardWrap}>
          <View style={styles.infoCard}>
            <View style={styles.infoScrollContent}>
              <View style={styles.infoLoadingWrap}>
                <LottieView style={styles.chainLoadingDots} source={images.threeDotsWhiteLoading} autoPlay loop />
              </View>
              <View style={styles.aiRow}>
                <View style={{ width: getSizeImgSquare('large'), justifyContent: 'center', alignItems: 'center' }}>
                  <MyIcon uri={images.UIV2.icons.aiChatLow} variant='small' />
                </View>
                <MyText variant='small' style={styles.aiLabel}>{TEXT.aiResponse}</MyText>
              </View>
            </View>
          </View>
        </View>
      )
    }

    return (
      <View style={styles.infoCardWrap}>
        <View style={[styles.infoCard, isPhishing && styles.infoCardDanger]}>
          {/* All AI info scrolls within a fixed max height (height(30)). */}
          <ScrollView
            style={styles.infoScroll}
            contentContainerStyle={styles.infoScrollContent}
            nestedScrollEnabled
            showsVerticalScrollIndicator
          >
            {verify.message
              ? (
                <>
                  <View style={{ paddingHorizontal: pixelByWidth(12) }}>
                    {/* When the AI gives both the analyzed site + the impersonated
                    official one, show the fixed layout (current site red, official
                    site a tappable blue link); otherwise the raw answer. */}
                    {isPhishing && verify.currentSite && verify.copiedSite
                      ? (
                        <>
                          <MyText style={styles.infoText}>
                            <MyText className='text-red-text'>{verify.currentSite}</MyText> {TEXT.phishingSuffix}
                          </MyText>
                          <MyText style={styles.infoText}>
                            {TEXT.officialUrlLabel}{'\n'}
                            <MyText
                              className='text-brand'
                              onPress={() => handleOpenUrl(/^https?:\/\//.test(verify.copiedSite) ? verify.copiedSite : `https://${verify.copiedSite}`)}
                            >
                              {verify.copiedSite}
                            </MyText>.
                          </MyText>
                        </>
                      )
                      : <MyText style={styles.infoText}>{verify.message}</MyText>}
                    {verify.reasons?.length > 0 && (
                      <>
                        <MyText style={styles.infoText}>{TEXT.reasons}</MyText>
                        {verify.reasons.map((reason, index) => (
                          <View key={index} style={styles.reasonRow}>
                            <View style={styles.reasonDot} />
                            <MyText style={[styles.infoText, styles.reasonText]}>{reason}</MyText>
                          </View>
                        ))}
                      </>
                    )}
                    {verify.keyFeatures?.length > 0 && (
                      <>
                        <MyText style={styles.infoText}>{TEXT.keyFeatures}</MyText>
                        {verify.keyFeatures.map((feature, index) => (
                          <View key={index} style={styles.reasonRow}>
                            <View style={styles.reasonDot} />
                            <MyText style={[styles.infoText, styles.reasonText]}>{feature}</MyText>
                          </View>
                        ))}
                      </>
                    )}
                  </View>
                  <View style={styles.aiRow}>
                    <View style={{ width: getSizeImgSquare('large'), justifyContent: 'center', alignItems: 'center' }}>
                      <MyIcon uri={images.UIV2.icons.aiChatLow} variant='small' />
                    </View>
                    <MyText variant='small' style={styles.aiLabel}>{TEXT.aiResponse}</MyText>
                  </View>
                </>
              )
              : (
                <View style={{ paddingHorizontal: pixelByWidth(12) }}>
                  <MyText style={styles.infoText}>{TEXT.errorLine1}</MyText>
                  <MyText style={styles.infoText}>{TEXT.errorLine2}</MyText>
                </View>
              )}
          </ScrollView>
        </View>
      </View>
    )
  }

  const renderLegendRow = (icon, label) => (
    <View style={styles.legendRow}>
      <View className='flex flex-row justify-center' style={{ width: getSizeImgSquare('large') }}>
        <MyIcon uri={icon} variant='medium' />
      </View>
      <MyText style={styles.legendText}>{label}</MyText>
    </View>
  )

  // The chain picker, shown only when there's no active match — the user selects
  // which supportable chains to add+connect. (The matched-active read-only row is
  // rendered inside the URL section instead.)
  const renderChainsSection = () => {
    // While loading, the chains row above shows the three-dot indicator.
    if (isChainsLoading) return null
    if (supportableChainIds.length === 0) {
      return (
        <View style={styles.chainsEmpty}>
          <MyText style={styles.chainsEmptyText}>{TEXT.noSupportedChains}</MyText>
        </View>
      )
    }
    // The matched-active read-only row renders inside the URL section instead.
    if (hasMatchedActiveChains) return null
    return (
      <View style={styles.chainsSection}>
        {/* No active network matches the dApp → warn + let the user add one. */}
        <View style={styles.warningRow}>
          <MyIcon uri={images.UIV2.icons.warning} variant='large' />
          <MyText style={styles.warningText}>{TEXT.noNetworkWarning}</MyText>
        </View>

        <MyText variant='subTitle' style={styles.pickerLabel}>{TEXT.addNetworkConnect}</MyText>

        {/* Boxed list (like the AI card): ~4 rows visible, then scroll inside. */}
        <View style={styles.pickerBox}>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
            {pickerChainIds.map((id, index) => {
              const item = apiChains?.[id] || blockchainList?.[id] || {}
              const symbol = item?.nativeCurrency?.symbol || item?.symbol || ''
              return (
                <ChainRow
                  key={id}
                  icon={item.icon}
                  title={item.name || item.chain || `Chain ${id}`}
                  gasSymbol={symbol}
                  isActive={selectedSet.has(id)}
                  noBorder={index === pickerChainIds.length - 1}
                  onPress={() => toggleSelect(id)}
                />
              )
            })}
          </ScrollView>
        </View>

        {/* Divider separating the picker box from the AI info card below. */}
        <View style={styles.pickerDivider} />
      </View>
    )
  }

  // Mobile deep link only: pick the account to connect with (max ~3 rows, then
  // scroll). Boxed like the chain picker.
  const renderAccountSection = () => {
    if (!isFromDeepLink) return null
    return (
      <View style={styles.accountSection}>
        <MyText variant='subTitle' style={styles.pickerLabel}>{TEXT.selectAccount}</MyText>
        <View style={styles.accountBox}>
          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
            {evmAccounts.map((acc, index) => {
              const isSelected = selectedAccount?.address === acc.address
              const isLast = index === evmAccounts.length - 1
              return (
                <TouchableOpacity
                  key={acc.address}
                  activeOpacity={1}
                  style={[styles.accountRow, isSelected ? styles.accountSelected : styles.accountUnselected]}
                  onPress={() => setSelectedAccount(acc)}
                >
                  <AvatarAccount account={acc} noShowAccountType size={getSizeImgSquare('large')} />
                  <View style={styles.accountInfo}>
                    <MyText fontWeight={700} numberOfLines={1}>
                      {acc.name || `Account ${(acc.indexAccount || 0) + 1}`}
                    </MyText>
                    <MyText className='text-medium'>{convertAddressArrToString([acc.address])}</MyText>
                  </View>
                  {/* Divider inset past the avatar (doesn't run under it). */}
                  {!isLast && <View style={styles.accountDivider} />}
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </View>

        {/* Divider separating the account box from the AI info card below. */}
        <View style={styles.pickerDivider} />
      </View>
    )
  }

  return (
    <MyViewPage isUseDrawer style={styles.container}>
      {/* Header: dApp avatar + name + Connect action */}
      {/* <View style={styles.header}>
        <View style={styles.headerLeft}>
          <ImageRender
            uri={siteIcon}
            uriDefault={images.walletConnectIcon}
            style={styles.avatar}
            resizeMode='contain'
          />
          <MyText variant='subTitle' style={styles.dappName} numberOfLines={1}>
            {siteName || '-'}
          </MyText>
        </View>
        <MyButton
          size='small'
          label={I18n.t('Content.connect')}
          variant={isPhishing ? 'dangerous' : 'primary'}
          isLoading={approving}
          isDisable={finalChainIds.length === 0 || (isFromDeepLink && !connectAccount?.address)}
          onPress={handleApprove}
        />
      </View> */}
      <TitleDrawer
        absolute
        hasBlur
        title={siteName || '-'}
        leftIcon={siteIcon || images.walletConnectIcon}
        rightElement={(
          <MyButton
            size='small'
            label={I18n.t('Content.connect')}
            variant={isPhishing ? 'dangerous' : 'primary'}
            isLoading={approving}
            isDisable={finalChainIds.length === 0 || (isFromDeepLink && !connectAccount?.address)}
            onPress={handleApprove}
          />
        )}
      />

      {/* Body scrolls; the header above stays fixed (like other modals). A plain
        ScrollView (not BottomSheetScrollView) keeps the sheet's dynamic sizing
        from collapsing to the flex content — the sheet height stays the fixed
        drawer height and the body scrolls inside it. */}
      <ScrollViewBlurHeader
        isUseDrawer
        style={styles.bodyScroll}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {/* URL row + the chains that will be connected — ALWAYS shown (network icon
          + horizontally-scrollable chain badges). These are the matched-active
          chains, or the ones picked in the list below (updates live). */}
        <View style={styles.urlSection}>
          {renderUrlRow(
            getUrlIcon(verify.state),
            siteUrl || '',
            isPhishing && verify.currentSite && verify.copiedSite
              ? diffHighlightUrl(verify.currentSite, verify.copiedSite)
              : null
          )}
          <View style={styles.urlRow}>
            <View className='flex flex-row justify-center' style={{ width: getSizeImgSquare('large') }}>
              <MyIcon uri={images.UIV2.icons.network} variant='medium' />
            </View>
            <View style={styles.urlRowInner}>
              {isChainsLoading
                ? <LottieView style={styles.chainLoadingDots} source={images.threeDotsWhiteLoading} autoPlay loop />
                : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chainIconsRow}
                  >
                    {finalChainIds.map((id, index) => {
                      const item = apiChains?.[id] || blockchainList?.[id] || {}
                      return (
                        <ChainIcon
                          key={id}
                          chainId={id}
                          uri={item.icon}
                          style={index === 0 ? null : styles.chainOverlap}
                        />
                      )
                    })}
                  </ScrollView>
                )}
            </View>
          </View>
        </View>

        {renderChainsSection()}

        {renderAccountSection()}

        {renderInfoCard()}

        {/* Legend — always shown */}
        <View style={styles.legendSection}>
          <MyText variant='subTitle' style={styles.legendTitle}>{TEXT.legendTitle}</MyText>
          <View style={styles.legendRows}>
            {renderLegendRow(images.UIV2.icons.successBlue, TEXT.legendVerified)}
            {renderLegendRow(images.UIV2.icons.browserBlue, TEXT.legendNotVerified)}
            {renderLegendRow(images.UIV2.icons.wcPhishing, TEXT.legendPhishing)}
          </View>
          <MyText style={styles.disclaimer}>{TEXT.disclaimer1}</MyText>
          <MyText style={styles.disclaimer}>{TEXT.disclaimer2}</MyText>
        </View>
      </ScrollViewBlurHeader>
    </MyViewPage>
  )
}

export default WalletConnectConnectModal
