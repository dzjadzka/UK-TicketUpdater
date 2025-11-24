import { useTranslation } from 'react-i18next';

const Admin = () => {
  const { t } = useTranslation();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('admin.title')}</h1>
      <div className="bg-white shadow rounded-lg p-6">
        <p className="text-gray-600">{t('admin.placeholder')}</p>
      </div>
    </div>
  );
};

export default Admin;
