import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  KeyIcon,
  DevicePhoneMobileIcon,
  ClockIcon,
  TicketIcon,
  ArrowDownTrayIcon,
  SparklesIcon,
  ArrowRightIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';

const Dashboard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const cards = [
    {
      title: t('nav.credentials'),
      description: t('credentials.description'),
      icon: KeyIcon,
      link: '/credentials',
      gradient: 'from-blue-500 to-blue-600',
      bgGradient: 'from-blue-50 to-blue-100'
    },
    {
      title: t('nav.devices'),
      description: t('devices.description'),
      icon: DevicePhoneMobileIcon,
      link: '/devices',
      gradient: 'from-green-500 to-emerald-600',
      bgGradient: 'from-green-50 to-emerald-100'
    },
    {
      title: t('downloads.title'),
      description: t('downloads.description'),
      icon: ArrowDownTrayIcon,
      link: '/downloads',
      gradient: 'from-purple-500 to-purple-600',
      bgGradient: 'from-purple-50 to-purple-100'
    },
    {
      title: t('nav.history'),
      description: t('history.description'),
      icon: ClockIcon,
      link: '/history',
      gradient: 'from-amber-500 to-orange-600',
      bgGradient: 'from-amber-50 to-orange-100'
    },
    {
      title: t('nav.tickets'),
      description: t('tickets.description'),
      icon: TicketIcon,
      link: '/tickets',
      gradient: 'from-red-500 to-pink-600',
      bgGradient: 'from-red-50 to-pink-100'
    }
  ];

  const quickSteps = [
    { step: 1, text: 'Add your ticket site credentials', link: '/credentials' },
    { step: 2, text: 'Configure device profiles', link: '/devices' },
    { step: 3, text: 'View downloaded tickets', link: '/tickets' }
  ];

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 p-8 md:p-12">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 -mt-4 -mr-4 h-32 w-32 rounded-full bg-white/10 blur-2xl"></div>
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 h-40 w-40 rounded-full bg-white/10 blur-2xl"></div>
        
        <div className="relative z-10">
          <div className="flex items-center space-x-2 mb-4">
            <SparklesIcon className="h-6 w-6 text-white" />
            <span className="text-white/90 text-sm font-medium">Welcome Back</span>
          </div>
          
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
            Hello, {user?.email?.split('@')[0] || 'User'}!
          </h1>
          
          <p className="text-lg text-white/90 mb-8 max-w-2xl">
            Manage your NVV semester tickets effortlessly. Automate downloads, track history, and configure device profiles—all in one place.
          </p>
          
          <div className="flex flex-wrap gap-4">
            <Link
              to="/downloads"
              className="inline-flex items-center px-6 py-3 bg-white text-blue-600 font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
            >
              <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
              Start Download
              <ArrowRightIcon className="h-4 w-4 ml-2" />
            </Link>
            <Link
              to="/history"
              className="inline-flex items-center px-6 py-3 bg-white/10 backdrop-blur-sm text-white font-semibold rounded-lg border-2 border-white/30 hover:bg-white/20 transition-all duration-200"
            >
              <ClockIcon className="h-5 w-5 mr-2" />
              View History
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Start Guide */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Quick Start Guide</h2>
            <p className="text-sm text-gray-600 mt-1">Get up and running in 3 simple steps</p>
          </div>
          <div className="hidden sm:block">
            <div className="inline-flex items-center px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 text-sm font-medium">
              <CheckCircleIcon className="h-4 w-4 mr-1.5" />
              Easy Setup
            </div>
          </div>
        </div>
        
        <div className="grid gap-4 md:grid-cols-3">
          {quickSteps.map((item) => (
            <Link
              key={item.step}
              to={item.link}
              className="group flex items-start space-x-4 p-4 rounded-xl border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all duration-200"
            >
              <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold text-sm">
                {item.step}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 group-hover:text-blue-600">
                  {item.text}
                </p>
              </div>
              <ArrowRightIcon className="h-5 w-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all duration-200" />
            </Link>
          ))}
        </div>
      </div>

      {/* Feature Cards */}
      <div>
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Features & Tools</h2>
          <p className="text-gray-600 mt-1">Explore all available features</p>
        </div>
        
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.title}
              to={card.link}
              className="card-interactive group p-6"
            >
              <div className={`inline-flex items-center justify-center h-14 w-14 rounded-xl bg-gradient-to-br ${card.bgGradient} mb-5`}>
                <div className={`inline-flex items-center justify-center h-10 w-10 rounded-lg bg-gradient-to-r ${card.gradient} text-white shadow-lg`}>
                  <card.icon className="h-6 w-6" />
                </div>
              </div>
              
              <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors duration-200 mb-2">
                {card.title}
              </h3>
              
              <p className="text-sm text-gray-600 leading-relaxed mb-4">
                {card.description}
              </p>
              
              <div className="flex items-center text-sm font-medium text-blue-600 group-hover:text-blue-700">
                Learn more
                <ArrowRightIcon className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform duration-200" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Help Banner */}
      <div className="card p-6 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <div className="flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              Need Help Getting Started?
            </h3>
            <p className="text-sm text-gray-700 mb-3">
              Check out our documentation on GitHub or reach out to the community for support.
            </p>
            <a
              href="https://github.com/dzjadzka/UK-TicketUpdater"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              View Documentation
              <ArrowRightIcon className="h-4 w-4 ml-1" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
