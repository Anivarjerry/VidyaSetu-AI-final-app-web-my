
import React, { useState, useEffect } from 'react';
import { LoginCard } from './components/LoginCard';
import { Dashboard } from './components/Dashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { loginUser } from './services/authService';
import { LoginRequest, Role } from './types';
import { ThemeLanguageProvider } from './contexts/ThemeLanguageContext';

const AppContent: React.FC = () => {
  const [authData, setAuthData] = useState<{
    view: 'login' | 'dashboard' | 'admin';
    credentials: LoginRequest | null;
    userRole: Role | null;
    userName: string;
  }>(() => {
    try {
      const savedCreds = localStorage.getItem('vidyasetu_creds');
      const savedRole = localStorage.getItem('vidyasetu_role');
      const savedName = localStorage.getItem('vidyasetu_name');

      if (savedCreds && savedRole) {
        const parsedCreds = JSON.parse(savedCreds);
        // Basic validation of parsed data
        if (parsedCreds && typeof parsedCreds === 'object') {
          return {
            view: savedRole === 'admin' ? 'admin' : 'dashboard',
            credentials: parsedCreds,
            userRole: savedRole as Role,
            userName: savedName || ''
          };
        }
      }
    } catch (e) {
      console.error("Auth hydration failed, resetting to login.", e);
      localStorage.clear();
    }
    return { view: 'login', credentials: null, userRole: null, userName: '' };
  });

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLogin = async (creds: LoginRequest) => {
    setIsLoggingIn(true);
    setLoginError(null);

    try {
      const response = await loginUser(creds);
      const role = response.user_role || response.role || 'teacher';

      if (response.status === 'success') {
          const name = response.user_name || '';
          localStorage.setItem('vidyasetu_creds', JSON.stringify(creds));
          localStorage.setItem('vidyasetu_role', role);
          localStorage.setItem('vidyasetu_name', name);
          
          setAuthData({
            view: role === 'admin' ? 'admin' : 'dashboard',
            credentials: creds,
            userRole: role,
            userName: name
          });
      } else {
          setLoginError(response.message || 'Invalid credentials');
      }
    } catch (error) {
      setLoginError('Network Error. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    setAuthData({ view: 'login', credentials: null, userRole: null, userName: '' });
    // Reset history stack on logout
    window.history.pushState(null, '', '/');
  };

  // Safe Rendering
  if (authData.view === 'admin') {
    return <AdminDashboard onLogout={handleLogout} userName={authData.userName} />;
  }

  if (authData.view === 'dashboard' && authData.credentials && authData.userRole) {
    return <Dashboard credentials={authData.credentials} role={authData.userRole} userName={authData.userName} onLogout={handleLogout} />;
  }

  return <LoginCard onSubmit={handleLogin} isLoading={isLoggingIn} error={loginError} />;
};

const App: React.FC = () => (
  <ThemeLanguageProvider>
    <div className="fixed inset-0 bg-white dark:bg-dark-950 overflow-hidden">
      <AppContent />
    </div>
  </ThemeLanguageProvider>
);

export default App;
