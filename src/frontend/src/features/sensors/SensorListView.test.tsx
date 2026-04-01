import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SensorListView from './SensorListView';

const { getDevices, deleteDevice } = vi.hoisted(() => ({
  getDevices: vi.fn(),
  deleteDevice: vi.fn(),
}));

const signalRMocks = vi.hoisted(() => {
  const connection = {
    on: vi.fn(),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    state: 'Connected',
  };

  const builder = {
    withUrl: vi.fn().mockReturnThis(),
    withAutomaticReconnect: vi.fn().mockReturnThis(),
    configureLogging: vi.fn().mockReturnThis(),
    build: vi.fn(() => connection),
  };

  function HubConnectionBuilder() {
    return builder;
  }

  return {
    connection,
    builder,
    HubConnectionBuilder,
    HubConnectionState: { Disconnected: 'Disconnected' },
    LogLevel: { Warning: 2 },
  };
});

vi.mock('../../api/api', () => ({
  getDevices,
  deleteDevice,
}));

vi.mock('@microsoft/signalr', () => signalRMocks);

vi.mock('@mui/material', async () => {
  const actual = await vi.importActual<typeof import('@mui/material')>('@mui/material');
  return actual;
});

vi.mock('recharts', () => {
  const ResponsiveContainer = ({ children }: { children?: ReactNode }) => <div>{children}</div>;

  return {
    ResponsiveContainer,
  };
});

describe('SensorListView', () => {
  beforeEach(() => {
    getDevices.mockResolvedValue([
      {
        id: 'device-1',
        uniqueId: 'CO2-2026-001',
        name: 'Office sensor',
        manufacturer: 'Acme',
        type: 'CarbonDioxide',
        locationName: 'HQ',
        locationId: 'location-1',
        lastContact: '2026-03-30T09:00:00.000Z',
        installationDate: '2026-03-28T08:15:00.000Z',
      },
      {
        id: 'device-2',
        uniqueId: 'WATER_8841_11',
        name: 'Water meter',
        manufacturer: 'MeterCo',
        type: 'WaterMeter',
        locationName: 'Warehouse',
        locationId: 'location-2',
        lastContact: '2026-03-30T08:00:00.000Z',
        installationDate: '2026-03-20T08:15:00.000Z',
      },
    ]);
    deleteDevice.mockResolvedValue(undefined);
  });

  it('Shall_search_sensors_by_unique_id', async () => {
    // Arrange
    const user = userEvent.setup();
    const onNavigateToLiveView = vi.fn();

    // Act
    render(<SensorListView onNavigateToLiveView={onNavigateToLiveView} />);

    await waitFor(() => expect(screen.getByText('CO2-2026-001')).toBeInTheDocument());
    await user.type(screen.getByPlaceholderText('Search sensors by name, uniqueId or location'), 'co22026001');

    // Assert
    expect(screen.getByText('CO2-2026-001')).toBeInTheDocument();
    expect(screen.queryByText('WATER_8841_11')).not.toBeInTheDocument();
  });

  it('Shall_render_sensor_activity_indicator_in_list', async () => {
    // Arrange
    const onNavigateToLiveView = vi.fn();

    // Act
    render(<SensorListView onNavigateToLiveView={onNavigateToLiveView} />);

    // Assert
    await waitFor(() => expect(screen.getByText('CO2-2026-001')).toBeInTheDocument());
    expect(screen.getByTestId('sensor-activity-device-1')).toBeInTheDocument();
    expect(screen.getByTestId('sensor-activity-device-2')).toBeInTheDocument();
  });
});
