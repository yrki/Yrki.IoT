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

export async function getRecentReadings(sensorId: string, hours = 3): Promise<SensorReadingDto[]> {
  const response = await api.get<SensorReadingDto[]>(`/sensorreadings/${encodeURIComponent(sensorId)}/recent`, {
    params: { hours },
  });
  return response.data;
}

export async function getLatestReadings(sensorId: string): Promise<SensorReadingDto[]> {
  const response = await api.get<SensorReadingDto[]>(`/sensorreadings/${encodeURIComponent(sensorId)}/latest`);
  return response.data;
}

export async function getSensorGateways(sensorId: string): Promise<SensorGatewayDto[]> {
  const response = await api.get<SensorGatewayDto[]>(`/sensorreadings/${encodeURIComponent(sensorId)}/gateways`);
  return response.data;
}

export async function getGatewaySensors(gatewayId: string): Promise<GatewaySensorDto[]> {
  const response = await api.get<GatewaySensorDto[]>(`/sensorreadings/gateway/${encodeURIComponent(gatewayId)}/sensors`);
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

export interface LocationDto {
  id: string;
  name: string;
  description: string;
  deviceCount: number;
  parentLocationId: string | null;
  latitude: number | null;
  longitude: number | null;
}

export async function getLocations(): Promise<LocationDto[]> {
  const response = await api.get<LocationDto[]>('/locations');
  return response.data;
}

export async function createLocation(name: string, description?: string, parentLocationId?: string, latitude?: number, longitude?: number): Promise<LocationDto> {
  const response = await api.post<LocationDto>('/locations', { name, description, parentLocationId, latitude, longitude });
  return response.data;
}

export async function updateLocation(id: string, request: { name?: string; description?: string; parentLocationId?: string | null; latitude?: number | null; longitude?: number | null }): Promise<LocationDto> {
  const response = await api.put<LocationDto>(`/locations/${id}`, request);
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
