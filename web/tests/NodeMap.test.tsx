import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MapBody } from '@/components/dashboard/NodeMap';
import type { NodeRow } from '@/lib/api';

const node = (over: Partial<NodeRow>): NodeRow => ({
  node_id: '0xabc', label: 'fast confirmation', layer: 'CL', track: 'latency', fork: 'G', tag: 'none',
  state: 'seeded', bounty: '0', criterion: null, criterion_hash: null, ens_name: null, head: null,
  active_lease_count: 0, ...over,
});

describe('NodeMap', () => {
  it('groups by layer and track, the strawmap\'s own shape', () => {
    render(<MapBody nodes={[node({}), node({ node_id: '0xdef', label: 'BALs', layer: 'EL', track: 'state' })]} />);
    expect(screen.getByText('CL')).toBeInTheDocument();
    expect(screen.getByText('EL')).toBeInTheDocument();
    expect(screen.getAllByTestId('map-node')).toHaveLength(2);
  });

  it('derives in-session and passed from the live columns, not from the stored state', () => {
    render(
      <MapBody nodes={[
        node({ node_id: '0x1', active_lease_count: 2 }),
        node({ node_id: '0x2', head: '0xhead' }),
        node({ node_id: '0x3' }),
      ]} />
    );
    const legend = screen.getByTestId('map-legend');
    expect(legend).toHaveTextContent('in session');
    expect(legend).toHaveTextContent('passed');
    expect(legend).toHaveTextContent('seeded');
  });

  it('links every node to its page', () => {
    render(<MapBody nodes={[node({ node_id: '0xabc' })]} />);
    expect(screen.getByTestId('map-node')).toHaveAttribute('href', '/node/0xabc');
  });
});
