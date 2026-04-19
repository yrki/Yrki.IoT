import { IconButton } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';

interface BackButtonProps {
  onClick: () => void;
}

function BackButton({ onClick }: BackButtonProps) {
  return (
    <IconButton aria-label="Back" onClick={onClick} sx={{ alignSelf: 'flex-start', mt: 0.25 }}>
      <ArrowBackRoundedIcon />
    </IconButton>
  );
}

export default BackButton;
