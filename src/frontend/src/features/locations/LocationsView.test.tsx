import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LocationsView from './LocationsView';

const { getLocations, createLocation, updateLocation, deleteLocation } = vi.hoisted(() => ({
  getLocations: vi.fn(),
  createLocation: vi.fn(),
  updateLocation: vi.fn(),
  deleteLocation: vi.fn(),
}));

vi.mock('../../api/api', () => ({
  getLocations,
  createLocation,
  updateLocation,
  deleteLocation,
}));

describe('LocationsView', () => {
  beforeEach(() => {
    getLocations.mockResolvedValue([
      { id: 'location-1', name: 'HQ', description: 'Office', deviceCount: 2, parentLocationId: null },
      { id: 'location-2', name: 'Warehouse', description: 'Storage', deviceCount: 0, parentLocationId: null },
    ]);
    createLocation.mockResolvedValue(undefined);
    updateLocation.mockResolvedValue(undefined);
    deleteLocation.mockResolvedValue(undefined);
  });

  it('Shall_navigate_to_sensor_list_when_clicking_sensors_button', async () => {
    // Arrange
    const user = userEvent.setup();
    const onNavigateToSensorList = vi.fn();

    // Act
    render(
      <LocationsView
        onNavigateToLiveView={vi.fn()}
        onNavigateToSensorList={onNavigateToSensorList}
      />,
    );

    await waitFor(() => expect(screen.getByText('HQ')).toBeInTheDocument());
    const hqRow = screen.getByText('HQ').closest('tr');
    if (!hqRow) {
      throw new Error('Could not find HQ row');
    }
    const sensorsButton = within(hqRow).getByRole('button', { name: /Sensors/i });
    await user.click(sensorsButton);

    // Assert
    expect(onNavigateToSensorList).toHaveBeenCalledWith('location-1');
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
        onNavigateToSensorList={vi.fn()}
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
        onNavigateToSensorList={vi.fn()}
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
      { id: 'loc-aa', name: 'Ålesund', description: 'Møre og Romsdal', deviceCount: 0, parentLocationId: null },
      { id: 'loc-oslo', name: 'Oslo', description: 'Hovedstaden', deviceCount: 0, parentLocationId: null },
      { id: 'loc-aeroskobing', name: 'Ærøskøbing', description: 'Danmark', deviceCount: 0, parentLocationId: null },
      { id: 'loc-oerje', name: 'Ørje', description: 'Marker', deviceCount: 0, parentLocationId: null },
    ]);

    // Act
    render(
      <LocationsView
        onNavigateToLiveView={vi.fn()}
        onNavigateToSensorList={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText('Oslo')).toBeInTheDocument());

    // Assert
    expect(screen.getByText('Oslo').compareDocumentPosition(screen.getByText('Ærøskøbing'))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByText('Ærøskøbing').compareDocumentPosition(screen.getByText('Ørje'))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByText('Ørje').compareDocumentPosition(screen.getByText('Ålesund'))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('Shall_show_parent_location_select_in_create_dialog', async () => {
    // Arrange
    const user = userEvent.setup();

    // Act
    render(
      <LocationsView
        onNavigateToLiveView={vi.fn()}
        onNavigateToSensorList={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText('HQ')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Add location' }));

    // Assert
    expect(screen.getByLabelText('Parent location')).toBeInTheDocument();
  });
});
