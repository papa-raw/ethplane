'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePolling } from '@/lib/usePolling';
import { NodeRow, LeaseRow, SubmissionRow, AttributionRow, STATE_STYLE, stateOf } from '@/lib/api';
import { readEnsText, shortEnsError } from '@/lib/ens';
import { Panel } from './Panel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export type NodeDetail = {
  node: NodeRow;
  leases: LeaseRow[];
  lease_events: Array<{ kind: string; block: number; ts: number; lineage: string; lease_seq: number }>;
  submissions: SubmissionRow[];
  verdicts: Array<{ artifact_hash: string; passed: number; metric: string; ts: number; lease_seq: number }>;
  attribution: AttributionRow[];
  head?: { head: string; block: number } | null;
};

const KIND = ['winner', 'parents', 'verifier', 'compute', 'registrant'];
const PRIVY_POLICY = 'c8io5x5g08igo85ljedozu2k';
/** The contract's verbs stay as deployed; only what a reader sees changes. */
const SESSION_WORD: Record<string, string> = {
  claimed: 'started',
  heartbeat: 'heartbeat',
  expired: 'lapsed',
  'missed-heartbeat': 'lapsed, no heartbeat',
};

export function NodePage({ nodeId, slug, label }: { nodeId: string; slug: string | null; label: string | null }) {
  const poll = usePolling<NodeDetail>(`/api/nodes/${nodeId}`);
  return (
    <main className="mx-auto max-w-5xl px-6 py-10 space-y-6">
      <Link href="/" className="text-sm text-muted-foreground hover:underline">← all 65 nodes</Link>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">{label ?? nodeId.slice(0, 12)}</h1>
        <p className="font-mono text-xs text-muted-foreground break-all">{nodeId}</p>
      </header>

      <Panel poll={poll} empty="This node is not in the indexer yet." isEmpty={(d) => !d?.node}>
        {(d) => <Detail d={d} slug={slug} />}
      </Panel>
    </main>
  );
}

function Detail({ d, slug }: { d: NodeDetail; slug: string | null }) {
  const state = stateOf(d.node);
  const style = STATE_STYLE[state] ?? STATE_STYLE.seeded;
  const unregistered = state === 'seeded';
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-2 text-sm">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${style.dot}`} /> {style.label}
        </span>
        {d.node.layer ? <Badge variant="secondary">{d.node.layer}</Badge> : null}
        {d.node.track ? <Badge variant="outline">{d.node.track}</Badge> : null}
      </div>

      {unregistered ? <RegisterCard slug={slug} /> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <CriterionCard node={d.node} />
        <FundingCard node={d.node} />
      </div>

      <EnsCard slug={slug} />
      <Sessions events={d.lease_events} leases={d.leases} />
      <Submissions rows={d.submissions} verdicts={d.verdicts} head={d.head?.head ?? null} />
      <Attribution rows={d.attribution} />
    </div>
  );
}

/** PRD 3.21: a node nobody has registered shows how to register it, not a dead end. */
function RegisterCard({ slug }: { slug: string | null }) {
  return (
    <Card data-testid="register-control">
      <CardHeader><CardTitle className="text-base">Nobody has registered this node</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>
          In principle anybody can contribute to any node, and registering one is permissionless and
          free: take the name, then define the node with its criterion and split. Anyone may do it
          once, and the registrant keeps the registrant share of everything the node ever pays.
        </p>
        <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
{`# claim the ENS name (one call, no fee)
cast send $SUBREGISTRY "registerStrawmapNode(string,address,address)" \\
  "${slug ?? '<node-slug>'}" $YOU $RESOLVER --private-key $KEY

# then define the node on Ethplane
cast send $ETHPLANE "defineNode(bytes32,bytes32,uint8,address,uint64,uint64,(uint16,uint16,uint16,uint16,uint16),uint16,uint16)" ...`}
        </pre>
      </CardContent>
    </Card>
  );
}

function CriterionCard({ node }: { node: NodeRow }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Criterion</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>{node.criterion ?? 'Fewer VM cycles on the pinned command, with proof size and verify time not worse.'}</p>
        <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-xs">
          <dt className="text-muted-foreground">criterion hash</dt>
          <dd className="font-mono break-all">{node.criterion_hash ?? '—'}</dd>
          <dt className="text-muted-foreground">head</dt>
          <dd className="font-mono break-all">{node.head ?? 'no verified submission yet'}</dd>
        </dl>
      </CardContent>
    </Card>
  );
}

/** The escrow, and the policy that guards it — the refusal is part of the story (PRD 3.5). */
function FundingCard({ node }: { node: NodeRow }) {
  const plane = node.bounty && node.bounty !== '0' ? `${(Number(node.bounty) / 1e18).toLocaleString()} PLANE` : 'unfunded';
  return (
    <Card data-testid="funding-card">
      <CardHeader><CardTitle className="text-base">Escrow</CardTitle></CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-lg font-medium">{plane}</p>
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>The contract holds the escrow. It pays on a verified improvement, in proportion to cumulative progress.</p>
          <p>Treasury wallet policy <span className="font-mono">{PRIVY_POLICY}</span> allows exactly three things:</p>
          <ul className="list-disc pl-4">
            <li>defineNode on the Ethplane contract, and nothing else on it</li>
            <li>fundNode, capped at 100,000e18 per call</li>
            <li>the same two for signing as well as sending, because policy rules are per RPC method</li>
          </ul>
          <p>Anything else is refused by Privy before it is signed: <span className="font-mono">RPC request denied due to policy violation</span>.</p>
        </div>
      </CardContent>
    </Card>
  );
}

/** Read through the Universal Resolver, so this panel proves ENS resolution rather than asserting it. */
function EnsCard({ slug }: { slug: string | null }) {
  const name = slug ? `${slug}.ethplane.eth` : null;
  const [state, setState] = useState<{ value?: string; resolver?: string; error?: string; detail?: string; loading: boolean }>({ loading: true });
  useEffect(() => {
    if (!name) { setState({ loading: false, error: 'no ENS name for this node' }); return; }
    let alive = true;
    readEnsText(name, 'ethplane.status')
      .then((r) => alive && setState({ ...r, loading: false }))
      .catch((e) => {
        if (!alive) return;
        console.warn('ENS read failed', e);
        setState({ loading: false, error: shortEnsError(e), detail: e instanceof Error ? e.message : String(e) });
      });
    return () => { alive = false; };
  }, [name]);
  return (
    <Card data-testid="ens-card">
      <CardHeader><CardTitle className="text-base">ENS</CardTitle></CardHeader>
      <CardContent className="space-y-1 text-sm">
        <p className="font-mono">{name ?? '—'}</p>
        {state.loading ? <p className="text-muted-foreground">reading through the Universal Resolver…</p> : null}
        {state.error ? (
          <p className="text-muted-foreground" title={state.detail}>no record yet: {state.error}</p>
        ) : null}
        {state.value ? (
          <>
            <p><span className="text-muted-foreground">ethplane.status</span> {state.value}</p>
            <p className="font-mono text-xs text-muted-foreground break-all">resolver {state.resolver}</p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Sessions({ events, leases }: { events: NodeDetail['lease_events']; leases: LeaseRow[] }) {
  return (
    <Card data-testid="sessions">
      <CardHeader><CardTitle className="text-base">Sessions</CardTitle></CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No session has been started on this node yet. A session is not permission and not
            exclusivity: it is a declaration that you are working from a particular head, kept alive
            by heartbeats, so that what you submit carries its provenance and a worker who goes
            silent lapses instead of holding the node.
          </p>
        ) : (
          <ol className="space-y-2 text-sm">
            {events.map((e, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-2">
                <Badge variant={e.kind === 'claimed' ? 'default' : 'secondary'}>{SESSION_WORD[e.kind] ?? e.kind}</Badge>
                <span className="font-mono text-xs">{e.lineage?.slice(0, 10)}…</span>
                <span className="text-muted-foreground text-xs">session {e.lease_seq} · block {e.block}</span>
              </li>
            ))}
          </ol>
        )}
        {leases.some((l) => l.active) ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {leases.filter((l) => l.active).length} active session(s). In principle anybody can
            contribute to any node, and many sessions run on one node at once.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Submissions({ rows, verdicts, head }: { rows: SubmissionRow[]; verdicts: NodeDetail['verdicts']; head: string | null }) {
  const verdictFor = (h: string) => verdicts.find((v) => v.artifact_hash === h);
  return (
    <Card data-testid="submissions">
      <CardHeader><CardTitle className="text-base">Submissions</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing submitted yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>artifact</TableHead><TableHead>lineage</TableHead><TableHead>cycles</TableHead><TableHead>verdict</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => {
                const v = verdictFor(s.artifact_hash);
                return (
                  <TableRow key={s.artifact_hash}>
                    <TableCell className="font-mono text-xs">
                      {s.artifact_hash.slice(0, 12)}…{head === s.artifact_hash ? <Badge className="ml-2">head</Badge> : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{s.lineage?.slice(0, 10)}…</TableCell>
                    <TableCell className="text-xs">{v?.metric ?? '—'}</TableCell>
                    <TableCell className="text-xs">{v ? (v.passed ? 'pass' : 'fail') : 'pending'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function Attribution({ rows }: { rows: AttributionRow[] }) {
  return (
    <Card data-testid="attribution">
      <CardHeader><CardTitle className="text-base">Attribution</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payouts yet: rows appear when a submission passes.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>who</TableHead><TableHead>kind</TableHead><TableHead>PLANE</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">{r.operator?.slice(0, 12)}…</TableCell>
                  <TableCell className="text-xs">{KIND[r.kind] ?? r.kind}</TableCell>
                  <TableCell className="text-xs">{(Number(r.weight) / 1e18).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
