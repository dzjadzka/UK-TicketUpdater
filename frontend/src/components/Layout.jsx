import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  HomeIcon,
  KeyIcon,
  DevicePhoneMobileIcon,
  ClockIcon,
  TicketIcon,
  UserCircleIcon,
  Cog6ToothIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';

const Layout = ({ children }) => {
  const { t, i18n } = useTranslation();
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navigation = [
    { name: t('nav.dashboard'), href: '/', icon: HomeIcon },
    { name: t('nav.credentials'), href: '/credentials', icon: KeyIcon },
    { name: t('nav.devices'), href: '/devices', icon: DevicePhoneMobileIcon },
    { name: t('nav.history'), href: '/history', icon: ClockIcon },
    { name: t('nav.tickets'), href: '/tickets', icon: TicketIcon },
  ];

  if (isAdmin) {
    navigation.push({ name: t('nav.admin'), href: '/admin', icon: Cog6ToothIcon });
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('language', lng);
  };

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const languageLabels = {
    en: 'English',
    de: 'Deutsch',
    ru: 'Русский'
  };

  return (
    <div className="min-h-screen bg-base-200">
      {/* Navbar */}
      <div className="navbar bg-base-100 shadow-lg">
        <div className="navbar-start">
          <div className="dropdown">
            <div tabIndex={0} role="button" className="btn btn-ghost lg:hidden">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h8m-8 6h16" />
              </svg>
            </div>
            <ul tabIndex={0} className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52">
              {navigation.map((item) => (
                <li key={item.name}>
                  <Link to={item.href} className={isActive(item.href) ? 'active' : ''}>
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <Link to="/" className="btn btn-ghost text-xl">
            <TicketIcon className="h-6 w-6" />
            {t('app.title')}
          </Link>
        </div>
        
        <div className="navbar-center hidden lg:flex">
          <ul className="menu menu-horizontal px-1">
            {navigation.map((item) => (
              <li key={item.name}>
                <Link to={item.href} className={isActive(item.href) ? 'active' : ''}>
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        
        <div className="navbar-end gap-2">
          {/* Language Dropdown */}
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-circle">
              <GlobeAltIcon className="h-5 w-5" />
            </div>
            <ul tabIndex={0} className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-40">
              {['en', 'de', 'ru'].map((lng) => (
                <li key={lng}>
                  <button
                    onClick={() => changeLanguage(lng)}
                    className={i18n.language === lng ? 'active' : ''}
                  >
                    {languageLabels[lng]}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* User Dropdown */}
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-circle avatar">
              <div className="avatar placeholder">
                <div className="bg-neutral text-neutral-content rounded-full w-10">
                  <span className="text-sm">{user?.email?.charAt(0).toUpperCase()}</span>
                </div>
              </div>
            </div>
            <ul tabIndex={0} className="menu menu-sm dropdown-content mt-3 z-[1] p-2 shadow bg-base-100 rounded-box w-52">
              <li className="menu-title">
                <span>{user?.email}</span>
                <span className="badge badge-sm badge-primary">{user?.role}</span>
              </li>
              <li>
                <Link to="/profile">
                  <UserCircleIcon className="h-4 w-4" />
                  {t('nav.profile')}
                </Link>
              </li>
              <li>
                <button onClick={handleLogout} className="text-error">
                  {t('nav.logout')}
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto p-4 lg:p-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="footer footer-center p-10 bg-base-100 text-base-content mt-auto">
        <aside>
          <TicketIcon className="h-12 w-12 text-primary" />
          <p className="font-bold">
            {t('app.title')}
          </p>
          <p>{t('app.description')}</p>
          <p>Copyright © {new Date().getFullYear()} - All rights reserved</p>
        </aside>
        <nav>
          <div className="grid grid-flow-col gap-4">
            <a href="https://github.com/dzjadzka/UK-TicketUpdater" target="_blank" rel="noopener noreferrer" className="link link-hover">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" className="fill-current">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            </a>
          </div>
        </nav>
      </footer>
    </div>
  );
};

export default Layout;
