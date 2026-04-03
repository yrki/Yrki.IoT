import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UsersView from './UsersView';

const { getUsers, createUser, updateUser, deleteUser } = vi.hoisted(() => ({
  getUsers: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
}));

vi.mock('../../api/api', () => ({
  getUsers,
  createUser,
  updateUser,
  deleteUser,
}));

describe('UsersView', () => {
  beforeEach(() => {
    getUsers.mockResolvedValue([
      {
        id: 'user-1',
        email: 'admin@example.com',
        createdAtUtc: '2026-04-01T08:00:00.000Z',
        lastLoginAtUtc: '2026-04-02T08:00:00.000Z',
      },
    ]);
    createUser.mockResolvedValue({
      id: 'user-2',
      email: 'new@example.com',
      createdAtUtc: '2026-04-03T08:00:00.000Z',
      lastLoginAtUtc: null,
    });
    updateUser.mockResolvedValue({
      id: 'user-1',
      email: 'edited@example.com',
      createdAtUtc: '2026-04-01T08:00:00.000Z',
      lastLoginAtUtc: '2026-04-02T08:00:00.000Z',
    });
    deleteUser.mockResolvedValue(undefined);
  });

  it('Shall_load_users_and_create_a_new_user', async () => {
    // Arrange
    const user = userEvent.setup();

    // Act
    render(<UsersView />);

    await waitFor(() => expect(screen.getByText('admin@example.com')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Add user' }));
    await user.type(screen.getByLabelText('Email'), 'new@example.com');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    // Assert
    await waitFor(() => expect(createUser).toHaveBeenCalledWith('new@example.com'));
    expect(screen.getByText('new@example.com')).toBeInTheDocument();
  });
});
