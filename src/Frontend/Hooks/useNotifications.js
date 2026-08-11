import { useEffect, useCallback } from 'react'
import { AppState } from 'react-native'
import { useSelector, useDispatch } from 'react-redux'
import StorageReduxAction from 'controller/Redux/actions/storageAction'
import BaseAPI from 'controller/API/BaseAPI'

const getNotiId = (noti) => noti?._id ?? noti?.id

export default function useNotifications () {
  const dispatch = useDispatch()
  const notificationListRedux = useSelector(s => s.notificationListRedux)
  const notificationReadIdsRedux = useSelector(s => s.notificationReadIdsRedux)

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await BaseAPI.getNotificationList()
      if (Array.isArray(data)) {
        dispatch(StorageReduxAction.setNotificationList(data))
      }
    } catch (_) {
      // Keep the previous list; the next focus/refresh retries
    }
  }, [dispatch])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60000)
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') fetchNotifications()
    })
    return () => {
      clearInterval(interval)
      subscription.remove()
    }
  }, [fetchNotifications])

  const unreadList = (notificationListRedux || []).filter(
    n => !(notificationReadIdsRedux || []).includes(getNotiId(n))
  )

  const markAsRead = useCallback((id) => {
    const current = notificationReadIdsRedux || []
    if (current.includes(id)) return
    dispatch(StorageReduxAction.setNotificationReadIds([...current, id]))
  }, [dispatch, notificationReadIdsRedux])

  const markAllAsRead = useCallback(() => {
    const allIds = (notificationListRedux || []).map(getNotiId)
    const current = notificationReadIdsRedux || []
    const merged = [...new Set([...current, ...allIds])]
    dispatch(StorageReduxAction.setNotificationReadIds(merged))
  }, [dispatch, notificationListRedux, notificationReadIdsRedux])

  return { unreadList, markAsRead, markAllAsRead }
}
