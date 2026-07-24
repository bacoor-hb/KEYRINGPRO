import { createNavigationContainerRef, StackActions } from '@react-navigation/native'

export const navigationRef = createNavigationContainerRef()

/**
 * @param {string} name
 * example: NAME_SCREEN.home
 * @param {object} [params]
 */
export function navigate (name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params)
  }
}

/**
 * @param {string} name
  * example: NAME_SCREEN.home
 * @param {object} [params]
 */
export function reset (name, params) {
  if (navigationRef.isReady()) {
    navigationRef.reset({
      index: 0,
      routes: [{ name, params }]
    })
  }
}

/**
 * @param {string} name
  * example: NAME_SCREEN.home
 * @param {object} [params]
 */
export function replace (name, params) {
  if (navigationRef.isReady()) {
    navigationRef.dispatch(
      StackActions.replace(name, params)
    )
  }
}

export function goBack () {
  if (navigationRef.isReady() && navigationRef.canGoBack()) {
    navigationRef.goBack()
  }
}

export function canGoBack () {
  return navigationRef.isReady() && navigationRef.canGoBack()
}

/**
 * @param {string} name
  * example: NAME_SCREEN.home
 * @param {object} [params]
 */
export function popTo (name, params) {
  if (navigationRef.isReady()) {
    navigationRef.dispatch(
      StackActions.popToTop(name, params)
    )
  }
}

export function pop (count = 1) {
  if (navigationRef.isReady()) {
    navigationRef.dispatch(
      StackActions.pop(count)
    )
  }
}

export function getCurrentScreen () {
  if (navigationRef.isReady()) {
    return navigationRef.getCurrentRoute()?.name
  }
  return null
}

export const NavigationActions = {
  navigate: (routeName, params = {}) => navigate(routeName, params),
  reset: (routeName, params = {}) => reset(routeName, params),
  replace: (routeName, params = {}) => replace(routeName, params),
  popTo: (routeName, params = {}) => popTo(routeName, params),
  pop: (count = 1) => pop(count),
  goBack: () => goBack(),
  canGoBack: () => canGoBack(),
  getCurrentScreen: () => getCurrentScreen()
}

export default {
  navigate,
  reset,
  replace,
  goBack,
  canGoBack,
  popTo,
  pop,
  getCurrentScreen,
  navigationRef,
  NavigationActions
}
