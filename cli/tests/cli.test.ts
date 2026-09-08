import { describe, it, expect, vi } from 'vitest';
import { readNode, namehash, dnsEncode, NODE_KEYS } from '../src/ens';
import { fetchArtifact, sha256 } from '../src/artifacts';
import type { PublicClient } from 'viem';
import { encodeAbiParameters } from 'viem';

/** A client that answers resolve() with an encoded string, the way the Universal Resolver does. */
function clientReturning(values: Record<string, string>): PublicClient {
  return {
    readContract: vi.fn(async ({ args }: { args: [string, string] }) => {
      // the second arg is text(node,key) calldata; the key is the only thing we need to match on
      const calldata = args[1] as string;
      const key = Object.keys(values).find((k) => calldata.includes(Buffer.from(k, 'utf8').toString('hex')));
      return [encodeAbiParameters([{ type: 'string' }], [key ? values[key] : '']), '0xres'];
    }),
  } as unknown as PublicClient;
}

describe('resolve', () => {
  it('reads the four node records through the Universal Resolver', async () => {
    const records = await readNode(
      clientReturning({ 'ethplane.status': 'open', 'ethplane.criterion': 'cycles < 1,542,812' }),
      'cl-pq.ethplane.eth'
    );
    expect(records['ethplane.status']).toBe('open');
    expect(records['ethplane.criterion']).toBe('cycles < 1,542,812');
    expect(records['ethplane.head']).toBe('');
    expect(Object.keys(records)).toEqual([...NODE_KEYS]);
  });

  it('treats an unreadable record as absent rather than as a crash', async () => {
    const client = { readContract: vi.fn().mockRejectedValue(new Error('reverted')) } as unknown as PublicClient;
    const records = await readNode(client, 'nothing.ethplane.eth');
    expect(Object.values(records).every((v) => v === '')).toBe(true);
  });

  it('encodes names the way ENS does', () => {
    expect(dnsEncode('probe.ethplane.eth')).toBe('0x0570726f626508657468706c616e650365746800');
    expect(namehash('eth')).toBe('0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae');
  });
});

describe('join', () => {
  const body = Buffer.from('a tarball, more or less');
  const hash = sha256(body);

  it('accepts an artifact whose bytes hash to the head it was fetched under', async () => {
    const fake = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => body }) as unknown as typeof fetch;
    await expect(fetchArtifact(hash, 'https://api.test', fake)).resolves.toEqual(body);
  });

  it('aborts on a hash mismatch instead of unpacking someone else’s code', async () => {
    const wrong = '0x' + '11'.repeat(32);
    const fake = vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => body }) as unknown as typeof fetch;
    await expect(fetchArtifact(wrong, 'https://api.test', fake)).rejects.toThrow(/hash mismatch/);
  });

  it('reports the status code when the API refuses', async () => {
    const fake = vi.fn().mockResolvedValue({ ok: false, status: 404 }) as unknown as typeof fetch;
    await expect(fetchArtifact(hash, 'https://api.test', fake)).rejects.toThrow(/responded 404/);
  });
});
