import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher = () => {
  const { i18n, t } = useTranslation('common');
  const { language } = i18n;

  const handleChange = (lng) => {
    if (lng !== language) {
      i18n.changeLanguage(lng);
      localStorage.setItem('locale', lng);
    }
  };

  React.useEffect(() => {
    const stored = localStorage.getItem('locale');
    if (stored && stored !== language) {
      i18n.changeLanguage(stored);
    }
  }, [i18n, language]);

  return (
    <div aria-label={t('language')} role="group" className="language-switcher">
      <button
        type="button"
        onClick={() => handleChange('en')}
        aria-pressed={language === 'en'}
      >
        {t('english')}
      </button>
      <button
        type="button"
        onClick={() => handleChange('de')}
        aria-pressed={language === 'de'}
      >
        {t('german')}
      </button>
    </div>
  );
};

export default LanguageSwitcher;
