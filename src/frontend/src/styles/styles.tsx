import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#5c8dff',
    },
    secondary: {
      main: '#242a33',
    },
    success: {
      main: '#30d17b',
    },
    warning: {
      main: '#f5c451',
    },
    error: {
      main: '#ff6b6b',
    },
    info: {
      main: '#38c7ff',
    },
    background: {
      default: '#171a20',
      paper: '#20242c',
    },
    text: {
      primary: '#f3f5f8',
      secondary: '#a0a8b8',
    },
  },
  typography: {
    fontFamily: '"Manrope", sans-serif',
    h1: {
      fontWeight: 800,
    },
    h2: {
      fontWeight: 800,
    },
    h3: {
      fontWeight: 700,
    },
    h4: {
      fontWeight: 700,
    },
    h5: {
      fontWeight: 700,
    },
    h6: {
      fontWeight: 700,
    },
    button: {
      textTransform: 'none',
      fontWeight: 700,
    },
  },
  shape: {
    borderRadius: 6,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          paddingInline: 16,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 28px 80px rgba(0, 0, 0, 0.34)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
        },
      },
    },
  },
});

export default theme;
