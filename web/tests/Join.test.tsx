import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const privy = {
  ready: true, authenticated: false, login: vi.fn(), logout: vi.fn(),
  getAccessToken: vi.fn().mockResolvedValue('tok'), user: null,
};
vi.mock('@privy-io/react-auth', () => ({
  usePrivy: () => privy,
  useWallets: () => ({ wallets: [{ address: '0xWALLET' }] }),
}));

import { Join } from '@/components/dashboard/Join';

beforeEach(() => {
  privy.ready = true; privy.authenticated = false;
  vi.restoreAllMocks();
});

describe('Join', () => {
  it('waits for Privy before showing either state', () => {
    privy.ready = false;
    render(<Join />);
    expect(screen.getByTestId('join-loading')).toBeInTheDocument();
  });

  it('offers sign-in when signed out, and explains what signing in gets you', () => {
    render(<Join />);
    expect(screen.getByTestId('join-signed-out')).toHaveTextContent('name under guests.ethplane.eth');
  });

  it('takes a name and shows it back', async () => {
    privy.authenticated = true;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, text: async () => JSON.stringify({ guestName: 'judge-7', wallet: '0xWALLET', returning: false }),
    }));
    render(<Join />);
    fireEvent.click(screen.getByText('Take my name'));
    await waitFor(() => expect(screen.getByTestId('join-result')).toHaveTextContent('judge-7.guests.ethplane.eth'));
  });

  it('shows the API error rather than pretending the claim worked', async () => {
    privy.authenticated = true;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 503, text: async () => JSON.stringify({ error: 'join is not configured' }),
    }));
    render(<Join />);
    fireEvent.click(screen.getByText('Take my name'));
    await waitFor(() => expect(screen.getByTestId('join-error')).toHaveTextContent('not configured'));
  });
});
