'use client';
import { useEffect, useState } from 'react';
import { usePolling } from '@/lib/usePolling';
import {
  NodeRow, AttributionRow, STATE_STYLE, STATE_INK, stateOf, apiState,
  toNodeDetail, type NodeDetail, type RawNodeDetail,
} from '@/lib/api';
import { readEnsText, shortEnsError } from '@/lib/ens';
import { Masthead } from './Masthead';
import { Panel } from './Panel';

/**
 * One node, in the same grid as the map: a 1240px column, hairline rules, section labels at 11px,
 * and records set as tables. The contract's own verbs are unchanged; every word a reader sees is
 * session vocabulary (BRIEF §3).
 */
const KIND = ['winner', 'parents', 'verifier', 'compute', 'registrant'];
const PRIVY_POLICY = 'c8io5x5g08igo85ljedozu2k';
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

export function NodePage({ nodeId, slug, label }: { nodeId: string; slug: string | null; label: string | null }) {
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
        <p className="mt-2 break-all" style={{ ...MONO, fontSize: 'var(--ep-size-label)', color: 'var(--ep-secondary)' }}>
          {nodeId}
        </p>
      </header>

      <Panel poll={poll} empty="This node is not in the indexer." isEmpty={(d) => !d?.node}>
        {(raw) => <Detail d={toNodeDetail(raw)} slug={slug} />}
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

function Detail({ d, slug }: { d: NodeDetail; slug: string | null }) {
  const unregistered = stateOf(d.node) === 'seeded';
  return (
    <div className="space-y-12">
      <section className="space-y-4">
        <SectionLabel>Criterion</SectionLabel>
        <p className="max-w-[80ch]" style={{ fontSize: 'var(--ep-size-md)', lineHeight: 1.5 }}>
          {d.node.criterion && d.node.criterion.trim().length > 0
            ? d.node.criterion
            : 'No criterion has been recorded for this node.'}
        </p>
        <dl className="grid max-w-[92ch] grid-cols-[10rem_1fr] gap-y-2" style={SMALL}>
          <dt style={{ color: 'var(--ep-secondary)' }}>criterion hash</dt>
          <dd className="m-0 break-all" style={MONO}>{d.node.criterion_hash || '—'}</dd>
          <dt style={{ color: 'var(--ep-secondary)' }}>head</dt>
          <dd className="m-0 break-all" style={MONO}>{d.node.head || 'no verified submission'}</dd>
          <dt style={{ color: 'var(--ep-secondary)' }}>layer and track</dt>
          <dd className="m-0">{[d.node.layer, d.node.track].filter(Boolean).join(' · ') || '—'}</dd>
          <dt style={{ color: 'var(--ep-secondary)' }}>fork target</dt>
          <dd className="m-0">{d.node.fork || '—'}</dd>
        </dl>
      </section>

      <div className="grid gap-12 md:grid-cols-2">
        <Escrow node={d.node} />
        <Ens slug={slug} />
      </div>

      {unregistered ? <Register slug={slug} /> : <StartSession slug={slug} />}

      <Sessions events={d.sessionEvents} sessions={d.sessions} />
      <Submissions rows={d.submissions} verdicts={d.verdicts} head={d.head} />
      <Attribution rows={d.attribution} />
    </div>
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
          The contract holds the escrow. It pays on a verified improvement, in proportion to
          cumulative progress.
        </p>
        <p className="m-0">
          Treasury wallet policy <span style={MONO}>{PRIVY_POLICY}</span> allows exactly three things:
        </p>
        <ul className="m-0 list-disc space-y-1 pl-5">
          <li>defineNode on the Ethplane contract, and nothing else on it</li>
          <li>fundNode, capped at 100,000e18 per call</li>
          <li>the same two for signing as well as sending, because policy rules are per RPC method</li>
        </ul>
        <p className="m-0">
          Anything else is refused by Privy before it is signed:{' '}
          <span style={MONO}>RPC request denied due to policy violation</span>.
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
      <SectionLabel>ENS</SectionLabel>
      <p className="m-0 break-all" style={{ ...MONO, fontSize: 'var(--ep-size-md)' }}>{name ?? '—'}</p>
      <div className="space-y-1" style={MUTED}>
        {state.loading ? <p className="m-0">Reading through the Universal Resolver.</p> : null}
        {state.error ? <p className="m-0" title={state.detail}>no record yet: {state.error}</p> : null}
        {state.value ? (
          <>
            <p className="m-0">
              <span style={MONO}>ethplane.status</span> {state.value}
            </p>
            <p className="m-0 break-all" style={MONO}>resolver {state.resolver}</p>
          </>
        ) : null}
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
