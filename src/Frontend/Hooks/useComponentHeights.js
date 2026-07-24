import ReduxService from 'common/redux'

const useComponentHeights = (noLayoutHeaderAnchor = false) => {
  const onLayoutContainerDefault = (event) => {
    const { height, width } = event.nativeEvent.layout
    ReduxService.refLayoutContainerDefault.current = { height, width }
  }
  const onLayoutContainer = (event) => {
    const { height, width } = event.nativeEvent.layout
    ReduxService.refLayoutContainer.current = { height, width }
  }

  const onLayoutHeaderAnchorDefault = (event) => {
    if (!noLayoutHeaderAnchor) {
      const { height, width } = event.nativeEvent.layout
      ReduxService.refLayoutHeaderAnchorDefault.current = { height, width }
    }
  }
  const onLayoutHeaderAnchor = (event) => {
    if (noLayoutHeaderAnchor) {
      ReduxService.refLayoutHeaderAnchor.current = { height: 0, width: 0 }
    } else {
      const { height, width } = event.nativeEvent.layout
      ReduxService.refLayoutHeaderAnchor.current = { height, width }
    }
  }

  return { onLayoutContainer, onLayoutContainerDefault, onLayoutHeaderAnchor, onLayoutHeaderAnchorDefault }
}

export default useComponentHeights
