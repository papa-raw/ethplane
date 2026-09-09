import { createPublicClient, http, encodeFunctionData, decodeAbiParameters, keccak256, toBytes } from 'viem';
import { sepolia } from 'viem/chains';
import type { PublicClient } from 'viem';

/** The hackathon Universal Resolver: reads go the same way a wallet's would, not through our API. */
export const UNIVERSAL_RESOLVER = '0xd26f2040D083Af1cD2962ba303F4BEa0c4faf142' as const;
export const DEFAULT_RPC = 'https://ethereum-sepolia-rpc.publicnode.com';

/** The four records a node carries (PRD 3.4). Order is the order they are printed in. */
export const NODE_KEYS = ['ethplane.status', 'ethplane.criterion', 'ethplane.head', 'ethplane.lease'] as const;
export type NodeKey = (typeof NODE_KEYS)[number];

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

export function makeClient(rpcUrl = process.env.SEPOLIA_RPC_URL || DEFAULT_RPC): PublicClient {
  return createPublicClient({ chain: sepolia, transport: http(rpcUrl) }) as PublicClient;
}

export function dnsEncode(name: string): `0x${string}` {
  const hex = name
    .split('.')
    .filter(Boolean)
    .map((p) => p.length.toString(16).padStart(2, '0') + Buffer.from(p, 'utf8').toString('hex'))
    .join('');
  return `0x${hex}00`;
}

export function namehash(name: string): `0x${string}` {
  let node = `0x${'00'.repeat(32)}` as `0x${string}`;
  if (!name) return node;
  for (const label of name.split('.').reverse()) {
    node = keccak256(`${node}${keccak256(toBytes(label)).slice(2)}` as `0x${string}`);
  }
  return node;
}

/** One record. An unset record is an empty string, not an error: "no record" is a real answer. */
export async function readText(client: PublicClient, name: string, key: string): Promise<string> {
  const data = encodeFunctionData({ abi: TEXT_ABI, functionName: 'text', args: [namehash(name), key] });
  try {
    const res = (await client.readContract({
      address: UNIVERSAL_RESOLVER, abi: UR_ABI, functionName: 'resolve', args: [dnsEncode(name), data],
    })) as [`0x${string}`, `0x${string}`];
    const [value] = decodeAbiParameters([{ type: 'string' }], res[0]);
    return value;
  } catch {
    return '';
  }
}

/**
 * The contract's id for a worknode: keccak of the label, which is what defineNode was called with
 * and what the site exports its pages under. The ENS label and the id are not interchangeable in a
 * URL, and printing the label as one is how the CLI sent guests to a 404.
 */
export function nodeIdFor(labelOrName: string): `0x${string}` {
  return keccak256(toBytes(labelOrName.split('.')[0]));
}

export async function readNode(client: PublicClient, name: string): Promise<Record<NodeKey, string>> {
  const values = await Promise.all(NODE_KEYS.map((k) => readText(client, name, k)));
  return Object.fromEntries(NODE_KEYS.map((k, i) => [k, values[i]])) as Record<NodeKey, string>;
}
