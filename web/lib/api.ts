/**
 * Every field on this dashboard comes from an endpoint, never from a guess (PRD 3.15). The base is
 * same-origin because the export is served by the same nginx that proxies /api; NEXT_PUBLIC_API_BASE
 * only exists so `pnpm dev` can point at a machine running the API.
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

export type NodeRow = {
  node_id: string;
  label: string | null;
  layer: string | null;
  track: string | null;
  fork: string | null;
  tag: string | null;
  state: string | null;
  bounty: string | null;
  criterion: string | null;
  criterion_hash: string | null;
  ens_name: string | null;
  head: string | null;
  active_lease_count: number | null;
};

export type LeaseRow = {
  node_id: string; lineage: string; operator: string; lease_seq: number;
  start: number; expiry: number; last_heartbeat: number; from_hash: string | null; active: number;
};

export type SubmissionRow = {
  artifact_hash: string; node_id: string; lineage: string; operator: string;
  lease_seq: number; parents: string | null; block: number; ts: number; tx: string;
};

export type AttributionRow = {
  node_id: string; operator: string; kind: number; weight: string;
  artifact_hash: string | null; block: number; ts: number; tx: string;
};

export async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { signal, headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`${path} responded ${res.status}`);
  return (await res.json()) as T;
}

/** The five states a node can be in, and the one colour each is allowed to use. */
export const STATE_STYLE: Record<string, { label: string; dot: string; ring: string }> = {
  seeded:   { label: 'seeded',   dot: 'bg-zinc-400',   ring: 'ring-zinc-300' },
  defined:  { label: 'defined',  dot: 'bg-sky-500',    ring: 'ring-sky-300' },
  funded:   { label: 'funded',   dot: 'bg-sky-600',    ring: 'ring-sky-400' },
  open:     { label: 'open',     dot: 'bg-violet-500', ring: 'ring-violet-300' },
  claimed:  { label: 'claimed',  dot: 'bg-amber-500',  ring: 'ring-amber-300' },
  passed:   { label: 'passed',   dot: 'bg-emerald-500', ring: 'ring-emerald-300' },
  closed:   { label: 'closed',   dot: 'bg-zinc-600',   ring: 'ring-zinc-400' },
};

export function stateOf(n: NodeRow): string {
  if ((n.active_lease_count ?? 0) > 0) return 'claimed';
  if (n.head) return 'passed';
  return n.state ?? 'seeded';
}
