import { lazy, Suspense, useCallback, useRef, useState } from 'react';
import {
  Box,
  CircularProgress,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import CellTowerRoundedIcon from '@mui/icons-material/CellTowerRounded';

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

  const handlePositionChange = useCallback((pos: MapPosition) => {
    positionRef.current = pos;
  }, []);

  const handleModeChange = useCallback((_: unknown, next: MapMode | null) => {
    if (!next) return;
    setPositionForChild({ ...positionRef.current });
    setMode(next);
  }, []);

  return (
    <Paper
      sx={{
        borderRadius: '6px',
        backgroundColor: 'rgba(36, 42, 51, 0.82)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 28px 80px rgba(0, 0, 0, 0.24)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 120px)',
      }}
    >
      <Box
        sx={{
          p: 1.5,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          backgroundColor: 'rgba(15, 23, 42, 0.36)',
          display: 'flex',
          justifyContent: 'center',
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
