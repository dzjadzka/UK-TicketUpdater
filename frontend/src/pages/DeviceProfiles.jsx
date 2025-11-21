import { useTranslation } from 'react-i18next';

const DeviceProfiles = () => {
  const { t } = useTranslation();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('devices.title')}</h1>
      <div className="bg-white shadow rounded-lg p-6">
        <p className="text-gray-600">{t('devices.placeholder')}</p>
        <p className="text-gray-500 mt-2 text-sm">{t('devices.presetsAvailable')}</p>
      </div>
    </div>
  );
};

export default DeviceProfiles;
