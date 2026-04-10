import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SensorsView from './SensorsView';

const {
  getDevices,
  getDeviceByUniqueId,
  getDevicesByLocation,
  getLocations,
  getSensorGateways,
  updateExistingDevice,
  getEncryptionKeyByDevice,
  updateEncryptionKey,
  createEncryptionKey,
  useSensorHub,
} = vi.hoisted(() => ({
  getDevices: vi.fn(),
  getDeviceByUniqueId: vi.fn(),
  getDevicesByLocation: vi.fn(),
  getLocations: vi.fn(),
  getSensorGateways: vi.fn(),
  updateExistingDevice: vi.fn(),
  getEncryptionKeyByDevice: vi.fn(),
  updateEncryptionKey: vi.fn(),
  createEncryptionKey: vi.fn(),
  useSensorHub: vi.fn(),
}));

vi.mock('../../api/api', () => ({
  getDevices,
  getDeviceByUniqueId,
  getDevicesByLocation,
  getLocations,
  getSensorGateways,
  updateExistingDevice,
  getEncryptionKeyByDevice,
  updateEncryptionKey,
  createEncryptionKey,
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
    getSensorGateways.mockResolvedValue([
      {
        gatewayId: 'gw-1',
        readingCount: 3,
        averageRssi: -77.5,
        lastSeenAt: '2026-03-30T09:00:00.000Z',
      },
    ]);
    updateExistingDevice.mockResolvedValue(undefined);
    getEncryptionKeyByDevice.mockResolvedValue(null);
    updateEncryptionKey.mockResolvedValue(undefined);
    createEncryptionKey.mockResolvedValue(undefined);

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
          RSSI: {
            sensorId: 'sensor-1',
            sensorType: 'RSSI',
            value: -72,
            timestamp: '2026-03-30T09:00:00.000Z',
          },
        },
        history: {
          Temperature: [
            { time: 1, value: 18 },
            { time: 2, value: 22 },
            { time: 3, value: 26 },
          ],
          RSSI: [
            { time: 1, value: -75 },
            { time: 2, value: -73 },
            { time: 3, value: -72 },
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

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Office sensor (sensor-1)' })).toBeInTheDocument());
    expect(screen.getByText('Gateways')).toBeInTheDocument();
    expect(screen.getByText('gw-1')).toBeInTheDocument();
    expect(screen.getByText('Avg RSSI: -77.5')).toBeInTheDocument();
    expect(screen.getByText('Signal strength')).toBeInTheDocument();
    expect(screen.getByText('-72')).toBeInTheDocument();
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
    expect(within(dialog).getByText('18.00 °C')).toBeInTheDocument();
    expect(within(dialog).getAllByText('22.00 °C')).toHaveLength(2);

    await user.click(within(dialog).getByRole('button', { name: '12h' }));

    await waitFor(() => {
      expect(useSensorHub).toHaveBeenCalledWith('sensor-1', 12, true);
    });
    expect(within(dialog).getByText('20.00 °C')).toBeInTheDocument();
    expect(within(dialog).getAllByText('24.00 °C')).toHaveLength(2);
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

  it('Shall_open_sensor_settings_and_update_name_and_encryption_key', async () => {
    // Arrange
    const user = userEvent.setup();
    getLocations.mockResolvedValue([
      { id: 'location-1', name: 'HQ', description: 'Office', deviceCount: 1 },
      { id: 'location-2', name: 'Lab', description: 'Lab', deviceCount: 1 },
    ]);
    getEncryptionKeyByDevice.mockResolvedValue({
      id: 'key-1',
      manufacturer: 'Acme',
      deviceUniqueId: 'sensor-1',
      groupName: null,
      description: 'Old key',
      keyValue: 'FFEEDDCCBBAA99887766554433221100',
      createdAt: '2026-03-30T09:00:00.000Z',
      updatedAt: '2026-03-30T09:05:00.000Z',
    });
    updateExistingDevice.mockResolvedValue({
      id: 'device-1',
      uniqueId: 'sensor-1',
      name: 'Updated sensor',
      manufacturer: 'Acme',
      type: 'CarbonDioxide',
      description: 'Tracks CO2',
      locationId: 'location-2',
      lastContact: '2026-03-30T09:00:00.000Z',
      installationDate: '2026-03-28T08:15:00.000Z',
      latitude: null,
      longitude: null,
    });
    updateEncryptionKey.mockResolvedValue({
      id: 'key-1',
      manufacturer: 'Acme',
      deviceUniqueId: 'sensor-1',
      groupName: null,
      description: 'Old key',
      keyValue: '00112233445566778899AABBCCDDEEFF',
      createdAt: '2026-03-30T09:00:00.000Z',
      updatedAt: '2026-03-30T10:00:00.000Z',
    });

    // Act
    render(<SensorsView initialSensorId="sensor-1" />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit sensor settings' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Edit sensor settings' }));

    const dialog = await screen.findByRole('dialog', { name: 'Edit Sensor' });
    await waitFor(() => expect(getEncryptionKeyByDevice).toHaveBeenCalledWith('sensor-1', undefined));

    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Updated sensor' } });
    await user.click(within(dialog).getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Lab' }));
    fireEvent.change(within(dialog).getByLabelText('Encryption Key (AES-128 hex)'), { target: { value: '00112233445566778899AABBCCDDEEFF' } });
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    // Assert
    await waitFor(() => {
      expect(updateExistingDevice).toHaveBeenCalledWith('device-1', {
        name: 'Updated sensor',
        description: undefined,
        locationId: 'location-2',
        latitude: null,
        longitude: null,
      });
    });
    expect(updateEncryptionKey).toHaveBeenCalledWith('key-1', {
      manufacturer: undefined,
      deviceUniqueId: 'sensor-1',
      keyValue: '00112233445566778899AABBCCDDEEFF',
    });
    expect(await screen.findByRole('heading', { name: 'Updated sensor (sensor-1)' })).toBeInTheDocument();
  });

  it('Shall_only_show_devices_from_same_location_in_device_dropdown', async () => {
    // Arrange
    const user = userEvent.setup();

    // Act
    render(<SensorsView initialSensorId="sensor-1" />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Office sensor (sensor-1)' })).toBeInTheDocument());
    expect(getDeviceByUniqueId).toHaveBeenCalledWith('sensor-1');
    expect(getDevicesByLocation).toHaveBeenCalledWith('location-1');
    await user.click(screen.getAllByRole('combobox')[0]);

    // Assert
    expect(await screen.findByRole('option', { name: 'Office sensor' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Lobby sensor' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Warehouse sensor' })).not.toBeInTheDocument();
  });

  it('Shall_render_axioma_measurements_with_labels_for_cards_and_graphs', async () => {
    // Arrange
    useSensorHub.mockReturnValue({
      readings: {
        TotalVolume: {
          sensorId: 'sensor-1',
          sensorType: 'TotalVolume',
          value: 123.4,
          timestamp: '2026-03-30T09:00:00.000Z',
        },
        AlarmCode: {
          sensorId: 'sensor-1',
          sensorType: 'AlarmCode',
          value: 5,
          timestamp: '2026-03-30T09:00:00.000Z',
        },
        HasAlarm: {
          sensorId: 'sensor-1',
          sensorType: 'HasAlarm',
          value: 1,
          timestamp: '2026-03-30T09:00:00.000Z',
        },
      },
      history: {
        TotalVolume: [
          { time: 1, value: 120.1 },
          { time: 2, value: 123.4 },
        ],
        AlarmCode: [
          { time: 1, value: 0 },
          { time: 2, value: 5 },
        ],
        HasAlarm: [
          { time: 1, value: 0 },
          { time: 2, value: 1 },
        ],
      },
      connected: true,
      loaded: true,
    });

    // Act
    render(<SensorsView initialSensorId="sensor-1" />);

    // Assert
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Office sensor (sensor-1)' })).toBeInTheDocument());
    expect(screen.getByText('Total volume')).toBeInTheDocument();
    expect(screen.getByText('Alarm code')).toBeInTheDocument();
    expect(screen.getByText('Alarm active')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Total volume in fullscreen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Alarm code in fullscreen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Alarm active in fullscreen' })).toBeInTheDocument();
  });

  it('Shall_fallback_to_selected_device_when_same_location_request_returns_empty', async () => {
    // Arrange
    getDevicesByLocation.mockResolvedValue([]);

    // Act
    render(<SensorsView initialSensorId="sensor-1" />);

    // Assert
    await waitFor(() => expect(getDeviceByUniqueId).toHaveBeenCalledWith('sensor-1'));
    expect(getDevices).toHaveBeenCalled();
    expect(await screen.findByRole('heading', { name: 'Office sensor (sensor-1)' })).toBeInTheDocument();
    expect(screen.getByText('HQ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit location' })).toBeInTheDocument();
  });
});
