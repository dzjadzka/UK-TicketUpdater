import React from 'react';

const AuthContext = React.createContext({
  isAuthenticated: false,
  login: () => {},
  logout: () => {}
});

export const AuthProvider = ({ children, initialAuthenticated = false }) => {
  const [isAuthenticated, setIsAuthenticated] = React.useState(initialAuthenticated);

  const login = React.useCallback(() => setIsAuthenticated(true), []);
  const logout = React.useCallback(() => setIsAuthenticated(false), []);

  const value = React.useMemo(
    () => ({
      isAuthenticated,
      login,
      logout
    }),
    [isAuthenticated, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => React.useContext(AuthContext);

export default AuthContext;
