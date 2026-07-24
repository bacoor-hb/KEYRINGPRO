// Trans Component
import I18n from 'react-native-i18n'
import { getLocales } from 'react-native-localize'
import en from './TranslationsEN'
import cn from './TranslationsCN'
import cn2 from './TranslationsCN2'
import de from './TranslationsDE'
import es from './TranslationsES'
import fr from './TranslationsFR'
import it from './TranslationsIT'
import jp from './TranslationsJP'
import kr from './TranslationsKR'
import nl from './TranslationsNL'
import pl from './TranslationsPL'
import pt from './TranslationsPT'
import ru from './TranslationsRU'
import th from './TranslationsTH'
import tr from './TranslationsTR'
import vn from './TranslationsVN'
I18n.fallbacks = true
I18n.translations = { en, cn, jp, cn2, de, es, fr, it, kr, nl, pl, pt, ru, th, tr, vn }

// Map ISO language codes (used by the chat agent) to this app's locale keys.
// Unknown codes fall through to I18n.fallbacks (English).
const ISO_TO_APP_LOCALE = {
  vi: 'vn',
  ja: 'jp',
  ko: 'kr',
  zh: 'cn',
  'zh-CN': 'cn',
  'zh-TW': 'cn2',
  'zh-HK': 'cn2'
}

// Default app locale when nothing else resolves.
export const DEFAULT_LOCALE = 'en'

// Resolve the device's preferred language into one of this app's locale keys.
// Used ONLY for a fresh install (no stored language yet) — an upgrade keeps the
// user's previously saved language. `react-native-localize` returns the device's
// preferred locales, most-preferred first, each split into language/script/region
// so we can honor Traditional vs. Simplified Chinese.
export const resolveDeviceLocale = () => {
  try {
    const locales = getLocales() || []
    for (const locale of locales) {
      const language = (locale.languageCode || '').toLowerCase()
      const script = (locale.scriptCode || '').toLowerCase()
      const region = (locale.countryCode || '').toUpperCase()

      // Chinese: pick Traditional (cn2) vs. Simplified (cn) by script/region.
      if (language === 'zh') {
        const isTraditional =
          script === 'hant' || region === 'TW' || region === 'HK' || region === 'MO'
        return isTraditional ? 'cn2' : 'cn'
      }

      // Exact app locale key (e.g. 'en', 'de', 'fr') or an ISO alias ('vi'→'vn').
      if (I18n.translations[language]) return language
      if (ISO_TO_APP_LOCALE[language]) return ISO_TO_APP_LOCALE[language]
    }
  } catch (e) {
    // Fall through to the default on any native/localize error.
  }
  return DEFAULT_LOCALE
}

export const resolveLocale = (code) => {
  if (!code) return I18n.locale
  if (I18n.translations[code]) return code
  return ISO_TO_APP_LOCALE[code] || I18n.locale
}

// Reverse of ISO_TO_APP_LOCALE: this app's locale keys → BCP-47 codes the chat
// agent expects (e.g. the nfc-info storefront link). Most keys already are valid
// BCP-47 (en/de/es/fr/it/nl/pl/pt/ru/th/tr); only the few that differ are mapped.
const APP_LOCALE_TO_ISO = {
  vn: 'vi',
  jp: 'ja',
  kr: 'ko',
  cn: 'zh-CN',
  cn2: 'zh-TW'
}

// Current app language as a BCP-47 tag for the agent. `I18n.locale` may carry a
// region suffix (e.g. "vn-US"), so match on the base key.
export const currentLanguageBcp47 = () => {
  const base = (I18n.locale || 'en').split('-')[0]
  return APP_LOCALE_TO_ISO[base] || base
}

export default I18n
