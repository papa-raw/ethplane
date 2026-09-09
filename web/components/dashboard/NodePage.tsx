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
const PRIVY_POLICY = 'c8io5x5g08igo85ljedozu2k';
const SUBREGISTRY = '0x58CB4caaDb0ebEdf7E1c96CeA6578Afb2f99d05b';
const UNIVERSAL_RESOLVER = '0xd26f2040d083af1cd2962ba303f4bea0c4faf142';
const SESSION_WORD: Record<string, string> = {
  claimed: 'started',
  heartbeat: 'heartbeat',
  expired: 'lapsed',
  'missed-heartbeat': 'lapsed, no heartbeat',
};

const RULE = { borderColor: 'var(--ep-border)' } as const;
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
        <Submissions rows={d.submissions} verdicts={d.verdicts} head={d.head} />
      </section>

      <div className="grid gap-12 md:grid-cols-2">
        <Escrow node={d.node} />
        <Ens slug={slug} />
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
          The contract holds the escrow. When a submission passes, it pays out: 68% to the lineage
          that submitted it, 15% to the parent it built on, 10% to the verifier, 5% held for compute,
          2% to whoever registered the worknode. The attribution split is set at definition under the
          Privy policy, which refuses any definition that gives the verifier less than 10%.
        </p>
      </div>

      <div
        data-testid="privy-policy"
        className="mt-5 space-y-2 border-t pt-4"
        style={{ ...MUTED, borderColor: 'var(--ep-border)' }}
      >
        <h3 className="m-0" style={{ fontSize: 'var(--ep-size-md)', fontWeight: 500, color: 'var(--ep-on-surface)' }}>
          Treasury under a Privy policy
        </h3>
        <p className="m-0">
          The treasury is a Privy server wallet bound to policy <span style={MONO}>{PRIVY_POLICY}</span>.
          A policy is an allowlist, so what no rule allows is refused before anything is signed. Read
          from the Privy API on 2026-09-09:
        </p>
        <ul className="m-0 list-disc space-y-1 pl-5">
          <li>approve PLANE, and only to the Ethplane contract</li>
          <li>fundNode, capped at 100,000 PLANE per call</li>
          <li>defineNode, only where the split gives the verifier at least 10%</li>
        </ul>
        <p className="m-0">
          Each is two rules, one for sending and one for signing, because a rule matches a single RPC
          method. Six in total.
        </p>
        <p className="m-0">
          We tried a fourth shape. A <span style={MONO}>transfer(0x…dEaD, 1)</span> of PLANE was
          refused at 2026-09-09 14:52:33 UTC:{' '}
          <span style={MONO}>RPC request denied due to policy violation</span>.{' '}
          <a href="/docs#privy" style={{ color: 'var(--ep-primary)' }}>The rules and the refusal in full</a>.
        </p>
      </div>
    </section>
  );
}

function Ens({ slug }: { slug: string | null }) {
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
        {state.value ? (
          <p className="m-0">
            <span style={MONO}>ethplane.status</span> {state.value}
          </p>
        ) : null}
        <p className="m-0 break-all" style={MONO}>subregistry {SUBREGISTRY}</p>
        {state.resolver ? <p className="m-0 break-all" style={MONO}>resolver {state.resolver}</p> : null}
        <p className="m-0">
          The resolver holds <span style={MONO}>ethplane.status</span>,{' '}
          <span style={MONO}>ethplane.head</span>, <span style={MONO}>ethplane.criterion</span> and{' '}
          <span style={MONO}>ethplane.node</span>. Status and head are written by the verifier,
          which holds the writer role for those keys. The resolver&apos;s owner can also write
          them.
        </p>
        <p className="m-0">Resolve it yourself through the hackathon Universal Resolver:</p>
        <p className="m-0 break-all" style={MONO}>
          cast call {UNIVERSAL_RESOLVER} &quot;resolve(bytes,bytes)&quot; $(cast namehash-bytes {name ?? 'NAME'}) $(cast calldata &quot;text(bytes32,string)&quot; $(cast namehash {name ?? 'NAME'}) &quot;ethplane.status&quot;) --rpc-url $SEPOLIA_RPC_URL
        </p>
        <p className="m-0">
          <a href="/docs#ens" style={{ color: 'var(--ep-primary)' }}>Why we run our own subregistry and one resolver per worknode</a>.
        </p>
      </div>
    </section>
  );
}

/** The one bordered panel on this page: the surface a reader edits and runs. */
function Surface({ title, note, command, testId }: { title: string; note: string; command: string; testId: string }) {
  return (
    <section className="space-y-4" data-testid={testId}>
      <SectionLabel>{title}</SectionLabel>
      <p className="m-0 max-w-[80ch]" style={SMALL}>{note}</p>
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
      note="A session declares which head the work starts from. Heartbeats keep it live, and a session that stops sending them lapses. Several sessions can run on one node at the same time."
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
  const recent = events.slice(-12).reverse();
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
                <Th>session</Th><Th>lineage</Th><Th>started</Th><Th>last heartbeat</Th><Th>state</Th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.seq} className="border-b" style={RULE}>
                  <Td>{s.seq}</Td>
                  <Td mono>{s.lineage?.slice(0, 12)}…</Td>
                  <Td mono>{s.start}</Td>
                  <Td mono>{s.lastHeartbeat}</Td>
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
            {active} active session(s). In principle anybody can contribute to any node, and many
            sessions run on one node at once. {events.length} session events are recorded; the most
            recent are{' '}
            {recent.map((e, i) => (
              <span key={i}>
                {i > 0 ? ', ' : ''}
                {SESSION_WORD[e.kind] ?? e.kind} at block {e.block}
              </span>
            ))}
            .
          </p>
        </>
      )}
    </section>
  );
}

function Submissions({ rows, verdicts, head }: {
  rows: NodeDetail['submissions']; verdicts: NodeDetail['verdicts']; head: string | null;
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
              <Th>artifact</Th><Th>session</Th><Th>lineage</Th><Th>verdict</Th><Th>reason recorded</Th>
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
                  <Td mono>{s.lineage?.slice(0, 12)}…</Td>
                  <Td>
                    <span style={{ fontWeight: v ? 700 : 400, color: v ? (v.passed ? 'var(--ep-state-passed)' : 'var(--ep-error)') : 'var(--ep-secondary)' }}>
                      {v ? (v.passed ? 'pass' : 'fail') : 'pending'}
                    </span>
                  </Td>
                  <Td>
                    {v ? (
                      <span style={MONO}>metric {Number(v.metric).toLocaleString('en-US')}</span>
                    ) : (
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
