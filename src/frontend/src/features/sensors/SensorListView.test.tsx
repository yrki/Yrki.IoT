import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import SensorListView from './SensorListView';

const { getDevices, deleteDevice, getLocations } = vi.hoisted(() => ({
  getDevices: vi.fn(),
  deleteDevice: vi.fn(),
  getLocations: vi.fn(),
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
  getLocations,
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
    class IntersectionObserverMock {
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
    }

    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);
    vi.restoreAllMocks();
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
    getLocations.mockResolvedValue([]);
  });

  it('Shall_search_sensors_by_unique_id', async () => {
    // Arrange
    const user = userEvent.setup();

    // Act
    render(
      <MemoryRouter>
        <SensorListView />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('CO2-2026-001')).toBeInTheDocument());
    await user.type(screen.getByPlaceholderText('Search sensors by name, uniqueId or location'), 'co22026001');

    // Assert
    expect(screen.getByText('CO2-2026-001')).toBeInTheDocument();
    expect(screen.queryByText('WATER_8841_11')).not.toBeInTheDocument();
  });

  it('Shall_render_sensor_activity_indicator_in_list', async () => {
    // Arrange
    // Act
    render(
      <MemoryRouter>
        <SensorListView />
      </MemoryRouter>,
    );

    // Assert
    await waitFor(() => expect(screen.getByText('CO2-2026-001')).toBeInTheDocument());
    expect(screen.getByTestId('sensor-activity-device-1')).toBeInTheDocument();
    expect(screen.getByTestId('sensor-activity-device-2')).toBeInTheDocument();
  });

  it('Shall_render_sensor_links_with_sensor_routes', async () => {
    // Act
    render(
      <MemoryRouter>
        <SensorListView />
      </MemoryRouter>,
    );

    // Assert
    await waitFor(() => expect(screen.getByText('CO2-2026-001')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'CO2-2026-001' })).toHaveAttribute('href', '/sensors/CO2-2026-001');
    expect(screen.getByRole('link', { name: 'Office sensor' })).toHaveAttribute('href', '/sensors/CO2-2026-001');
  });

  it('Shall_lazy_load_more_sensors_without_breaking_search_and_sorting', async () => {
    // Arrange
    const user = userEvent.setup();
    getDevices.mockResolvedValue(Array.from({ length: 101 }, (_, index) => ({
      id: `device-${index + 1}`,
      uniqueId: `SENSOR-${String(index + 1).padStart(4, '0')}`,
      name: `Sensor ${String(index + 1).padStart(4, '0')}`,
      manufacturer: index % 2 === 0 ? 'Acme' : 'MeterCo',
      type: index % 2 === 0 ? 'CarbonDioxide' : 'WaterMeter',
      locationName: `Location ${index + 1}`,
      locationId: `location-${index + 1}`,
      lastContact: `2026-03-30T${String(index % 24).padStart(2, '0')}:00:00.000Z`,
      installationDate: '2026-03-20T08:15:00.000Z',
    })));

    // Act
    render(
      <MemoryRouter>
        <SensorListView />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Showing 100 of 101 sensors')).toBeInTheDocument());
    await user.click(screen.getByText('Sensor ID'));

    // Assert
    expect(screen.getByText('SENSOR-0001')).toBeInTheDocument();
    expect(screen.queryByText('SENSOR-0101')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Load more' }));
    await waitFor(() => expect(screen.getByText('Showing 101 of 101 sensors')).toBeInTheDocument());
    expect(screen.getByText('SENSOR-0101')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search sensors by name, uniqueId or location'), { target: { value: 'sensor0101' } });

    await waitFor(() => expect(screen.getByText('Showing 1 of 1 sensor')).toBeInTheDocument());
    expect(screen.getByText('SENSOR-0101')).toBeInTheDocument();
    expect(screen.queryByText('SENSOR-0100')).not.toBeInTheDocument();
  });
});
