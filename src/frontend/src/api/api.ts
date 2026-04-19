import axios from 'axios';
import { IAuthResponse, ICurrentUser } from './models/IAuthResponse';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

let accessToken: string | null = null;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export async function requestMagicLink(email: string): Promise<void> {
  await api.post('/auth/magic-link', { email });
}

export async function verifyMagicLink(token: string): Promise<IAuthResponse> {
  const response = await api.post<IAuthResponse>('/auth/verify', { token });
  return response.data;
}

export async function getCurrentUser(): Promise<ICurrentUser> {
  const response = await api.get<ICurrentUser>('/auth/me');
  return response.data;
}

export interface UserDto {
  id: string;
  email: string;
  createdAtUtc: string;
  lastLoginAtUtc: string | null;
}

export async function getUsers(): Promise<UserDto[]> {
  const response = await api.get<UserDto[]>('/users');
  return response.data;
}

export async function createUser(email: string): Promise<UserDto> {
  const response = await api.post<UserDto>('/users', { email });
  return response.data;
}

export async function updateUser(id: string, email: string): Promise<UserDto> {
  const response = await api.put<UserDto>(`/users/${id}`, { email });
  return response.data;
}

export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/users/${id}`);
}

export interface SensorReadingDto {
  sensorId: string;
  sensorType: string;
  value: number;
  timestamp: string;
  gatewayId: string | null;
  rssi: number | null;
}

export interface SensorGatewayDto {
  gatewayId: string;
  readingCount: number;
  averageRssi: number;
  minRssi: number | null;
  maxRssi: number | null;
  lastSeenAt: string;
}

export interface GatewaySensorDto {
  sensorId: string;
  readingCount: number;
  averageRssi: number;
  lastSeenAt: string;
}

export async function getSensorIds(): Promise<string[]> {
  const response = await api.get<string[]>('/sensorreadings/sensors');
  return response.data;
}

export async function getRecentReadings(
  sensorId: string,
  hours = 3,
  from?: string,
  to?: string,
): Promise<SensorReadingDto[]> {
  const params: Record<string, string | number> = {};
  if (from && to) {
    params.from = from;
    params.to = to;
  } else {
    params.hours = hours;
  }
  const response = await api.get<SensorReadingDto[]>(`/sensorreadings/${encodeURIComponent(sensorId)}/recent`, {
    params,
  });
  return response.data;
}

export async function getLatestReadings(sensorId: string): Promise<SensorReadingDto[]> {
  const response = await api.get<SensorReadingDto[]>(`/sensorreadings/${encodeURIComponent(sensorId)}/latest`);
  return response.data;
}

export async function getSensorGateways(sensorId: string, hours?: number): Promise<SensorGatewayDto[]> {
  const response = await api.get<SensorGatewayDto[]>(`/sensorreadings/${encodeURIComponent(sensorId)}/gateways`, {
    params: hours != null ? { hours } : undefined,
  });
  return response.data;
}

export async function getGatewaySensors(gatewayId: string): Promise<GatewaySensorDto[]> {
  const response = await api.get<GatewaySensorDto[]>(`/sensorreadings/gateway/${encodeURIComponent(gatewayId)}/sensors`);
  return response.data;
}

export interface CoverageConnectionDto {
  gatewayId: string;
  sensorId: string;
  averageRssi: number | null;
  readingCount: number;
  lastSeenAt: string;
}

export async function getCoverageConnections(hours = 168): Promise<CoverageConnectionDto[]> {
  const response = await api.get<CoverageConnectionDto[]>('/sensorreadings/coverage', { params: { hours } });
  return response.data;
}

export interface RawPayloadDto {
  id: string;
  receivedAt: string;
  payloadHex: string;
  source: string;
  deviceId: string | null;
  manufacturer: string | null;
  gatewayId: string | null;
  rssi: number | null;
  error: string | null;
}

export async function getRawPayloadsByDevice(
  deviceId: string,
  limit = 100,
): Promise<RawPayloadDto[]> {
  const response = await api.get<RawPayloadDto[]>(
    `/rawpayloads/device/${encodeURIComponent(deviceId)}`,
    { params: { limit } },
  );
  return response.data;
}

export interface NewDeviceDto {
  id: string;
  uniqueId: string;
  name: string | null;
  manufacturer: string | null;
  type: string;
  description: string;
  locationId: string | null;
  lastContact: string;
  installationDate: string;
  latitude: number | null;
  longitude: number | null;
}

export interface UpdateDeviceRequest {
  name?: string;
  description?: string;
  locationId?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export async function getNewDevices(): Promise<NewDeviceDto[]> {
  const response = await api.get<NewDeviceDto[]>('/newdevices');
  return response.data;
}

export async function updateDevice(id: string, request: UpdateDeviceRequest): Promise<NewDeviceDto> {
  const response = await api.put<NewDeviceDto>(`/newdevices/${id}`, request);
  return response.data;
}

export async function updateExistingDevice(id: string, request: UpdateDeviceRequest): Promise<NewDeviceDto> {
  const response = await api.put<NewDeviceDto>(`/devices/${id}`, request);
  return response.data;
}

export interface SensorListItemDto {
  id: string;
  uniqueId: string;
  name: string | null;
  manufacturer: string | null;
  type: string;
  kind?: 'Sensor' | 'Gateway';
  locationName: string | null;
  locationId: string | null;
  lastContact: string;
  installationDate: string;
  latitude: number | null;
  longitude: number | null;
}

export async function getDevices(): Promise<SensorListItemDto[]> {
  const response = await api.get<SensorListItemDto[]>('/devices');
  return response.data;
}

export async function getGateways(): Promise<SensorListItemDto[]> {
  const response = await api.get<SensorListItemDto[]>('/devices/gateways');
  return response.data;
}

export async function deleteDevice(id: string): Promise<void> {
  await api.delete(`/devices/${id}`);
}

export async function getDevicesByLocation(locationId: string): Promise<SensorListItemDto[]> {
  const response = await api.get<SensorListItemDto[]>(`/devices/location/${locationId}`);
  return response.data;
}

export async function getDevicesBySensorLocation(sensorId: string): Promise<SensorListItemDto[]> {
  const response = await api.get<SensorListItemDto[]>(`/devices/sensor/${encodeURIComponent(sensorId)}`);
  return response.data;
}

export async function getDeviceByUniqueId(sensorId: string): Promise<SensorListItemDto> {
  const response = await api.get<SensorListItemDto>(`/devices/unique/${encodeURIComponent(sensorId)}`);
  return response.data;
}

export type LocationBoundary = number[][];

export interface LocationDto {
  id: string;
  name: string;
  description: string;
  deviceCount: number;
  parentLocationId: string | null;
  latitude: number | null;
  longitude: number | null;
  boundary: LocationBoundary | null;
  color: string | null;
}

export async function getLocations(): Promise<LocationDto[]> {
  const response = await api.get<LocationDto[]>('/locations');
  return response.data;
}

export async function createLocation(
  name: string,
  description?: string,
  parentLocationId?: string,
  latitude?: number,
  longitude?: number,
  boundary?: LocationBoundary,
  color?: string | null,
): Promise<LocationDto> {
  const response = await api.post<LocationDto>('/locations', {
    name,
    description,
    parentLocationId,
    latitude,
    longitude,
    boundary,
    color,
  });
  return response.data;
}

export async function updateLocation(
  id: string,
  request: {
    name?: string;
    description?: string;
    parentLocationId?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    boundary?: LocationBoundary | null;
    color?: string | null;
  },
): Promise<LocationDto> {
  const response = await api.put<LocationDto>(`/locations/${id}`, request);
  return response.data;
}

export async function assignDevicesToLocation(
  locationId: string,
  deviceIds: string[],
): Promise<{ affected: number }> {
  const response = await api.post<{ affected: number }>('/devices/assign-to-location', {
    locationId,
    deviceIds,
  });
  return response.data;
}

export interface ImportDeviceEntry {
  uniqueId: string;
  name?: string;
  manufacturer?: string;
  type?: string;
  kind?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
}

export interface ImportDevicesResponse {
  inserted: number;
  updated: number;
  deleted: number;
}

export async function importDevices(
  devices: ImportDeviceEntry[],
  mode: 'update' | 'replace',
): Promise<ImportDevicesResponse> {
  const response = await api.post<ImportDevicesResponse>('/devices/import', { devices, mode });
  return response.data;
}

// --- Buildings ---

export interface BuildingDto {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  ifcFileName: string | null;
  deviceCount: number;
  locationId: string | null;
  locationName: string | null;
  createdAtUtc: string;
}

export async function getBuildings(): Promise<BuildingDto[]> {
  const response = await api.get<BuildingDto[]>('/buildings');
  return response.data;
}

export async function getBuilding(id: string): Promise<BuildingDto> {
  const response = await api.get<BuildingDto>(`/buildings/${id}`);
  return response.data;
}

export async function createBuilding(
  name: string,
  address?: string,
  latitude?: number,
  longitude?: number,
  locationId?: string,
): Promise<BuildingDto> {
  const response = await api.post<BuildingDto>('/buildings', { name, address, latitude, longitude, locationId: locationId || undefined });
  return response.data;
}

export async function updateBuilding(
  id: string,
  request: { name?: string; address?: string; latitude?: number | null; longitude?: number | null; locationId?: string | null },
): Promise<BuildingDto> {
  const response = await api.put<BuildingDto>(`/buildings/${id}`, request);
  return response.data;
}

export async function deleteBuilding(id: string): Promise<void> {
  await api.delete(`/buildings/${id}`);
}

export async function uploadBuildingIfc(id: string, file: File): Promise<{ fileName: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post<{ fileName: string }>(`/buildings/${id}/upload-ifc`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

export interface FloorDto {
  id: string;
  name: string;
  elevation: number;
  sortOrder: number;
  bimExpressId: number | null;
  buildingId: string;
  rooms: RoomDto[];
}

export interface RoomDto {
  id: string;
  name: string;
  number: string | null;
  sortOrder: number;
  bimExpressId: number | null;
  floorId: string;
  deviceCount: number;
}

export async function getBuildingFloors(buildingId: string): Promise<FloorDto[]> {
  const response = await api.get<FloorDto[]>(`/buildings/${buildingId}/floors`);
  return response.data;
}

export async function createFloor(buildingId: string, name: string, elevation = 0): Promise<FloorDto> {
  const response = await api.post<FloorDto>(`/buildings/${buildingId}/create-floor`, { name, elevation });
  return response.data;
}

export async function createRoom(buildingId: string, floorId: string, name: string, number?: string): Promise<RoomDto> {
  const response = await api.post<RoomDto>(`/buildings/${buildingId}/floors/${floorId}/create-room`, { name, number });
  return response.data;
}

export async function assignDeviceToRoom(
  buildingId: string,
  deviceId: string,
  roomId: string,
  bimX?: number,
  bimY?: number,
  bimZ?: number,
): Promise<void> {
  await api.post(`/buildings/${buildingId}/assign-device-to-room`, { deviceId, roomId, bimX, bimY, bimZ });
}

export interface ImportFloorEntry {
  name: string;
  elevation: number;
  bimExpressId?: number;
  rooms: ImportRoomEntry[];
}

export interface ImportRoomEntry {
  name: string;
  number?: string;
  bimExpressId?: number;
}

export interface BimStructureDiff {
  newFloors: Array<{ name: string; elevation: number; bimExpressId: number | null; roomCount: number }>;
  removedFloors: Array<{ existingId: string; name: string; roomCount: number }>;
  newRooms: Array<{ name: string; number: string | null; floorName: string }>;
  removedRooms: Array<{ existingId: string; name: string; floorName: string; deviceCount: number }>;
  hasChanges: boolean;
}

export async function importBuildingStructure(
  buildingId: string,
  floors: ImportFloorEntry[],
): Promise<BimStructureDiff> {
  const response = await api.post<BimStructureDiff>(`/buildings/${buildingId}/import-structure`, { floors });
  return response.data;
}

export async function applyBuildingStructureChanges(
  buildingId: string,
  floors: ImportFloorEntry[],
  createNew: boolean,
  deleteRemoved: boolean,
): Promise<void> {
  await api.post(`/buildings/${buildingId}/apply-structure-changes?createNew=${createNew}&deleteRemoved=${deleteRemoved}`, { floors });
}

export interface BuildingDeviceDto {
  id: string;
  uniqueId: string;
  name: string | null;
  manufacturer: string | null;
  type: string;
  kind: string;
  lastContact: string;
  bimX: number | null;
  bimY: number | null;
  bimZ: number | null;
  roomId: string | null;
}

export async function getBuildingDevices(buildingId: string): Promise<BuildingDeviceDto[]> {
  const response = await api.get<BuildingDeviceDto[]>(`/buildings/${buildingId}/devices`);
  return response.data;
}

export function getBuildingIfcUrl(id: string): string {
  return `${API_BASE_URL}/buildings/${id}/ifc`;
}

export async function updateFloor(
  buildingId: string,
  floorId: string,
  name: string,
  elevation: number,
): Promise<FloorDto> {
  const response = await api.put<FloorDto>(`/buildings/${buildingId}/floors/${floorId}`, { name, elevation });
  return response.data;
}

export async function deleteFloor(buildingId: string, floorId: string): Promise<void> {
  await api.delete(`/buildings/${buildingId}/floors/${floorId}`);
}

export async function updateRoom(
  buildingId: string,
  floorId: string,
  roomId: string,
  name: string,
  number?: string | null,
): Promise<RoomDto> {
  const response = await api.put<RoomDto>(
    `/buildings/${buildingId}/floors/${floorId}/rooms/${roomId}`,
    { name, number: number ?? null },
  );
  return response.data;
}

export async function deleteRoom(buildingId: string, floorId: string, roomId: string): Promise<void> {
  await api.delete(`/buildings/${buildingId}/floors/${floorId}/rooms/${roomId}`);
}

export async function reorderFloors(buildingId: string, floorIds: string[]): Promise<void> {
  await api.put(`/buildings/${buildingId}/reorder-floors`, { floorIds });
}

export async function reorderRooms(buildingId: string, floorId: string, roomIds: string[]): Promise<void> {
  await api.put(`/buildings/${buildingId}/floors/${floorId}/reorder-rooms`, { roomIds });
}

export async function assignDeviceToBuilding(
  deviceId: string,
  buildingId: string,
  bimX?: number,
  bimY?: number,
  bimZ?: number,
): Promise<void> {
  await api.post('/buildings/assign-device', { deviceId, buildingId, bimX, bimY, bimZ });
}

export async function exportReadings(
  sensorIds: string[],
  sensorTypes: string[],
  from: string,
  to: string,
): Promise<SensorReadingDto[]> {
  const response = await api.post<SensorReadingDto[]>('/sensorreadings/export', {
    sensorIds,
    sensorTypes,
    from,
    to,
  });
  return response.data;
}

export interface ForecastPointDto {
  timestamp: string;
  value: number;
  lower: number;
  upper: number;
}

export async function getSensorForecast(
  sensorId: string,
  sensorType: string,
  hours = 72,
): Promise<ForecastPointDto[]> {
  const response = await api.get<ForecastPointDto[]>(
    `/sensorreadings/${encodeURIComponent(sensorId)}/${encodeURIComponent(sensorType)}/forecast`,
    { params: { hours } },
  );
  return response.data;
}

export async function getDistinctSensorTypes(sensorIds?: string[]): Promise<string[]> {
  const params = sensorIds && sensorIds.length > 0 ? { sensorIds: sensorIds.join(',') } : undefined;
  const response = await api.get<string[]>('/sensorreadings/sensor-types', { params });
  return response.data;
}

export async function createDevice(
  uniqueId: string,
  manufacturer: string,
  name?: string,
  type?: string,
): Promise<SensorListItemDto> {
  const response = await api.post<SensorListItemDto>('/devices', {
    uniqueId,
    manufacturer,
    name: name || undefined,
    type: type || undefined,
  });
  return response.data;
}

export async function deleteLocation(id: string): Promise<void> {
  await api.delete(`/locations/${id}`);
}

export interface EncryptionKeyDto {
  id: string;
  manufacturer: string | null;
  deviceUniqueId: string | null;
  groupName: string | null;
  description: string | null;
  keyValue: string | null;
  hasKey: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export async function getEncryptionKeys(): Promise<EncryptionKeyDto[]> {
  const response = await api.get<EncryptionKeyDto[]>('/encryptionkeys');
  return response.data;
}

export async function getEncryptionKeyByDevice(deviceUniqueId: string, manufacturer?: string): Promise<EncryptionKeyDto | null> {
  try {
    const response = await api.get<EncryptionKeyDto>(`/encryptionkeys/device/${encodeURIComponent(deviceUniqueId)}`, {
      params: { manufacturer },
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function createEncryptionKey(request: {
  manufacturer?: string;
  deviceUniqueId?: string;
  groupName?: string;
  keyValue: string;
  description?: string;
}): Promise<EncryptionKeyDto> {
  const response = await api.post<EncryptionKeyDto>('/encryptionkeys', request);
  return response.data;
}

export async function updateEncryptionKey(id: string, request: {
  manufacturer?: string;
  deviceUniqueId?: string;
  groupName?: string;
  keyValue?: string;
  description?: string;
}): Promise<EncryptionKeyDto> {
  const response = await api.put<EncryptionKeyDto>(`/encryptionkeys/${id}`, request);
  return response.data;
}

export async function deleteEncryptionKey(id: string): Promise<void> {
  await api.delete(`/encryptionkeys/${id}`);
}

// --- Gateway Positions ---

export interface GatewayPositionDto {
  timestamp: string;
  gatewayUniqueId: string;
  longitude: number | null;
  latitude: number | null;
  heading: number | null;
  driveBy: boolean;
}

export interface GatewayActivityBucketDto {
  hour: string;
  contactCount: number;
}

export async function getGatewayActivity(gatewayId: string, hours = 24): Promise<GatewayActivityBucketDto[]> {
  const response = await api.get<GatewayActivityBucketDto[]>(
    `/gatewaypositions/${encodeURIComponent(gatewayId)}/activity`,
    { params: { hours } },
  );
  return response.data;
}

export async function getGatewayPositions(gatewayId: string, hours = 24): Promise<GatewayPositionDto[]> {
  const response = await api.get<GatewayPositionDto[]>(
    `/gatewaypositions/${encodeURIComponent(gatewayId)}`,
    { params: { hours } },
  );
  return response.data;
}

export async function getGatewayLatestPosition(gatewayId: string): Promise<GatewayPositionDto | null> {
  try {
    const response = await api.get<GatewayPositionDto>(
      `/gatewaypositions/${encodeURIComponent(gatewayId)}/latest`,
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }

    throw error;
  }
}

export async function getGatewayDriveByPositions(gatewayId: string, hours = 24): Promise<GatewayPositionDto[]> {
  const response = await api.get<GatewayPositionDto[]>(
    `/gatewaypositions/${encodeURIComponent(gatewayId)}/driveby`,
    { params: { hours } },
  );
  return response.data;
}
