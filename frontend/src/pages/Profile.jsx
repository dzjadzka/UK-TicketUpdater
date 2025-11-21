import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';

const Profile = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('profile.title')}</h1>
      <div className="bg-white shadow rounded-lg p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('profile.email')}</label>
            <p className="mt-1 text-sm text-gray-900">{user?.email}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('profile.role')}</label>
            <p className="mt-1 text-sm text-gray-900 capitalize">{user?.role}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">{t('profile.language')}</label>
            <p className="mt-1 text-sm text-gray-900">{user?.locale}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
