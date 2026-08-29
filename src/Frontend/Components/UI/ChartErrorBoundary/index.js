import React from 'react'

/**
 * Contains a render crash inside a chart so it cannot take the screen with it.
 *
 * Charts are the one part of a detail screen driven entirely by async, third-party
 * data: the series arrives from an API, is reshaped by d3, and is handed to
 * react-native-svg-charts, which clones its own props (d3 scale FUNCTIONS, the
 * raw data array) onto every child before react-native-svg parses them. A single
 * unexpected value anywhere in that chain throws during render, and an uncaught
 * render throw unmounts the whole tree — the user taps a token and the screen
 * dies, losing balance, price and every action on it.
 *
 * A chart is decoration on a screen whose real job is showing a balance. Trading
 * it for a one-line message is always the right trade, so this boundary renders
 * `fallback` and lets the rest of the screen stand.
 *
 * Deliberately NOT a general-purpose boundary: it is scoped to one subtree whose
 * failure is genuinely non-critical. Wrapping something load-bearing this way
 * would hide a real bug behind a shrug.
 */
class ChartErrorBoundary extends React.Component {
  static getDerivedStateFromError () {
    return { hasError: true }
  }

  constructor (props) {
    super(props)
    this.state = { hasError: false }
  }

  /**
   * A new series is a fresh attempt: without this, one bad payload would leave
   * the boundary tripped for as long as the screen stays mounted, so a later
   * good refresh could never draw.
   */
  componentDidUpdate (prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false })
    }
  }

  componentDidCatch (error, info) {
    // Dev-only and deliberately loud: the fallback makes a crash look like
    // ordinary "no data", so without this a real bug would render as a shrug and
    // never be noticed. Stripped from release by transform-remove-console.
    if (__DEV__) {
      console.log('[ChartErrorBoundary] chart render failed', {
        message: error?.message,
        stack: error?.stack,
        componentStack: info?.componentStack
      })
    }
  }

  render () {
    if (this.state.hasError) return this.props.fallback ?? null
    return this.props.children
  }
}

export default ChartErrorBoundary
