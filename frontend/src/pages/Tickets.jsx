import { useTranslation } from 'react-i18next';

const Tickets = () => {
  const { t } = useTranslation();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('tickets.title')}</h1>
      <div className="bg-white shadow rounded-lg p-6">
        <p className="text-gray-600">
          Your downloaded tickets will appear here.
        </p>
      </div>
    </div>
  );
};

export default Tickets;
