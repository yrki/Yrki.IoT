import { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { getBuilding } from '../../api/api';
import BimView from './BimView';
import BuildingStructureView from './BuildingStructureView';

interface BuildingViewProps {
  buildingId: string;
  onBack: () => void;
}

function BuildingView({ buildingId, onBack }: BuildingViewProps) {
  const [hasIfc, setHasIfc] = useState<boolean | null>(null);

  useEffect(() => {
    getBuilding(buildingId)
      .then((b) => setHasIfc(!!b.ifcFileName))
      .catch(() => setHasIfc(false));
  }, [buildingId]);

  if (hasIfc === null) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 2 }}>
        <CircularProgress size={24} />
        <Typography color="text.secondary">Loading building...</Typography>
      </Box>
    );
  }

  if (hasIfc) {
    return <BimView buildingId={buildingId} onBack={onBack} />;
  }

  return <BuildingStructureView buildingId={buildingId} onBack={onBack} />;
}

export default BuildingView;
