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

export interface SensorReadingDto {
  sensorId: string;
  sensorType: string;
  value: number;
  timestamp: string;
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
}

export interface UpdateDeviceRequest {
  name?: string;
  description?: string;
  locationId?: string;
}

export async function getNewDevices(): Promise<NewDeviceDto[]> {
  const response = await api.get<NewDeviceDto[]>('/newdevices');
  return response.data;
}

export async function updateDevice(id: string, request: UpdateDeviceRequest): Promise<NewDeviceDto> {
  const response = await api.put<NewDeviceDto>(`/newdevices/${id}`, request);
  return response.data;
}

export interface SensorListItemDto {
  id: string;
  uniqueId: string;
  name: string | null;
  manufacturer: string | null;
  type: string;
  locationName: string | null;
  locationId: string | null;
  lastContact: string;
}

export async function getDevices(): Promise<SensorListItemDto[]> {
  const response = await api.get<SensorListItemDto[]>('/devices');
  return response.data;
}

export async function deleteDevice(id: string): Promise<void> {
  await api.delete(`/devices/${id}`);
}

export async function getDevicesByLocation(locationId: string): Promise<SensorListItemDto[]> {
  const response = await api.get<SensorListItemDto[]>(`/devices/location/${locationId}`);
  return response.data;
}

export interface LocationDto {
  id: string;
  name: string;
  description: string;
  deviceCount: number;
}

export async function getLocations(): Promise<LocationDto[]> {
  const response = await api.get<LocationDto[]>('/locations');
  return response.data;
}

export async function createLocation(name: string, description?: string): Promise<LocationDto> {
  const response = await api.post<LocationDto>('/locations', { name, description });
  return response.data;
}

export async function updateLocation(id: string, request: { name?: string; description?: string }): Promise<LocationDto> {
  const response = await api.put<LocationDto>(`/locations/${id}`, request);
  return response.data;
}

export async function deleteLocation(id: string): Promise<void> {
  await api.delete(`/locations/${id}`);
}

export interface EncryptionKeyDto {
  id: string;
  deviceUniqueId: string | null;
  groupName: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export async function getEncryptionKeys(): Promise<EncryptionKeyDto[]> {
  const response = await api.get<EncryptionKeyDto[]>('/encryptionkeys');
  return response.data;
}

export async function createEncryptionKey(request: {
  deviceUniqueId?: string;
  groupName?: string;
  keyValue: string;
  description?: string;
}): Promise<EncryptionKeyDto> {
  const response = await api.post<EncryptionKeyDto>('/encryptionkeys', request);
  return response.data;
}

export async function updateEncryptionKey(id: string, request: {
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
