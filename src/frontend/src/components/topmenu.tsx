import * as React from 'react';
import { AppBar, Drawer, Box, Toolbar, Typography, Button, IconButton } from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu';
import LeftDrawer from './leftdrawer';


type Anchor = 'left' | 'top' | 'right' | 'bottom';

function Topmenu()
{
    const [state, setState] = React.useState({
        left: false,
        top: false,
        right: false,
        bottom: false
      });
    
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