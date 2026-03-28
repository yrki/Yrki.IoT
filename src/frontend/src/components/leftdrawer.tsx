import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import FiberNewRoundedIcon from '@mui/icons-material/FiberNewRounded';
import MemoryRoundedIcon from '@mui/icons-material/MemoryRounded';
import SensorsRoundedIcon from '@mui/icons-material/SensorsRounded';
import type { SvgIconComponent } from '@mui/icons-material';

export type NavigationSection = 'Devices' | 'Sensors' | 'New Sensors';

const primaryItems: Array<{ label: NavigationSection; icon: SvgIconComponent }> = [
  { label: 'Sensors', icon: SensorsRoundedIcon },
  { label: 'New Sensors', icon: FiberNewRoundedIcon },
  { label: 'Devices', icon: MemoryRoundedIcon },
];

interface LeftDrawerProps {
  selectedSection: NavigationSection;
  onSelectSection: (section: NavigationSection) => void;
}

function LeftDrawer({ selectedSection, onSelectSection }: LeftDrawerProps) {
  return (
    <Box
      sx={{
        width: { xs: 280, md: 300 },
        height: '100%',
        px: 2,
        py: 3,
        backgroundColor: 'background.paper',
      }}
      role="presentation"
    >
      <List sx={{ display: 'grid', gap: 0.5 }}>
        {primaryItems.map(({ label, icon: Icon }) => {
          const active = selectedSection === label;

          return (
          <ListItemButton
            key={label}
            onClick={() => onSelectSection(label)}
            selected={active}
            sx={{
              borderRadius: '6px',
              px: 1.5,
              py: 1.1,
              color: active ? 'text.primary' : 'text.secondary',
              backgroundColor: active ? 'rgba(92, 141, 255, 0.12)' : 'transparent',
              '&.Mui-selected': {
                backgroundColor: 'rgba(92, 141, 255, 0.12)',
              },
              '&.Mui-selected:hover, &:hover': {
                backgroundColor: active ? 'rgba(92, 141, 255, 0.16)' : 'rgba(255,255,255,0.04)',
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 38, color: 'inherit' }}>
              <Icon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={label}
              primaryTypographyProps={{
                fontSize: '0.98rem',
                fontWeight: active ? 800 : 600,
              }}
            />
          </ListItemButton>
          );
        })}
      </List>
    </Box>
  );
}

export default LeftDrawer;
