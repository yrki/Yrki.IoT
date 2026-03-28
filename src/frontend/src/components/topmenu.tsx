import { useState } from 'react';
import {
  AppBar,
  Box,
  Button,
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
import DevicesView from '../features/devices/DevicesView';
import NewSensorsView from '../features/new-sensors/NewSensorsView';
import SensorsView from '../features/sensors/SensorsView';

const drawerWidth = 300;

interface TopmenuProps {
  currentUser: ICurrentUser | null;
  onRequestMagicLink: (email: string) => Promise<void>;
  onLogout: () => void;
}

function Topmenu({ currentUser, onRequestMagicLink, onLogout }: TopmenuProps) {
  const [loginOpen, setLoginOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedSection, setSelectedSection] = useState<NavigationSection>('Sensors');
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));

  const drawer = (
    <LeftDrawer
      selectedSection={selectedSection}
      onSelectSection={(section) => {
        setSelectedSection(section);
        setMobileOpen(false);
      }}
    />
  );

  const renderMainContent = () => {
    switch (selectedSection) {
      case 'Devices':
        return <DevicesView />;
      case 'New Sensors':
        return <NewSensorsView />;
      default:
        return <SensorsView />;
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
          <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '0.04em', flexGrow: 1 }}>
            Yrki.IoT
          </Typography>
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
        {renderMainContent()}
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
