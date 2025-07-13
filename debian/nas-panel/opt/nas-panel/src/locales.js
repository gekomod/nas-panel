import { createI18n } from 'vue-i18n'
import pl from '@/locales/pl'
import en from '@/locales/en'

export const i18n = createI18n({
  legacy: false,
  locale: 'pl', // domyślny język
  fallbackLocale: 'en',
  messages: {
     pl,
     en
  },
  datetimeFormats: {
    pl: {
      short: {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }
    },
    en: {
      short: {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }
    }
  },
  numberFormats: {
    pl: {
      currency: {
        style: 'currency',
        currency: 'PLN'
      }
    },
    en: {
      currency: {
        style: 'currency',
        currency: 'USD'
      }
    }
  }
})

// Opcjonalna funkcja do zmiany języka
export function setLocale(lang) {
  i18n.global.locale.value = lang
}
