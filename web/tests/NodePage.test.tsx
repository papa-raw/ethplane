import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('@/lib/ens', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ens')>()),
  readEnsText: vi.fn().mockRejectedValue(new Error('no record')),
}));
vi.mock('@/lib/usePolling', () => ({ usePolling: vi.fn() }));

import { usePolling } from '@/lib/usePolling';
import { NodePage } from '@/components/dashboard/NodePage';
import type { NodeRow } from '@/lib/api';

const node = (over: Partial<NodeRow> = {}): NodeRow => ({
  node_id: '0x8e67', label: 'PQ aggregation', layer: 'CL', track: 'security', fork: 'G', tag: 'none',
  state: 'open', bounty: '10000000000000000000000', criterion: null, criterion_hash: '0xcrit',
  ens_name: null, head: null, active_lease_count: 0, ...over,
});

const detail = (over: Record<string, unknown> = {}) => ({
  node: node(), leases: [], lease_events: [], submissions: [], verdicts: [], attribution: [], head: null, ...over,
});

describe('NodePage', () => {
  it('shows a skeleton before the first response', () => {
    vi.mocked(usePolling).mockReturnValue({ data: null, error: null, loading: true });
    render(<NodePage nodeId="0x8e67" slug="cl-pq" label="PQ aggregation" />);
    expect(screen.getByTestId('panel-loading')).toBeInTheDocument();
  });

  it('names the failure when the API is unreachable', () => {
    vi.mocked(usePolling).mockReturnValue({ data: null, error: '/api/nodes/0x8e67 responded 500', loading: false });
    render(<NodePage nodeId="0x8e67" slug="cl-pq" label="PQ aggregation" />);
    expect(screen.getByTestId('panel-error')).toHaveTextContent('responded 500');
  });

  it('says so when the indexer has never seen the node', () => {
    vi.mocked(usePolling).mockReturnValue({ data: { node: null } as never, error: null, loading: false });
    render(<NodePage nodeId="0x8e67" slug="cl-pq" label="PQ aggregation" />);
    expect(screen.getByTestId('panel-empty')).toBeInTheDocument();
  });

  it('shows the escrow, the policy rules and empty sections that explain themselves', () => {
    vi.mocked(usePolling).mockReturnValue({ data: detail() as never, error: null, loading: false });
    render(<NodePage nodeId="0x8e67" slug="cl-pq" label="PQ aggregation" />);
    expect(screen.getByTestId('funding-card')).toHaveTextContent('10,000 PLANE');
    expect(screen.getByTestId('funding-card')).toHaveTextContent('c8io5x5g08igo85ljedozu2k');
    expect(screen.getByTestId('funding-card')).toHaveTextContent('policy violation');
    expect(screen.getByTestId('sessions')).toHaveTextContent('No session has been started on this node yet');
    expect(screen.getByTestId('attribution')).toHaveTextContent('No payouts yet');
  });

  it('offers the Register control only while the node is unregistered', () => {
    vi.mocked(usePolling).mockReturnValue({ data: detail({ node: node({ state: 'seeded' }) }) as never, error: null, loading: false });
    const { unmount } = render(<NodePage nodeId="0x8e67" slug="cl-pq" label="PQ" />);
    expect(screen.getByTestId('register-control')).toBeInTheDocument();
    unmount();
    vi.mocked(usePolling).mockReturnValue({ data: detail({ node: node({ state: 'open' }) }) as never, error: null, loading: false });
    render(<NodePage nodeId="0x8e67" slug="cl-pq" label="PQ" />);
    expect(screen.queryByTestId('register-control')).toBeNull();
  });

  it('shows one line when the ENS read fails, not viem\'s stack', async () => {
    vi.mocked(usePolling).mockReturnValue({ data: detail() as never, error: null, loading: false });
    render(<NodePage nodeId="0x8e67" slug="cl-pq" label="PQ aggregation" />);
    await waitFor(() => expect(screen.getByTestId('ens-card')).toHaveTextContent('no record yet'));
    expect(screen.getByTestId('ens-card')).not.toHaveTextContent('Contract Call');
  });
});
