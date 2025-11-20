import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    common: {
      appTitle: 'UK Ticket Updater',
      language: 'Language',
      english: 'English',
      german: 'German',
      authOnly: 'Content is protected. Please sign in to continue.',
      logout: 'Log out'
    },
    forms: {
      heading: 'Accessible form',
      nameLabel: 'Full name',
      submit: 'Submit',
      validationError: 'Please provide your name',
      success: 'Form submitted successfully'
    },
    tables: {
      heading: 'Recent history',
      caption: 'Recent updates with keyboard and screen reader support',
      date: 'Date',
      action: 'Action',
      status: 'Status'
    }
  },
  de: {
    common: {
      appTitle: 'UK Ticket Aktualisierer',
      language: 'Sprache',
      english: 'Englisch',
      german: 'Deutsch',
      authOnly: 'Inhalt ist geschützt. Bitte anmelden, um fortzufahren.',
      logout: 'Abmelden'
    },
    forms: {
      heading: 'Barrierearmes Formular',
      nameLabel: 'Vollständiger Name',
      submit: 'Absenden',
      validationError: 'Bitte gib deinen Namen ein',
      success: 'Formular erfolgreich abgeschickt'
    },
    tables: {
      heading: 'Neueste Historie',
      caption: 'Letzte Aktualisierungen mit Tastatur- und Screenreader-Unterstützung',
      date: 'Datum',
      action: 'Aktion',
      status: 'Status'
    }
  }
};

const defaultLng = import.meta.env.VITE_DEFAULT_LOCALE || 'en';

void i18n.use(initReactI18next).init({
  lng: defaultLng,
  fallbackLng: 'en',
  supportedLngs: ['en', 'de'],
  ns: ['common', 'forms', 'tables'],
  defaultNS: 'common',
  interpolation: {
    escapeValue: false
  },
  resources
});

export default i18n;
