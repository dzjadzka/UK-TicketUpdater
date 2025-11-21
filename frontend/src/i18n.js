import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Translation files
import enTranslation from './locales/en.json';
import deTranslation from './locales/de.json';
import ruTranslation from './locales/ru.json';

const resources = {
  en: { translation: enTranslation },
  de: { translation: deTranslation },
  ru: { translation: ruTranslation }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: localStorage.getItem('language') || 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
