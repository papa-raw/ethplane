import fs from 'fs';
import path from 'path';
import { keccak256, toBytes } from 'viem';

/** Build-time only: the 65 ids, so every node page is exported and a deep link 200s. */
export function strawmapIds(): { id: string; label: string; hash: string }[] {
  const candidates = [
    path.join(process.cwd(), '..', 'research', 'strawmap-nodes.json'),
    path.join(process.cwd(), 'research', 'strawmap-nodes.json'),
  ];
  const file = candidates.find((c) => fs.existsSync(c));
  if (!file) return [];
  const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const nodes: Array<{ id: string; label?: string }> = parsed.nodes ?? parsed;
  return nodes.map((n) => ({ id: n.id, label: n.label ?? n.id, hash: keccak256(toBytes(n.id)) }));
}
