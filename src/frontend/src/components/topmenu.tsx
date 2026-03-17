import { useState } from 'react';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import FullscreenRoundedIcon from '@mui/icons-material/FullscreenRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import LeftDrawer, { NavigationSection } from './leftdrawer';
import { ICurrentUser } from '../api/models/IAuthResponse';
import LoginDialog from './LoginDialog';
import DevicesView from '../features/devices/DevicesView';

const drawerWidth = 300;

interface TopmenuProps {
  currentUser: ICurrentUser | null;
  onRequestMagicLink: (email: string) => Promise<void>;
  onLogout: () => void;
}

function Topmenu({ currentUser, onRequestMagicLink, onLogout }: TopmenuProps) {
  const [loginOpen, setLoginOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedSection, setSelectedSection] = useState<NavigationSection>('Devices');
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
    if (selectedSection === 'Devices') {
      return <DevicesView />;
    }

    return (
      <Box
        sx={{
          p: { xs: 2.5, md: 3.5 },
          borderRadius: '6px',
          backgroundColor: 'rgba(36, 42, 51, 0.82)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <Typography variant="h4" sx={{ mb: 1 }}>
          {selectedSection}
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
          This section is not wired yet. The shell and navigation are ready for the next slice.
        </Typography>
      </Box>
    );
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
        <Toolbar sx={{ minHeight: 88, px: { xs: 2, sm: 3, md: 4 } }}>
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
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexGrow: 1 }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '0.04em' }}>
                Yrki.IoT
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            {[FullscreenRoundedIcon, SearchRoundedIcon].map((Icon, index) => (
              <Tooltip title={index === 0 ? 'Fullscreen' : 'Search'} key={index}>
                <IconButton
                  color="inherit"
                  sx={{
                    display: { xs: 'none', sm: 'inline-flex' },
                    border: '1px solid rgba(255,255,255,0.08)',
                    backgroundColor: 'rgba(255,255,255,0.03)',
                  }}
                >
                  <Icon />
                </IconButton>
              </Tooltip>
            ))}
            <Chip
              icon={<LanguageRoundedIcon sx={{ color: '#fff !important' }} />}
              label="EN"
              sx={{
                display: { xs: 'none', md: 'inline-flex' },
                backgroundColor: 'rgba(255,255,255,0.05)',
                color: 'text.primary',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            />
            <Box sx={{ position: 'relative', display: { xs: 'none', sm: 'inline-flex' } }}>
              <IconButton
                color="inherit"
                sx={{
                  border: '1px solid rgba(255,255,255,0.08)',
                  backgroundColor: 'rgba(255,255,255,0.03)',
                }}
              >
                <NotificationsRoundedIcon />
              </IconButton>
              <Box
                sx={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  minWidth: 18,
                  height: 18,
                  px: 0.5,
                  borderRadius: 999,
                  display: 'grid',
                  placeItems: 'center',
                  backgroundColor: 'error.main',
                  color: '#fff',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                }}
              >
                9
              </Box>
            </Box>
            <IconButton
              color="inherit"
              sx={{
                display: { xs: 'none', md: 'inline-flex' },
                border: '1px solid rgba(255,255,255,0.08)',
                backgroundColor: 'rgba(255,255,255,0.03)',
              }}
            >
              <SettingsRoundedIcon />
            </IconButton>
            {currentUser ? (
              <Stack
                direction="row"
                spacing={1.25}
                alignItems="center"
                sx={{
                  pl: { xs: 0.5, md: 1 },
                }}
              >
                <Avatar sx={{ width: 42, height: 42, bgcolor: '#7f5af0' }}>
                  {currentUser.email.charAt(0).toUpperCase()}
                </Avatar>
                <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                  <Typography sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                    {currentUser.email}
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Signed in
                  </Typography>
                </Box>
                <Button color="inherit" onClick={onLogout} sx={{ ml: 1 }}>
                  Logout
                </Button>
              </Stack>
            ) : (
              <Button variant="contained" onClick={() => setLoginOpen(true)}>
                Sign in
              </Button>
            )}
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
          pt: { xs: 14, sm: 15 },
          pb: 4,
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems={{ xs: 'flex-start', md: 'center' }}
          justifyContent="space-between"
          sx={{ mb: 3 }}
        >
          <Box>
            <Typography variant="h3" sx={{ fontSize: { xs: '2rem', md: '2.4rem' }, mb: 0.5 }}>
              {selectedSection}
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', maxWidth: 720 }}>
              {selectedSection === 'Devices'
                ? 'A sortable device inventory with search and inline add flow.'
                : `Manage ${selectedSection.toLowerCase()} from the same dashboard shell.`}
            </Typography>
          </Box>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            Yrki.IoT &nbsp; / &nbsp; {selectedSection}
          </Typography>
        </Stack>
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
