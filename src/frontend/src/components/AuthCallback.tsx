import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { verifyMagicLink } from '../api/api';
import { ICurrentUser } from '../api/models/IAuthResponse';

interface AuthCallbackProps {
  onAuthenticated: (accessToken: string, user: ICurrentUser) => void;
}

function AuthCallback({ onAuthenticated }: AuthCallbackProps) {
  const [error, setError] = useState<string | null>(null);
  const verifying = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (verifying.current) return;
    verifying.current = true;

    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setError('Magic link is missing a token.');
      return;
    }

    verifyMagicLink(token)
      .then((response) => {
        onAuthenticated(response.accessToken, response.user);
        navigate('/', { replace: true });
      })
      .catch(() => {
        setError('Magic link is invalid or expired.');
      });
  }, [onAuthenticated, navigate]);

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
