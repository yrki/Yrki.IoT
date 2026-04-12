import { Alert, Box, Button, TextField, Typography } from '@mui/material';
import { FormEvent, useState } from 'react';

interface LoginPageProps {
  onSubmit: (email: string) => Promise<void>;
}

function LoginPage({ onSubmit }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('submitting');
    setError(null);

    try {
      await onSubmit(email);
      setStatus('sent');
    } catch {
      setError('Could not send login link. Try again.');
      setStatus('idle');
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        bgcolor: 'background.default',
        px: 2,
      }}
    >
      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          width: '100%',
          maxWidth: 400,
          display: 'grid',
          gap: 3,
          p: 4,
          borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.08)',
          bgcolor: 'background.paper',
        }}
      >
        <pre
          style={{
            fontFamily: 'monospace',
            fontSize: '0.7rem',
            lineHeight: 1.15,
            color: 'inherit',
            margin: 0,
            textAlign: 'center',
            whiteSpace: 'pre',
          }}
        >{` __ __     _   _
|  |  |___| |_|_|
|_   _|  _| '_| |
  |_| |_| |_,_|_|`}</pre>
        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
          Enter your email and we will send you a sign-in link.
        </Typography>
        <TextField
          autoFocus
          required
          type="email"
          label="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '6px',
              backgroundColor: 'rgba(255,255,255,0.03)',
            },
          }}
        />
        {status === 'sent' && (
          <Alert severity="success">
            Check your email for the sign-in link.
          </Alert>
        )}
        {error && <Alert severity="error">{error}</Alert>}
        <Button
          type="submit"
          variant="contained"
          size="large"
          disabled={status === 'submitting'}
        >
          Send magic link
        </Button>
      </Box>
    </Box>
  );
}

export default LoginPage;
