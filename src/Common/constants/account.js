// Account types — how an account's keys are held on this device.
//   HOT       — private key generated or imported on-device (the default).
//               Shown with a flame badge ("hot wallet").
//   COLD      — key lives on an external NFC keycard; the device never holds
//               the raw key. Shown with a snowflake badge ("cold wallet").
//   VIEW_ONLY — watch-only: only an address was imported, no key at all.
//               Can read balances/activity but cannot sign.
export const ACCOUNT_TYPE = {
  HOT: 'hot',
  COLD: 'cold',
  VIEW_ONLY: 'viewOnly'
}

// Human-readable label per type (for UI display).
export const ACCOUNT_TYPE_LABEL = {
  [ACCOUNT_TYPE.HOT]: 'Hot',
  [ACCOUNT_TYPE.COLD]: 'Cold',
  [ACCOUNT_TYPE.VIEW_ONLY]: 'View only'
}
