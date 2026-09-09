import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * The duplicate rows on the live node page after the 2026-09-09 rehearsal: one session "started"
 * three times at the same block, heartbeats twice, "lapsed" twice — the poller reading the same
 * logs again after a rescan. These tests index the same log twice and expect one row.
 */
process.env.DB_PATH = process.env.DB_PATH ?? path.join(os.tmpdir(), 'ethplane-dedupe-test.db');

const NODE = '0x' + 'ab'.repeat(32);
const LINEAGE = '0x' + '11'.repeat(20);
const ARTIFACT = '0x' + 'cd'.repeat(32);

async function fresh() {
  const { db, initializeDatabase } = await import('../src/db');
  initializeDatabase();
  for (const t of ['lease_events', 'verdicts', 'attribution', 'releases']) db.exec(`DELETE FROM ${t}`);
  return db;
}

const meta = (over: Partial<{ block: number; ts: number; tx: string; logIndex: number; removed: boolean }> = {}) => ({
  block: 11667679, ts: 1757000000, tx: '0x' + 'ee'.repeat(32), logIndex: 4, removed: false, ...over,
});

describe('indexing the same log twice', () => {
  let db: Awaited<ReturnType<typeof fresh>>;
  let storeEvent: typeof import('../src/indexer')['storeEvent'];

  beforeEach(async () => {
    db = await fresh();
    ({ storeEvent } = await import('../src/indexer'));
  });

  it('writes one lease event, not three', () => {
    const args = { nodeId: NODE, lineage: LINEAGE, operator: LINEAGE, fromHash: '0x' + '00'.repeat(32), expiry: 1, seq: 1 };
    for (let i = 0; i < 3; i++) storeEvent('LeaseClaimed', args, meta());
    const rows = db.prepare(`SELECT * FROM lease_events WHERE node_id = ?`).all(NODE);
    expect(rows).toHaveLength(1);
  });

  it('keeps two heartbeats that are genuinely two logs', () => {
    const args = { nodeId: NODE, lineage: LINEAGE, seq: 1, at: 1757000001 };
    storeEvent('Heartbeat', args, meta({ logIndex: 1 }));
    storeEvent('Heartbeat', args, meta({ logIndex: 1 }));            // the same log, read twice
    storeEvent('Heartbeat', args, meta({ tx: '0x' + 'ff'.repeat(32), logIndex: 1 }));  // a later beat
    expect(db.prepare(`SELECT COUNT(*) AS n FROM lease_events WHERE kind = 'heartbeat'`).get()).toEqual({ n: 2 });
  });

  it('writes one verdict per measurement log', () => {
    const args = { nodeId: NODE, artifactHash: ARTIFACT, seq: 1, cycles: 1542812n, proofBytes: 302592n, evidenceHash: '0x' + '22'.repeat(32), status: 2 };
    storeEvent('MeasurementRecorded', args, meta({ logIndex: 7 }));
    storeEvent('MeasurementRecorded', args, meta({ logIndex: 7 }));
    expect(db.prepare(`SELECT COUNT(*) AS n FROM verdicts`).get()).toEqual({ n: 1 });
  });

  it('keeps every Payout of one transaction, and no repeats of them', () => {
    // _release emits up to four Payout logs in a single tx: they share a tx and differ by log index.
    const base = { nodeId: NODE, artifactHash: ARTIFACT, amount: 100n };
    storeEvent('Payout', { ...base, to: '0x' + '01'.repeat(20), kind: 0 }, meta({ logIndex: 1 }));
    storeEvent('Payout', { ...base, to: '0x' + '02'.repeat(20), kind: 2 }, meta({ logIndex: 2 }));
    storeEvent('Payout', { ...base, to: '0x' + '02'.repeat(20), kind: 2 }, meta({ logIndex: 2 }));
    expect(db.prepare(`SELECT COUNT(*) AS n FROM attribution`).get()).toEqual({ n: 2 });
  });

  it('writes one release row per Withdrawn log', () => {
    const args = { to: '0x' + '01'.repeat(20), amount: 5n };
    storeEvent('Withdrawn', args, meta({ logIndex: 9 }));
    storeEvent('Withdrawn', args, meta({ logIndex: 9 }));
    expect(db.prepare(`SELECT COUNT(*) AS n FROM releases`).get()).toEqual({ n: 1 });
  });

  it('still marks a reorged-out log as removed rather than dropping it', () => {
    const args = { nodeId: NODE, lineage: LINEAGE, operator: LINEAGE, fromHash: '0x' + '00'.repeat(32), expiry: 1, seq: 1 };
    storeEvent('LeaseClaimed', args, meta({ logIndex: 3 }));
    storeEvent('LeaseClaimed', args, { ...meta({ logIndex: 3 }), removed: true });
    const row = db.prepare(`SELECT removed FROM lease_events WHERE log_index = 3`).get() as { removed: number };
    expect(row.removed).toBe(1);
  });
});

describe('the one-time migration on an old database', () => {
  it('collapses the duplicates already there and leaves distinct rows alone', async () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ethplane-legacy-')), 'old.db');
    const old = new Database(file);
    // The schema as it was before log_index existed on these tables.
    old.exec(`CREATE TABLE lease_events(id INTEGER PRIMARY KEY, node_id TEXT, lineage TEXT,
      lease_seq INTEGER, kind TEXT, block INTEGER, ts INTEGER, tx TEXT, log_index INTEGER, removed INTEGER DEFAULT 0)`);
    old.exec(`CREATE TABLE attribution(id INTEGER PRIMARY KEY, node_id TEXT, operator TEXT, lineage TEXT,
      kind INTEGER, weight TEXT, artifact_hash TEXT, block INTEGER, ts INTEGER, tx TEXT)`);
    const started = old.prepare(`INSERT INTO lease_events(node_id, lineage, lease_seq, kind, block, ts, tx, log_index)
      VALUES(?,?,?,?,?,?,?,?)`);
    for (let i = 0; i < 3; i++) started.run(NODE, LINEAGE, 1, 'claimed', 11667679, 1757000000, '0xtx1', 4);
    started.run(NODE, LINEAGE, 1, 'heartbeat', 11667700, 1757000100, '0xtx2', 0);
    // legacy rows with no log_index at all: two identical, two that only share a transaction
    const payout = old.prepare(`INSERT INTO attribution(node_id, operator, kind, weight, artifact_hash, block, ts, tx)
      VALUES(?,?,?,?,?,?,?,?)`);
    payout.run(NODE, '0x01', 0, '100', ARTIFACT, 1, 1, '0xtx3');
    payout.run(NODE, '0x01', 0, '100', ARTIFACT, 1, 1, '0xtx3');
    payout.run(NODE, '0x02', 2, '10', ARTIFACT, 1, 1, '0xtx3');
    old.close();

    process.env.DB_PATH = file;
    const mod = await import(`../src/db?legacy=${Date.now()}`);
    mod.initializeDatabase();

    expect(mod.db.prepare(`SELECT COUNT(*) AS n FROM lease_events`).get()).toEqual({ n: 2 });
    expect(mod.db.prepare(`SELECT COUNT(*) AS n FROM attribution`).get()).toEqual({ n: 2 });
    // and the column the poller needs now exists on the old table
    const cols = (mod.db.prepare(`PRAGMA table_info(attribution)`).all() as Array<{ name: string }>).map((c) => c.name);
    expect(cols).toContain('log_index');
  });
});
