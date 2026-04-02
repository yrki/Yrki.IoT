import { useCallback, useEffect, useRef, useState } from 'react';
import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { getRecentReadings, getLatestReadings, SensorReadingDto } from '../../api/api';

const HUB_URL = import.meta.env.VITE_SIGNALR_URL ?? '/hubs/sensors';

export interface SensorReading {
  sensorId: string;
  sensorType: string;
  value: number;
  timestamp: string;
  gatewayId?: string | null;
  rssi?: number | null;
}

export interface SensorDataPoint {
  time: number;
  value: number;
}

export type SensorValues = Record<string, SensorReading>;
export type SensorHistory = Record<string, SensorDataPoint[]>;

const rssiSensorType = 'RSSI';

function toDataPoint(r: SensorReadingDto): SensorDataPoint {
  return { time: new Date(r.timestamp).getTime(), value: r.value };
}

export function useSensorHub(sensorId: string, hours: number, enabled = true) {
  const [readings, setReadings] = useState<SensorValues>({});
  const [history, setHistory] = useState<SensorHistory>({});
  const [connected, setConnected] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const connectionRef = useRef<ReturnType<typeof buildConnection> | null>(null);

  const handleReading = useCallback((reading: SensorReading) => {
    if (reading.sensorId !== sensorId) return;

    const time = new Date(reading.timestamp).getTime();
    const cutoff = Date.now() - hours * 60 * 60 * 1000;

    setReadings((prev) => {
      const next = {
        ...prev,
        [reading.sensorType]: reading,
      };

      if (reading.rssi !== null && reading.rssi !== undefined) {
        next[rssiSensorType] = {
          sensorId: reading.sensorId,
          sensorType: rssiSensorType,
          value: reading.rssi,
          timestamp: reading.timestamp,
          gatewayId: reading.gatewayId,
          rssi: reading.rssi,
        };
      }

      return next;
    });

    setHistory((prev) => {
      const existing = prev[reading.sensorType] ?? [];
      const updated = [...existing, { time, value: reading.value }].filter((p) => p.time >= cutoff);
      const next = { ...prev, [reading.sensorType]: updated };

      if (reading.rssi !== null && reading.rssi !== undefined) {
        const existingRssi = prev[rssiSensorType] ?? [];
        next[rssiSensorType] = [...existingRssi, { time, value: reading.rssi }].filter((p) => p.time >= cutoff);
      }

      return next;
    });
  }, [sensorId, hours]);

  // Fetch historical data from API when sensorId or hours changes
  useEffect(() => {
    if (!enabled || !sensorId) return;
    let cancelled = false;

    async function fetchData() {
      setLoaded(false);
      setReadings({});
      setHistory({});

      const [recentResult, latestResult] = await Promise.allSettled([
        getRecentReadings(sensorId, hours),
        getLatestReadings(sensorId),
      ]);

      if (cancelled) return;

      if (recentResult.status === 'fulfilled') {
        const historyMap: SensorHistory = {};
        for (const r of recentResult.value) {
          const arr = historyMap[r.sensorType] ?? [];
          arr.push(toDataPoint(r));
          historyMap[r.sensorType] = arr;

          if (r.rssi !== null && r.rssi !== undefined) {
            const rssiHistory = historyMap[rssiSensorType] ?? [];
            rssiHistory.push({ time: new Date(r.timestamp).getTime(), value: r.rssi });
            historyMap[rssiSensorType] = rssiHistory;
          }
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
            gatewayId: r.gatewayId,
            rssi: r.rssi,
          };

          if (r.rssi !== null && r.rssi !== undefined) {
            latestMap[rssiSensorType] = {
              sensorId: r.sensorId,
              sensorType: rssiSensorType,
              value: r.rssi,
              timestamp: r.timestamp,
              gatewayId: r.gatewayId,
              rssi: r.rssi,
            };
          }
        }
        setReadings(latestMap);
      } else {
        console.error('Failed to fetch latest readings:', latestResult.reason);
      }

      setLoaded(true);
    }

    fetchData();
    return () => { cancelled = true; };
  }, [sensorId, hours, enabled]);

  // Connect to SignalR for live updates
  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      return;
    }

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
  }, [enabled, handleReading]);

  return { readings, history, connected, loaded };
}

function buildConnection() {
  return new HubConnectionBuilder()
    .withUrl(HUB_URL)
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Information)
    .build();
}
