import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { FormEvent, useState } from 'react';

interface LoginDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (email: string) => Promise<void>;
}

function LoginDialog({ open, onClose, onSubmit }: LoginDialogProps) {
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

  const handleClose = () => {
    setEmail('');
    setError(null);
    setStatus('idle');
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="xs"
      PaperProps={{
        sx: {
          backgroundColor: 'background.paper',
          borderRadius: '6px',
        },
      }}
    >
      <Box component="form" onSubmit={handleSubmit}>
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h4">Sign in</Typography>
        </DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, pt: 1 }}>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            Enter your email and we will send you a one-time sign-in link.
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
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={handleClose} color="inherit">
            Close
          </Button>
          <Button type="submit" variant="contained" disabled={status === 'submitting'}>
            Send magic link
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

export default LoginDialog;
