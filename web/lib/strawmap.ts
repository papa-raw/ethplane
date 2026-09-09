import fs from 'fs';
import path from 'path';
import { keccak256, toBytes } from 'viem';

/** Build-time only: the whole strawmap record for each node, structure included. The picture is
 *  drawn from this file rather than from the API, so the map still renders when the API is down —
 *  only the colours need the live state. */
export function strawmapNodes(): Array<{
  id: string; label: string; hash: string; layer: string; track: string; fork_target: string;
  tag?: string; throughlines_to?: string[];
}> {
  const parsed = readParsed();
  return parsed.map((n) => ({
    id: n.id,
    label: n.label ?? n.id,
    hash: keccak256(toBytes(n.id)),
    layer: n.layer ?? 'unclassified',
    track: n.track ?? 'other',
    fork_target: n.fork_target ?? 'longer term',
    tag: n.tag,
    throughlines_to: (n.throughlines_to as unknown as string[]) ?? [],
  }));
}

function readParsed(): Array<Record<string, string>> {
  const candidates = [
    path.join(process.cwd(), '..', 'research', 'strawmap-nodes.json'),
    path.join(process.cwd(), 'research', 'strawmap-nodes.json'),
  ];
  const file = candidates.find((c) => fs.existsSync(c));
  if (!file) return [];
  const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
  return parsed.nodes ?? parsed;
}

/** Build-time only: the 65 ids, so every node page is exported and a deep link 200s. Each carries
 *  the summary written into research/strawmap-nodes.json: a plain sentence for a reader who does not
 *  know what the roadmap item is. */
export function strawmapIds(): { id: string; label: string; hash: string; summary: string | null }[] {
  const candidates = [
    path.join(process.cwd(), '..', 'research', 'strawmap-nodes.json'),
    path.join(process.cwd(), 'research', 'strawmap-nodes.json'),
  ];
  const file = candidates.find((c) => fs.existsSync(c));
  if (!file) return [];
  const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const nodes: Array<{ id: string; label?: string; summary?: string }> = parsed.nodes ?? parsed;
  return nodes.map((n) => ({
    id: n.id, label: n.label ?? n.id, hash: keccak256(toBytes(n.id)), summary: n.summary ?? null,
  }));
}
