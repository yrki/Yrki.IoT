import { useCallback, useEffect, useRef, useState } from 'react';
import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { getRecentReadings, getLatestReadings, SensorReadingDto } from '../../api/api';

const HUB_URL = import.meta.env.VITE_SIGNALR_URL ?? '/hubs/sensors';

export interface SensorReading {
  sensorId: string;
  sensorType: string;
  value: number;
  timestamp: string;
}

export interface SensorDataPoint {
  time: number;
  value: number;
}

export type SensorValues = Record<string, SensorReading>;
export type SensorHistory = Record<string, SensorDataPoint[]>;

function toDataPoint(r: SensorReadingDto): SensorDataPoint {
  return { time: new Date(r.timestamp).getTime(), value: r.value };
}

export function useSensorHub(hours: number) {
  const [readings, setReadings] = useState<SensorValues>({});
  const [history, setHistory] = useState<SensorHistory>({});
  const [connected, setConnected] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const connectionRef = useRef<ReturnType<typeof buildConnection> | null>(null);

  const handleReading = useCallback((reading: SensorReading) => {
    const time = new Date(reading.timestamp).getTime();
    const cutoff = Date.now() - hours * 60 * 60 * 1000;

    setReadings((prev) => ({
      ...prev,
      [reading.sensorType]: reading,
    }));

    setHistory((prev) => {
      const existing = prev[reading.sensorType] ?? [];
      const updated = [...existing, { time, value: reading.value }]
        .filter((p) => p.time >= cutoff);
      return { ...prev, [reading.sensorType]: updated };
    });
  }, [hours]);

  // Fetch historical data from API when hours changes
  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoaded(false);

      const [recentResult, latestResult] = await Promise.allSettled([
        getRecentReadings(hours),
        getLatestReadings(),
      ]);

      if (cancelled) return;

      if (recentResult.status === 'fulfilled') {
        const historyMap: SensorHistory = {};
        for (const r of recentResult.value) {
          const arr = historyMap[r.sensorType] ?? [];
          arr.push(toDataPoint(r));
          historyMap[r.sensorType] = arr;
        }
        setHistory(historyMap);
      } else {
        console.error('Failed to fetch recent readings:', recentResult.reason);
      }

      if (latestResult.status === 'fulfilled') {
        const latestMap: SensorValues = {};
        for (const r of latestResult.value) {
          latestMap[r.sensorType] = {
            sensorId: r.sensorId,
            sensorType: r.sensorType,
            value: r.value,
            timestamp: r.timestamp,
          };
        }
        setReadings(latestMap);
      } else {
        console.error('Failed to fetch latest readings:', latestResult.reason);
      }

      setLoaded(true);
    }

    fetchData();
    return () => { cancelled = true; };
  }, [hours]);

  // Connect to SignalR for live updates
  useEffect(() => {
    const connection = buildConnection();
    connectionRef.current = connection;

    connection.on('SensorReadingReceived', handleReading);
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
  }, [handleReading]);

  return { readings, history, connected, loaded };
}

function buildConnection() {
  return new HubConnectionBuilder()
    .withUrl(HUB_URL)
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Information)
    .build();
}
