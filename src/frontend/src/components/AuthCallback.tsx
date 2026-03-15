import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { verifyMagicLink } from '../api/api';
import { ICurrentUser } from '../api/models/IAuthResponse';

interface AuthCallbackProps {
  onAuthenticated: (accessToken: string, user: ICurrentUser) => void;
}

function AuthCallback({ onAuthenticated }: AuthCallbackProps) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const token = new URLSearchParams(window.location.search).get('token');
      if (!token) {
        setError('Magic link is missing a token.');
        return;
      }

      try {
        const response = await verifyMagicLink(token);
        onAuthenticated(response.accessToken, response.user);
        window.history.replaceState({}, '', '/');
      } catch {
        setError('Magic link is invalid or expired.');
      }
    };

    void run();
  }, [onAuthenticated]);

  return (
    <Box sx={{ p: 4, display: 'grid', gap: 2, justifyItems: 'center' }}>
      {error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <>
          <CircularProgress />
          <Typography>Signing you in...</Typography>
        </>
      )}
    </Box>
  );
}

export default AuthCallback;
