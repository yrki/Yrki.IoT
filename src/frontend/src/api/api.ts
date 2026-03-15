import axios from 'axios';
import { IDevice } from './models/IDevice';
import { IAuthResponse, ICurrentUser } from './models/IAuthResponse';
type Guid = string;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

let accessToken: string | null = null;

export const myApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

myApi.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  return config;
});

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export async function requestMagicLink(email: string): Promise<void> {
  await myApi.post('/auth/magic-link', { email });
}

export async function verifyMagicLink(token: string): Promise<IAuthResponse> {
  const response = await myApi.post<IAuthResponse>('/auth/verify', { token });
  return response.data;
}

export async function getCurrentUser(): Promise<ICurrentUser> {
  const response = await myApi.get<ICurrentUser>('/auth/me');
  return response.data;
}

export const getDevice = async (id: Guid) : Promise<IDevice> => {
  const response = await myApi.get(`/devices/${id}`);
  return response.data;
};
