// This page is deprecated. Credentials management is now handled in Settings.jsx
// Keeping this file as a redirect for backwards compatibility

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Credentials = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to settings page where credentials are managed
    navigate('/settings', { replace: true });
  }, [navigate]);

  return (
    <div className="flex justify-center items-center h-64">
      <div className="text-center">
        <p className="text-muted-foreground">Redirecting to Settings...</p>
      </div>
    </div>
  );
};

export default Credentials;
