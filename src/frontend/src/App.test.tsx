import { render, screen } from '@testing-library/react';
import App from './App';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('./api/api', () => ({
  getCurrentUser: vi.fn(),
  requestMagicLink: vi.fn().mockResolvedValue(undefined),
  setAccessToken: vi.fn(),
  verifyMagicLink: vi.fn(),
  getDevices: vi.fn().mockResolvedValue([]),
  deleteDevice: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./features/sensors/useSensorHub', () => ({
  useSensorHub: () => ({ readings: {}, connected: false }),
}));

test('renders login page when not authenticated', () => {
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );
  expect(screen.getByText('Yrki IoT')).toBeInTheDocument();
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
});
