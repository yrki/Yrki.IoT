import { render, screen } from '@testing-library/react';
import App from './App';
import { vi } from 'vitest';

vi.mock('./api/api', () => ({
  getDevice: vi.fn().mockResolvedValue({ id: '1' }),
}));

test('renders the top navigation', () => {
  render(<App />);
  expect(screen.getByRole('banner')).toBeInTheDocument();
});
