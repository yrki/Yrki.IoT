import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LocationsView from './LocationsView';

const { getLocations, getDevices, getDevicesByLocation, createLocation, updateLocation, deleteLocation } = vi.hoisted(() => ({
  getLocations: vi.fn(),
  getDevices: vi.fn(),
  getDevicesByLocation: vi.fn(),
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
  deleteLocation: vi.fn(),
}));

vi.mock('../../api/api', () => ({
  getLocations,
  getDevices,
  getDevicesByLocation,
  createLocation,
  updateLocation,
  deleteLocation,
}));

describe('LocationsView', () => {
  beforeEach(() => {
    getLocations.mockResolvedValue([
      { id: 'location-1', name: 'HQ', description: 'Office', deviceCount: 2 },
      { id: 'location-2', name: 'Warehouse', description: 'Storage', deviceCount: 0 },
    ]);
    getDevicesByLocation.mockResolvedValue([
      {
        id: 'device-1',
        uniqueId: 'sensor-1',
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
        uniqueId: 'sensor-2',
        name: 'Lobby sensor',
        manufacturer: 'Acme',
        type: 'Temperature',
        locationName: 'HQ',
        locationId: 'location-1',
        lastContact: '2026-03-30T08:30:00.000Z',
        installationDate: '2026-03-27T08:15:00.000Z',
      },
    ]);
    getDevices.mockResolvedValue([
      {
        id: 'device-1',
        uniqueId: 'sensor-1',
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
        uniqueId: 'sensor-2',
        name: 'Lobby sensor',
        manufacturer: 'Acme',
        type: 'Temperature',
        locationName: 'HQ',
        locationId: 'location-1',
        lastContact: '2026-03-30T08:30:00.000Z',
        installationDate: '2026-03-27T08:15:00.000Z',
      },
    ]);
    createLocation.mockResolvedValue(undefined);
    updateLocation.mockResolvedValue(undefined);
    deleteLocation.mockResolvedValue(undefined);
  });

  it('Shall_expand_location_and_navigate_directly_to_sensor', async () => {
    // Arrange
    const user = userEvent.setup();
    const onNavigateToLiveView = vi.fn();
    const onNavigateToSensor = vi.fn();

    // Act
    render(
      <LocationsView
        onNavigateToLiveView={onNavigateToLiveView}
        onNavigateToSensor={onNavigateToSensor}
      />,
    );

    await waitFor(() => expect(screen.getByText('HQ')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Expand HQ' }));

    // Assert
    expect(getDevicesByLocation).toHaveBeenCalledWith('location-1');
    const details = await screen.findByText('Sensors at this location');
    const container = details.closest('td');
    expect(container).not.toBeNull();
    expect(within(container as HTMLElement).getByRole('button', { name: 'Office sensor' })).toBeInTheDocument();

    await user.click(within(container as HTMLElement).getByRole('button', { name: 'Lobby sensor' }));
    expect(onNavigateToSensor).toHaveBeenCalledWith('sensor-2');
  });
});
