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

  it('Shall_render_locations_alphabetically_on_all_levels', async () => {
    // Arrange
    getLocations.mockResolvedValue([
      { id: 'loc-c', name: 'Corge', description: 'Third root', deviceCount: 0, parentLocationId: null },
      { id: 'loc-a', name: 'Alpha', description: 'First root', deviceCount: 0, parentLocationId: null },
      { id: 'loc-b', name: 'Bravo', description: 'Second root', deviceCount: 0, parentLocationId: null },
      { id: 'loc-a-zulu', name: 'Zulu', description: 'Second child', deviceCount: 0, parentLocationId: 'loc-a' },
      { id: 'loc-a-delta', name: 'Delta', description: 'First child', deviceCount: 0, parentLocationId: 'loc-a' },
    ]);
    const user = userEvent.setup();

    // Act
    render(
      <LocationsView
        onNavigateToLiveView={vi.fn()}
        onNavigateToSensor={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());

    // Assert
    expect(screen.getByText('Alpha').compareDocumentPosition(screen.getByText('Bravo'))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByText('Bravo').compareDocumentPosition(screen.getByText('Corge'))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    await user.click(screen.getByRole('button', { name: 'Expand Alpha' }));

    expect(screen.getByText('Delta').compareDocumentPosition(screen.getByText('Zulu'))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('Shall_render_locations_with_norwegian_alphabetical_order', async () => {
    // Arrange
    getLocations.mockResolvedValue([
      { id: 'loc-aa', name: 'Ålesund', description: 'Alesund', deviceCount: 0, parentLocationId: null },
      { id: 'loc-oslo', name: 'Oslo', description: 'Oslo', deviceCount: 0, parentLocationId: null },
      { id: 'loc-aeroskobing', name: 'Ærøskøbing', description: 'Aeroskobing', deviceCount: 0, parentLocationId: null },
      { id: 'loc-oerje', name: 'Ørje', description: 'Orje', deviceCount: 0, parentLocationId: null },
    ]);

    // Act
    render(
      <LocationsView
        onNavigateToLiveView={vi.fn()}
        onNavigateToSensor={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Expand Oslo' })).toBeInTheDocument());

    // Assert
    expect(screen.getByRole('button', { name: 'Expand Oslo' }).compareDocumentPosition(screen.getByRole('button', { name: 'Expand Ærøskøbing' }))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByRole('button', { name: 'Expand Ærøskøbing' }).compareDocumentPosition(screen.getByRole('button', { name: 'Expand Ørje' }))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByRole('button', { name: 'Expand Ørje' }).compareDocumentPosition(screen.getByRole('button', { name: 'Expand Ålesund' }))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('Shall_show_sensors_for_parent_and_child_locations_in_the_tree', async () => {
    // Arrange
    getLocations.mockResolvedValue([
      { id: 'loc-asker', name: 'Asker Kommune', description: 'Municipality', deviceCount: 0, parentLocationId: null },
      { id: 'loc-hurum', name: 'Hurum', description: 'District', deviceCount: 1, parentLocationId: 'loc-asker' },
      { id: 'loc-saetre', name: 'Sætre', description: 'Village', deviceCount: 1, parentLocationId: 'loc-hurum' },
    ]);
    getDevicesByLocation.mockImplementation(async (locationId: string) => {
      if (locationId === 'loc-hurum') {
        return [{
          id: 'device-hurum',
          uniqueId: 'sensor-hurum',
          name: 'Hurum sensor',
          manufacturer: 'Acme',
          type: 'Temperature',
          locationName: 'Hurum',
          locationId: 'loc-hurum',
          lastContact: '2026-03-30T09:00:00.000Z',
          installationDate: '2026-03-28T08:15:00.000Z',
        }];
      }

      if (locationId === 'loc-saetre') {
        return [{
          id: 'device-saetre',
          uniqueId: 'sensor-saetre',
          name: 'Sætre sensor',
          manufacturer: 'Acme',
          type: 'CarbonDioxide',
          locationName: 'Sætre',
          locationId: 'loc-saetre',
          lastContact: '2026-03-30T08:30:00.000Z',
          installationDate: '2026-03-27T08:15:00.000Z',
        }];
      }

      return [];
    });
    const user = userEvent.setup();

    // Act
    render(
      <LocationsView
        onNavigateToLiveView={vi.fn()}
        onNavigateToSensor={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText('Asker Kommune')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Expand Asker Kommune' }));
    await user.click(screen.getByRole('button', { name: 'Expand Hurum' }));

    // Assert
    await waitFor(() => expect(screen.getByText('Hurum sensor')).toBeInTheDocument());
    expect(screen.getByText('Sætre')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Expand Sætre' }));
    await waitFor(() => expect(screen.getByText('Sætre sensor')).toBeInTheDocument());
    expect(getDevicesByLocation).toHaveBeenCalledWith('loc-hurum');
    expect(getDevicesByLocation).toHaveBeenCalledWith('loc-saetre');
  });

  it('Shall_render_sensors_alphabetically_by_name', async () => {
    // Arrange
    getDevicesByLocation.mockResolvedValue([
      {
        id: 'device-3',
        uniqueId: 'sensor-3',
        name: 'Zulu sensor',
        manufacturer: 'Acme',
        type: 'Temperature',
        locationName: 'HQ',
        locationId: 'location-1',
        lastContact: '2026-03-30T08:30:00.000Z',
        installationDate: '2026-03-27T08:15:00.000Z',
      },
      {
        id: 'device-1',
        uniqueId: 'sensor-1',
        name: 'Alpha sensor',
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
        type: 'Humidity',
        locationName: 'HQ',
        locationId: 'location-1',
        lastContact: '2026-03-30T08:45:00.000Z',
        installationDate: '2026-03-27T08:15:00.000Z',
      },
    ]);
    const user = userEvent.setup();

    // Act
    render(
      <LocationsView
        onNavigateToLiveView={vi.fn()}
        onNavigateToSensor={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText('HQ')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Expand HQ' }));

    // Assert
    await waitFor(() => expect(screen.getByText('Alpha sensor')).toBeInTheDocument());
    expect(screen.getByText('Alpha sensor').compareDocumentPosition(screen.getByText('Lobby sensor'))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByText('Lobby sensor').compareDocumentPosition(screen.getByText('Zulu sensor'))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('Shall_render_sensors_with_norwegian_alphabetical_order', async () => {
    // Arrange
    getDevicesByLocation.mockResolvedValue([
      {
        id: 'device-4',
        uniqueId: 'sensor-4',
        name: 'Ålesund sensor',
        manufacturer: 'Acme',
        type: 'Temperature',
        locationName: 'HQ',
        locationId: 'location-1',
        lastContact: '2026-03-30T08:30:00.000Z',
        installationDate: '2026-03-27T08:15:00.000Z',
      },
      {
        id: 'device-1',
        uniqueId: 'sensor-1',
        name: 'Oslo sensor',
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
        name: 'Ærø sensor',
        manufacturer: 'Acme',
        type: 'Humidity',
        locationName: 'HQ',
        locationId: 'location-1',
        lastContact: '2026-03-30T08:45:00.000Z',
        installationDate: '2026-03-27T08:15:00.000Z',
      },
      {
        id: 'device-3',
        uniqueId: 'sensor-3',
        name: 'Ørje sensor',
        manufacturer: 'Acme',
        type: 'Pressure',
        locationName: 'HQ',
        locationId: 'location-1',
        lastContact: '2026-03-30T08:50:00.000Z',
        installationDate: '2026-03-27T08:15:00.000Z',
      },
    ]);
    const user = userEvent.setup();

    // Act
    render(
      <LocationsView
        onNavigateToLiveView={vi.fn()}
        onNavigateToSensor={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText('HQ')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Expand HQ' }));

    // Assert
    await waitFor(() => expect(screen.getByText('Oslo sensor')).toBeInTheDocument());
    expect(screen.getByText('Oslo sensor').compareDocumentPosition(screen.getByText('Ærø sensor'))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByText('Ærø sensor').compareDocumentPosition(screen.getByText('Ørje sensor'))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByText('Ørje sensor').compareDocumentPosition(screen.getByText('Ålesund sensor'))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
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
