import AppVersionUpdateRequest from 'frontend/Components/AppVersionUpdateRequest'
import React, { useEffect, useState } from 'react'
import { Modal, View, StyleSheet } from 'react-native'
import deviceInfoModule from 'react-native-device-info'
import VersionCheck from 'react-native-version-check'

// Check for a new app version on mount and, if needed, render a small centered,
// non-dismissable "update required" modal. Returns the modal element for the
// screen to render (e.g. `{versionUpdateModal}` inside the page root). Renders a
// self-contained RN Modal as a small centered card.
const useCheckNewAppVersion = () => {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const checkUpdate = () => {
      try {
        VersionCheck && VersionCheck.needUpdate()
          .then(res => {
            if (res && res.isNeeded) {
              setVisible(true)
            }
          })
      } catch (error) {
        // error here
      }
    }
    const brand = deviceInfoModule.getBrand()
    const isHuawei = brand && brand.toLowerCase().includes('huawei') && !ISIOS
    // Ignore check update for Huawei devices
    if (!isHuawei) {
      checkUpdate()
    }
  }, [])

  return (
    <Modal
      transparent
      visible={visible}
      animationType='fade'
      // Non-dismissable: Android back does nothing; only the Update button closes it.
      onRequestClose={() => {}}
    >
      <View style={overlayStyles.backdrop}>
        <AppVersionUpdateRequest closeModal={() => setVisible(false)} />
      </View>
    </Modal>
  )
}

const overlayStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)'
  }
})

export default useCheckNewAppVersion
