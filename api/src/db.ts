import Database from 'better-sqlite3';
import { keccak256, toBytes } from 'viem';
import type { Database as DatabaseType } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// The path is configuration, not a constant: tests use a temp file, the dev box uses ./data, and
// hawk points DB_PATH at /opt/ethplane-private. A hardcoded /opt path fails on every other machine.
const dbPath = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'ethplane.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
export const db: DatabaseType = new Database(dbPath);

// Create tables with the exact schema from the spec. Returns how many duplicate event rows the
// one-time migration removed, per table, so a redeploy can say what it changed instead of implying.
export function initializeDatabase(): Record<string, number> {
  // Nodes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS nodes(
      node_id TEXT PRIMARY KEY, 
      label TEXT, 
      layer TEXT, 
      track TEXT, 
      fork TEXT, 
      tag TEXT, 
      ef_tier TEXT, 
      criterion_type TEXT, 
      criterion TEXT, 
      routing_mode TEXT, 
      state TEXT, 
      bounty TEXT, 
      criterion_hash TEXT, 
      ens_name TEXT, 
      opened_block INTEGER
    )
  `);

  // Leases table
  db.exec(`
    CREATE TABLE IF NOT EXISTS leases(
      node_id TEXT, 
      lineage TEXT, 
      operator TEXT, 
      lease_seq INTEGER, 
      start INTEGER, 
      expiry INTEGER, 
      last_heartbeat INTEGER, 
      from_hash TEXT, 
      active INTEGER, 
      PRIMARY KEY(node_id, lineage, lease_seq)
    )
  `);

  // Lease events table
  db.exec(`
    CREATE TABLE IF NOT EXISTS lease_events(
      id INTEGER PRIMARY KEY, 
      node_id TEXT, 
      lineage TEXT, 
      lease_seq INTEGER, 
      kind TEXT, 
      block INTEGER, 
      ts INTEGER, 
      tx TEXT, 
      log_index INTEGER, 
      removed INTEGER DEFAULT 0
    )
  `);

  // Submissions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS submissions(
      artifact_hash TEXT PRIMARY KEY, 
      node_id TEXT, 
      lineage TEXT, 
      operator TEXT, 
      guest_name TEXT, 
      lease_seq INTEGER, 
      parents TEXT, 
      block INTEGER, 
      ts INTEGER, 
      tx TEXT
    )
  `);

  // Verdicts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS verdicts(
      id INTEGER PRIMARY KEY, 
      node_id TEXT, 
      artifact_hash TEXT, 
      lease_seq INTEGER, 
      passed INTEGER, 
      metric TEXT, 
      metric_hash TEXT, 
      spread TEXT, 
      block INTEGER, 
      ts INTEGER, 
      tx TEXT, 
      log_index INTEGER
    )
  `);

  // Attribution table
  db.exec(`
    CREATE TABLE IF NOT EXISTS attribution(
      id INTEGER PRIMARY KEY, 
      node_id TEXT, 
      operator TEXT, 
      lineage TEXT, 
      kind INTEGER, 
      weight TEXT, 
      artifact_hash TEXT, 
      block INTEGER, 
      ts INTEGER, 
      tx TEXT, 
      log_index INTEGER
    )
  `);

  // Releases table
  db.exec(`
    CREATE TABLE IF NOT EXISTS releases(
      id INTEGER PRIMARY KEY, 
      node_id TEXT, 
      to_addr TEXT, 
      amount TEXT, 
      lease_seq INTEGER, 
      block INTEGER, 
      ts INTEGER, 
      tx TEXT, 
      log_index INTEGER
    )
  `);

  // Heads table
  db.exec(`
    CREATE TABLE IF NOT EXISTS heads(
      node_id TEXT PRIMARY KEY, 
      head TEXT, 
      block INTEGER, 
      ts INTEGER
    )
  `);

  // Board lines table
  db.exec(`
    CREATE TABLE IF NOT EXISTS board_lines(
      id INTEGER PRIMARY KEY, 
      host TEXT, 
      ts INTEGER, 
      role TEXT, 
      kind TEXT, 
      text TEXT, 
      mode TEXT, 
      reason TEXT
    )
  `);

  // Hosts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS hosts(
      host TEXT PRIMARY KEY, 
      lineage TEXT, 
      model TEXT, 
      last_seen INTEGER, 
      status TEXT
    )
  `);

  // Artifacts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS artifacts(
      artifact_hash TEXT PRIMARY KEY, 
      path TEXT, 
      size INTEGER, 
      ts INTEGER
    )
  `);

  // Cursor table
  db.exec(`
    CREATE TABLE IF NOT EXISTS cursor(
      k TEXT PRIMARY KEY, 
      v INTEGER
    )
  `);

  // Guests: one row per Privy user, so a returning judge gets the same name (PRD 3.25).
  db.exec(`
    CREATE TABLE IF NOT EXISTS guests(
      privy_user_id TEXT PRIMARY KEY,
      wallet TEXT,
      guest_name TEXT UNIQUE,
      created_at INTEGER
    )
  `);
  // Names waiting for the maintainer key to register them on chain. The request never signs.
  db.exec(`
    CREATE TABLE IF NOT EXISTS pending_names(
      label TEXT PRIMARY KEY,
      owner TEXT,
      resolver TEXT,
      expiry INTEGER,
      registered INTEGER DEFAULT 0,
      created_at INTEGER
    )
  `);

  // Create indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_events_node ON lease_events(node_id, block)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_attr_op ON attribution(operator)`);

  addMissingColumns();
  const removed = dedupeEvents();
  enforceEventUniqueness();
  return removed;
}

/**
 * An event row's identity is the log it came from: (tx, log_index). Everything below exists because
 * the poller can legitimately read the same log twice — a rescan, an overlapping range, a restart —
 * and until 2026-09-09 every one of those re-reads appended another row. The live node page showed
 * one session started three times and one heartbeat twice, which is a lie about the chain told by
 * the reader, not the chain.
 */
export const EVENT_TABLES = ['lease_events', 'verdicts', 'attribution', 'releases'] as const;

/** The columns that make a legacy row (one written before log_index existed) distinguishable. */
const CONTENT_COLUMNS: Record<string, string[]> = {
  lease_events: ['node_id', 'lineage', 'lease_seq', 'kind', 'block', 'ts', 'tx'],
  verdicts: ['node_id', 'artifact_hash', 'lease_seq', 'passed', 'metric', 'metric_hash', 'spread', 'block', 'ts', 'tx'],
  attribution: ['node_id', 'operator', 'kind', 'weight', 'artifact_hash', 'block', 'ts', 'tx'],
  releases: ['node_id', 'to_addr', 'amount', 'lease_seq', 'block', 'ts', 'tx'],
};

function columnsOf(table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((c) => c.name);
}

function addMissingColumns(): void {
  for (const table of EVENT_TABLES) {
    if (!columnsOf(table).includes('log_index')) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN log_index INTEGER`);
    }
  }
}

/**
 * Drop the repeats, keeping the lowest rowid of each — one pass, on startup, before the unique
 * index goes on (the index cannot be created while duplicates are still there).
 *
 * Two passes per table, and the second one matters: rows written before log_index existed have NULL
 * there, and NULLs are distinct to a unique index, so grouping them by (tx, log_index) would either
 * keep every duplicate or — if NULL were coalesced to a constant — delete genuinely different rows
 * that share a transaction. One `_release` emits up to four Payout logs in a single tx. So legacy
 * rows are grouped by their whole content instead, which collapses exact repeats and keeps
 * everything else.
 */
export function dedupeEvents(): Record<string, number> {
  const removed: Record<string, number> = {};
  for (const table of EVENT_TABLES) {
    const before = (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
    db.exec(
      `DELETE FROM ${table} WHERE log_index IS NOT NULL AND rowid NOT IN (
         SELECT MIN(rowid) FROM ${table} WHERE log_index IS NOT NULL GROUP BY tx, log_index)`
    );
    const content = CONTENT_COLUMNS[table].filter((c) => columnsOf(table).includes(c)).join(', ');
    db.exec(
      `DELETE FROM ${table} WHERE log_index IS NULL AND rowid NOT IN (
         SELECT MIN(rowid) FROM ${table} WHERE log_index IS NULL GROUP BY ${content})`
    );
    const after = (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
    removed[table] = before - after;
  }
  return removed;
}

/**
 * The index is partial — `WHERE log_index IS NOT NULL` — so it binds every row the poller writes
 * from now on without pretending the legacy rows have an identity they never carried.
 */
function enforceEventUniqueness(): void {
  for (const table of EVENT_TABLES) {
    db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS ux_${table}_log ON ${table}(tx, log_index) WHERE log_index IS NOT NULL`
    );
  }
}

/**
 * Seed the node metadata the chain does not carry. A node id on chain is keccak256(bytes(id)) of a
 * strawmap slug; the labels, layers and tracks live in research/strawmap-nodes.json. Idempotent:
 * it fills the descriptive columns and never touches state, bounty or head, which are the chain's.
 */
export function seedStrawmapMetadata(): number {
  const candidates = [
    process.env.STRAWMAP_JSON,
    path.join(process.cwd(), '..', 'research', 'strawmap-nodes.json'),
    path.join(process.cwd(), 'research', 'strawmap-nodes.json'),
  ].filter(Boolean) as string[];
  const file = candidates.find((c) => fs.existsSync(c));
  if (!file) return 0;
  const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const nodes: Array<Record<string, string>> = parsed.nodes ?? parsed;
  const up = db.prepare(
    `INSERT INTO nodes(node_id, label, layer, track, fork, tag, state, bounty)
     VALUES(?,?,?,?,?,?,'seeded','0')
     ON CONFLICT(node_id) DO UPDATE SET
       label = excluded.label, layer = excluded.layer, track = excluded.track,
       fork = excluded.fork, tag = excluded.tag`
  );
  const tx = db.transaction((rows: Array<Record<string, string>>) => {
    for (const n of rows) {
      up.run(keccak256(toBytes(n.id)), n.label ?? n.id, n.layer ?? '', n.track ?? '', n.fork_target ?? '', n.tag ?? '');
    }
  });
  tx(nodes);
  return nodes.length;
}
