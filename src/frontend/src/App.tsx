import './App.css';
import { Alert, Box, CircularProgress, ThemeProvider } from '@mui/material';
import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Topmenu from './components/topmenu';
import theme from './styles/styles';
import { getCurrentUser, requestMagicLink, setAccessToken } from './api/api';
import { ICurrentUser } from './api/models/IAuthResponse';
import { clearStoredAccessToken, getStoredAccessToken, setStoredAccessToken } from './auth/authStorage';
import AuthCallback from './components/AuthCallback';


function App() {
  const [currentUser, setCurrentUser] = useState<ICurrentUser | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token) {
      setAuthReady(true);
      return;
    }

    setAccessToken(token);
    getCurrentUser()
      .then((user) => setCurrentUser(user))
      .catch(() => {
        clearStoredAccessToken();
        setAccessToken(null);
        setCurrentUser(null);
      })
      .finally(() => setAuthReady(true));
  }, []);

  const handleAuthenticated = (token: string, user: ICurrentUser) => {
    setStoredAccessToken(token);
    setAccessToken(token);
    setCurrentUser(user);
    setAuthReady(true);
  };

  const handleRequestMagicLink = async (email: string) => {
    await requestMagicLink(email);
  };

  const handleLogout = () => {
    clearStoredAccessToken();
    setAccessToken(null);
    setCurrentUser(null);
  };

  if (!authReady) {
    return (
      <ThemeProvider theme={theme}>
        <Box className="app-shell__loading">
          <CircularProgress />
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallback onAuthenticated={handleAuthenticated} />} />
        <Route
          path="*"
          element={(
            <Box className="app-shell">
              {!currentUser && (
                <Alert severity="info" className="app-shell__notice">
                  Sign in with your email to access the API-backed features.
                </Alert>
              )}
              <Topmenu
                currentUser={currentUser}
                onRequestMagicLink={handleRequestMagicLink}
                onLogout={handleLogout}
              />
            </Box>
          )}
        />
        <Route path="/" element={<Navigate to="/sensors" replace />} />
      </Routes>
    </ThemeProvider>
  );
}

export default App;
