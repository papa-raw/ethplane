'use client';
import { createPublicClient, http, encodeFunctionData, decodeAbiParameters, toHex, keccak256, toBytes } from 'viem';
import { sepolia } from 'viem/chains';

/**
 * ENS reads go through the hackathon Universal Resolver, the same path a judge's wallet would use —
 * not through our own contracts. If this panel shows a record, ENS resolution genuinely works.
 * The RPC is a public endpoint (no key), which P7 measured as fast enough for this.
 */
export const UNIVERSAL_RESOLVER = '0xd26f2040D083Af1cD2962ba303F4BEa0c4faf142' as const;
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com';

const client = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });

const TEXT_ABI = [
  { type: 'function', name: 'text', stateMutability: 'view',
    inputs: [{ name: 'node', type: 'bytes32' }, { name: 'key', type: 'string' }],
    outputs: [{ name: '', type: 'string' }] },
] as const;

const UR_ABI = [
  { type: 'function', name: 'resolve', stateMutability: 'view',
    inputs: [{ name: 'name', type: 'bytes' }, { name: 'data', type: 'bytes' }],
    outputs: [{ name: '', type: 'bytes' }, { name: '', type: 'address' }] },
] as const;

export function dnsEncode(name: string): `0x${string}` {
  const parts = name.split('.').filter(Boolean);
  let out = '';
  for (const p of parts) {
    out += p.length.toString(16).padStart(2, '0');
    out += Buffer.from(p, 'utf8').toString('hex');
  }
  return `0x${out}00`;
}

export function namehash(name: string): `0x${string}` {
  let node = `0x${'00'.repeat(32)}` as `0x${string}`;
  if (!name) return node;
  for (const label of name.split('.').reverse()) {
    node = keccak256(`${node}${keccak256(toBytes(label)).slice(2)}` as `0x${string}`);
  }
  return node;
}

export async function readEnsText(name: string, key: string): Promise<{ value: string; resolver: string }> {
  const data = encodeFunctionData({ abi: TEXT_ABI, functionName: 'text', args: [namehash(name), key] });
  const [result, resolver] = (await client.readContract({
    address: UNIVERSAL_RESOLVER, abi: UR_ABI, functionName: 'resolve', args: [dnsEncode(name), data],
  })) as [`0x${string}`, `0x${string}`];
  const [value] = decodeAbiParameters([{ type: 'string' }], result);
  return { value, resolver };
}

export { toHex };
