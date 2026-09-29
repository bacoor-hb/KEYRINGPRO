/**
 * Make TextDecoder behave per spec on Hermes.
 *
 * `@walletconnect/react-native-compat` polyfills TextDecoder with
 * `fast-text-encoding`, which is incomplete in two ways that matter here:
 *   1. it throws ("the 'fatal' option is unsupported") on any constructor option
 *      instead of ignoring it;
 *   2. `decode()` with no argument dereferences `undefined` ("Cannot read property
 *      'buffer' of undefined") instead of returning ''.
 *
 * Since @walletconnect/pay 1.0.9 the wasm-bindgen glue hits both at module scope:
 *
 *   let A = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true }); A.decode();
 *
 * and @reown/walletkit requires that module on the first line of its entry — so
 * importing WalletKit crashes the app before any of our code runs.
 *
 * Dropping the options means lenient UTF-8 decoding instead of throwing on malformed
 * bytes. The glue only decodes its own well-formed output, so the behaviour matches.
 *
 * Import order matters: this must run AFTER '@walletconnect/react-native-compat'
 * (which defines the globals) and BEFORE '@reown/walletkit'.
 */
const BaseTextDecoder = global.TextDecoder

if (BaseTextDecoder) {
  let isSpecCompliant = false

  try {
    // Both defects in one probe: options accepted, and a bare decode() returns ''.
    isSpecCompliant = new BaseTextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode() === ''
  } catch (e) {
    isSpecCompliant = false
  }

  // Leave a spec-compliant implementation alone — this turns into a no-op once
  // Hermes (or an Expo-style runtime) provides a real TextDecoder.
  if (!isSpecCompliant) {
    const EMPTY_INPUT = new Uint8Array(0)

    global.TextDecoder = class extends BaseTextDecoder {
      // The options are swallowed on purpose — that is the whole point.
      constructor (encoding, options) {
        super(encoding)
      }

      decode (input, options) {
        return super.decode(input === undefined || input === null ? EMPTY_INPUT : input)
      }
    }
  }
}
