import { describe, it, expect, beforeAll } from 'vitest';
import os from 'os';
import path from 'path';

/**
 * A node that is defined, funded, open and taking submissions read on the map as a spec-only item:
 * `criterion: null`, `ens_name: null`, and the roadmap's generic label (both live nodes, 2026-09-09).
 * A judge clicking dl-leanvm saw a locked specification. These hold the fields that fix it.
 */
process.env.DB_PATH = process.env.DB_PATH ?? path.join(os.tmpdir(), 'ethplane-live-nodes-test.db');

const NODE1 = '0x8e67c816b1f39fa072094b67f4f74937bd1920a7a9d79e4b98e785ae9aa29d58';
const NODE2 = '0x662b44f5cf418a3e3d4126a187d0154034afbdc8d2536b9076c68f2a4440c37e';

describe('live node metadata', () => {
  let db: typeof import('../src/db')['db'];
  let seedStrawmapMetadata: () => number;
  let seedLiveNodeMetadata: () => number;

  beforeAll(async () => {
    const mod = await import('../src/db');
    db = mod.db; seedStrawmapMetadata = mod.seedStrawmapMetadata; seedLiveNodeMetadata = mod.seedLiveNodeMetadata;
    mod.initializeDatabase();
    seedStrawmapMetadata();
    seedLiveNodeMetadata();
  });

  const row = (id: string) => db.prepare('SELECT * FROM nodes WHERE node_id = ?').get(id) as Record<string, string>;

  it('gives both live nodes the ENS name a judge can resolve', () => {
    expect(row(NODE1).ens_name).toBe('cl-pq-leanxmss-attestations.ethplane.eth');
    expect(row(NODE2).ens_name).toBe('dl-leanvm.ethplane.eth');
  });

  it('gives them a criterion sentence, not only a hash', () => {
    expect(row(NODE2).criterion).toMatch(/cycles < 1,542,812/);
    expect(row(NODE2).criterion).toMatch(/compiler/);
    expect(row(NODE2).criterion_type).toBe('metric');
  });

  it('keeps the strawmap label, layer and track', () => {
    expect(row(NODE2).label).toBe('leanVM');
    expect(row(NODE2).layer).toBe('DL');
    expect(row(NODE2).track).toBe('types');
  });

  it('runs after the strawmap without being overwritten by it', () => {
    seedStrawmapMetadata();     // a later pass, as the server does on every boot
    seedLiveNodeMetadata();
    expect(row(NODE2).criterion).toMatch(/cycles/);
    expect(row(NODE2).ens_name).toBe('dl-leanvm.ethplane.eth');
  });

  it('never touches what the chain owns', () => {
    // `head` is its own table, filled by HeadAdvanced; state and bounty are the indexer's columns.
    db.prepare("UPDATE nodes SET state = 'open', bounty = '10000000000000000000000' WHERE node_id = ?").run(NODE2);
    seedLiveNodeMetadata();
    const r = row(NODE2);
    expect(r.state).toBe('open');
    expect(r.bounty).toBe('10000000000000000000000');
  });

  it('is a no-op when the file is not there rather than an error', () => {
    process.env.LIVE_NODES_JSON = '/nowhere/live-nodes.json';
    expect(() => seedLiveNodeMetadata()).not.toThrow();
    delete process.env.LIVE_NODES_JSON;
  });
});
