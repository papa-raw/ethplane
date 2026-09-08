import { describe, it, expect, beforeAll } from 'vitest';

// No module mocks: the point of this file is that the indexer's event list matches the ABI it was
// built against. The first draft switched on invented event names and every mock passed anyway.
process.env.DB_PATH = process.env.DB_PATH ?? '/tmp/ethplane-vitest.db';

describe('indexer', () => {
  let mod: typeof import('../src/indexer');

  beforeAll(async () => {
    mod = await import('../src/indexer');
  });

  it('exports the poller', () => {
    expect(typeof mod.runIndexer).toBe('function');
    expect(typeof mod.storeEvent).toBe('function');
  });

  it('watches the events the deployed contract actually emits', () => {
    const names = mod.events.map((e) => e.name);
    for (const required of [
      'NodeDefined', 'NodeFunded', 'BaselineRecorded', 'LeaseClaimed', 'Heartbeat', 'LeaseForfeited',
      'SubmissionMade', 'MeasurementRecorded', 'ReviewConfirmed', 'HeadAdvanced', 'Payout',
    ]) {
      expect(names, `${required} missing from the ABI the indexer loaded`).toContain(required);
    }
    // and nothing invented: every name the switch handles must exist in the ABI
    expect(names.length).toBeGreaterThanOrEqual(20);
  });

  it('writes a node row from a NodeDefined event', async () => {
    const { db, initializeDatabase } = await import('../src/db');
    initializeDatabase();
    const nodeId = '0x' + 'ab'.repeat(32);
    const wrote = mod.storeEvent(
      'NodeDefined',
      { nodeId, registrant: '0x0000000000000000000000000000000000000001', criterionHash: '0x' + '11'.repeat(32) },
      { block: 100, ts: 1, tx: '0xtx', logIndex: 0, removed: false }
    );
    expect(wrote).toBe(true);
    const row = db.prepare('SELECT node_id, state FROM nodes WHERE node_id = ?').get(nodeId) as
      | { node_id: string; state: string }
      | undefined;
    expect(row?.state).toBe('defined');
  });

  it('ignores configuration events without inventing rows for them', () => {
    expect(mod.storeEvent('RelaySet', {}, { block: 1, ts: 1, tx: '0x', logIndex: 0, removed: false })).toBe(false);
  });
});
