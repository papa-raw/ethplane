import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Strawmap } from '@/components/dashboard/Strawmap';
import { layout, FORK_ORDER, type StrawNode } from '@/lib/layout';

const n = (over: Partial<StrawNode> & { id: string }): StrawNode => ({
  hash: `0x${over.id}`, label: over.id, layer: 'CL', track: 'latency', fork_target: 'G',
  throughlines_to: [], ...over,
});

describe('layout', () => {
  it('orders fork columns along the strawmap timeline and puts unknown forks last', () => {
    const l = layout([n({ id: 'a', fork_target: 'someday' }), n({ id: 'b', fork_target: 'J' }), n({ id: 'c', fork_target: 'G' })]);
    expect(l.columns.map((c) => c.fork)).toEqual(['G', 'J', 'someday']);
    // and the order is the declared one, not alphabetical
    expect(FORK_ORDER.indexOf('G')).toBeLessThan(FORK_ORDER.indexOf('J'));
  });

  it('stacks nodes that share a cell instead of drawing them on top of each other', () => {
    const l = layout([n({ id: 'a' }), n({ id: 'b' }), n({ id: 'c' })]);
    const ys = l.chips.map((c) => c.y).sort((p, q) => p - q);
    expect(new Set(ys).size).toBe(3);
    for (let i = 1; i < ys.length; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(l.chips[0].h);
  });

  it('makes a band tall enough for its busiest column, so no chip escapes its band', () => {
    const l = layout([n({ id: 'a' }), n({ id: 'b' }), n({ id: 'c', fork_target: 'J' })]);
    const band = l.bands.find((b) => b.layer === 'CL' && b.track === 'latency')!;
    for (const c of l.chips) {
      expect(c.y).toBeGreaterThanOrEqual(band.y);
      expect(c.y + c.h).toBeLessThanOrEqual(band.y + band.h);
    }
  });

  it('separates layers and their tracks into distinct bands', () => {
    const l = layout([n({ id: 'a' }), n({ id: 'b', track: 'state' }), n({ id: 'c', layer: 'EL', track: 'gas' })]);
    expect(l.bands).toHaveLength(3);
    expect(l.layers.map((b) => b.layer)).toEqual(['CL', 'EL']);
    const cl = l.layers.find((b) => b.layer === 'CL')!;
    const el = l.layers.find((b) => b.layer === 'EL')!;
    expect(cl.y + cl.h).toBeLessThanOrEqual(el.y);
  });

  it('draws a throughline between two chips and drops one that points off the map', () => {
    const l = layout([n({ id: 'a', throughlines_to: ['b', 'ghost'] }), n({ id: 'b', fork_target: 'J' })]);
    expect(l.lines).toHaveLength(1);
    const [line] = l.lines;
    const a = l.chips.find((c) => c.id === 'a')!;
    const b = l.chips.find((c) => c.id === 'b')!;
    expect(line).toMatchObject({ from: 'a', to: 'b', x1: a.x + a.w, x2: b.x });
  });

  it('keeps every chip inside the canvas it reports', () => {
    const l = layout([n({ id: 'a' }), n({ id: 'b', layer: 'EL', track: 'gas', fork_target: 'north star' })]);
    for (const c of l.chips) {
      expect(c.x + c.w).toBeLessThanOrEqual(l.width);
      expect(c.y + c.h).toBeLessThanOrEqual(l.height);
    }
  });

  it('returns an empty map rather than throwing when there are no nodes', () => {
    expect(layout([]).chips).toEqual([]);
  });
});

describe('Strawmap', () => {
  const nodes = [n({ id: 'fast-confirmations', label: 'fast confirmations' }), n({ id: 'bals', label: 'BALs', layer: 'EL', track: 'state' })];
  const row = (id: string, over: Record<string, unknown> = {}) => ({
    node_id: `0x${id}`, label: id, layer: null, track: null, fork: null, tag: null, state: 'open',
    bounty: '0', criterion: null, criterion_hash: null, ens_name: null, head: null,
    active_lease_count: 0, ...over,
  });

  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('draws one linked chip per node', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, json: async () => [] });
    render(<Strawmap nodes={nodes} />);
    const chips = screen.getAllByTestId('strawmap-chip');
    expect(chips).toHaveLength(2);
    expect(chips[0]).toHaveAttribute('href', '/node/0xfast-confirmations');
  });

  it('colours a chip from the live state, not from the static file', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true, json: async () => [row('fast-confirmations', { active_lease_count: 1 })],
    });
    render(<Strawmap nodes={nodes} />);
    // `open` with a session running is still open: sessions are not exclusive, so the state column
    // wins where it is specific and the live columns only fill in a base state.
    await waitFor(() => expect(screen.getByLabelText('fast confirmations (open)')).toBeInTheDocument());
    // the node the API said nothing about is `unknown`, not `seeded`: it does not inherit a
    // neighbour's colour and it does not claim a state the response never gave (design.md, Colors)
    expect(screen.getByLabelText('BALs (unknown)')).toBeInTheDocument();
  });

  it('still draws the roadmap when the API is down, and says the colours are missing', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('offline'));
    render(<Strawmap nodes={nodes} />);
    await waitFor(() => expect(screen.getByTestId('strawmap')).toHaveTextContent('Live state unavailable'));
    expect(screen.getAllByTestId('strawmap-chip')).toHaveLength(2);
  });
});
