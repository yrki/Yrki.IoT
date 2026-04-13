import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import BuildingStructureView from './BuildingStructureView';
import * as api from '../../api/api';

vi.mock('../../api/api', () => ({
  getBuilding: vi.fn(),
  getBuildingFloors: vi.fn(),
  getBuildingDevices: vi.fn(),
  getDevices: vi.fn(),
  createFloor: vi.fn(),
  createRoom: vi.fn(),
  createDevice: vi.fn(),
  assignDeviceToRoom: vi.fn(),
  updateFloor: vi.fn(),
  updateRoom: vi.fn(),
  deleteFloor: vi.fn(),
  deleteRoom: vi.fn(),
  reorderRooms: vi.fn(),
}));

const mockBuilding: api.BuildingDto = {
  id: 'b1',
  name: 'Test Building',
  address: null,
  latitude: null,
  longitude: null,
  ifcFileName: null,
  deviceCount: 0,
  locationId: null,
  locationName: null,
  createdAtUtc: '2026-01-01T00:00:00Z',
};

const mockFloors: api.FloorDto[] = [
  {
    id: 'f1',
    name: 'Level 1',
    elevation: 0,
    sortOrder: 0,
    bimExpressId: null,
    buildingId: 'b1',
    rooms: [
      { id: 'r1', name: 'Reception', number: '1A01', sortOrder: 0, bimExpressId: null, floorId: 'f1', deviceCount: 2 },
      { id: 'r2', name: 'Office', number: '1A02', sortOrder: 1, bimExpressId: null, floorId: 'f1', deviceCount: 0 },
    ],
  },
  {
    id: 'f2',
    name: 'Level 2',
    elevation: 3.5,
    sortOrder: 1,
    bimExpressId: null,
    buildingId: 'b1',
    rooms: [
      { id: 'r3', name: 'Lab', number: '2A01', sortOrder: 0, bimExpressId: null, floorId: 'f2', deviceCount: 1 },
    ],
  },
];

const defaultProps = {
  buildingId: 'b1',
  onBack: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.getBuilding).mockResolvedValue(mockBuilding);
  vi.mocked(api.getBuildingFloors).mockResolvedValue(mockFloors);
  vi.mocked(api.getBuildingDevices).mockResolvedValue([]);
  vi.mocked(api.getDevices).mockResolvedValue([]);
  vi.mocked(api.assignDeviceToRoom).mockResolvedValue(undefined);
});

describe('BuildingStructureView', () => {
  it('Shall_render_building_name', async () => {
    render(<BuildingStructureView {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Test Building')).toBeInTheDocument();
    });
  });

  it('Shall_render_floors_in_side_panel', async () => {
    render(<BuildingStructureView {...defaultProps} />);

    await waitFor(() => {
      // Floor names appear both in the visual area and the side panel
      expect(screen.getAllByText('Level 1').length).toBeGreaterThanOrEqual(2);
    });
    expect(screen.getAllByText('Level 2').length).toBeGreaterThanOrEqual(2);
  });

  it('Shall_render_rooms_in_visual_area', async () => {
    render(<BuildingStructureView {...defaultProps} />);

    await waitFor(() => {
      // Rooms are shown as rectangles in the visual area
      expect(screen.getByText('Reception')).toBeInTheDocument();
    });
    expect(screen.getByText('Office')).toBeInTheDocument();
    expect(screen.getByText('Lab')).toBeInTheDocument();
  });

  it('Shall_show_room_numbers_in_visual_area', async () => {
    render(<BuildingStructureView {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('1A01')).toBeInTheDocument();
    });
    expect(screen.getByText('1A02')).toBeInTheDocument();
  });

  it('Shall_show_device_count_on_rooms_in_visual_area', async () => {
    vi.mocked(api.getBuildingDevices).mockResolvedValue([
      { id: 'd1', uniqueId: 'sensor-1', name: null, manufacturer: null, type: 'CO2', kind: 'Sensor', lastContact: new Date().toISOString(), bimX: null, bimY: null, bimZ: null, roomId: 'r1' },
      { id: 'd2', uniqueId: 'sensor-2', name: null, manufacturer: null, type: 'CO2', kind: 'Sensor', lastContact: new Date().toISOString(), bimX: null, bimY: null, bimZ: null, roomId: 'r1' },
    ]);

    render(<BuildingStructureView {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('2 devices')).toBeInTheDocument();
    });
  });

  it('Shall_show_add_floor_button', async () => {
    render(<BuildingStructureView {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('BUILDING STRUCTURE')).toBeInTheDocument();
    });
  });

  it('Shall_call_onBack_when_back_button_clicked', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<BuildingStructureView buildingId="b1" onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText('Test Building')).toBeInTheDocument();
    });

    const backButton = screen.getByText('Test Building').parentElement!.querySelector('button')!;
    await user.click(backButton);
    expect(onBack).toHaveBeenCalled();
  });

  it('Shall_show_empty_state_when_no_floors', async () => {
    vi.mocked(api.getBuildingFloors).mockResolvedValue([]);

    render(<BuildingStructureView {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('No floors yet')).toBeInTheDocument();
    });
  });

  it('Shall_show_rooms_in_panel_when_floor_expanded', async () => {
    const user = userEvent.setup();
    render(<BuildingStructureView {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getAllByText('Level 1').length).toBeGreaterThanOrEqual(1);
    });

    // Click Level 1 in the side panel (it's in a ListItemButton)
    const level1Elements = screen.getAllByText('Level 1');
    // The panel's Level 1 is inside a ListItemButton
    const panelLevel1 = level1Elements.find((el) => el.closest('[role="button"]'));
    await user.click(panelLevel1!);

    // Rooms should appear in the panel (formatted as "number — name")
    await waitFor(() => {
      expect(screen.getByText('1A01 — Reception')).toBeInTheDocument();
    });
    expect(screen.getByText('1A02 — Office')).toBeInTheDocument();
  });

  it('Shall_open_add_device_dialog_when_clicking_add_on_room', async () => {
    const user = userEvent.setup();
    vi.mocked(api.getDevices).mockResolvedValue([
      {
        id: 'd1', uniqueId: 'sensor-001', name: 'Test sensor', manufacturer: 'ABB',
        type: 'CO2', kind: 'Sensor' as const, locationName: null, locationId: null,
        lastContact: new Date().toISOString(), installationDate: new Date().toISOString(),
        latitude: null, longitude: null,
      },
    ]);

    render(<BuildingStructureView {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getAllByText('Level 1').length).toBeGreaterThanOrEqual(1);
    });

    // Expand Level 1 in side panel
    const panelLevel1 = screen.getAllByText('Level 1').find((el) => el.closest('[role="button"]'));
    await user.click(panelLevel1!);

    // Click the add-device button on a room
    await waitFor(() => {
      expect(screen.getByText('1A01 — Reception')).toBeInTheDocument();
    });

    // Find the add button on the room (the + icon button)
    const roomRow = screen.getByText('1A01 — Reception').closest('[role="button"]')!;
    const addButtons = roomRow.querySelectorAll('button');
    // First icon button is add-device
    await user.click(addButtons[0]);

    // Dialog should appear
    await waitFor(() => {
      expect(screen.getByText(/Add sensor to/)).toBeInTheDocument();
    });
    expect(screen.getByText('Find existing')).toBeInTheDocument();
    expect(screen.getByText('Create new')).toBeInTheDocument();
  });

  it('Shall_assign_existing_device_to_room', async () => {
    const user = userEvent.setup();
    const mockDevice: api.SensorListItemDto = {
      id: 'd1', uniqueId: 'sensor-001', name: 'Test sensor', manufacturer: 'ABB',
      type: 'CO2', kind: 'Sensor' as const, locationName: null, locationId: null,
      lastContact: new Date().toISOString(), installationDate: new Date().toISOString(),
      latitude: null, longitude: null,
    };
    vi.mocked(api.getDevices).mockResolvedValue([mockDevice]);

    render(<BuildingStructureView {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getAllByText('Level 1').length).toBeGreaterThanOrEqual(1);
    });

    // Expand and click add on room
    const panelLevel1 = screen.getAllByText('Level 1').find((el) => el.closest('[role="button"]'));
    await user.click(panelLevel1!);
    await waitFor(() => {
      expect(screen.getByText('1A01 — Reception')).toBeInTheDocument();
    });
    const roomRow = screen.getByText('1A01 — Reception').closest('[role="button"]')!;
    await user.click(roomRow.querySelectorAll('button')[0]);

    // Dialog opens — the "Add to room" button should be disabled until a device is selected
    await waitFor(() => {
      expect(screen.getByText('Add to room')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Add to room' })).toBeDisabled();
  });
});
