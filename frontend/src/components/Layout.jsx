import { Fragment } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, Transition } from '@headlessui/react';
import {
  Bars3Icon,
  XMarkIcon,
  HomeIcon,
  KeyIcon,
  DevicePhoneMobileIcon,
  ClockIcon,
  TicketIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  Cog6ToothIcon,
  GlobeAltIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';
import { useState } from 'react';

const Layout = ({ children }) => {
  const { t, i18n } = useTranslation();
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Top Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 backdrop-blur-sm bg-white/95">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 justify-between">
            <div className="flex">
              {/* Logo */}
              <div className="flex flex-shrink-0 items-center">
                <div className="flex items-center space-x-2">
                  <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-2 rounded-lg">
                    <TicketIcon className="h-6 w-6 text-white" />
                  </div>
                  <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    {t('app.title')}
                  </span>
                </div>
              </div>
              
              {/* Desktop Navigation */}
              <div className="hidden sm:ml-8 sm:flex sm:space-x-1">
                {navigation.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`inline-flex items-center px-3 py-1 my-auto rounded-lg text-sm font-medium transition-all duration-200 ${
                        active
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      <item.icon className={`mr-2 h-5 w-5 ${active ? 'text-blue-600' : 'text-gray-500'}`} />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:items-center space-x-3">
              {/* Language Switcher */}
              <Menu as="div" className="relative">
                <Menu.Button className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors duration-200">
                  <GlobeAltIcon className="h-5 w-5" />
                  <span>{languageLabels[i18n.language]}</span>
                  <ChevronDownIcon className="h-4 w-4" />
                </Menu.Button>
                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-100"
                  enterFrom="transform opacity-0 scale-95"
                  enterTo="transform opacity-100 scale-100"
                  leave="transition ease-in duration-75"
                  leaveFrom="transform opacity-100 scale-100"
                  leaveTo="transform opacity-0 scale-95"
                >
                  <Menu.Items className="absolute right-0 z-10 mt-2 w-40 origin-top-right rounded-xl bg-white py-1 shadow-lg ring-1 ring-gray-200 focus:outline-none">
                    {['en', 'de', 'ru'].map((lng) => (
                      <Menu.Item key={lng}>
                        {({ active }) => (
                          <button
                            onClick={() => changeLanguage(lng)}
                            className={`${
                              active ? 'bg-blue-50' : ''
                            } ${
                              i18n.language === lng ? 'text-blue-600 font-semibold' : 'text-gray-700'
                            } flex items-center w-full px-4 py-2 text-sm transition-colors duration-150`}
                          >
                            {i18n.language === lng && (
                              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                            <span className={i18n.language !== lng ? 'ml-6' : ''}>
                              {languageLabels[lng]}
                            </span>
                          </button>
                        )}
                      </Menu.Item>
                    ))}
                  </Menu.Items>
                </Transition>
              </Menu>

              {/* User Menu */}
              <Menu as="div" className="relative">
                <Menu.Button className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors duration-200">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold text-sm">
                    {user?.email?.charAt(0).toUpperCase()}
                  </div>
                  <ChevronDownIcon className="h-4 w-4" />
                </Menu.Button>
                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-100"
                  enterFrom="transform opacity-0 scale-95"
                  enterTo="transform opacity-100 scale-100"
                  leave="transition ease-in duration-75"
                  leaveFrom="transform opacity-100 scale-100"
                  leaveTo="transform opacity-0 scale-95"
                >
                  <Menu.Items className="absolute right-0 z-10 mt-2 w-64 origin-top-right rounded-xl bg-white py-1 shadow-lg ring-1 ring-gray-200 focus:outline-none">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-900 truncate">{user?.email}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                          {user?.role}
                        </span>
                      </p>
                    </div>
                    <div className="py-1">
                      <Menu.Item>
                        {({ active }) => (
                          <Link
                            to="/profile"
                            className={`${
                              active ? 'bg-blue-50' : ''
                            } flex items-center px-4 py-2 text-sm text-gray-700 transition-colors duration-150`}
                          >
                            <UserCircleIcon className="h-5 w-5 mr-3 text-gray-400" />
                            {t('nav.profile')}
                          </Link>
                        )}
                      </Menu.Item>
                    </div>
                    <div className="border-t border-gray-100 py-1">
                      <Menu.Item>
                        {({ active }) => (
                          <button
                            onClick={handleLogout}
                            className={`${
                              active ? 'bg-red-50 text-red-700' : 'text-gray-700'
                            } flex items-center w-full px-4 py-2 text-sm transition-colors duration-150`}
                          >
                            <ArrowRightOnRectangleIcon className="h-5 w-5 mr-3" />
                            {t('nav.logout')}
                          </button>
                        )}
                      </Menu.Item>
                    </div>
                  </Menu.Items>
                </Transition>
              </Menu>
            </div>
            <div className="-mr-2 flex items-center sm:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="inline-flex items-center justify-center rounded-lg p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors duration-200"
              >
                {mobileMenuOpen ? (
                  <XMarkIcon className="block h-6 w-6" />
                ) : (
                  <Bars3Icon className="block h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <Transition
          show={mobileMenuOpen}
          enter="transition ease-out duration-200"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-150"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
        >
          <div className="sm:hidden border-t border-gray-200 bg-white">
            <div className="space-y-1 px-3 py-3">
              {navigation.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center px-3 py-2 rounded-lg text-base font-medium transition-colors duration-200 ${
                      active
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <item.icon className={`h-5 w-5 mr-3 ${active ? 'text-blue-600' : 'text-gray-500'}`} />
                    {item.name}
                  </Link>
                );
              })}
            </div>
            
            <div className="border-t border-gray-200 px-3 py-4">
              <div className="flex items-center px-3 mb-3">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold">
                  {user?.email?.charAt(0).toUpperCase()}
                </div>
                <div className="ml-3 flex-1 min-w-0">
                  <div className="text-base font-semibold text-gray-900 truncate">{user?.email}</div>
                  <div className="text-sm text-gray-500">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {user?.role}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-1">
                <Link
                  to="/profile"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors duration-200"
                >
                  <UserCircleIcon className="h-5 w-5 mr-3 text-gray-500" />
                  {t('nav.profile')}
                </Link>
                <button
                  onClick={() => {
                    handleLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center w-full px-3 py-2 text-base font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                >
                  <ArrowRightOnRectangleIcon className="h-5 w-5 mr-3" />
                  {t('nav.logout')}
                </button>
              </div>
            </div>
            
            {/* Language selector in mobile */}
            <div className="border-t border-gray-200 px-3 py-3">
              <div className="flex items-center justify-between px-3 mb-2">
                <span className="text-sm font-medium text-gray-700 flex items-center">
                  <GlobeAltIcon className="h-5 w-5 mr-2" />
                  Language
                </span>
              </div>
              <div className="space-y-1">
                {['en', 'de', 'ru'].map((lng) => (
                  <button
                    key={lng}
                    onClick={() => {
                      changeLanguage(lng);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex items-center w-full px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                      i18n.language === lng
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {i18n.language === lng && (
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                    <span className={i18n.language !== lng ? 'ml-6' : ''}>
                      {languageLabels[lng]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Transition>
      </nav>

      {/* Main Content */}
      <main className="flex-1 py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <div className="flex items-center space-x-2">
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-1.5 rounded-lg">
                  <TicketIcon className="h-4 w-4 text-white" />
                </div>
                <span className="font-semibold text-gray-900">{t('app.title')}</span>
              </div>
              <span className="text-gray-400">·</span>
              <span>{new Date().getFullYear()}</span>
            </div>
            
            <div className="flex items-center space-x-6 text-sm">
              <a
                href="https://github.com/dzjadzka/UK-TicketUpdater"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 hover:text-blue-600 transition-colors duration-200 flex items-center space-x-1"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                <span>GitHub</span>
              </a>
              <span className="text-gray-300">|</span>
              <span className="text-gray-600">
                {t('app.description')}
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
