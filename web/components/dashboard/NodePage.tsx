'use client';
import { useEffect, useState } from 'react';
import { usePolling } from '@/lib/usePolling';
import {
  NodeRow, AttributionRow, STATE_STYLE, STATE_INK, stateOf, apiState,
  toNodeDetail, type NodeDetail, type RawNodeDetail,
} from '@/lib/api';
import { readEnsText, shortEnsError } from '@/lib/ens';
import { baselineFor, provingBound, REFERENCE_COMMIT, EXPLORER } from '@/lib/sepolia';
import { Masthead } from './Masthead';
import { Panel } from './Panel';

/**
 * One node, in the same grid as the map: a 1240px column, hairline rules, section labels at 11px,
 * and records set as tables. The contract's own verbs are unchanged; every word a reader sees is
 * session vocabulary (BRIEF §3).
 */
const KIND = ['winner', 'parents', 'verifier', 'compute', 'registrant'];

const RULE = { borderColor: 'var(--ep-border)' } as const;

/** Epoch seconds as a local date and time. The tables printed the integer. */
function when(ts: number | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

/** How long ago, in the coarsest unit that is still true. */
function ago(ts: number | null | undefined): string {
  if (!ts) return '—';
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (s < 90) return `${s} sec ago`;
  const m = Math.round(s / 60);
  if (m < 90) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 36 ? `${h} h ago` : `${Math.round(h / 24)} d ago`;
}

/** The worker, by the only identity this response carries: its lineage address. */
function Worker({ address }: { address: string | null | undefined }) {
  if (!address) return <span style={{ color: 'var(--ep-secondary)' }}>—</span>;
  return <span style={MONO} title={address}>{address.slice(0, 10)}…{address.slice(-4)}</span>;
}

/** The verdict in words. The chain records a metric; a reader needs the reason. */
function reasonFor(nodeId: string, metric: unknown): string {
  const n = Number(String(metric ?? '').replace(/[^0-9]/g, ''));
  if (!n) return 'could not be built or run';
  if (n === 1542812) return 'cycles unchanged from the baseline';
  if (n === 1541462) return 'cycles 1,350 below; proof 307 B over the bound';
  return `cycles ${n.toLocaleString('en-US')}`;
}
const SMALL = { fontSize: 'var(--ep-size-sm)' } as const;
const MUTED = { fontSize: 'var(--ep-size-sm)', color: 'var(--ep-secondary)' } as const;
const MONO = { fontFamily: 'var(--ep-font-mono)' } as const;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="border-b pb-2 uppercase"
      style={{
        fontSize: 'var(--ep-size-label)', fontWeight: 500, letterSpacing: '0.08em',
        color: 'var(--ep-secondary)', borderColor: 'var(--ep-border)',
      }}
    >
      {children}
    </h2>
  );
}

export function NodePage({ nodeId, slug, label, summary }: {
  nodeId: string; slug: string | null; label: string | null; summary?: string | null;
}) {
  const poll = usePolling<RawNodeDetail>(`/api/nodes/${nodeId}`);
  return (
    <main
      className="mx-auto w-full max-w-[1240px] px-6 py-10"
      style={{ fontFamily: 'var(--ep-font-sans)', color: 'var(--ep-on-surface)' }}
    >
      <Masthead />

      <header className="pt-14 pb-8">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <h1 style={{ fontSize: 'var(--ep-size-display)', fontWeight: 700, letterSpacing: '-0.01em', margin: 0 }}>
            {label ?? nodeId.slice(0, 12)}
          </h1>
          {slug ? (
            <span style={{ ...MONO, ...MUTED }}>{slug}.ethplane.eth</span>
          ) : null}
          <StatusWord node={poll.data?.node ?? null} />
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1" style={{ fontSize: 'var(--ep-size-label)', color: 'var(--ep-secondary)' }}>
          <span>{[poll.data?.node?.layer, poll.data?.node?.track, poll.data?.node?.fork].filter(Boolean).join(' · ') || 'placement not indexed'}</span>
          <CopyId nodeId={nodeId} />
        </p>
      </header>

      <Panel poll={poll} empty="This worknode is not in the indexer." isEmpty={(d) => !d?.node}>
        {(raw) => <Detail d={toNodeDetail(raw)} slug={slug} summary={summary ?? null} />}
      </Panel>
    </main>
  );
}

function StatusWord({ node }: { node: NodeRow | null }) {
  if (!node) return null;
  const derived = stateOf(node);
  const open = apiState(node) === 'open';
  return (
    <span
      className="uppercase"
      style={{
        fontSize: 'var(--ep-size-label)', fontWeight: open ? 700 : 500, letterSpacing: '0.08em',
        color: open ? 'var(--ep-primary)' : (STATE_INK[derived] ?? 'var(--ep-secondary)'),
      }}
    >
      {STATE_STYLE[derived]?.label ?? derived}
    </span>
  );
}

function Detail({ d, slug, summary }: { d: NodeDetail; slug: string | null; summary: string | null }) {
  const unregistered = stateOf(d.node) === 'seeded';
  return (
    <div className="space-y-12">
      <Plain d={d} summary={summary} />
      <Divider />
      <Summary d={d} />
      <Criterion d={d} />

      <section className="space-y-8" data-testid="activity">
        <Sessions events={d.sessionEvents} sessions={d.sessions} />
        <Submissions rows={d.submissions} verdicts={d.verdicts} head={d.head} nodeId={d.node.node_id} />
      </section>

      <div className="grid gap-12 [@media(min-width:900px)]:grid-cols-2">
        <Escrow node={d.node} />
        <Ens slug={slug} nodeId={d.node.node_id} head={d.head} criterionHash={d.node.criterion_hash} />
      </div>

      {unregistered ? <Register slug={slug} /> : <StartSession slug={slug} />}
    </div>
  );
}

/** Three short blocks for a reader who has not read the criterion: what the item is, what counts as
 *  done, and what has happened. Everything here is on the page below as well, in numbers. */
function Plain({ d, summary }: { d: NodeDetail; summary: string | null }) {
  const b = baselineFor(d.node.node_id);
  const sessions = d.sessions.length;
  const submissions = d.submissions.length;
  const verdicts = d.verdicts.length;
  const passed = d.verdicts.filter((v) => v.passed).length;
  const below = d.verdicts.filter((v) => b && v.metric && Number(String(v.metric).replace(/[^0-9]/g, '')) > 0).length;
  return (
    <section data-testid="node-plain" className="grid gap-8 md:grid-cols-3">
      <div className="space-y-2">
        <SectionLabel>What this is</SectionLabel>
        <p className="m-0" style={{ fontSize: 'var(--ep-size-md)', lineHeight: 1.55 }}>
          {summary ?? 'This roadmap item has no summary recorded yet.'}
        </p>
      </div>

      <div className="space-y-2">
        <SectionLabel>What counts as done</SectionLabel>
        <p className="m-0" style={{ fontSize: 'var(--ep-size-md)', lineHeight: 1.55 }}>
          {b
            ? `A submission has to run the benchmark in fewer VM cycles than the recorded baseline of ${b.cycles.toLocaleString('en-US')}, without making proving time, verification time or proof size worse.`
            : 'This worknode has no criterion yet, so nothing can be submitted against it.'}
          {' '}
          {b ? "The judge is this worknode's verifier, a separate machine account with its own key." : ''}
        </p>
      </div>

      <div className="space-y-2">
        <SectionLabel>What has happened</SectionLabel>
        <p className="m-0" style={{ fontSize: 'var(--ep-size-md)', lineHeight: 1.55 }}>
          {verdicts === 0
            ? `${sessions === 0 ? 'No sessions have started' : `${sessions} session${sessions === 1 ? ' has' : 's have'} started`} and nothing has been submitted yet.`
            : `${sessions} session${sessions === 1 ? '' : 's'}, ${submissions} submission${submissions === 1 ? '' : 's'}, and ${verdicts} verdict${verdicts === 1 ? '' : 's'} recorded. ${PLAIN_REASON[d.node.node_id.toLowerCase()] ?? 'Every verdict so far is a fail.'} ${passed > 0 ? '' : 'No payout yet.'}`}
        </p>
      </div>
    </section>
  );
}

/** Where the plain account ends and the record begins. */
function Divider() {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <span className="uppercase" style={{ fontSize: 'var(--ep-size-label)', letterSpacing: '0.08em', color: 'var(--ep-secondary)' }}>
        Details
      </span>
      <span className="h-px flex-1" style={{ background: 'var(--ep-border)' }} />
    </div>
  );
}

/** The one-line story of each open worknode's verdicts, from the chain. */
const PLAIN_REASON: Record<string, string> = {
  '0x8e67c816b1f39fa072094b67f4f74937bd1920a7a9d79e4b98e785ae9aa29d58':
    'Two attempts ran and produced exactly the baseline cycle count, so nothing changed; two more could not be built.',
  '0x662b44f5cf418a3e3d4126a187d0154034afbdc8d2536b9076c68f2a4440c37e':
    'Three attempts cut cycles by 1,350, and the same change made the proof 307 bytes larger than the bound allows, so all three failed.',
};

/** The worknode id, shortened, with the whole of it a click away. */
function CopyId({ nodeId }: { nodeId: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title={nodeId}
      onClick={() => {
        navigator.clipboard?.writeText(nodeId).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }, () => setCopied(false));
      }}
      className="cursor-pointer border-0 bg-transparent p-0 underline-offset-2 hover:underline"
      style={{ ...MONO, fontSize: 'var(--ep-size-label)', color: 'var(--ep-secondary)' }}
    >
      {nodeId.slice(0, 10)}…{nodeId.slice(-6)} {copied ? '· copied' : '· copy'}
    </button>
  );
}

/** Escrow, baseline and verdicts, in the same three-cell strip the map page uses. */
function Summary({ d }: { d: NodeDetail }) {
  const b = baselineFor(d.node.node_id);
  const escrow = d.node.bounty && d.node.bounty !== '0'
    ? `${(Number(d.node.bounty) / 1e18).toLocaleString('en-US')} PLANE`
    : 'unfunded';
  const cells = [
    { value: escrow, label: 'escrow held by the contract' },
    { value: b ? `${b.cycles.toLocaleString('en-US')}` : 'not recorded', label: b ? 'baseline cycles to beat' : 'no baseline recorded' },
    {
      value: d.verdicts.length > 0 ? String(d.verdicts.length) : 'none',
      label: d.verdicts.length > 0
        ? `submissions judged, ${d.verdicts.filter((v) => v.passed).length} passed`
        : 'submissions judged',
    },
  ];
  return (
    <section data-testid="node-summary">
      <div className="grid grid-cols-1 border-y sm:grid-cols-3" style={RULE}>
        {cells.map((c, i) => (
          <div key={c.label} className={i < cells.length - 1 ? 'px-5 py-[18px] sm:border-r' : 'px-5 py-[18px]'} style={RULE}>
            <b className="block" style={{ fontSize: 'var(--ep-size-display)', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              {c.value}
            </b>
            <span className="mt-1 block" style={{ fontSize: 'var(--ep-size-label)', fontWeight: 500, letterSpacing: '0.04em', color: 'var(--ep-secondary)' }}>
              {c.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** What a submission has to beat, in one sentence and then in numbers. */
function Criterion({ d }: { d: NodeDetail }) {
  const b = baselineFor(d.node.node_id);
  const text = d.node.criterion && d.node.criterion.trim().length > 0
    ? d.node.criterion
    : 'No criterion has been recorded for this worknode.';
  return (
    <section className="space-y-4" data-testid="criterion">
      <SectionLabel>Criterion</SectionLabel>
      <p className="max-w-[80ch]" style={{ fontSize: 'var(--ep-size-md)', lineHeight: 1.5 }}>{text}</p>
      <dl className="grid max-w-[92ch] grid-cols-[12rem_1fr] gap-y-2" style={SMALL}>
        <dt style={{ color: 'var(--ep-secondary)' }}>reference commit</dt>
        <dd className="m-0" style={MONO}>{REFERENCE_COMMIT}</dd>
        {b ? (
          <>
            <dt style={{ color: 'var(--ep-secondary)' }}>baseline cycles</dt>
            <dd className="m-0" style={MONO}>{b.cycles.toLocaleString('en-US')}, and only strictly below counts</dd>
            <dt style={{ color: 'var(--ep-secondary)' }}>proving band</dt>
            <dd className="m-0" style={MONO}>
              {b.proving.toLocaleString('en-US')} µs recorded, {provingBound(b).toLocaleString('en-US')} µs allowed ({(b.spreadBps / 100).toFixed(2)}% spread)
            </dd>
            <dt style={{ color: 'var(--ep-secondary)' }}>proof bound</dt>
            <dd className="m-0" style={MONO}>{b.proof.toLocaleString('en-US')} B, no allowance</dd>
            <dt style={{ color: 'var(--ep-secondary)' }}>verify bound</dt>
            <dd className="m-0" style={MONO}>{b.verify.toLocaleString('en-US')} µs</dd>
            <dt style={{ color: 'var(--ep-secondary)' }}>editable surface</dt>
            <dd className="m-0" style={MONO}>{b.editable}</dd>
          </>
        ) : null}
        <dt style={{ color: 'var(--ep-secondary)' }}>head</dt>
        <dd className="m-0 break-all" style={MONO}>{d.node.head || 'no verified submission'}</dd>
        <dt style={{ color: 'var(--ep-secondary)' }}>criterion hash</dt>
        <dd className="m-0 break-all" style={MONO}>{d.node.criterion_hash || '—'}</dd>
      </dl>
      {d.node.criterion_hash ? (
        <p className="m-0 max-w-[92ch]" style={MUTED}>
          The hash is of <span style={MONO}>docs/CRITERION-pq-leanxmss@a2e71ccb.md</span>, the frozen
          copy; the living file has moved on and does not hash to this value.
        </p>
      ) : null}
    </section>
  );
}

function Escrow({ node }: { node: NodeRow }) {
  const plane = node.bounty && node.bounty !== '0'
    ? `${(Number(node.bounty) / 1e18).toLocaleString('en-US')} PLANE`
    : 'unfunded';
  return (
    <section className="space-y-4" data-testid="funding-card">
      <SectionLabel>Escrow</SectionLabel>
      <p style={{ fontSize: 'var(--ep-size-display)', fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
        {plane}
      </p>
      <div className="space-y-2" style={MUTED}>
        <p className="m-0">
          Paid out by the contract when a submission passes: 68% to the submitter&apos;s lineage, 15%
          to the parent, 10% to the verifier, 5% held, 2% to the registrant.
        </p>
        <p className="m-0">
          Funded by the treasury under a{' '}
          <a href="/docs#privy" style={{ color: 'var(--ep-primary)' }}>Privy policy</a>.
        </p>
      </div>
    </section>
  );
}

function Ens({ slug, nodeId, head, criterionHash }: {
  slug: string | null; nodeId: string; head: string | null; criterionHash: string | null;
}) {
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
    <section className="space-y-4" data-testid="ens-card">
      <SectionLabel>Name on ENS v2</SectionLabel>
      <p className="m-0 break-all" style={{ ...MONO, fontSize: 'var(--ep-size-md)' }}>{name ?? '—'}</p>
      <div className="space-y-1" style={MUTED}>
        {state.loading ? <p className="m-0">Reading through the Universal Resolver.</p> : null}
        {state.error ? <p className="m-0" title={state.detail}>no record yet: {state.error}</p> : null}
        <dl className="m-0 grid grid-cols-[7rem_1fr] gap-y-1">
          <dt>status</dt>
          <dd className="m-0" style={MONO}>{state.value ?? 'not read'}</dd>
          <dt>head</dt>
          <dd className="m-0" style={MONO}>{head ? `${head.slice(0, 10)}…` : 'none yet'}</dd>
          <dt>criterion</dt>
          <dd className="m-0" style={MONO}>{criterionHash ? `${criterionHash.slice(0, 10)}…` : '—'}</dd>
          <dt>node</dt>
          <dd className="m-0" style={MONO}>{nodeId.slice(0, 10)}…</dd>
        </dl>
        <p className="m-0">
          <a href="/docs#ens" style={{ color: 'var(--ep-primary)' }}>
            Resolve it yourself and see the resolver and subregistry addresses
          </a>.
        </p>
      </div>
    </section>
  );
}

/** The one bordered panel on this page: the surface a reader edits and runs. */
function Surface({ title, note, command, testId, link }: {
  title: string; note: string; command: string; testId: string;
  link?: { href: string; text: string };
}) {
  return (
    <section className="space-y-4" data-testid={testId}>
      <SectionLabel>{title}</SectionLabel>
      <p className="m-0 max-w-[80ch]" style={SMALL}>
        {note}
        {link ? (
          <>
            {' '}
            <a href={link.href} style={{ color: 'var(--ep-primary)' }}>{link.text}</a>.
          </>
        ) : null}
      </p>
      <div className="border p-4" style={{ ...RULE, borderRadius: 'var(--ep-radius-md)' }}>
        <textarea
          defaultValue={command}
          spellCheck={false}
          rows={command.split('\n').length + 1}
          aria-label={title}
          className="w-full resize-y border-0 bg-transparent outline-none"
          style={{ ...MONO, fontSize: 'var(--ep-size-sm)', lineHeight: 1.6, color: 'var(--ep-on-surface)' }}
        />
      </div>
      <p className="m-0" style={MUTED}>
        Edit the values above before running the command. The page does not send it.
      </p>
    </section>
  );
}

function Register({ slug }: { slug: string | null }) {
  return (
    <Surface
      testId="register-control"
      title="Register this node"
      note="Nobody has registered this node. Registration is permissionless and free: take the name, then define the node with its criterion and split. It can be done once, and the registrant keeps the registrant share of everything the node pays."
      command={`# claim the ENS name (one call, no fee)
cast send $SUBREGISTRY "registerStrawmapNode(string,address,address)" \\
  "${slug ?? '<node-slug>'}" $YOU $RESOLVER --private-key $KEY

# then define the node on Ethplane
cast send $ETHPLANE "defineNode(bytes32,bytes32,uint8,address,uint64,uint64,(uint16,uint16,uint16,uint16,uint16),uint16,uint16)" ...`}
    />
  );
}

function StartSession({ slug }: { slug: string | null }) {
  return (
    <Surface
      testId="session-control"
      title="Start a session"
      note="A session declares which head the work starts from. Heartbeats keep it live, and a session that stops sending them lapses. Several sessions can run on one worknode at the same time."
      link={{ href: '/join', text: 'Join to get a name and a wallet' }}
      command={`# start a session on this node, from the current head
cast send $ETHPLANE "claim(bytes32,bytes32)" \\
  $(cast keccak "${slug ?? '<node-slug>'}") $FROM_HASH --private-key $KEY

# keep it live
cast send $ETHPLANE "heartbeat(bytes32,uint64)" \\
  $(cast keccak "${slug ?? '<node-slug>'}") $SESSION_SEQ --private-key $KEY`}
    />
  );
}

function Sessions({ events, sessions }: { events: NodeDetail['sessionEvents']; sessions: NodeDetail['sessions'] }) {
  const active = sessions.filter((s) => s.active).length;
  return (
    <section className="space-y-4" data-testid="sessions">
      <SectionLabel>Sessions</SectionLabel>
      {sessions.length === 0 && events.length === 0 ? (
        <p className="m-0 max-w-[80ch]" style={SMALL}>
          No session has been started on this node yet. A session declares which head the work starts
          from. Heartbeats keep it live, and a session that stops sending them lapses.
        </p>
      ) : (
        <>
          <table className="w-full border-collapse" style={SMALL}>
            <thead>
              <tr className="border-b" style={RULE}>
                <Th>session</Th><Th>worker</Th><Th>started</Th><Th>last heartbeat</Th><Th>state</Th>
              </tr>
            </thead>
            <tbody>
              {[...sessions].sort((a, b) => a.seq - b.seq).map((s) => (
                <tr key={s.seq} className="border-b" style={RULE}>
                  <Td>{s.seq}</Td>
                  <Td><Worker address={s.lineage} /></Td>
                  <Td>{when(s.start)}</Td>
                  <Td><span title={when(s.lastHeartbeat)}>{ago(s.lastHeartbeat)}</span></Td>
                  <Td>
                    <span style={{ fontWeight: s.active ? 700 : 400, color: s.active ? 'var(--ep-primary)' : 'var(--ep-secondary)' }}>
                      {s.active ? 'live' : 'lapsed'}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="m-0" style={MUTED}>
            {active} session{active === 1 ? '' : 's'} active, {sessions.length - active} lapsed;{' '}
            {events.length} session events on chain.
          </p>
        </>
      )}
    </section>
  );
}

function Submissions({ rows, verdicts, head, nodeId }: {
  rows: NodeDetail['submissions']; verdicts: NodeDetail['verdicts']; head: string | null; nodeId: string;
}) {
  const verdictFor = (h: string) => verdicts.find((v) => v.artifactHash === h);
  return (
    <section className="space-y-4" data-testid="submissions">
      <SectionLabel>Submissions and verdicts</SectionLabel>
      {rows.length === 0 ? (
        <p className="m-0" style={SMALL}>Nothing has been submitted to this node.</p>
      ) : (
        <table className="w-full border-collapse" style={SMALL}>
          <thead>
            <tr className="border-b" style={RULE}>
              <Th>artifact</Th><Th>session</Th><Th>worker</Th><Th>cycles</Th><Th>verdict</Th><Th>why</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const v = verdictFor(s.artifactHash);
              return (
                <tr key={s.artifactHash} className="border-b" style={RULE}>
                  <Td mono>
                    {s.artifactHash.slice(0, 14)}…
                    {head === s.artifactHash ? (
                      <span style={{ marginLeft: 8, fontWeight: 700, color: 'var(--ep-primary)' }}>head</span>
                    ) : null}
                  </Td>
                  <Td>{s.seq}</Td>
                  <Td><Worker address={s.lineage} /></Td>
                  <Td mono>{v && Number(v.metric) > 0 ? Number(v.metric).toLocaleString('en-US') : '—'}</Td>
                  <Td>
                    <span style={{ fontWeight: v ? 700 : 400, color: v ? (v.passed ? 'var(--ep-state-passed)' : 'var(--ep-error)') : 'var(--ep-secondary)' }}>
                      {v ? (v.passed ? 'pass' : 'fail') : 'pending'}
                    </span>
                  </Td>
                  <Td>
                    {v ? reasonFor(nodeId, v.metric) : (
                      <span style={{ color: 'var(--ep-secondary)' }}>no verdict written</span>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Attribution({ rows }: { rows: AttributionRow[] }) {
  return (
    <section className="space-y-4" data-testid="attribution">
      <SectionLabel>Attribution</SectionLabel>
      {rows.length === 0 ? (
        <p className="m-0" style={SMALL}>No payouts yet. Rows appear when a submission passes.</p>
      ) : (
        <table className="w-full border-collapse" style={SMALL}>
          <thead>
            <tr className="border-b" style={RULE}><Th>who</Th><Th>kind</Th><Th>PLANE</Th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b" style={RULE}>
                <Td mono>{r.operator?.slice(0, 14)}…</Td>
                <Td>{KIND[r.kind] ?? r.kind}</Td>
                <Td mono>{(Number(r.weight) / 1e18).toLocaleString('en-US')}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="py-2 pr-4 text-left uppercase"
      style={{ fontSize: 'var(--ep-size-label)', fontWeight: 500, letterSpacing: '0.08em', color: 'var(--ep-secondary)' }}
    >
      {children}
    </th>
  );
}

function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return <td className="py-2 pr-4 align-top" style={mono ? MONO : undefined}>{children}</td>;
}
