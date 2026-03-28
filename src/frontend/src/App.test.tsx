import { render, screen } from '@testing-library/react';
import App from './App';
import { vi } from 'vitest';

vi.mock('./api/api', () => ({
  getCurrentUser: vi.fn(),
  requestMagicLink: vi.fn().mockResolvedValue(undefined),
  setAccessToken: vi.fn(),
  verifyMagicLink: vi.fn(),
}));

vi.mock('./features/sensors/useSensorHub', () => ({
  useSensorHub: () => ({ readings: {}, connected: false }),
}));

test('renders the top navigation', () => {
  render(<App />);
  expect(screen.getByRole('banner')).toBeInTheDocument();
});
