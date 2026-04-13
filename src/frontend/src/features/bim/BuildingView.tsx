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
  const [view, setView] = useState<'bim' | 'structure'>('bim');

  useEffect(() => {
    getBuilding(buildingId)
      .then((b) => {
        const ifc = !!b.ifcFileName;
        setHasIfc(ifc);
        setView(ifc ? 'bim' : 'structure');
      })
      .catch(() => {
        setHasIfc(false);
        setView('structure');
      });
  }, [buildingId]);

  if (hasIfc === null) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 2 }}>
        <CircularProgress size={24} />
        <Typography color="text.secondary">Loading building...</Typography>
      </Box>
    );
  }

  if (view === 'bim' && hasIfc) {
    return (
      <BimView
        buildingId={buildingId}
        onBack={onBack}
        onSwitchToStructure={() => setView('structure')}
      />
    );
  }

  return (
    <BuildingStructureView
      buildingId={buildingId}
      onBack={onBack}
      onSwitchToBim={hasIfc ? () => setView('bim') : undefined}
    />
  );
}

export default BuildingView;
