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

const sensorFixtures = [
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
];

describe('LocationsView', () => {
  beforeEach(() => {
    getLocations.mockResolvedValue([
      { id: 'location-1', name: 'HQ', description: 'Office', deviceCount: 2, parentLocationId: null },
      { id: 'location-2', name: 'Warehouse', description: 'Storage', deviceCount: 0, parentLocationId: null },
    ]);
    getDevicesByLocation.mockResolvedValue(sensorFixtures);
    getDevices.mockResolvedValue(sensorFixtures);
    createLocation.mockResolvedValue(undefined);
    updateLocation.mockResolvedValue(undefined);
    deleteLocation.mockResolvedValue(undefined);
  });

  it('Shall_expand_location_and_show_sensor_table', async () => {
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
    await waitFor(() => expect(screen.getByText('Office sensor')).toBeInTheDocument());
    expect(screen.getByText('Lobby sensor')).toBeInTheDocument();
    expect(screen.getByText('CarbonDioxide')).toBeInTheDocument();
    expect(screen.getByText('Temperature')).toBeInTheDocument();
  });

  it('Shall_click_sensor_row_to_navigate', async () => {
    // Arrange
    const user = userEvent.setup();
    const onNavigateToSensor = vi.fn();

    // Act
    render(
      <LocationsView
        onNavigateToLiveView={vi.fn()}
        onNavigateToSensor={onNavigateToSensor}
      />,
    );

    await waitFor(() => expect(screen.getByText('HQ')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Expand HQ' }));
    await waitFor(() => expect(screen.getByText('Lobby sensor')).toBeInTheDocument());
    await user.click(screen.getByText('Lobby sensor'));

    // Assert
    expect(onNavigateToSensor).toHaveBeenCalledWith('sensor-2');
  });

  it('Shall_render_child_locations_nested_under_parent', async () => {
    // Arrange
    getLocations.mockResolvedValue([
      { id: 'loc-building', name: 'Building A', description: 'Main building', deviceCount: 0, parentLocationId: null },
      { id: 'loc-floor1', name: 'Floor 1', description: 'First floor', deviceCount: 1, parentLocationId: 'loc-building' },
      { id: 'loc-floor2', name: 'Floor 2', description: 'Second floor', deviceCount: 0, parentLocationId: 'loc-building' },
    ]);
    const user = userEvent.setup();

    // Act
    render(
      <LocationsView
        onNavigateToLiveView={vi.fn()}
        onNavigateToSensor={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText('Building A')).toBeInTheDocument());

    // Children should not be visible before expanding
    expect(screen.queryByText('Floor 1')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Expand Building A' }));

    // Assert — children now visible
    expect(screen.getByText('Floor 1')).toBeInTheDocument();
    expect(screen.getByText('Floor 2')).toBeInTheDocument();
  });

  it('Shall_show_parent_location_select_in_create_dialog', async () => {
    // Arrange
    const user = userEvent.setup();

    // Act
    render(
      <LocationsView
        onNavigateToLiveView={vi.fn()}
        onNavigateToSensor={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText('HQ')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Add location' }));

    // Assert
    expect(screen.getByLabelText('Parent location')).toBeInTheDocument();
  });
});
