import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SensorsView from './SensorsView';

const { getDevices, getDeviceByUniqueId, getDevicesByLocation, getLocations, createLocation, updateExistingDevice, useSensorHub } = vi.hoisted(() => ({
  getDevices: vi.fn(),
  getDeviceByUniqueId: vi.fn(),
  getDevicesByLocation: vi.fn(),
  getLocations: vi.fn(),
  createLocation: vi.fn(),
  updateExistingDevice: vi.fn(),
  useSensorHub: vi.fn(),
}));

vi.mock('../../api/api', () => ({
  getDevices,
  getDeviceByUniqueId,
  getDevicesByLocation,
  getLocations,
  createLocation,
  updateExistingDevice,
}));

vi.mock('./useSensorHub', () => ({
  useSensorHub,
}));

vi.mock('recharts', () => {
  const ResponsiveContainer = ({ children }: { children?: ReactNode }) => <div>{children}</div>;

  return {
    ResponsiveContainer,
    AreaChart: () => <div data-testid="mock-area-chart" />,
    Area: () => <div data-testid="area-chart-series" />,
    XAxis: () => <div />,
    YAxis: () => <div />,
    Tooltip: () => <div />,
  };
});

describe('SensorsView', () => {
  beforeEach(() => {
    const sameLocationDevices = [
      {
        id: 'device-1',
        uniqueId: 'sensor-1',
        name: 'Office sensor',
        locationName: 'HQ',
        locationId: 'location-1',
        lastContact: '2026-03-30T09:00:00.000Z',
        installationDate: '2026-03-28T08:15:00.000Z',
      },
      {
        id: 'device-2',
        uniqueId: 'sensor-2',
        name: 'Lobby sensor',
        locationName: 'HQ',
        locationId: 'location-1',
        lastContact: '2026-03-30T08:30:00.000Z',
        installationDate: '2026-03-27T10:15:00.000Z',
      },
    ];

    getDevices.mockResolvedValue([
      ...sameLocationDevices,
      {
        id: 'device-3',
        uniqueId: 'sensor-3',
        name: 'Warehouse sensor',
        locationName: 'Warehouse',
        locationId: 'location-2',
        lastContact: '2026-03-30T08:00:00.000Z',
        installationDate: '2026-03-26T08:15:00.000Z',
      },
    ]);
    getDevicesByLocation.mockResolvedValue(sameLocationDevices);
    getDeviceByUniqueId.mockResolvedValue(sameLocationDevices[0]);
    getLocations.mockResolvedValue([
      { id: 'location-1', name: 'HQ', description: 'Office', deviceCount: 1 },
    ]);
    createLocation.mockResolvedValue(undefined);
    updateExistingDevice.mockResolvedValue(undefined);

    getDevicesByLocation.mockClear();
    useSensorHub.mockImplementation((_sensorId: string, hours: number, enabled = true) => {
      if (!enabled) {
        return { readings: {}, history: {}, connected: false, loaded: true };
      }

      if (hours === 12) {
        return {
          readings: {
            Temperature: {
              sensorId: 'sensor-1',
              sensorType: 'Temperature',
              value: 24.1,
              timestamp: '2026-03-30T10:00:00.000Z',
            },
          },
          history: {
            Temperature: [
              { time: 1, value: 20 },
              { time: 2, value: 24 },
              { time: 3, value: 28 },
            ],
          },
          connected: true,
          loaded: true,
        };
      }

      return {
        readings: {
          Temperature: {
            sensorId: 'sensor-1',
            sensorType: 'Temperature',
            value: 22.4,
            timestamp: '2026-03-30T09:00:00.000Z',
          },
        },
        history: {
          Temperature: [
            { time: 1, value: 18 },
            { time: 2, value: 22 },
            { time: 3, value: 26 },
          ],
        },
        connected: true,
        loaded: true,
      };
    });
  });

  it('Shall_open_fullscreen_sensor_view_with_statistics_and_independent_time_range', async () => {
    // Arrange
    const user = userEvent.setup();

    // Act
    render(<SensorsView initialSensorId="sensor-1" />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Office sensor' })).toBeInTheDocument());
    expect(screen.getByText(/First reading:/)).toBeInTheDocument();
    expect(screen.getByText(/Last reading:/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open Temperature in fullscreen' }));

    // Assert
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Office sensor' })).toBeInTheDocument();
    expect(within(dialog).getByText('Temperature - HQ')).toBeInTheDocument();
    expect(within(dialog).getByText(/First reading:/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Last reading:/)).toBeInTheDocument();
    expect(within(dialog).getByText('Lowest')).toBeInTheDocument();
    expect(within(dialog).getByText('Highest')).toBeInTheDocument();
    expect(within(dialog).getByText('Median')).toBeInTheDocument();
    expect(within(dialog).getByText('Average')).toBeInTheDocument();
    expect(within(dialog).getByText('18.0 °C')).toBeInTheDocument();
    expect(within(dialog).getAllByText('22.0 °C')).toHaveLength(2);

    await user.click(within(dialog).getByRole('button', { name: '12h' }));

    await waitFor(() => {
      expect(useSensorHub).toHaveBeenCalledWith('sensor-1', 12, true);
    });
    expect(within(dialog).getByText('20.0 °C')).toBeInTheDocument();
    expect(within(dialog).getAllByText('24.0 °C')).toHaveLength(2);
  });

  it('Shall_update_sensor_location_from_live_view', async () => {
    // Arrange
    const user = userEvent.setup();
    getLocations.mockResolvedValue([
      { id: 'location-1', name: 'HQ', description: 'Office', deviceCount: 1 },
      { id: 'location-2', name: 'Lab', description: 'Lab', deviceCount: 1 },
    ]);
    updateExistingDevice.mockResolvedValue({
      id: 'device-1',
      uniqueId: 'sensor-1',
      name: 'Office sensor',
      manufacturer: 'Acme',
      type: 'CarbonDioxide',
      description: 'Tracks CO2',
      locationId: 'location-2',
      lastContact: '2026-03-30T09:00:00.000Z',
      installationDate: '2026-03-28T08:15:00.000Z',
    });

    // Act
    render(<SensorsView initialSensorId="sensor-1" />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit location' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Edit location' }));
    const dialog = await screen.findByRole('dialog', { name: 'Update Sensor Location' });
    await user.click(within(dialog).getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Lab' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    // Assert
    await waitFor(() => {
      expect(updateExistingDevice).toHaveBeenCalledWith('device-1', {
        name: 'Office sensor',
        description: undefined,
        locationId: 'location-2',
      });
    });
    expect(await screen.findByText('Lab')).toBeInTheDocument();
  });

  it('Shall_only_show_devices_from_same_location_in_device_dropdown', async () => {
    // Arrange
    const user = userEvent.setup();

    // Act
    render(<SensorsView initialSensorId="sensor-1" />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Office sensor' })).toBeInTheDocument());
    expect(getDeviceByUniqueId).toHaveBeenCalledWith('sensor-1');
    expect(getDevicesByLocation).toHaveBeenCalledWith('location-1');
    await user.click(screen.getAllByRole('combobox')[0]);

    // Assert
    expect(await screen.findByRole('option', { name: 'Office sensor' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Lobby sensor' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Warehouse sensor' })).not.toBeInTheDocument();
  });

  it('Shall_fallback_to_selected_device_when_same_location_request_returns_empty', async () => {
    // Arrange
    getDevicesByLocation.mockResolvedValue([]);

    // Act
    render(<SensorsView initialSensorId="sensor-1" />);

    // Assert
    await waitFor(() => expect(getDeviceByUniqueId).toHaveBeenCalledWith('sensor-1'));
    expect(getDevices).toHaveBeenCalled();
    expect(await screen.findByRole('heading', { name: 'Office sensor' })).toBeInTheDocument();
    expect(screen.getByText('HQ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit location' })).toBeInTheDocument();
  });
});
