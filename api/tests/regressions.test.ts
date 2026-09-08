import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';

/** Both bugs found live on 2026-09-09, each with the test that would have caught it. */
const DB = '/tmp/ethplane-regressions.db';
process.env.DB_PATH = DB;
process.env.ETHPLANE_ADDRESS = '0x0000000000000000000000000000000000000abc';

const NODE = '0x8e67c816b1f39fa072094b67f4f74937bd1920a7a9d79e4b98e785ae9aa29d58';

beforeEach(() => {
  if (fs.existsSync(DB)) fs.unlinkSync(DB);
  vi.resetModules();
});

describe('indexer regressions', () => {
  it('applies NodeDefined and NodeFunded to the row, not just to the log table', async () => {
    const { db, initializeDatabase } = await import('../src/db');
    initializeDatabase();
    const { storeEvent } = await import('../src/indexer');
    const meta = { block: 11662931, ts: 1, tx: '0xtx', logIndex: 0, removed: false };

    storeEvent('NodeDefined', { nodeId: NODE, registrant: '0xdead', criterionHash: '0xcrit' }, meta);
    storeEvent('NodeFunded', { nodeId: NODE, funder: '0xdead', amount: '1', bounty: '10000000000000000000000' },
      { ...meta, block: 11662939 });

    const row = db.prepare('SELECT state, bounty, criterion_hash FROM nodes WHERE node_id = ?').get(NODE) as
      { state: string; bounty: string; criterion_hash: string };
    expect(row.state).toBe('funded');
    expect(row.bounty).toBe('10000000000000000000000');
    expect(row.criterion_hash).toBe('0xcrit');
  });

  it('advances the cursor across two passes', async () => {
    const { initializeDatabase, db } = await import('../src/db');
    initializeDatabase();
    const indexer = await import('../src/indexer');
    const head = { n: 11663010n };
    vi.spyOn(indexer.client, 'getBlockNumber').mockImplementation(async () => head.n);
    vi.spyOn(indexer.client, 'getLogs').mockResolvedValue([] as never);

    process.env.START_BLOCK = '11663000';
    await indexer.runIndexer();
    const first = (db.prepare(`SELECT v FROM cursor WHERE k='block'`).get() as { v: number }).v;
    expect(first).toBe(11663010);

    head.n = 11663050n;
    await indexer.runIndexer();
    const second = (db.prepare(`SELECT v FROM cursor WHERE k='block'`).get() as { v: number }).v;
    expect(second).toBe(11663050);
    expect(second).toBeGreaterThan(first);
    delete process.env.START_BLOCK;
  });

  it('keeps going when one log cannot be handled, and says which', async () => {
    const { initializeDatabase } = await import('../src/db');
    initializeDatabase();
    const indexer = await import('../src/indexer');
    vi.spyOn(indexer.client, 'getBlockNumber').mockResolvedValue(11663010n);
    // a log with rubbish topics: decodeEventLog throws, and the pass must survive it
    vi.spyOn(indexer.client, 'getLogs').mockResolvedValue([
      { data: '0x', topics: ['0x' + 'ff'.repeat(32)], blockNumber: 11663001n, transactionHash: '0xbad', logIndex: 3, removed: false },
    ] as never);
    const errors: string[] = [];
    vi.spyOn(console, 'error').mockImplementation((m) => { errors.push(String(m)); });
    process.env.START_BLOCK = '11663000';
    await expect(indexer.runIndexer()).resolves.toBeTypeOf('number');
    expect(errors.join(' ')).toContain('0xbad');
    delete process.env.START_BLOCK;
  });
});

describe('detail route', () => {
  it('returns the row for an id that /nodes lists, rather than an empty object', async () => {
    const { db, initializeDatabase } = await import('../src/db');
    initializeDatabase();
    db.prepare(`INSERT INTO nodes(node_id, label, state, bounty) VALUES(?,?,?,?)`).run(NODE, 'PQ', 'open', '10');

    const Fastify = (await import('fastify')).default;
    const routes = (await import('../src/routes/nodes')).default;
    const app = Fastify();
    await app.register(routes, { prefix: '/api' });

    const list = await app.inject({ method: 'GET', url: '/api/nodes' });
    expect(JSON.parse(list.body).map((n: { node_id: string }) => n.node_id)).toContain(NODE);

    const detail = await app.inject({ method: 'GET', url: `/api/nodes/${NODE}` });
    const body = JSON.parse(detail.body);
    expect(body.node, 'the detail route emptied a populated row').toMatchObject({ node_id: NODE, state: 'open' });
    await app.close();
  });
});

describe('join flow', () => {
  it('refuses every request when Privy is not configured, rather than trusting the caller', async () => {
    delete process.env.PRIVY_APP_ID;
    delete process.env.PRIVY_APP_SECRET;
    const { initializeDatabase } = await import('../src/db');
    initializeDatabase();
    const Fastify = (await import('fastify')).default;
    const app = Fastify();
    await app.register((await import('../src/routes/join')).default, { prefix: '/api' });
    const res = await app.inject({ method: 'POST', url: '/api/join', headers: { authorization: 'Bearer x' } });
    expect(res.statusCode).toBe(503);
    expect(JSON.parse(res.body).error).toContain('not configured');
    await app.close();
  });

  it('rejects a request with no bearer token once configured', async () => {
    process.env.PRIVY_APP_ID = 'app';
    process.env.PRIVY_APP_SECRET = 'secret';
    const { initializeDatabase } = await import('../src/db');
    initializeDatabase();
    const Fastify = (await import('fastify')).default;
    const app = Fastify();
    await app.register((await import('../src/routes/join')).default, { prefix: '/api' });
    const res = await app.inject({ method: 'POST', url: '/api/join' });
    expect(res.statusCode).toBe(401);
    await app.close();
    delete process.env.PRIVY_APP_ID;
    delete process.env.PRIVY_APP_SECRET;
  });

  it('gives a returning wallet the same guest name and reports registration state', async () => {
    const { db, initializeDatabase } = await import('../src/db');
    initializeDatabase();
    const now = Math.floor(Date.now() / 1000);
    db.prepare(`INSERT INTO guests(privy_user_id, wallet, guest_name, created_at) VALUES(?,?,?,?)`)
      .run('did:privy:1', '0xAbC', 'judge-1', now);
    db.prepare(`INSERT INTO pending_names(label, owner, resolver, expiry, registered, created_at) VALUES(?,?,?,?,0,?)`)
      .run('judge-1', '0xAbC', '0xres', now + 100, now);

    const Fastify = (await import('fastify')).default;
    const app = Fastify();
    await app.register((await import('../src/routes/join')).default, { prefix: '/api' });
    // case-insensitive: a wallet is the same wallet however it is cased
    const res = await app.inject({ method: 'GET', url: '/api/guests/0xabc' });
    expect(JSON.parse(res.body)).toEqual({ guestName: 'judge-1', registered: false });
    const missing = await app.inject({ method: 'GET', url: '/api/guests/0xnobody' });
    expect(missing.statusCode).toBe(404);
    await app.close();
  });
});
