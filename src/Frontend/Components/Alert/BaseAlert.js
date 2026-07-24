import { Component, createRef } from 'react'

let timeOutAlet, timeOutClose, timeOutSettle

const INIT_STATE = {
  cancelTitle: '',
  callback: null,
  cancelAction: null,
  type: false,
  title: '',
  txtValue: '',
  moreViewMess: null,
  okTitle: null,
  message: '',
  isOpen: false,
  isOut: false,
  moreVIew: null,
  okAction: null,
  isInput: false,
  isLoading: false,
  closable: false,
  autoClose: false,
  overClickClose: true,
  // False while the open (zoomIn) animation is running; flipped true by the
  // Animatable onAnimationEnd. Glass surfaces inside the alert wait for this so
  // they don't materialize mid-zoom (broken glass). See Alert.js / SettleGate.
  alertSettled: false
}
export default class BaseAlert extends Component {
  constructor (props) {
    super(props)
    this.state = { ...INIT_STATE }
    this.viewAlertRef = createRef()
  }

  onCancelAction = () => {
    const { callback } = this.state
    if (this.viewAlertRef && this.viewAlertRef.current) {
      this.clearTimeOut()
      const self = this
      timeOutClose = setTimeout(() => {
        self.setState({ ...INIT_STATE }, () => {
          setTimeout(() => {
            callback && callback()
          }, 10)
        })
      }, 300)
      this.setState({ isOut: true })
      if (this.viewAlertRef && this.viewAlertRef.current) {
        this.viewAlertRef.current?.zoomOut(300)
      }
    }
  }

  onCancelActionConfirm = async () => {
    const { cancelAction } = this.state
    cancelAction && cancelAction()

    this.onCancelAction()
  }

  onChangeText = (txtValue) => {
    this.setState({ txtValue })
  }

  onDoneAction = async () => {
    this.setState({ isLoading: true })
    if (this.state.okAction) {
      this.state.okAction(this.state.isInput ? this.state.txtValue : '')
    }
    this.onCancelAction()
  }

  onOkAction = async () => {
    this.setState({ isLoading: true })
    if (this.state.okAction) {
      this.state.okAction()
    }
    this.onCancelAction()
  }

  alertWithType (message, title = '', options = {}) {
    // The `options = {}` default only covers `undefined` — some callers pass an
    // explicit `null` (e.g. redirectBackToDapp), which would make the destructure
    // below throw "Cannot read property 'type' of null". Normalize it first.
    options = options || {}
    const {
      type = false,
      callback = null,
      moreView = null,
      okAction = null,
      okTitle = null,
      moreViewMess = null,
      cancelAction = null,
      cancelTitle = '',
      isInput = false,
      timeout = 4000,
      autoClose = true
    } = options
    this.clearTimeOut()
    if (message && typeof message !== 'string') {
      message = message.toString()
    }
    if (title && typeof title !== 'string') {
      title = title.toString()
    }
    if (this.state.isOpen === false) {
      this.setState({ isLoading: false, okAction, type, message, title, isOpen: true, callback, moreView, okTitle, moreViewMess, cancelAction, cancelTitle, isInput, autoClose, ...options, alertSettled: false })
      // Safety net for the glass-settle signal: normally the card's zoomIn
      // onAnimationEnd flips alertSettled, but if that event doesn't fire (edge
      // cases in Animatable), promote after the 300ms zoom anyway so inner glass
      // never stays stuck on its flat fallback.
      const self = this
      timeOutSettle && clearTimeout(timeOutSettle)
      timeOutSettle = setTimeout(() => {
        if (!self.state.isOut && !self.state.alertSettled) self.setState({ alertSettled: true })
      }, 360)
    }

    if (autoClose) {
      if (type !== 'question' && type !== 'info') {
        const self = this
        timeOutAlet = setTimeout(() => {
          self.onCancelAction()
        }, timeout)
      }
    }
  }

  clearTimeOut = () => {
    timeOutAlet && clearTimeout(timeOutAlet)
    timeOutClose && clearTimeout(timeOutClose)
    timeOutSettle && clearTimeout(timeOutSettle)
  }
}
