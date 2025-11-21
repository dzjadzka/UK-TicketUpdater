import { useTranslation } from 'react-i18next';

const DeviceProfiles = () => {
  const { t } = useTranslation();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('devices.title')}</h1>
      <div className="bg-white shadow rounded-lg p-6">
        <p className="text-gray-600">
          Device profiles management interface will be implemented here.
        </p>
        <p className="text-gray-500 mt-2 text-sm">
          Available presets: desktop_chrome, mobile_android, iphone_13, tablet_ipad
        </p>
      </div>
    </div>
  );
};

export default DeviceProfiles;
