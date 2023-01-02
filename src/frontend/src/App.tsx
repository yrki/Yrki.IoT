import './App.css';
import { ThemeProvider, Drawer } from '@mui/material';  
import Topmenu from './components/topmenu';
import theme from './styles/styles';


function App() {

  return (
    <ThemeProvider theme={theme}>
      <Topmenu />
    </ThemeProvider>
  );
}

export default App;
