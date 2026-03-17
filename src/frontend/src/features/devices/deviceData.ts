import { DeviceListItem } from './types';

export const initialDevices: DeviceListItem[] = [
  {
    id: '118bc870-7b6f-4f07-be28-016074313d9b',
    name: 'Office CO2 Sensor',
    uniqueId: 'CO2-2026-001',
    type: 'CO2',
    locationId: '21d7be9f-fec7-41f8-8d7c-17da5ef8a1f3',
    description: 'Tracks meeting room air quality on the third floor.',
    lastContact: '2026-03-16T08:15:00+00:00',
    installationDate: '2026-01-08T09:00:00+00:00',
  },
  {
    id: 'a5c4c4fd-e5f3-4d67-aeb3-1c2106af8a11',
    name: 'Pump Monitor',
    uniqueId: 'WTR-8841-11',
    type: 'WATER',
    locationId: '8a4d1f43-7365-4b45-a718-4fbdca6526ab',
    description: 'Monitors water pressure and leak thresholds.',
    lastContact: '2026-03-16T07:30:00+00:00',
    installationDate: '2025-12-01T10:00:00+00:00',
  },
  {
    id: 'f24eb7b1-cd7e-4200-83df-30fe3efeb7d2',
    name: 'Entrance Motion',
    uniqueId: 'PIR-ENTRY-07',
    type: 'PassiveIR',
    locationId: '1132f94a-ab4a-4f6d-a087-d7fe41e7f211',
    description: 'Passive infrared motion sensor for after-hours movement.',
    lastContact: '2026-03-15T22:10:00+00:00',
    installationDate: '2025-11-20T14:30:00+00:00',
  },
];
