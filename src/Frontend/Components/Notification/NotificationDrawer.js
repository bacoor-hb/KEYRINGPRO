import React, { useState, useEffect, useRef, useMemo } from 'react'
import { View, TouchableOpacity, StyleSheet } from 'react-native'
// ScrollView must come from react-native-gesture-handler so it cooperates with the
// drawer's pan gesture — otherwise Android can't scroll inside the drawer (iOS is fine).
import { ScrollView } from 'react-native-gesture-handler'
import { useDispatch, useSelector } from 'react-redux'
import Markdown from 'react-native-markdown-display'
import FitImage from 'react-native-fit-image'
import MyText from 'frontend/Components/UI/MyText'
import MyTextTicker from 'frontend/Components/UI/MyTextTicker'
import MyIcon from 'frontend/Components/UI/MyIcon'
import MyViewPage from 'frontend/Components/UI/MyViewPage'
import TitleDrawer from 'frontend/Components/UI/TitleDrawer'
import images from 'assets/Image'
import I18n from 'assets/Lang'
import { pixelByHeight, pixelByWidth, getHeightHeaderDrawer, Colors, fontSize, getFontFamily, getSafeAreaValues } from 'common/styles'
import StorageReduxAction from 'controller/Redux/actions/storageAction'

function getNotiId (noti) {
  return noti?._id ?? noti?.id
}

function getLocalizedText (field, locale) {
  if (!field || typeof field === 'string') return field || ''
  return field[locale] || field.en || ''
}

const TEXT_MEDIUM = Colors.TEXT_MEDIUM
const TEXT_LOW = Colors.TEXT_LOW
const BORDER_COLOR = Colors.BG_BOX_SMALL

function formatDate (dateStr) {
  const d = new Date(dateStr)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}/${m}/${day}`
}

function NotiTitleRow ({ title, showArrow, isExpanded, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={styles.itemRow}
      disabled={!onPress}
    >
      <View style={styles.titleWrap}>
        <MyTextTicker style={styles.itemTitle} scrollSpeed={50}>
          {title}
        </MyTextTicker>
      </View>
      {showArrow && (
        <MyIcon
          variant='small'
          uri={isExpanded ? images.UIV2.icons.arrowRDownBlue : images.UIV2.icons.arrowRightBrand}
        />
      )}
    </TouchableOpacity>
  )
}

function SingleView ({ noti, markAllAsRead, locale }) {
  useEffect(() => {
    markAllAsRead()
  }, [])

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
      <View style={{ paddingTop: pixelByHeight(8) }}>
        <MyText style={styles.dateLabel}>{formatDate(noti.createdAt)}</MyText>
        <NotiTitleRow title={getLocalizedText(noti.title, locale)} showArrow={false} />
        <View style={{ paddingTop: pixelByHeight(8) }}>
          <Markdown style={contentMdStyles} rules={markdownRules}>{getLocalizedText(noti.content, locale)}</Markdown>
        </View>
      </View>
    </ScrollView>
  )
}

function NotificationItem ({ noti, markAsRead, locale }) {
  const [isExpanded, setIsExpanded] = useState(false)

  const handlePress = () => {
    if (!isExpanded) markAsRead(getNotiId(noti))
    setIsExpanded(prev => !prev)
  }

  return (
    <View>
      <NotiTitleRow
        title={getLocalizedText(noti.title, locale)}
        showArrow
        isExpanded={isExpanded}
        onPress={handlePress}
      />
      {isExpanded && (
        <View style={styles.itemContent}>
          <Markdown style={contentMdStyles} rules={markdownRules}>{getLocalizedText(noti.content, locale)}</Markdown>
        </View>
      )}
    </View>
  )
}

function ListView ({ localList, markAsRead, locale }) {
  const groups = useMemo(() => {
    const map = {}
    for (const n of localList) {
      const key = formatDate(n.createdAt)
      if (!map[key]) map[key] = []
      map[key].push(n)
    }
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]))
  }, [localList])

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
      <View style={{ paddingTop: pixelByHeight(8) }}>
        {groups.map(([date, items]) => (
          <View key={date} style={styles.dateGroup}>
            <MyText style={styles.dateLabel}>{date}</MyText>
            {items.map((noti, idx) => (
              <NotificationItem key={getNotiId(noti) ?? `${date}-${idx}`} noti={noti} markAsRead={markAsRead} locale={locale} />
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

export default function NotificationDrawer () {
  const dispatch = useDispatch()
  const reduxReadIds = useSelector(s => s.notificationReadIdsRedux)
  const notificationList = useSelector(s => s.notificationListRedux)
  const locale = useSelector(s => s.localeRedux)

  const [localList] = useState(() =>
    (notificationList || []).filter(n => {
      const id = getNotiId(n)
      return id && !(reduxReadIds || []).includes(id)
    })
  )

  const readIdsRef = useRef(reduxReadIds)
  useEffect(() => {
    readIdsRef.current = reduxReadIds
  }, [reduxReadIds])

  const markAsRead = (id) => {
    const current = readIdsRef.current || []
    if (current.includes(id)) return
    dispatch(StorageReduxAction.setNotificationReadIds([...current, id]))
  }

  const markAllAsRead = () => {
    const current = readIdsRef.current || []
    const allIds = localList.map(getNotiId)
    dispatch(StorageReduxAction.setNotificationReadIds([...new Set([...current, ...allIds])]))
  }

  const isSingle = localList.length === 1

  return (
    <MyViewPage isUseDrawer style={{ flex: 1 }}>
      <TitleDrawer
        hasBlur
        absolute
        title={I18n.t('v2.common.notification')}
        leftIcon={images.UIV2.icons.notiBrand}
        containerConfig={{ style: { paddingTop: pixelByHeight(8) } }}
      />
      {isSingle
        ? <SingleView noti={localList[0]} markAllAsRead={markAllAsRead} locale={locale} />
        : <ListView localList={localList} markAsRead={markAsRead} locale={locale} />}
    </MyViewPage>
  )
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: getSafeAreaValues().bottom,
    paddingTop: getHeightHeaderDrawer()
  },
  dateGroup: {
    marginBottom: pixelByHeight(14)
  },
  dateLabel: {
    color: TEXT_LOW
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: pixelByHeight(52),
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR
  },
  titleWrap: {
    flex: 1,
    overflow: 'hidden'
  },
  itemTitle: {
    color: Colors.WHITE
  },
  itemContent: {
    paddingVertical: pixelByHeight(12),
    paddingHorizontal: pixelByWidth(4)
  }
})

// Markdown styles for notification content — dark-mode only. Plain object passed
// whole to <Markdown>. Supports bold / lists / clickable links / images.
const contentMdStyles = {
  body: {
    color: TEXT_MEDIUM,
    fontSize: fontSize(16.5),
    lineHeight: fontSize(16.5) * 1.5,
    fontFamily: getFontFamily(),
    // gap spaces the blocks apart; zero the paragraph margins so there is no
    // leading/trailing padding — makes markdown flush like plain text.
    gap: pixelByHeight(8)
  },
  paragraph: { marginTop: 0, marginBottom: 0 },
  strong: { color: Colors.WHITE },
  em: { fontStyle: 'italic' },
  link: { color: Colors.BLUE5, textDecorationLine: 'underline' },
  bullet_list: { marginVertical: pixelByHeight(2) },
  ordered_list: { marginVertical: pixelByHeight(2) },
  list_item: { marginVertical: pixelByHeight(2) },
  image: { borderRadius: 8, marginVertical: pixelByHeight(6) }
}

// Override the default `image` rule: the lib builds a props object that INCLUDES
// `key` and spreads it into <FitImage> — React 19 errors on a spread key. Pass the
// key directly and spread the rest.
const markdownRules = {
  image: (node, children, parent, styles) => {
    const { src, alt } = node.attributes
    const imageProps = {
      // no `indicator` — FitImage's built-in spinner can get stuck spinning
      style: styles._VIEW_SAFE_image,
      source: { uri: src }
    }
    if (alt) {
      imageProps.accessible = true
      imageProps.accessibilityLabel = alt
    }
    return <FitImage key={node.key} {...imageProps} />
  }
}
