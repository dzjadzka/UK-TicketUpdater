import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ShieldCheckIcon, UsersIcon, ChartBarIcon } from '@heroicons/react/24/outline';

const AdminLayout = () => {
  const location = useLocation();

  const tabs = [
    { to: '/admin/overview', label: 'Overview', icon: ChartBarIcon },
    { to: '/admin/users', label: 'Users', icon: UsersIcon },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm text-base-content/70">Admin tools for monitoring and maintenance</p>
          <h1 className="text-3xl font-bold text-base-content flex items-center gap-2">
            <ShieldCheckIcon className="h-8 w-8 text-primary" />
            Admin Dashboard
          </h1>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="badge badge-outline">{location.pathname}</span>
          <span className="badge badge-primary badge-outline">Restricted to admins</span>
        </div>
      </div>

      <div className="tabs tabs-boxed w-full overflow-x-auto">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `tab whitespace-nowrap ${isActive ? 'tab-active' : ''}`
            }
          >
            <tab.icon className="h-5 w-5" />
            <span className="ml-2">{tab.label}</span>
          </NavLink>
        ))}
      </div>

      <div className="bg-base-100 rounded-xl shadow-sm border border-base-200 p-4 lg:p-6">
        <Outlet />
      </div>
    </div>
  );
};

export default AdminLayout;
