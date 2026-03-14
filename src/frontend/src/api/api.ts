import axios from 'axios';
import { IDevice } from './models/IDevice';
type Guid = string;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';


export const myApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});


export const getDevice = async (id: Guid) : Promise<IDevice> => {
  const response = await myApi.get(`/devices/${id}`);
  return response.data;
};
