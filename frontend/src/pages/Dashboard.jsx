import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  KeyIcon,
  DevicePhoneMobileIcon,
  ClockIcon,
  TicketIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

const Dashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const cards = [
    {
      title: t('nav.credentials'),
      description: 'Manage your ticket site login credentials',
      icon: KeyIcon,
      link: '/credentials',
      color: 'bg-blue-500'
    },
    {
      title: t('nav.devices'),
      description: 'Configure device profiles for downloads',
      icon: DevicePhoneMobileIcon,
      link: '/devices',
      color: 'bg-green-500'
    },
    {
      title: t('downloads.title'),
      description: 'Download your semester tickets',
      icon: ArrowDownTrayIcon,
      link: '/downloads',
      color: 'bg-purple-500'
    },
    {
      title: t('nav.history'),
      description: 'View download history and results',
      icon: ClockIcon,
      link: '/history',
      color: 'bg-yellow-500'
    },
    {
      title: t('nav.tickets'),
      description: 'Access your downloaded tickets',
      icon: TicketIcon,
      link: '/tickets',
      color: 'bg-red-500'
    }
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          {t('nav.dashboard')}
        </h1>
        <p className="mt-2 text-gray-600">
          Welcome back, {user?.email}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.title}
            to={card.link}
            className="relative group bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 border border-gray-200"
          >
            <div>
              <span className={`inline-flex rounded-lg p-3 ${card.color} text-white`}>
                <card.icon className="h-6 w-6" aria-hidden="true" />
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-lg font-medium text-gray-900 group-hover:text-blue-600">
                {card.title}
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                {card.description}
              </p>
            </div>
            <span
              className="pointer-events-none absolute top-6 right-6 text-gray-300 group-hover:text-gray-400"
              aria-hidden="true"
            >
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20 4h1a1 1 0 00-1-1v1zm-1 12a1 1 0 102 0h-2zM8 3a1 1 0 000 2V3zM3.293 19.293a1 1 0 101.414 1.414l-1.414-1.414zM19 4v12h2V4h-2zm1-1H8v2h12V3zm-.707.293l-16 16 1.414 1.414 16-16-1.414-1.414z" />
              </svg>
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-8 bg-blue-50 border-l-4 border-blue-400 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              <strong>Getting Started:</strong> Add your credentials first, then configure device profiles, and finally trigger a download.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
