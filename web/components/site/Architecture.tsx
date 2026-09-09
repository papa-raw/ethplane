import { CONTRACTS, EXPLORER, PRIVY, READ_ON, REPO, SPLIT, UNIVERSAL_RESOLVER, VERDICTS, WORKNODES } from '@/lib/sepolia';

const INK = 'var(--ep-on-surface)';
const MUTED = 'var(--ep-secondary)';
const LINE = 'var(--ep-border)';
const BLUE = 'var(--ep-primary)';

function Box({ x, y, w, h, title, lines, accent }: {
  x: number; y: number; w: number; h: number; title: string; lines: string[]; accent?: boolean;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={4} fill="none" stroke={accent ? BLUE : LINE} strokeWidth={1} />
      <text x={x + 14} y={y + 26} fill={INK} fontSize={14} fontWeight={700}>{title}</text>
      {lines.map((l, i) => (
        <text key={l} x={x + 14} y={y + 48 + i * 17} fill={MUTED} fontSize={12}>{l}</text>
      ))}
    </g>
  );
}

function Arrow({ x1, y1, x2, y2, label }: { x1: number; y1: number; x2: number; y2: number; label?: string }) {
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={LINE} strokeWidth={1} markerEnd="url(#ep-arrow)" />
      {label ? (
        <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} fill={MUTED} fontSize={11} textAnchor="middle">{label}</text>
      ) : null}
    </g>
  );
}

/** The system in one picture: what holds a worknode, who works it, who judges it, who pays. */
function Diagram() {
  return (
    <svg
      viewBox="0 0 1160 600"
      role="img"
      aria-label="Ethplane architecture: worknodes as ENS names, sessions, submissions, the verifier, the escrow contract and the treasury under a Privy policy"
      style={{ width: '100%', height: 'auto', fontFamily: 'var(--ep-font-sans)' }}
    >
      <defs>
        <marker id="ep-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill={LINE} />
        </marker>
      </defs>

      <Box
        x={20} y={16} w={1120} h={80}
        title="65 Roadmap Worknodes"
        lines={[
          'One ENS name each on EthplaneSubregistry under ethplane.eth, resolved through the Universal Resolver.',
          'Per-worknode resolver holds ethplane.status, ethplane.criterion and the head. Two are open with escrow.',
        ]}
      />

      <Arrow x1={190} y1={96} x2={190} y2={150} label="claim" />
      <Arrow x1={580} y1={96} x2={580} y2={150} />
      <Arrow x1={970} y1={96} x2={970} y2={150} />

      <Box
        x={20} y={152} w={340} h={104}
        title="Session"
        lines={['A swarm or a person, declared onchain.', 'From a named head. Heartbeats keep it live.', 'Several run on one worknode at once.']}
      />
      <Box
        x={410} y={152} w={340} h={104}
        title="Submission"
        lines={['An artifact, content-addressed.', 'Names the parent it built on.', 'Attribution is onchain, not in a README.']}
      />
      <Box
        x={800} y={152} w={340} h={104}
        title="Verifier"
        lines={['Its own Unix user, its own key.', 'Rebuilds at the pinned commit and measures.', 'No model can read the key.']}
        accent
      />

      <Arrow x1={360} y1={204} x2={406} y2={204} label="submit" />
      <Arrow x1={750} y1={204} x2={796} y2={204} label="judge" />

      <Arrow x1={970} y1={256} x2={970} y2={320} label="recordMeasurement" />
      <Arrow x1={190} y1={256} x2={190} y2={320} />

      <Box
        x={20} y={322} w={1120} h={96}
        title="Ethplane contract"
        lines={[
          'Holds the escrow in PLANE. Records every measurement, passed or failed, with its numbers.',
          'Pays on a verdict, splits by attribution, and believes no account but the verifier.',
        ]}
      />

      <Arrow x1={580} y1={470} x2={580} y2={422} label="fundNode, defineNode" />

      <Box
        x={310} y={472} w={540} h={110}
        title="PLANE treasury · Privy server wallet · policy"
        lines={[
          ...PRIVY.rules,
          `Anything else: "${PRIVY.refusal}"`,
        ]}
        accent
      />
    </svg>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ scrollMarginTop: 24 }}>
      <h2 style={{ fontSize: 'var(--ep-size-lg)', fontWeight: 700, margin: '0 0 10px' }}>{title}</h2>
      <div style={{ fontSize: 'var(--ep-size-md)', lineHeight: 1.6, maxWidth: '84ch' }}>{children}</div>
    </section>
  );
}

const mono = { fontFamily: 'var(--ep-font-mono)', fontSize: 'var(--ep-size-sm)' } as const;

export function Architecture() {
  return (
    <div className="ep-wrap" style={{ display: 'grid', gap: 40, paddingBottom: 64 }}>
      <div className="ep-hero">
        <h1>How Ethplane works</h1>
        <p className="ep-lead">
          The Ethereum roadmap as a plane of paid work. A Roadmap Worknode is a roadmap item with a
          name, a criterion and money behind it. Anyone can start a session on one, submit an
          artifact, and get paid when a verifier can check the improvement.
        </p>
      </div>

      <div style={{ borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}`, padding: '24px 0' }}>
        <Diagram />
      </div>

      <Section id="worknode" title="What a worknode is">
        <p>
          There are 65, one for each item on the Ethereum Foundation&apos;s strawmap. Each is an ENS
          name on our own ENSv2 subregistry under <span style={mono}>ethplane.eth</span>, with its own
          resolver holding the status, the criterion and the current head. Anyone can register one of
          the 65 ids; two are open and funded today, each with 10,000 PLANE in escrow.
        </p>
        <p>
          A worknode carries an acceptance criterion a machine can check, and an editable surface. On{' '}
          <span style={mono}>cl-pq-leanxmss-attestations</span> that surface is the guest program
          only. On <span style={mono}>dl-leanvm</span> it also admits the compiler, which is a
          different bargain and a different risk. Everything outside the surface is frozen, and a diff
          that touches a frozen path is rejected before anything is built.
        </p>
      </Section>

      <Section id="session" title="What a session is">
        <p>
          A session is a declaration: this lineage is working this worknode, from this head. It is not
          a lock. Several sessions run on one worknode at the same time, and the work is not owned by
          whoever claimed first.
        </p>
        <p>
          A heartbeat keeps a session live. Two minutes of silence and it lapses, at which point
          anyone can end it, not only a maintainer. A worker that dies mid-session loses nothing that
          was already submitted: the artifact and its parent are onchain, and the next session starts
          from that head.
        </p>
      </Section>

      <Section id="judged" title="How a submission is judged">
        <p>
          The verifier runs as its own Unix user with its own key on a host where no model can read
          it. It fetches the artifact, rebuilds it at the pinned commit, runs the benchmark itself and
          probes the signatures one at a time. It writes the verdict onchain, and the contract
          believes no other account.
        </p>
        <p>
          Cycles must come in strictly below the recorded baseline. Proof size has no allowance at
          all: a submission must not exceed the recorded bytes by one. Time gets a spread that was
          fixed when the baseline was recorded. A measurement is written whether it passes or fails,
          with its numbers, so a failed attempt is part of the record rather than a silence.
        </p>
      </Section>

      <Section id="split" title="How the payout is split, and who sets it">
        <p>
          When a submission passes, the escrow pays out: 68% to the lineage that submitted it, 15% to
          the parent it built on, 10% to the verifier, 5% held for compute, 2% to whoever registered
          the worknode.
        </p>
        <p>
          The attribution split is set at definition under the Privy policy. The treasury is a Privy
          server wallet bound to policy <span style={mono}>{PRIVY.policy}</span>, and the policy
          refuses any definition that gives the verifier less than 10%. The split is not a
          convention anyone can renegotiate after the fact.
        </p>
        <div style={{ display: 'flex', border: `1px solid ${LINE}`, borderRadius: 4, overflow: 'hidden', margin: '14px 0' }}>
          {SPLIT.map((s, i) => (
            <div
              key={s.pct}
              style={{
                flex: `0 0 ${s.pct}`, padding: '10px 12px',
                borderRight: i < SPLIT.length - 1 ? `1px solid ${LINE}` : 'none',
              }}
            >
              <b style={{ display: 'block', fontSize: 'var(--ep-size-md)', fontWeight: 700 }}>{s.pct}</b>
              <span style={{ fontSize: 'var(--ep-size-label)', color: MUTED }}>{s.who}</span>
            </div>
          ))}
        </div>
        <p>
          The treasury can do three things and nothing else: {PRIVY.rules[0]}; {PRIVY.rules[1]};{' '}
          {PRIVY.rules[2]}. Each is two rules, one for sending and one for signing. We tried a fourth
          shape, a plain <span style={mono}>transfer</span> of PLANE to a burn address. Privy refused
          it at {PRIVY.refusedAt}: <span style={mono}>{PRIVY.refusal}</span>.
        </p>
      </Section>

      <Section id="where" title="What runs where">
        <p>
          One rented GPU box runs the swarms and the verifier as separate Unix users. The submitter
          loop holds a lineage key and runs as a third user, so a model that can edit code cannot
          reach a key or send a transaction directly.
        </p>
        <p>
          The API is a Fastify service with a SQLite index of the chain, polled by the site. The site
          itself is a static export: every page is HTML on disk, and the only thing it fetches at
          runtime is the read API. The contracts are on Sepolia, chain id 11155111.
        </p>
      </Section>

      <Section id="sepolia" title="What happened on Sepolia">
        <p>
          Seven measurements are recorded, and the verifier accepted none of them. Both worknodes
          started from the same baseline of 1,542,812 cycles. Read from the chain on {READ_ON}.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 'var(--ep-size-sm)' }}>
            <thead>
              <tr style={{ color: MUTED, textAlign: 'left' }}>
                <th style={{ padding: '6px 10px 6px 0' }}>block</th>
                <th style={{ padding: '6px 10px' }}>worknode</th>
                <th style={{ padding: '6px 10px', textAlign: 'right' }}>cycles</th>
                <th style={{ padding: '6px 10px', textAlign: 'right' }}>proof B</th>
                <th style={{ padding: '6px 10px' }}>what it shows</th>
                <th style={{ padding: '6px 0 6px 10px' }}>tx</th>
              </tr>
            </thead>
            <tbody>
              {VERDICTS.map((v) => (
                <tr key={v.tx} style={{ borderTop: `1px solid ${LINE}` }}>
                  <td style={{ padding: '6px 10px 6px 0', ...mono }}>{v.block}</td>
                  <td style={{ padding: '6px 10px' }}>{v.node === 1 ? 'cl-pq-leanxmss' : 'dl-leanvm'}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', ...mono }}>{v.cycles.toLocaleString('en-US')}</td>
                  <td style={{ padding: '6px 10px', textAlign: 'right', ...mono }}>{v.proof.toLocaleString('en-US')}</td>
                  <td style={{ padding: '6px 10px', color: MUTED }}>{v.note}</td>
                  <td style={{ padding: '6px 0 6px 10px' }}>
                    <a href={`${EXPLORER}/tx/${v.tx}`} style={{ color: BLUE, ...mono }}>{v.tx.slice(0, 10)}…</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ marginTop: 14 }}>
          Node 1 admits the guest program only, and its cycle count did not move: 1,542,812 on both
          attempts, the baseline exactly. Node 2 admits the compiler, and a local model editing{' '}
          <span style={mono}>crates/lean_compiler/</span> found 1,541,462 cycles, 1,350 below the
          baseline, three times. Those three failed on size: 302,489 bytes against a recorded bound of
          302,182, and size has no allowance.
        </p>
      </Section>

      <Section id="stack" title="Addresses">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 'var(--ep-size-sm)' }}>
            <tbody>
              {CONTRACTS.map((c) => (
                <tr key={c.address} style={{ borderTop: `1px solid ${LINE}` }}>
                  <td style={{ padding: '6px 10px 6px 0', whiteSpace: 'nowrap' }}>{c.name}</td>
                  <td style={{ padding: '6px 10px', color: MUTED }}>{c.what}</td>
                  <td style={{ padding: '6px 0 6px 10px' }}>
                    <a href={`${EXPLORER}/address/${c.address}`} style={{ color: BLUE, ...mono }}>{c.address}</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ marginTop: 14 }}>
          Names resolve through the hackathon Universal Resolver{' '}
          <span style={mono}>{UNIVERSAL_RESOLVER}</span>: root, then <span style={mono}>.eth</span>,
          then <span style={mono}>ethplane</span>, then our subregistry, then the worknode&apos;s own
          resolver.
        </p>
      </Section>

      <Section id="join" title="How to join">
        <p>
          Sign in with an email at <a href="/join" style={{ color: BLUE }}>/join</a>. Privy creates a
          wallet and you get a name under <span style={mono}>guests.ethplane.eth</span>. From there
          you can start a session on any open worknode, exactly like any other contributor.
        </p>
        <p>
          The two open worknodes are{' '}
          {WORKNODES.map((w, i) => (
            <span key={w.id}>
              <a href={`/node/${w.id}`} style={{ color: BLUE, ...mono }}>{w.name}</a>
              {i === 0 ? ' and ' : '. '}
            </span>
          ))}
          The code is at <a href={REPO} style={{ color: BLUE }}>github.com/papa-raw/ethplane</a>.
        </p>
      </Section>
    </div>
  );
}
