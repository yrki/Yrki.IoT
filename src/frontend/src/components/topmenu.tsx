import { useEffect, useState } from 'react';
import { AppBar, Drawer, Box, Toolbar, Typography, Button, IconButton } from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu';
import LeftDrawer from './leftdrawer';
import { getDevice } from '../api/api';
import { IDevice } from '../api/models/IDevice';


type Anchor = 'left' | 'top' | 'right' | 'bottom';

function Topmenu()
{
    const [device, setDevice] = useState<IDevice | null>(null);
    const [state, setState] = useState({
        left: false,
        top: false,
        right: false,
        bottom: false
      });
    
    // Create a useEffect hook that calls getDevice and sets the device state
    useEffect(() => {
        const fetchDevice = async () => {
            const result = await getDevice('1');
            setDevice(result);
        }
        
        fetchDevice();
    }, [])

    

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
                <Button color="inherit">Login</Button>
                </Toolbar>
            </AppBar>
            <Drawer anchor='left'
                open={state['left']}
                onClose={toggleDrawer('left', false)}
            >
                <LeftDrawer />
            </Drawer>
        </Box>
    )
}

export default Topmenu;