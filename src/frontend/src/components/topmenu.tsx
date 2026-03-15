import { useEffect, useState } from 'react';
import { AppBar, Drawer, Box, Toolbar, Typography, Button, IconButton, Chip } from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu';
import LeftDrawer from './leftdrawer';
import { getDevice } from '../api/api';
import { IDevice } from '../api/models/IDevice';
import { ICurrentUser } from '../api/models/IAuthResponse';
import LoginDialog from './LoginDialog';


type Anchor = 'left' | 'top' | 'right' | 'bottom';

interface TopmenuProps {
    currentUser: ICurrentUser | null;
    onRequestMagicLink: (email: string) => Promise<void>;
    onLogout: () => void;
}

function Topmenu({ currentUser, onRequestMagicLink, onLogout }: TopmenuProps)
{
    const [device, setDevice] = useState<IDevice | null>(null);
    const [loginOpen, setLoginOpen] = useState(false);
    const [state, setState] = useState({
        left: false,
        top: false,
        right: false,
        bottom: false
      });
    
    useEffect(() => {
        if (!currentUser) {
            setDevice(null);
            return;
        }

        const fetchDevice = async () => {
            try {
                const result = await getDevice('1');
                setDevice(result);
            } catch {
                setDevice(null);
            }
        };
        
        void fetchDevice();
    }, [currentUser])

    

    const toggleDrawer =
        (anchor: Anchor, open: boolean) =>
        (event: React.KeyboardEvent | React.MouseEvent) => {
            if (
                event.type === "keydown" &&
                ((event as React.KeyboardEvent).key === "Tab" ||
                    (event as React.KeyboardEvent).key === "Shift")
            ) {
                return;
            }

            setState({ ...state, [anchor]: open });
        };
        

    return(
        <Box>
            <AppBar position="static"
                color='secondary'>
                <Toolbar>
                <div>{device?.id}</div>
                <IconButton
                    onClick={ toggleDrawer('left', true)}
                    size="large"
                    edge="start"
                    color="inherit"
                    aria-label="menu"
                    sx={{ mr: 2 }}
                >
                    <MenuIcon />
                </IconButton>
                <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                    Yrki IoT
                </Typography>
                {currentUser ? (
                    <>
                        <Chip label={currentUser.email} color="default" sx={{ mr: 2 }} />
                        <Button color="inherit" onClick={onLogout}>Logout</Button>
                    </>
                ) : (
                    <Button color="inherit" onClick={() => setLoginOpen(true)}>Login</Button>
                )}
                </Toolbar>
            </AppBar>
            <Drawer anchor='left'
                open={state['left']}
                onClose={toggleDrawer('left', false)}
            >
                <LeftDrawer />
            </Drawer>
            <LoginDialog
                open={loginOpen}
                onClose={() => setLoginOpen(false)}
                onSubmit={onRequestMagicLink}
            />
        </Box>
    )
}

export default Topmenu;
