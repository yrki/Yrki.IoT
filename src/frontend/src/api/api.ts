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

export async function getRecentReadings(hours = 3): Promise<SensorReadingDto[]> {
  const response = await api.get<SensorReadingDto[]>('/sensorreadings/recent', {
    params: { hours },
  });
  return response.data;
}

export async function getLatestReadings(): Promise<SensorReadingDto[]> {
  const response = await api.get<SensorReadingDto[]>('/sensorreadings/latest');
  return response.data;
}
