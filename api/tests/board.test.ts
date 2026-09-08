import { describe, it, expect } from 'vitest';

process.env.DB_PATH = process.env.DB_PATH ?? '/tmp/ethplane-vitest.db';

describe('board routes', () => {
  it('exports a fastify plugin', async () => {
    const mod = await import('../src/routes/board');
    const plugin = (mod as { default?: unknown }).default ?? (mod as Record<string, unknown>).boardRoutes;
    expect(typeof plugin).toBe('function');
  });
});
