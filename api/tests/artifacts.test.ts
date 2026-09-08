import { describe, it, expect, beforeEach } from 'vitest';
import { createHash } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

const dir = path.join(os.tmpdir(), 'ethplane-artifacts-test');
process.env.ARTIFACT_DIR = dir;
process.env.DB_PATH = '/tmp/ethplane-artifacts.db';

const body = Buffer.from('pretend this is a tarball');
const hash = '0x' + createHash('sha256').update(body).digest('hex');

async function app() {
  const Fastify = (await import('fastify')).default;
  const routes = (await import('../src/routes/artifacts')).default;
  const a = Fastify();
  await a.register(routes, { prefix: '/api' });
  return a;
}

beforeEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

describe('artifacts', () => {
  it('stores an upload under the hash of what actually arrived, and serves it back', async () => {
    const a = await app();
    const post = await a.inject({
      method: 'POST', url: '/api/artifacts', payload: body, headers: { 'content-type': 'application/gzip' },
    });
    expect(post.statusCode).toBe(201);
    expect(JSON.parse(post.body).hash).toBe(hash);

    const get = await a.inject({ method: 'GET', url: `/api/artifacts/${hash}` });
    expect(get.statusCode).toBe(200);
    expect(Buffer.from(get.rawPayload)).toEqual(body);
    await a.close();
  });

  it('refuses an upload whose claimed hash is not the hash of its bytes', async () => {
    const a = await app();
    const res = await a.inject({
      method: 'POST', url: '/api/artifacts', payload: body,
      headers: { 'content-type': 'application/gzip', 'x-artifact-hash': '0x' + '22'.repeat(32) },
    });
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).actual).toBe(hash);
    await a.close();
  });

  it('404s an unknown hash and 400s a malformed one', async () => {
    const a = await app();
    expect((await a.inject({ method: 'GET', url: `/api/artifacts/0x${'33'.repeat(32)}` })).statusCode).toBe(404);
    expect((await a.inject({ method: 'GET', url: '/api/artifacts/not-a-hash' })).statusCode).toBe(400);
    await a.close();
  });
});
