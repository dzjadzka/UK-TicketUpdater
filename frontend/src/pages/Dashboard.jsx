import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  KeyIcon,
  DevicePhoneMobileIcon,
  ClockIcon,
  TicketIcon,
  ArrowDownTrayIcon,
  SparklesIcon
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
      color: 'bg-primary'
    },
    {
      title: t('nav.devices'),
      description: t('devices.description'),
      icon: DevicePhoneMobileIcon,
      link: '/devices',
      color: 'bg-success'
    },
    {
      title: t('downloads.title'),
      description: t('downloads.description'),
      icon: ArrowDownTrayIcon,
      link: '/downloads',
      color: 'bg-secondary'
    },
    {
      title: t('nav.history'),
      description: t('history.description'),
      icon: ClockIcon,
      link: '/history',
      color: 'bg-warning'
    },
    {
      title: t('nav.tickets'),
      description: t('tickets.description'),
      icon: TicketIcon,
      link: '/tickets',
      color: 'bg-accent'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="hero bg-gradient-to-r from-primary to-secondary rounded-box text-primary-content">
        <div className="hero-content text-center py-12">
          <div className="max-w-md">
            <div className="flex justify-center mb-4">
              <SparklesIcon className="h-12 w-12" />
            </div>
            <h1 className="text-4xl font-bold">
              Hello, {user?.email?.split('@')[0] || 'User'}!
            </h1>
            <p className="py-6 text-lg">
              {t('app.description')}
            </p>
            <div className="flex gap-4 justify-center">
              <Link to="/downloads" className="btn btn-neutral">
                <ArrowDownTrayIcon className="h-5 w-5" />
                Start Download
              </Link>
              <Link to="/history" className="btn btn-ghost btn-outline">
                <ClockIcon className="h-5 w-5" />
                View History
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Start Steps */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title">Quick Start Guide</h2>
          <p className="text-base-content/70">Get up and running in 3 simple steps</p>
          <div className="steps steps-vertical lg:steps-horizontal mt-4">
            <Link to="/credentials" className="step step-primary">Add Credentials</Link>
            <Link to="/devices" className="step step-primary">Configure Devices</Link>
            <Link to="/tickets" className="step">View Tickets</Link>
          </div>
        </div>
      </div>

      {/* Feature Cards */}
      <div>
        <h2 className="text-2xl font-bold mb-6">Features & Tools</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.title}
              to={card.link}
              className="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="card-body">
                <div className={`avatar placeholder mb-4`}>
                  <div className={`${card.color} text-white rounded-full w-16`}>
                    <card.icon className="h-8 w-8" />
                  </div>
                </div>
                <h2 className="card-title">{card.title}</h2>
                <p className="text-base-content/70">{card.description}</p>
                <div className="card-actions justify-end mt-4">
                  <button className="btn btn-primary btn-sm">Learn More</button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Help Alert */}
      <div className="alert alert-info">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-current shrink-0 w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div>
          <h3 className="font-bold">Need Help Getting Started?</h3>
          <div className="text-sm">Check out our documentation on GitHub for guides and support.</div>
        </div>
        <button className="btn btn-sm">
          <a href="https://github.com/dzjadzka/UK-TicketUpdater" target="_blank" rel="noopener noreferrer">
            View Docs
          </a>
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
