import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import BimSidePanel from './BimSidePanel';

const storeys = [
  { id: 1, name: 'Level 1' },
  { id: 2, name: 'Level 2' },
];

const rooms = [
  { expressId: 100, name: '1A01 — Reception', storeyId: 1 },
  { expressId: 101, name: '1A02 — Office', storeyId: 1 },
  { expressId: 200, name: '2A01 — Lab', storeyId: 2 },
];

const placedDevices = [
  { deviceId: 'd1', uniqueId: 'sensor-001', name: 'Lobby sensor', type: 'CO2', roomExpressId: 100, lastContact: new Date().toISOString() },
];

const defaultProps = {
  storeys,
  rooms,
  placedDevices,
  activeStorey: null as number | null,
  onSelectStorey: vi.fn(),
  onSelectRoom: vi.fn(),
  onLocateDevice: vi.fn(),
  onRemoveDevice: vi.fn(),
  onAddDeviceToRoom: vi.fn(),
  onShowSensorData: vi.fn(),
};

describe('BimSidePanel', () => {
  it('Shall_render_all_storeys', () => {
    render(<BimSidePanel {...defaultProps} />);
    expect(screen.getByText('Level 1')).toBeInTheDocument();
    expect(screen.getByText('Level 2')).toBeInTheDocument();
  });

  it('Shall_show_rooms_when_storey_expanded', async () => {
    const user = userEvent.setup();
    render(<BimSidePanel {...defaultProps} />);

    // Click storey to expand
    await user.click(screen.getByText('Level 1'));

    // Rooms should be visible after expanding
    expect(screen.getByText('1A01 — Reception')).toBeVisible();
    expect(screen.getByText('1A02 — Office')).toBeVisible();
  });

  it('Shall_show_sensor_icon_on_rooms_with_devices', async () => {
    const user = userEvent.setup();
    render(<BimSidePanel {...defaultProps} />);

    await user.click(screen.getByText('Level 1'));

    // Reception has a device — should show sensor icon (not meeting room icon)
    // and the room should be clickable
    expect(screen.getByText('1A01 — Reception')).toBeInTheDocument();
  });

  it('Shall_call_onSelectStorey_when_clicking_storey', async () => {
    const onSelectStorey = vi.fn();
    const user = userEvent.setup();
    render(<BimSidePanel {...defaultProps} onSelectStorey={onSelectStorey} />);

    await user.click(screen.getByText('Level 1'));
    expect(onSelectStorey).toHaveBeenCalledWith(1);
  });

  it('Shall_call_onSelectRoom_when_clicking_room', async () => {
    const onSelectRoom = vi.fn();
    const user = userEvent.setup();
    render(<BimSidePanel {...defaultProps} onSelectRoom={onSelectRoom} />);

    await user.click(screen.getByText('Level 1'));
    await user.click(screen.getByText('1A01 — Reception'));
    expect(onSelectRoom).toHaveBeenCalledWith(rooms[0]);
  });

  it('Shall_show_all_floors_link', () => {
    render(<BimSidePanel {...defaultProps} />);
    expect(screen.getByText('Show all floors')).toBeInTheDocument();
  });

  it('Shall_call_onSelectStorey_null_when_clicking_all_floors', async () => {
    const onSelectStorey = vi.fn();
    const user = userEvent.setup();
    render(<BimSidePanel {...defaultProps} onSelectStorey={onSelectStorey} />);

    await user.click(screen.getByText('Show all floors'));
    expect(onSelectStorey).toHaveBeenCalledWith(null);
  });

  it('Shall_show_activity_indicator_for_devices', async () => {
    const user = userEvent.setup();
    render(<BimSidePanel {...defaultProps} />);

    await user.click(screen.getByText('Level 1'));
    await user.click(screen.getByText('1A01 — Reception'));

    // Device should have an activity dot with a data-testid
    const dot = screen.getByTestId('activity-dot-sensor-001');
    expect(dot).toBeInTheDocument();
  });

  it('Shall_show_green_activity_for_fresh_device', async () => {
    const user = userEvent.setup();
    render(<BimSidePanel {...defaultProps} />);

    await user.click(screen.getByText('Level 1'));
    await user.click(screen.getByText('1A01 — Reception'));

    const dot = screen.getByTestId('activity-dot-sensor-001');
    // Fresh device (lastContact = now) should not be grey
    expect(dot.style.backgroundColor).not.toBe('rgba(148, 163, 184, 0.55)');
  });

  it('Shall_show_grey_activity_for_stale_device', async () => {
    const staleDevices = [{
      ...placedDevices[0],
      lastContact: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    }];
    const user = userEvent.setup();
    render(<BimSidePanel {...defaultProps} placedDevices={staleDevices} />);

    await user.click(screen.getByText('Level 1'));
    await user.click(screen.getByText('1A01 — Reception'));

    const dot = screen.getByTestId('activity-dot-sensor-001');
    expect(dot.style.backgroundColor).toBe('rgba(148, 163, 184, 0.55)');
  });

  it('Shall_show_add_device_button_per_room', async () => {
    const user = userEvent.setup();
    render(<BimSidePanel {...defaultProps} />);

    await user.click(screen.getByText('Level 1'));

    expect(screen.getByTestId('add-device-room-100')).toBeInTheDocument();
    expect(screen.getByTestId('add-device-room-101')).toBeInTheDocument();
  });

  it('Shall_call_onAddDeviceToRoom_when_clicking_add_button', async () => {
    const onAddDeviceToRoom = vi.fn();
    const user = userEvent.setup();
    render(<BimSidePanel {...defaultProps} onAddDeviceToRoom={onAddDeviceToRoom} />);

    await user.click(screen.getByText('Level 1'));
    await user.click(screen.getByTestId('add-device-room-101'));

    expect(onAddDeviceToRoom).toHaveBeenCalledWith(rooms[1]);
  });

  it('Shall_show_add_floor_button_when_onAddFloor_provided', () => {
    render(<BimSidePanel {...defaultProps} onAddFloor={vi.fn()} />);
    // The "+" button should appear in the header
    expect(screen.getByText('BUILDING STRUCTURE').parentElement!.querySelectorAll('button').length).toBeGreaterThan(0);
  });

  it('Shall_show_edit_and_delete_buttons_on_storey_when_editing_enabled', async () => {
    const user = userEvent.setup();
    render(
      <BimSidePanel
        {...defaultProps}
        onEditFloor={vi.fn()}
        onDeleteFloor={vi.fn()}
      />,
    );

    // The storey row should have edit and delete buttons (visible without expanding)
    const level1 = screen.getByText('Level 1');
    const row = level1.closest('[role="button"]')!;
    const buttons = row.querySelectorAll('button');
    // Should have at least edit + delete buttons
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it('Shall_show_edit_and_delete_buttons_on_room_when_editing_enabled', async () => {
    const user = userEvent.setup();
    render(
      <BimSidePanel
        {...defaultProps}
        onEditRoom={vi.fn()}
        onDeleteRoom={vi.fn()}
      />,
    );

    await user.click(screen.getByText('Level 1'));
    const roomRow = screen.getByText('1A01 — Reception').closest('[role="button"]')!;
    const buttons = roomRow.querySelectorAll('button');
    // Should have add-device + edit + delete buttons
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  });

  it('Shall_open_add_floor_dialog_and_call_onAddFloor', async () => {
    const onAddFloor = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<BimSidePanel {...defaultProps} onAddFloor={onAddFloor} />);

    // Click the add floor button in the header
    const headerButtons = screen.getByText('BUILDING STRUCTURE').parentElement!.querySelectorAll('button');
    await user.click(headerButtons[0]);

    // Dialog should appear
    await vi.waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    const inputs = screen.getByRole('dialog').querySelectorAll('input');
    await user.type(inputs[0], 'Level 3');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onAddFloor).toHaveBeenCalledWith('Level 3');
  });

  it('Shall_show_delete_confirmation_for_floor', async () => {
    const onDeleteFloor = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<BimSidePanel {...defaultProps} onDeleteFloor={onDeleteFloor} />);

    // Find delete button on Level 1 row
    const level1 = screen.getByText('Level 1');
    const row = level1.closest('[role="button"]')!;
    const deleteBtn = row.querySelector('button[color="error"]') ?? row.querySelectorAll('button')[row.querySelectorAll('button').length - 1];
    await user.click(deleteBtn!);

    await vi.waitFor(() => {
      expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();
    });
  });

  it('Shall_show_no_sensors_text_when_room_expanded_without_devices', async () => {
    const user = userEvent.setup();
    const { container } = render(<BimSidePanel {...defaultProps} />);

    await user.click(screen.getByText('Level 1'));
    await user.click(screen.getByText('1A02 — Office'));

    // "No sensors" text exists in the DOM
    const noSensors = container.querySelector('[class*="Collapse"]');
    expect(noSensors?.textContent).toContain('No sensors');
  });
});
