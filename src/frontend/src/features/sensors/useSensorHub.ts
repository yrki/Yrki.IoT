import { useEffect, useRef, useState } from 'react';
import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';

const HUB_URL = import.meta.env.VITE_SIGNALR_URL ?? '/hubs/sensors';

export interface SensorReading {
  sensorId: string;
  sensorType: string;
  value: number;
  timestamp: string;
}

export type SensorValues = Record<string, SensorReading>;

export function useSensorHub() {
  const [readings, setReadings] = useState<SensorValues>({});
  const [connected, setConnected] = useState(false);
  const connectionRef = useRef<ReturnType<typeof buildConnection> | null>(null);

  useEffect(() => {
    const connection = buildConnection();
    connectionRef.current = connection;

    connection.on('SensorReadingReceived', (reading: SensorReading) => {
      setReadings((prev) => ({
        ...prev,
        [reading.sensorType]: reading,
      }));
    });

    connection.onclose(() => setConnected(false));
    connection.onreconnected(() => setConnected(true));

    connection
      .start()
      .then(() => setConnected(true))
      .catch((err) => console.error('SignalR connect failed:', err));

    return () => {
      if (connection.state !== HubConnectionState.Disconnected) {
        connection.stop();
      }
    };
  }, []);

  return { readings, connected };
}

function buildConnection() {
  return new HubConnectionBuilder()
    .withUrl(HUB_URL)
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Information)
    .build();
}
