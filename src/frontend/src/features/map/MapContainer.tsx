import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  Box,
  CircularProgress,
  IconButton,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import CellTowerRoundedIcon from '@mui/icons-material/CellTowerRounded';
import FullscreenRoundedIcon from '@mui/icons-material/FullscreenRounded';
import FullscreenExitRoundedIcon from '@mui/icons-material/FullscreenExitRounded';

const MapView = lazy(() => import('./MapView'));
const CoverageMapView = lazy(() => import('./CoverageMapView'));

type MapMode = 'locations' | 'coverage';

export interface MapPosition {
  center: [number, number];
  zoom: number;
}

const defaultPosition: MapPosition = { center: [10.4, 63.4], zoom: 5 };

interface MapContainerProps {
  onNavigateToSensor: (sensorId: string) => void;
  onNavigateToGateway: (gatewayId: string) => void;
}

function MapContainer({ onNavigateToSensor, onNavigateToGateway }: MapContainerProps) {
  const [mode, setMode] = useState<MapMode>('locations');
  const positionRef = useRef<MapPosition>(defaultPosition);
  const [positionForChild, setPositionForChild] = useState<MapPosition>(defaultPosition);
  const [fullscreen, setFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handlePositionChange = useCallback((pos: MapPosition) => {
    positionRef.current = pos;
  }, []);

  const handleModeChange = useCallback((_: unknown, next: MapMode | null) => {
    if (!next) return;
    setPositionForChild({ ...positionRef.current });
    setMode(next);
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  return (
    <Paper
      ref={containerRef}
      sx={{
        position: 'relative',
        borderRadius: fullscreen ? 0 : '6px',
        backgroundColor: 'rgba(36, 42, 51, 0.82)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 28px 80px rgba(0, 0, 0, 0.24)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: fullscreen ? '100vh' : 'calc(100vh - 120px)',
      }}
    >
      <Box
        sx={{
          p: 1.5,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          backgroundColor: 'rgba(15, 23, 42, 0.36)',
          display: 'flex',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        <ToggleButtonGroup
          exclusive
          value={mode}
          onChange={handleModeChange}
          size="small"
          color="primary"
        >
          <ToggleButton value="locations">
            <PlaceRoundedIcon fontSize="small" sx={{ mr: 0.5 }} />
            Locations
          </ToggleButton>
          <ToggleButton value="coverage">
            <CellTowerRoundedIcon fontSize="small" sx={{ mr: 0.5 }} />
            Coverage
          </ToggleButton>
        </ToggleButtonGroup>

        <IconButton
          onClick={toggleFullscreen}
          sx={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            backgroundColor: 'rgba(36, 42, 51, 0.92)',
            border: '1px solid rgba(255,255,255,0.08)',
            backdropFilter: 'blur(8px)',
            color: 'text.primary',
            '&:hover': { backgroundColor: 'rgba(36, 42, 51, 1)' },
          }}
          size="small"
        >
          {fullscreen ? <FullscreenExitRoundedIcon /> : <FullscreenRoundedIcon />}
        </IconButton>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <Suspense
          fallback={
            <Box sx={{ display: 'grid', placeItems: 'center', height: '100%' }}>
              <CircularProgress />
            </Box>
          }
        >
          {mode === 'locations' ? (
            <MapView
              onNavigateToSensor={onNavigateToSensor}
              onNavigateToGateway={onNavigateToGateway}
              initialPosition={positionForChild}
              onPositionChange={handlePositionChange}
            />
          ) : (
            <CoverageMapView
              onNavigateToSensor={onNavigateToSensor}
              onNavigateToGateway={onNavigateToGateway}
              initialPosition={positionForChild}
              onPositionChange={handlePositionChange}
            />
          )}
        </Suspense>
      </Box>
    </Paper>
  );
}

export default MapContainer;
