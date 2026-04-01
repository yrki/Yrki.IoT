import { lazy, Suspense, useCallback, useState } from 'react';
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

interface LiveViewParams {
  sensorId?: string;
  locationId?: string;
  locationName?: string;
}

interface GatewayViewParams {
  gatewayId?: string;
}

interface TopmenuProps {
  currentUser: ICurrentUser | null;
  onRequestMagicLink: (email: string) => Promise<void>;
  onLogout: () => void;
}

function Topmenu({ currentUser, onRequestMagicLink, onLogout }: TopmenuProps) {
  const [loginOpen, setLoginOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedSection, setSelectedSection] = useState<NavigationSection>('Sensors');
  const [previousSection, setPreviousSection] = useState<NavigationSection>('Sensors');
  const [liveViewParams, setLiveViewParams] = useState<LiveViewParams>({});
  const [gatewayViewParams, setGatewayViewParams] = useState<GatewayViewParams>({});
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));

  const navigateToLiveView = useCallback((params: LiveViewParams) => {
    if (selectedSection !== 'Live View') {
      setPreviousSection(selectedSection);
    }
    setLiveViewParams(params);
    setSelectedSection('Live View');
  }, [selectedSection]);

  const handleSelectSection = useCallback((section: NavigationSection) => {
    setSelectedSection(section);
    if (section !== 'Live View') {
      setLiveViewParams({});
    }
    if (section !== 'Gateway View') {
      setGatewayViewParams({});
    }
    setMobileOpen(false);
  }, []);

  const navigateToGatewayView = useCallback((gatewayId: string) => {
    if (selectedSection !== 'Gateway View') {
      setPreviousSection(selectedSection);
    }
    setGatewayViewParams({ gatewayId });
    setSelectedSection('Gateway View');
  }, [selectedSection]);

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
    switch (selectedSection) {
      case 'Sensors':
        return <SensorListView onNavigateToLiveView={(sensorId) => navigateToLiveView({ sensorId })} />;
      case 'Gateways':
        return <GatewayListView onNavigateToGateway={navigateToGatewayView} />;
      case 'Locations':
        return (
          <LocationsView
            onNavigateToLiveView={(locationId, locationName) => navigateToLiveView({ locationId, locationName })}
            onNavigateToSensor={(sensorId) => navigateToLiveView({ sensorId })}
            onNavigateToGateway={navigateToGatewayView}
          />
        );
      case 'New Sensors':
        return <NewSensorsView />;
      case 'Live View':
        return (
          <SensorsView
            initialSensorId={liveViewParams.sensorId}
            locationId={liveViewParams.locationId}
            locationName={liveViewParams.locationName}
            onBack={() => setSelectedSection(previousSection)}
            onNavigateToGateway={navigateToGatewayView}
          />
        );
      case 'Gateway View':
        return gatewayViewParams.gatewayId ? (
          <GatewayView
            gatewayId={gatewayViewParams.gatewayId}
            onBack={() => setSelectedSection(previousSection)}
            onNavigateToSensor={(sensorId) => navigateToLiveView({ sensorId })}
          />
        ) : (
          <GatewayListView onNavigateToGateway={navigateToGatewayView} />
        );
      default:
        return <SensorListView onNavigateToLiveView={(sensorId) => navigateToLiveView({ sensorId })} />;
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
