import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppBar,
  Box,
  Button,
  CircularProgress,
  Drawer,
  IconButton,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import LeftDrawer, { NavigationSection } from './leftdrawer';
import { ICurrentUser } from '../api/models/IAuthResponse';

const SensorListView = lazy(() => import('../features/sensors/SensorListView'));
const NewSensorsView = lazy(() => import('../features/new-sensors/NewSensorsView'));
const SensorsView = lazy(() => import('../features/sensors/SensorsView'));
const LocationsView = lazy(() => import('../features/locations/LocationsView'));
const GatewayListView = lazy(() => import('../features/gateways/GatewayListView'));
const GatewayView = lazy(() => import('../features/gateways/GatewayView'));
const UsersView = lazy(() => import('../features/users/UsersView'));
const MapView = lazy(() => import('../features/map/MapView'));
const RawPayloadsView = lazy(() => import('../features/raw-payloads/RawPayloadsView'));

const drawerWidth = 220;

interface TopmenuProps {
  currentUser: ICurrentUser;
  onLogout: () => void;
}

function getSectionFromPath(pathname: string): NavigationSection {
  if (matchPath('/sensors/:sensorId', pathname) || matchPath('/locations/:locationId', pathname)) {
    return 'Live View';
  }

  if (matchPath('/gateways/:gatewayId', pathname)) {
    return 'Gateway View';
  }

  if (matchPath('/raw-payloads/:deviceId', pathname)) {
    return 'New Sensors';
  }

  if (pathname.startsWith('/gateways')) {
    return 'Gateways';
  }

  if (pathname.startsWith('/locations')) {
    return 'Locations';
  }

  if (pathname.startsWith('/map')) {
    return 'Map';
  }

  if (pathname.startsWith('/users')) {
    return 'Users';
  }

  if (pathname.startsWith('/new-sensors')) {
    return 'New Sensors';
  }

  return 'Sensors';
}

function getPrimaryPath(section: NavigationSection) {
  switch (section) {
    case 'Gateways':
      return '/gateways';
    case 'Locations':
      return '/locations';
    case 'New Sensors':
      return '/new-sensors';
    case 'Map':
      return '/map';
    case 'Users':
      return '/users';
    case 'Sensors':
    default:
      return '/sensors';
  }
}

function Topmenu({ currentUser, onLogout }: TopmenuProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const navigate = useNavigate();
  const location = useLocation();

  const selectedSection = useMemo(
    () => getSectionFromPath(location.pathname),
    [location.pathname],
  );

  useEffect(() => {
    const isKnownRoute = [
      '/sensors',
      '/gateways',
      '/locations',
      '/users',
      '/new-sensors',
      '/map',
    ].some((path) => location.pathname === path)
      || matchPath('/sensors/:sensorId', location.pathname)
      || matchPath('/locations/:locationId', location.pathname)
      || matchPath('/gateways/:gatewayId', location.pathname)
      || matchPath('/raw-payloads/:deviceId', location.pathname);

    if (!isKnownRoute) {
      navigate('/sensors', { replace: true });
    }
  }, [location.pathname, navigate]);

  const navigateToSensorView = useCallback((sensorId: string) => {
    navigate(`/sensors/${encodeURIComponent(sensorId)}`, {
      state: { from: location.pathname },
    });
  }, [location.pathname, navigate]);

  const navigateToLocationView = useCallback((locationId: string) => {
    navigate(`/locations/${encodeURIComponent(locationId)}`, {
      state: { from: location.pathname },
    });
  }, [location.pathname, navigate]);

  const navigateToGatewayView = useCallback((gatewayId: string) => {
    navigate(`/gateways/${encodeURIComponent(gatewayId)}`, {
      state: { from: location.pathname },
    });
  }, [location.pathname, navigate]);

  const navigateToRawPayloads = useCallback((deviceId: string) => {
    navigate(`/raw-payloads/${encodeURIComponent(deviceId)}`, {
      state: { from: location.pathname },
    });
  }, [location.pathname, navigate]);

  const navigateToSensorListWithLocationFilter = useCallback((locationId: string) => {
    navigate(`/sensors?locationId=${encodeURIComponent(locationId)}`, {
      state: { from: location.pathname },
    });
  }, [location.pathname, navigate]);

  const handleSelectSection = useCallback((section: NavigationSection) => {
    navigate(getPrimaryPath(section));
    setMobileOpen(false);
  }, [navigate]);

  const drawer = (
    <LeftDrawer
      selectedSection={selectedSection}
      onSelectSection={handleSelectSection}
    />
  );

  const contentFallback = (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: 320 }}>
      <CircularProgress />
    </Box>
  );

  const renderMainContent = () => {
    const sensorMatch = matchPath('/sensors/:sensorId', location.pathname);
    const locationMatch = matchPath('/locations/:locationId', location.pathname);
    const gatewayMatch = matchPath('/gateways/:gatewayId', location.pathname);
    const rawPayloadsMatch = matchPath('/raw-payloads/:deviceId', location.pathname);
    const fromPath = typeof location.state === 'object' && location.state && 'from' in location.state
      ? String(location.state.from)
      : null;

    if (rawPayloadsMatch?.params.deviceId) {
      return (
        <RawPayloadsView
          deviceId={decodeURIComponent(rawPayloadsMatch.params.deviceId)}
          onBack={() => navigate(fromPath || '/new-sensors')}
        />
      );
    }

    if (sensorMatch?.params.sensorId) {
      return (
        <SensorsView
          initialSensorId={decodeURIComponent(sensorMatch.params.sensorId)}
          onBack={() => navigate(fromPath || '/sensors')}
          onNavigateToGateway={navigateToGatewayView}
        />
      );
    }

    if (locationMatch?.params.locationId) {
      return (
        <SensorsView
          locationId={decodeURIComponent(locationMatch.params.locationId)}
          onBack={() => navigate(fromPath || '/locations')}
          onNavigateToGateway={navigateToGatewayView}
        />
      );
    }

    if (gatewayMatch?.params.gatewayId) {
      return (
        <GatewayView
          gatewayId={decodeURIComponent(gatewayMatch.params.gatewayId)}
          onBack={() => navigate(fromPath || '/gateways')}
          onNavigateToSensor={navigateToSensorView}
        />
      );
    }

    switch (selectedSection) {
      case 'Gateways':
        return <GatewayListView onNavigateToGateway={navigateToGatewayView} />;
      case 'Locations':
        return (
          <LocationsView
            onNavigateToLiveView={(locationId) => navigateToLocationView(locationId)}
            onNavigateToSensorList={navigateToSensorListWithLocationFilter}
          />
        );
      case 'New Sensors':
        return <NewSensorsView onNavigateToRawPayloads={navigateToRawPayloads} />;
      case 'Map':
        return (
          <MapView
            onNavigateToSensor={navigateToSensorView}
            onNavigateToGateway={navigateToGatewayView}
          />
        );
      case 'Users':
        return <UsersView />;
      case 'Sensors':
      default:
        return <SensorListView />;
    }
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: '100%',
          backgroundColor: 'rgba(32, 36, 44, 0.92)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(14px)',
          zIndex: (t) => t.zIndex.drawer + 1,
        }}
      >
        <Toolbar variant="dense" sx={{ px: { xs: 2, sm: 3, md: 4 }, minHeight: 48 }}>
          <IconButton
            onClick={() => setMobileOpen(true)}
            color="inherit"
            edge="start"
            sx={{
              display: { lg: 'none' },
              mr: 1.5,
              border: '1px solid rgba(255,255,255,0.08)',
              backgroundColor: 'rgba(255,255,255,0.03)',
            }}
          >
            <MenuRoundedIcon />
          </IconButton>
          <pre
            style={{
              fontFamily: 'monospace',
              fontSize: '0.5rem',
              lineHeight: 1.1,
              color: 'white',
              margin: 0,
              marginRight: 16,
            }}
          >{` __ __     _   _
|  |  |___| |_|_|
|_   _|  _| '_| |
  |_| |_| |_,_|_|`}</pre>
          <Box sx={{ flexGrow: 1 }} />
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {currentUser.email}
            </Typography>
            <Button color="inherit" size="small" onClick={onLogout}>
              Logout
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { lg: drawerWidth }, flexShrink: { lg: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', lg: 'none' },
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
              borderRight: '1px solid rgba(255,255,255,0.08)',
            },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          open={isDesktop}
          sx={{
            display: { xs: 'none', lg: 'block' },
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
              borderRight: '1px solid rgba(255,255,255,0.08)',
              mt: '48px',
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          px: { xs: 2, sm: 3, md: 4 },
          pt: { xs: 10, sm: 11 },
          pb: 4,
        }}
      >
        <Suspense fallback={contentFallback}>
          {renderMainContent()}
        </Suspense>
      </Box>

    </Box>
  );
}

export default Topmenu;
