import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Bars3Icon, TicketIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const Layout = () => {
  const { user, logout, isAdmin } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', to: '/dashboard' },
    { name: 'Tickets', to: '/tickets' },
    { name: 'Devices', to: '/device-profiles' },
    { name: 'Settings', to: '/settings' }
  ];

  if (isAdmin) {
    navItems.push({ name: 'Admin', to: '/admin/overview' });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <TicketIcon className="h-7 w-7 text-primary" />
            <Link to="/dashboard" className="text-xl font-bold text-foreground">
              UK Ticket Center
            </Link>
          </div>

          <button
            aria-label="Toggle navigation"
            className="rounded-md p-2 text-muted-foreground hover:bg-accent sm:hidden"
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
                  `text-sm font-medium transition-colors ${
                    isActive 
                      ? 'text-primary' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`
                }
              >
                {item.name}
              </NavLink>
            ))}
            <div className="h-6 w-px bg-border" aria-hidden />
            <div className="flex items-center gap-3 text-sm font-medium text-foreground">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary ring-2 ring-primary/20">
                {user?.email?.[0]?.toUpperCase()}
              </span>
              <span className="max-w-[150px] truncate">{user?.email}</span>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent transition-colors"
            >
              Log out
            </button>
          </nav>
        </div>

        {menuOpen && (
          <div className="border-t bg-card sm:hidden">
            <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      isActive 
                        ? 'bg-primary/10 text-primary' 
                        : 'text-foreground hover:bg-accent'
                    }`
                  }
                >
                  {item.name}
                </NavLink>
              ))}
              <button
                onClick={handleLogout}
                className="rounded-md px-3 py-2 text-left text-sm font-semibold text-destructive hover:bg-destructive/10 transition-colors"
              >
                Log out
              </button>
            </nav>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
