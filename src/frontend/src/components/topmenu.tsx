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
import LoginDialog from './LoginDialog';

const SensorListView = lazy(() => import('../features/sensors/SensorListView'));
const NewSensorsView = lazy(() => import('../features/new-sensors/NewSensorsView'));
const SensorsView = lazy(() => import('../features/sensors/SensorsView'));
const LocationsView = lazy(() => import('../features/locations/LocationsView'));
const GatewayListView = lazy(() => import('../features/gateways/GatewayListView'));
const GatewayView = lazy(() => import('../features/gateways/GatewayView'));

const drawerWidth = 300;

interface TopmenuProps {
  currentUser: ICurrentUser | null;
  onRequestMagicLink: (email: string) => Promise<void>;
  onLogout: () => void;
}

function getSectionFromPath(pathname: string): NavigationSection {
  if (matchPath('/sensors/:sensorId', pathname) || matchPath('/locations/:locationId', pathname)) {
    return 'Live View';
  }

  if (matchPath('/gateways/:gatewayId', pathname)) {
    return 'Gateway View';
  }

  if (pathname.startsWith('/gateways')) {
    return 'Gateways';
  }

  if (pathname.startsWith('/locations')) {
    return 'Locations';
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
    case 'Sensors':
    default:
      return '/sensors';
  }
}

function Topmenu({ currentUser, onRequestMagicLink, onLogout }: TopmenuProps) {
  const [loginOpen, setLoginOpen] = useState(false);
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
      '/new-sensors',
    ].some((path) => location.pathname === path)
      || matchPath('/sensors/:sensorId', location.pathname)
      || matchPath('/locations/:locationId', location.pathname)
      || matchPath('/gateways/:gatewayId', location.pathname);

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
    const fromPath = typeof location.state === 'object' && location.state && 'from' in location.state
      ? String(location.state.from)
      : null;

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
            onNavigateToSensor={navigateToSensorView}
            onNavigateToGateway={navigateToGatewayView}
          />
        );
      case 'New Sensors':
        return <NewSensorsView />;
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
          width: { lg: `calc(100% - ${drawerWidth}px)` },
          ml: { lg: `${drawerWidth}px` },
          backgroundColor: 'rgba(32, 36, 44, 0.92)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          backdropFilter: 'blur(14px)',
        }}
      >
        <Toolbar sx={{ px: { xs: 2, sm: 3, md: 4 } }}>
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
          <Box sx={{ flexGrow: 1 }} />
          {currentUser ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {currentUser.email}
              </Typography>
              <Button color="inherit" size="small" onClick={onLogout}>
                Logout
              </Button>
            </Stack>
          ) : (
            <Button variant="contained" size="small" onClick={() => setLoginOpen(true)}>
              Sign in
            </Button>
          )}
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

      <LoginDialog
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSubmit={onRequestMagicLink}
      />
    </Box>
  );
}

export default Topmenu;
