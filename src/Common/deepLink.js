// Cold-start / locked deep-link gate.
//
// On a cold start the OS delivers the launch URL (Linking.getInitialURL) right
// after BootSplash hides — while the UnlockScreen is still the root and the vault
// is locked. Acting on that link immediately would push the target screen (WC
// connect, sign request, export-key, …) ON TOP of the unlock screen, bypassing
// the password gate. The same applies to a warm deep link that arrives while the
// app is auto-locked.
//
// So App.navigate stashes the URL here whenever the vault is locked, and the
// UnlockScreen replays it via flushPendingDeepLink() once the user has unlocked.

let pendingUrl = null
let handler = null

// App registers its deep-link processor (App.navigate) so the stashed link can be
// replayed from elsewhere (UnlockScreen) without a circular import.
export const setDeepLinkHandler = (fn) => { handler = fn }

export const stashPendingDeepLink = (url) => { pendingUrl = url }

export const consumePendingDeepLink = () => {
  const url = pendingUrl
  pendingUrl = null
  return url
}

// Replay the stashed deep link (if any) through the registered handler.
export const flushPendingDeepLink = () => {
  const url = consumePendingDeepLink()
  if (url && handler) handler({ url })
}
