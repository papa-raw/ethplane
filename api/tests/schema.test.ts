import { describe, it, expect, beforeEach } from 'vitest';
import { db, initializeDatabase } from '../src/db';

describe('Database Schema Validation', () => {
  beforeEach(() => {
    // Initialize database before each test
    initializeDatabase();
  });

  it('should match the spec schema from spec-api.md', () => {
    // Check all tables exist with correct columns
    const tables = [
      { name: 'nodes', columns: ['node_id', 'label', 'layer', 'track', 'fork', 'tag', 'ef_tier', 'criterion_type', 'criterion', 'routing_mode', 'state', 'bounty', 'criterion_hash', 'ens_name', 'opened_block'] },
      { name: 'leases', columns: ['node_id', 'lineage', 'operator', 'lease_seq', 'start', 'expiry', 'last_heartbeat', 'from_hash', 'active'] },
      { name: 'lease_events', columns: ['id', 'node_id', 'lineage', 'lease_seq', 'kind', 'block', 'ts', 'tx', 'log_index', 'removed'] },
      { name: 'submissions', columns: ['artifact_hash', 'node_id', 'lineage', 'operator', 'guest_name', 'lease_seq', 'parents', 'block', 'ts', 'tx'] },
      { name: 'verdicts', columns: ['id', 'node_id', 'artifact_hash', 'lease_seq', 'passed', 'metric', 'metric_hash', 'spread', 'block', 'ts', 'tx'] },
      { name: 'attribution', columns: ['id', 'node_id', 'operator', 'lineage', 'kind', 'weight', 'artifact_hash', 'block', 'ts', 'tx'] },
      { name: 'releases', columns: ['id', 'node_id', 'to_addr', 'amount', 'lease_seq', 'block', 'ts', 'tx'] },
      { name: 'heads', columns: ['node_id', 'head', 'block', 'ts'] },
      { name: 'board_lines', columns: ['id', 'host', 'ts', 'role', 'kind', 'text', 'mode', 'reason'] },
      { name: 'hosts', columns: ['host', 'lineage', 'model', 'last_seen', 'status'] },
      { name: 'artifacts', columns: ['artifact_hash', 'path', 'size', 'ts'] },
      { name: 'cursor', columns: ['k', 'v'] }
    ];

    for (const table of tables) {
      const result = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table.name);
      expect(result).toBeDefined();
      
      // Check columns
      const columns = db.prepare(`PRAGMA table_info(${table.name})`).all() as Array<{ name: string }>;
      const columnNames = columns.map(col => col.name);
      
      for (const column of table.columns) {
        expect(columnNames).toContain(column);
      }
    }
  });

  it('should have required indexes', () => {
    // Check that indexes exist
    const index1 = db.prepare(`SELECT name FROM sqlite_master WHERE type='index' AND name=?`).get('idx_events_node');
    const index2 = db.prepare(`SELECT name FROM sqlite_master WHERE type='index' AND name=?`).get('idx_attr_op');
    
    expect(index1).toBeDefined();
    expect(index2).toBeDefined();
  });
});