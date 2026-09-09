import { describe, it, expect } from 'vitest';
import { shortEnsError, dnsEncode, namehash } from '@/lib/ens';

describe('shortEnsError', () => {
  it('turns a viem revert dump into one line', () => {
    const viem = new Error(
      'The contract function "resolve" reverted with the following signature: 0x77209fe8\n' +
      'Unable to decode signature "0x77209fe8" as it was not found on the provided ABI.\n' +
      'Contract Call: address: 0xd26f… function: resolve(bytes name, bytes data)'
    );
    const short = shortEnsError(viem);
    expect(short).toBe('the Universal Resolver reverted for this name');
    expect(short).not.toContain('ABI');
    expect(short.split('\n')).toHaveLength(1);
  });

  it('says so when the RPC itself did not answer', () => {
    expect(shortEnsError(new Error('fetch failed'))).toBe('the Sepolia RPC did not answer');
  });

  it('keeps an unknown message, first line only and bounded', () => {
    const short = shortEnsError(new Error(`${'x'.repeat(400)}\nsecond line`));
    expect(short).toHaveLength(120);
    expect(short).not.toContain('second line');
  });
});

describe('ENS name encoding', () => {
  it('dns-encodes a three-label name', () => {
    expect(dnsEncode('a.ethplane.eth')).toBe('0x016108657468706c616e650365746800');
  });
  it('namehashes eth to the known value', () => {
    expect(namehash('eth')).toBe('0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae');
  });
});
