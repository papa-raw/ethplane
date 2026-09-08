import Database from 'better-sqlite3';
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

  // Create indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_events_node ON lease_events(node_id, block)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_attr_op ON attribution(operator)`);
}