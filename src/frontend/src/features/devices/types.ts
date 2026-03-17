export type DeviceType = 'CO2' | 'WATER' | 'PassiveIR';

export interface DeviceListItem {
  id: string;
  name: string | null;
  uniqueId: string;
  type: DeviceType;
  locationId: string;
  description: string;
  lastContact: string;
  installationDate: string;
}
