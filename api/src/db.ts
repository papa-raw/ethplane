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

// Create tables with the exact schema from the spec
export function initializeDatabase() {
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
      tx TEXT
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
      tx TEXT
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
      tx TEXT
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
