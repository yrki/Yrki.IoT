import { render, screen } from '@testing-library/react';
import App from './App';
import { vi } from 'vitest';

vi.mock('./api/api', () => ({
  getCurrentUser: vi.fn(),
  getDevice: vi.fn().mockResolvedValue({ id: '1' }),
  requestMagicLink: vi.fn().mockResolvedValue(undefined),
  setAccessToken: vi.fn(),
  verifyMagicLink: vi.fn(),
}));

test('renders the top navigation', () => {
  render(<App />);
  expect(screen.getByRole('banner')).toBeInTheDocument();
});
