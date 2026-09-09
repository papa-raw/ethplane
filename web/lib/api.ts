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
  claimed:  { label: 'in session',  dot: 'bg-amber-500',  ring: 'ring-amber-300' },
  passed:   { label: 'passed',   dot: 'bg-emerald-500', ring: 'ring-emerald-300' },
  closed:   { label: 'closed',   dot: 'bg-zinc-600',   ring: 'ring-zinc-400' },
};

/**
 * The state a reader is shown. The state column wins wherever it is specific, so a node the API
 * calls `open` stays open even while a session runs on it; where the column is only a base state,
 * the live columns are more current than the indexer and fill it in. Derivation is by node_id from
 * the API's own row — never a name match (BRIEF §2 refusal 8).
 */
export function stateOf(n: NodeRow): string {
  const s = apiState(n);
  if (s === 'open' || s === 'passed' || s === 'closed') return s;
  if ((n.active_lease_count ?? 0) > 0) return 'claimed';
  if (n.head) return 'passed';
  return s;
}

/**
 * The state column exactly as the API returns it, with no derivation on top. The node list reads
 * this directly; the map reads `stateOf`, which returns the column unchanged whenever it is
 * specific, so both highlight the same chips. What refusal 8 actually requires is that the
 * identity be the API's `node_id` and never a label match, and both paths satisfy that. The
 * coupling is worth knowing before changing `stateOf`'s precedence: if a derived state could ever
 * win over `open`, the map's highlight would go with it while the list's would not.
 */
export function apiState(n: NodeRow): string {
  const s = (n.state ?? '').trim().toLowerCase();
  return s.length > 0 ? s : 'seeded';
}

export function isOpen(n: NodeRow): boolean {
  return apiState(n) === 'open';
}

/** One colour per state, from the tokens. `unknown` is the colour of "the API did not answer". */
export const STATE_INK: Record<string, string> = {
  seeded: 'var(--ep-secondary)',
  defined: 'var(--ep-state-defined)',
  funded: 'var(--ep-state-defined)',
  open: 'var(--ep-primary)',
  claimed: 'var(--ep-state-claimed)',
  passed: 'var(--ep-state-passed)',
  closed: 'var(--ep-secondary)',
  unknown: 'var(--ep-state-unknown)',
};

/* ---------------------------------------------------------------------------------------------
 * Sessions. The contract and the indexer call these leases and their JSON keys stay as deployed;
 * every name a reader can reach is a session (BRIEF §3, vocabulary). The rename happens here, at
 * the edge, so the words "lease" and "lease_seq" live in one file instead of across the pages.
 * ------------------------------------------------------------------------------------------- */
export type SessionRow = {
  nodeId: string; lineage: string; operator: string; seq: number;
  start: number; expiry: number; lastHeartbeat: number; fromHash: string | null; active: boolean;
};
export type SessionEvent = { kind: string; block: number; ts: number; lineage: string; seq: number };
export type VerdictRow = { artifactHash: string; passed: boolean; metric: string; ts: number; seq: number };
export type SubmissionView = {
  artifactHash: string; lineage: string; operator: string; seq: number; block: number; ts: number; tx: string;
};

export type RawNodeDetail = {
  node: NodeRow;
  leases?: LeaseRow[];
  lease_events?: Array<{ kind: string; block: number; ts: number; lineage: string; lease_seq: number }>;
  submissions?: SubmissionRow[];
  verdicts?: Array<{ artifact_hash: string; passed: number; metric: string; ts: number; lease_seq: number }>;
  attribution?: AttributionRow[];
  head?: { head: string; block: number } | null;
};

export type NodeDetail = {
  node: NodeRow;
  sessions: SessionRow[];
  sessionEvents: SessionEvent[];
  submissions: SubmissionView[];
  verdicts: VerdictRow[];
  attribution: AttributionRow[];
  head: string | null;
};

export function toNodeDetail(raw: RawNodeDetail): NodeDetail {
  return {
    node: raw.node,
    sessions: (raw.leases ?? []).map((l) => ({
      nodeId: l.node_id, lineage: l.lineage, operator: l.operator, seq: l.lease_seq,
      start: l.start, expiry: l.expiry, lastHeartbeat: l.last_heartbeat,
      fromHash: l.from_hash, active: Boolean(l.active),
    })),
    sessionEvents: (raw.lease_events ?? []).map((e) => ({
      kind: e.kind, block: e.block, ts: e.ts, lineage: e.lineage, seq: e.lease_seq,
    })),
    submissions: (raw.submissions ?? []).map((s) => ({
      artifactHash: s.artifact_hash, lineage: s.lineage, operator: s.operator, seq: s.lease_seq,
      block: s.block, ts: s.ts, tx: s.tx,
    })),
    verdicts: (raw.verdicts ?? []).map((v) => ({
      artifactHash: v.artifact_hash, passed: Boolean(v.passed), metric: v.metric, ts: v.ts, seq: v.lease_seq,
    })),
    attribution: raw.attribution ?? [],
    head: raw.head?.head ?? null,
  };
}
