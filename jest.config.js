module.exports = {
  preset: 'react-native',
  // `p-limit` (and its `yocto-queue` dependency) ship as pure ESM. Jest runs
  // CommonJS and does NOT transform node_modules by default, so importing
  // anything that reaches them dies with "Cannot use import statement outside a
  // module" — at LOAD time, which fails the whole suite rather than one test.
  //
  // That is not a cosmetic failure: three modules pull p-limit in (ViemWeb3,
  // TokenListV2/symbolOnchain, RegisterAddress), so every TokenListV2 suite was
  // silently not running — 63 tests that looked absent rather than red.
  //
  // `uuid` (v14) is pure ESM for the same reason and arrives by a different
  // route: importing anything from `keyring-agent-core` resolves to its NODE
  // build under Jest (`main`), not the `react-native` one the app itself gets,
  // and that build reaches uuid through LangGraph. So a module can import core
  // fine in the app and still fail only under test — which is what happened.
  //
  // The preset's own pattern is repeated here and EXTENDED, not replaced:
  // dropping `react-native` from the list breaks its own transform instead.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|p-limit|yocto-queue|uuid)/)'
  ]
}
