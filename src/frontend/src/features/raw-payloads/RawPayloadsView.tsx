import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { getRawPayloadsByDevice, RawPayloadDto } from '../../api/api';

interface RawPayloadsViewProps {
  deviceId: string;
  onBack: () => void;
}

const PAYLOAD_LIMIT = 100;

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function RawPayloadsView({ deviceId, onBack }: RawPayloadsViewProps) {
  const [payloads, setPayloads] = useState<RawPayloadDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyPayload = async (payload: RawPayloadDto) => {
    const markCopied = () => {
      setCopiedId(payload.id);
      window.setTimeout(() => {
        setCopiedId((current) => (current === payload.id ? null : current));
      }, 1500);
    };

    // navigator.clipboard is only available in secure contexts (HTTPS or
    // localhost). On a plain HTTP deployment it is undefined and accessing
    // .writeText throws, so fall back to the legacy textarea + execCommand
    // approach which works in any context as long as the call sits inside
    // a user gesture.
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(payload.payloadHex);
        markCopied();
        return;
      } catch (clipboardError: unknown) {
        console.warn('navigator.clipboard.writeText failed, falling back:', clipboardError);
      }
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = payload.payloadHex;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.left = '0';
      textarea.style.opacity = '0';
      textarea.style.pointerEvents = 'none';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (!ok) {
        throw new Error('document.execCommand("copy") returned false');
      }
      markCopied();
    } catch (fallbackError: unknown) {
      console.error('Failed to copy payload to clipboard:', fallbackError);
      setError('Could not copy payload to clipboard.');
    }
  };

  const load = () => {
    setLoading(true);
    setError(null);
    getRawPayloadsByDevice(deviceId, PAYLOAD_LIMIT)
      .then(setPayloads)
      .catch((loadError: unknown) => {
        console.error('Failed to fetch raw payloads:', loadError);
        setError('Failed to load raw payloads.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  return (
    <Paper
      sx={{
        borderRadius: '6px',
        backgroundColor: 'rgba(36, 42, 51, 0.82)',
        border: '1px solid rgba(255,255,255,0.06)',
        p: { xs: 2, md: 3 },
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        sx={{ mb: 2 }}
      >
        <Button
          size="small"
          variant="outlined"
          startIcon={<ArrowBackRoundedIcon />}
          onClick={onBack}
        >
          Back
        </Button>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
            Raw payloads
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
            {deviceId}
          </Typography>
        </Box>
        <Button
          size="small"
          variant="outlined"
          startIcon={<RefreshRoundedIcon />}
          onClick={load}
          disabled={loading}
        >
          Refresh
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : payloads.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          No raw payloads recorded for this sensor.
        </Typography>
      ) : (
        <>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Showing {payloads.length} most recent payload{payloads.length === 1 ? '' : 's'} (max {PAYLOAD_LIMIT}).
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Received</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell>Gateway</TableCell>
                  <TableCell align="right">RSSI</TableCell>
                  <TableCell>Payload (hex)</TableCell>
                  <TableCell>Error</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {payloads.map((payload) => (
                  <TableRow key={payload.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {formatTimestamp(payload.receivedAt)}
                    </TableCell>
                    <TableCell>{payload.source || '-'}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {payload.gatewayId ?? '-'}
                    </TableCell>
                    <TableCell align="right">
                      {payload.rssi != null ? `${payload.rssi} dBm` : '-'}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 380 }}>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <Tooltip title={payload.payloadHex} placement="top">
                          <Box
                            component="span"
                            sx={{
                              fontFamily: 'monospace',
                              fontSize: '0.8rem',
                              flex: 1,
                              minWidth: 0,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {payload.payloadHex}
                          </Box>
                        </Tooltip>
                        <Tooltip
                          title={copiedId === payload.id ? 'Copied!' : 'Copy hex to clipboard'}
                          placement="top"
                        >
                          <IconButton
                            size="small"
                            onClick={() => copyPayload(payload)}
                            aria-label="Copy hex payload to clipboard"
                            sx={{ flexShrink: 0 }}
                          >
                            {copiedId === payload.id ? (
                              <CheckRoundedIcon fontSize="inherit" sx={{ color: 'success.light' }} />
                            ) : (
                              <ContentCopyRoundedIcon fontSize="inherit" />
                            )}
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ color: payload.error ? 'error.light' : 'text.secondary' }}>
                      {payload.error ?? '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Paper>
  );
}

export default RawPayloadsView;
