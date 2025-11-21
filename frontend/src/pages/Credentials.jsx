import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { credentialsAPI } from '../services/api';

const Credentials = () => {
  const { t } = useTranslation();
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    loginName: '',
    loginPassword: '',
    label: ''
  });
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCredentials();
  }, []);

  const fetchCredentials = async () => {
    try {
      const response = await credentialsAPI.getAll();
      setCredentials(response.data.credentials);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (editingId) {
        await credentialsAPI.update(editingId, formData);
      } else {
        await credentialsAPI.create(
          formData.loginName,
          formData.loginPassword,
          formData.label
        );
      }
      
      setFormData({ loginName: '', loginPassword: '', label: '' });
      setShowForm(false);
      setEditingId(null);
      fetchCredentials();
    } catch (err) {
      setError(err.response?.data?.error || 'Operation failed');
    }
  };

  const handleEdit = (credential) => {
    setFormData({
      loginName: credential.login_name,
      loginPassword: '',
      label: credential.label || ''
    });
    setEditingId(credential.id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm(t('credentials.deleteConfirm'))) {
      try {
        await credentialsAPI.delete(id);
        fetchCredentials();
      } catch (err) {
        setError(err.response?.data?.error || 'Delete failed');
      }
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ loginName: '', loginPassword: '', label: '' });
    setError('');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('credentials.title')}</h1>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
            {t('credentials.add')}
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      {showForm && (
        <div className="mb-6 bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            {editingId ? t('credentials.edit') : t('credentials.add')}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="loginName" className="block text-sm font-medium text-gray-700">
                {t('credentials.loginName')}
              </label>
              <input
                type="text"
                id="loginName"
                value={formData.loginName}
                onChange={(e) => setFormData({ ...formData, loginName: e.target.value })}
                required
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="loginPassword" className="block text-sm font-medium text-gray-700">
                {t('credentials.loginPassword')}
              </label>
              <input
                type="password"
                id="loginPassword"
                value={formData.loginPassword}
                onChange={(e) => setFormData({ ...formData, loginPassword: e.target.value })}
                required={!editingId}
                placeholder={editingId ? 'Leave blank to keep current password' : ''}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="label" className="block text-sm font-medium text-gray-700">
                {t('credentials.label')}
              </label>
              <input
                type="text"
                id="label"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {t('common.save')}
              </button>
            </div>
          </form>
        </div>
      )}

      {credentials.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500">{t('credentials.noCredentials')}</p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden rounded-lg">
          <ul className="divide-y divide-gray-200">
            {credentials.map((credential) => (
              <li key={credential.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {credential.label || credential.login_name}
                    </p>
                    <p className="text-sm text-gray-500">{credential.login_name}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {t('credentials.created')}: {new Date(credential.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(credential)}
                      className="p-2 text-blue-600 hover:text-blue-900"
                      title={t('common.edit')}
                    >
                      <PencilIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(credential.id)}
                      className="p-2 text-red-600 hover:text-red-900"
                      title={t('common.delete')}
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default Credentials;
