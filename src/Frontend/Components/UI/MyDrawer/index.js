import { BottomSheetBackdrop } from '@gorhom/bottom-sheet'
import { sleep } from 'common/function'
import { height } from 'common/styles'
import { PureComponent } from 'react'
import { View } from 'react-native'

const DEFAULT_DRAWER = {
  addDrawer: false,
  enablePanDownToClose: true,
  children: null,
  onclose: () => {},
  scrollView: true,
  style: {}
}

class MyDrawer extends PureComponent {
  constructor (props) {
    super(props)
    this.drawersRef = new Map()
    this.drawers = []
    this.state = {
      ...this.state,
      drawersState: []
    }
  }

  openDrawer (drawer = DEFAULT_DRAWER) {
    const drawerConfig = { ...DEFAULT_DRAWER, ...drawer }

    if (drawerConfig?.addDrawer === true) {
      this.drawers = [...this.drawers, drawerConfig]
    } else {
      this.drawers = [drawerConfig]
    }
    this.forceUpdate()
  }

  closeDrawer = async () => {
    const indexDrawer = this.drawers.length - 1
    if (this.drawersRef.get(`drawer-${indexDrawer}`)) {
      this.drawersRef.get(`drawer-${indexDrawer}`)?.close()
      this.drawersRef.set(`drawer-${indexDrawer}`, null)
      await sleep(500)
    }

    if (this.drawers?.length > 1) {
      this.drawers = this.drawers.slice(0, -1)
    } else {
      this.drawers = []
    }
    this.forceUpdate()
  }

  closeAllDrawer = () => {
    this.drawers.forEach((drawer, indexDrawer) => {
      this.drawersRef.get(`drawer-${indexDrawer}`)?.close()
      this.drawersRef.set(`drawer-${indexDrawer}`, null)
    })
    this.drawers = []
    this.forceUpdate()
  }

  updateDrawer () {
    if (this.drawers?.length > 1) {
      this.drawers = this.drawers.slice(0, -1)
    } else {
      this.drawers = []
    }
    this.forceUpdate()
  }

  onDownToCloseDrawer = () => {
    this.closeDrawer()
  }

  renderBackdrop (isFirstDrawer, props) {
    return (
      <BottomSheetBackdrop
        style={{ backgroundColor: isFirstDrawer ? 'rgba(0,0,0,0.2)' : 'transparent' }}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        pressBehavior='none'
        onPress={() => {}}
        opacity={isFirstDrawer ? 0.7 : 0}
        {...props}

      >
        <View
          style={{
            height: height(100),
            backgroundColor: isFirstDrawer ? 'rgba(0,0,0,0.2)' : 'transparent'
          }} />
      </BottomSheetBackdrop>
    )
  }
}

export default MyDrawer
