import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SensorsView from './SensorsView';

const { getDevices, getDevicesByLocation, useSensorHub } = vi.hoisted(() => ({
  getDevices: vi.fn(),
  getDevicesByLocation: vi.fn(),
  useSensorHub: vi.fn(),
}));

vi.mock('../../api/api', () => ({
  getDevices,
  getDevicesByLocation,
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
    getDevices.mockResolvedValue([
      {
        id: 'device-1',
        uniqueId: 'sensor-1',
        name: 'Office sensor',
        locationName: 'HQ',
      },
    ]);

    getDevicesByLocation.mockReset();
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
    await user.click(screen.getByRole('button', { name: 'Open Temperature in fullscreen' }));

    // Assert
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Office sensor' })).toBeInTheDocument();
    expect(within(dialog).getByText('Temperature - HQ')).toBeInTheDocument();
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
});
