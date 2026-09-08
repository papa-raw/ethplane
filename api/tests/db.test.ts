import { describe, it, expect, beforeEach } from 'vitest';
import { db, initializeDatabase } from '../src/db';

describe('Database Schema', () => {
  beforeEach(() => {
    // Initialize database before each test
    initializeDatabase();
  });

  it('should create all required tables', () => {
    // Test that tables exist by trying to query them
    const tables = [
      'nodes', 'leases', 'lease_events', 'submissions', 
      'verdicts', 'attribution', 'releases', 'heads', 
      'board_lines', 'hosts', 'artifacts', 'cursor'
    ];
    
    for (const table of tables) {
      const result = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table);
      expect(result).toBeDefined();
    }
  });

  it('should create required indexes', () => {
    // Check that indexes exist
    const index1 = db.prepare(`SELECT name FROM sqlite_master WHERE type='index' AND name=?`).get('idx_events_node');
    const index2 = db.prepare(`SELECT name FROM sqlite_master WHERE type='index' AND name=?`).get('idx_attr_op');
    
    expect(index1).toBeDefined();
    expect(index2).toBeDefined();
  });
});