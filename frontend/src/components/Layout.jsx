import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Bars3Icon, TicketIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const Layout = () => {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', to: '/dashboard' },
    { name: 'Settings', to: '/settings' }
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <TicketIcon className="h-6 w-6 text-indigo-600" />
            <Link to="/dashboard" className="text-lg font-semibold text-slate-900">
              UK Ticket Center
            </Link>
          </div>

          <button
            aria-label="Toggle navigation"
            className="rounded-md p-2 text-slate-600 hover:bg-slate-100 sm:hidden"
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            <Bars3Icon className="h-6 w-6" />
          </button>

          <nav className="hidden items-center gap-6 sm:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `text-sm font-medium ${isActive ? 'text-indigo-600' : 'text-slate-600 hover:text-slate-900'}`
                }
              >
                {item.name}
              </NavLink>
            ))}
            <div className="h-6 w-px bg-slate-200" aria-hidden />
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-indigo-700">
                {user?.email?.[0]?.toUpperCase()}
              </span>
              <span>{user?.email}</span>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Log out
            </button>
          </nav>
        </div>

        {menuOpen && (
          <div className="border-t bg-white sm:hidden">
            <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2 text-sm font-medium ${
                      isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
                    }`
                  }
                >
                  {item.name}
                </NavLink>
              ))}
              <button
                onClick={handleLogout}
                className="rounded-lg px-3 py-2 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50"
              >
                Log out
              </button>
            </nav>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
