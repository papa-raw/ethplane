'use client';
import { useEffect, useState } from 'react';
import { Diagram } from '@/components/site/Architecture';
import { CONTRACTS, ETH_REGISTRY, EXPLORER, PRIVY, READ_ON, REPO, SPLIT, UNIVERSAL_RESOLVER, VERDICTS, WORKNODES } from '@/lib/sepolia';

const INK = 'var(--ep-on-surface)';
const MUTED = 'var(--ep-secondary)';
const LINE = 'var(--ep-border)';
const BLUE = 'var(--ep-primary)';
const WHY = {
  unbuilt: 'could not be built or run',
  unchanged: 'cycles unchanged from the baseline',
  oversize: 'cycles 1,350 below the baseline; proof 307 bytes over the bound, and proof size has no allowance',
} as const;
const mono = { fontFamily: 'var(--ep-font-mono)', fontSize: 'var(--ep-size-sm)' } as const;

const SECTIONS = [
  { id: 'what', title: 'What this is' },
  { id: 'architecture', title: 'Architecture' },
  { id: 'how', title: 'How it works' },
  { id: 'sepolia', title: 'Live on Sepolia' },
  { id: 'ens', title: 'ENS' },
  { id: 'privy', title: 'Privy' },
  { id: 'verifier', title: 'The verifier' },
  { id: 'swarms', title: 'The swarms' },
  { id: 'run', title: 'Run it yourself' },
  { id: 'join', title: 'Join' },
];

/** The section under the reader, for the side list. Falls back to the first section. */
function useCurrentSection(): string {
  const [current, setCurrent] = useState(SECTIONS[0].id);
  useEffect(() => {
    const seen = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.intersectionRatio);
        let best = SECTIONS[0].id;
        let bestRatio = -1;
        for (const s of SECTIONS) {
          const r = seen.get(s.id) ?? 0;
          if (r > bestRatio) { bestRatio = r; best = s.id; }
        }
        if (bestRatio > 0) setCurrent(best);
      },
      { rootMargin: '-10% 0px -70% 0px', threshold: [0, 0.25, 0.5, 1] },
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, []);
  return current;
}

function H({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} style={{ fontSize: 'var(--ep-size-lg)', fontWeight: 700, margin: '0 0 12px', scrollMarginTop: 24 }}>
      {children}
    </h2>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: '0 0 12px', maxWidth: '84ch' }}>{children}</p>;
}

export function Docs() {
  const current = useCurrentSection();
  return (
    <div className="ep-wrap" style={{ paddingBottom: 64 }}>
      <div className="ep-hero">
        <h1>Docs</h1>
        <p className="ep-lead">
          What a judge needs, on one page, with the addresses and the numbers. Every figure here was
          read from Sepolia on {READ_ON}. The long-form documents are in the repository and linked at
          the end.
        </p>
      </div>

      <div className="ep-docs-grid">
        <nav aria-label="Sections" className="ep-docs-nav" style={{ fontSize: 'var(--ep-size-sm)' }}>
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              aria-current={current === s.id ? 'true' : undefined}
              style={{
                display: 'block', padding: '5px 0 5px 10px', textDecoration: 'none',
                boxShadow: `inset 2px 0 0 ${current === s.id ? BLUE : LINE}`,
                color: current === s.id ? INK : MUTED,
                fontWeight: current === s.id ? 500 : 400,
              }}
            >
              {s.title}
            </a>
          ))}
        </nav>

        <div style={{ display: 'grid', gap: 36, fontSize: 'var(--ep-size-md)', lineHeight: 1.6 }}>
          <section>
            <H id="what">What this is</H>
            <Row>
              Ethplane turns the Ethereum Foundation&apos;s strawmap into a plane of paid work. Each
              of the 65 roadmap items is a Roadmap Worknode: an ENS name, an acceptance criterion a
              machine can check, and an escrow that pays when a verifier confirms an improvement.
            </Row>
            <Row>
              Two worknodes are open and funded with 10,000 PLANE each. Seven measurements are
              recorded onchain and the verifier accepted none of them, which is the honest state of
              the plane today.
            </Row>
          </section>

          <section>
            <H id="architecture">Architecture</H>
            <Row>
              What holds a worknode, who works it, who judges it, and who pays.
            </Row>
            <div style={{ borderTop: `1px solid ${LINE}`, borderBottom: `1px solid ${LINE}`, padding: '20px 0', margin: '4px 0 8px' }}>
              <Diagram />
            </div>
          </section>

          <section>
            <H id="how">How it works</H>
            <Row>
              <b>Worknode.</b> A roadmap item with a name on our ENSv2 subregistry, a criterion, an
              editable surface and an escrow. Anyone can register one of the 65 ids.
            </Row>
            <Row>
              <b>Session.</b> A declaration that a lineage is working a worknode from a named head.
              It is not a lock: several sessions run on one worknode at once. A heartbeat keeps a
              session live, and after two minutes of silence anyone can end it.
            </Row>
            <Row>
              <b>Submission.</b> A content-addressed artifact that names the parent it built on.
              Attribution is onchain rather than in a README.
            </Row>
            <Row>
              <b>Verdict.</b> The verifier rebuilds the artifact at the pinned commit, measures it,
              and writes the result onchain whether it passes or fails. Cycles must be strictly below
              the baseline. Proof size has no allowance at all.
            </Row>
            <Row>
              <b>Payout.</b> When a submission passes, the escrow pays out:{' '}
              {SPLIT.map((s, i) => (
                <span key={s.pct}>{s.pct} to {s.who}{i < SPLIT.length - 1 ? ', ' : '. '}</span>
              ))}
              The attribution split is set at definition under the Privy policy, which refuses any
              definition that gives the verifier less than 10%.
            </Row>
          </section>

          <section>
            <H id="sepolia">Live on Sepolia</H>
            <Row>Chain id 11155111. Read from the chain on {READ_ON}.</Row>
            <div style={{ overflowX: 'auto', marginBottom: 16 }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 'var(--ep-size-sm)' }}>
                <tbody>
                  {CONTRACTS.map((c) => (
                    <tr key={c.address} style={{ borderTop: `1px solid ${LINE}` }}>
                      <td style={{ padding: '6px 10px 6px 0', whiteSpace: 'nowrap' }}>{c.name}</td>
                      <td style={{ padding: '6px 0 6px 10px' }}>
                        <a href={`${EXPLORER}/address/${c.address}`} style={{ color: BLUE, ...mono }}>{c.address}</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Row>
              A submission is an artifact a worker sent. The verifier rebuilds it at the pinned
              commit, runs it, and records a verdict on chain. A verdict passes only if cycles come in
              below the baseline and proving time, verify time and proof size do not regress. Seven
              submissions have been measured.
            </Row>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 'var(--ep-size-sm)' }}>
                <thead>
                  <tr style={{ color: MUTED, textAlign: 'left' }}>
                    <th style={{ padding: '6px 10px 6px 0' }}>block</th>
                    <th style={{ padding: '6px 10px' }}>worknode</th>
                    <th style={{ padding: '6px 10px', textAlign: 'right' }}>cycles measured</th>
                    <th style={{ padding: '6px 10px', textAlign: 'right' }}>proof size</th>
                    <th style={{ padding: '6px 10px' }}>verdict</th>
                    <th style={{ padding: '6px 10px' }}>why</th>
                    <th style={{ padding: '6px 0 6px 10px' }}>tx</th>
                  </tr>
                </thead>
                <tbody>
                  {VERDICTS.map((v) => (
                    <tr key={v.tx} style={{ borderTop: `1px solid ${LINE}` }}>
                      <td style={{ padding: '6px 10px 6px 0', ...mono }}>{v.block}</td>
                      <td style={{ padding: '6px 10px' }}>{v.node === 1 ? 'cl-pq-leanxmss' : 'dl-leanvm'}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', ...mono }}>{v.cycles === 0 ? '—' : v.cycles.toLocaleString('en-US')}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', ...mono }}>{v.proof === 0 ? '—' : `${v.proof.toLocaleString('en-US')} B`}</td>
                      <td style={{ padding: '6px 10px' }}>FAIL</td>
                      <td style={{ padding: '6px 10px', color: MUTED }}>{WHY[v.node === 1 ? (v.cycles === 0 ? 'unbuilt' : 'unchanged') : 'oversize']}</td>
                      <td style={{ padding: '6px 0 6px 10px' }}>
                        <a href={`${EXPLORER}/tx/${v.tx}`} style={{ color: BLUE, ...mono }}>{v.tx.slice(0, 10)}…</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Row>
              No submission has passed yet. The three node-2 submissions show a real cycles cut that
              cost proof size; the criterion holds both.
            </Row>
          </section>

          <section>
            <H id="ens">ENS</H>
            <Row>
              Every worknode, operator, lineage and guest is a name under{' '}
              <span style={mono}>ethplane.eth</span>. The name is registered on the hackathon
              ETHRegistry <span style={mono}>{ETH_REGISTRY}</span>, and its subregistry is ours:{' '}
              <span style={mono}>EthplaneSubregistry</span> implements{' '}
              <span style={mono}>IRegistry</span> and is set as the subregistry of{' '}
              <span style={mono}>ethplane.eth</span>.
            </Row>
            <Row>
              We wrote our own resolver per worknode because the shared one could not be scoped.
              Probing the deployed PermissionedResolver showed that its authorisation resource is a
              function of the text key alone: the same key on two different names produced the same
              resource. One shared resolver would let a key holder write that key on every name.{' '}
              <span style={mono}>EthplaneResolver</span> takes an immutable{' '}
              <span style={mono}>servedNode</span> and reverts for any other name.
            </Row>
            <Row>
              Resolution runs root, <span style={mono}>.eth</span>,{' '}
              <span style={mono}>ethplane</span>, our subregistry, the worknode&apos;s resolver,
              through the Universal Resolver <span style={mono}>{UNIVERSAL_RESOLVER}</span>. Both
              open worknodes resolve <span style={mono}>ethplane.status</span> = open and an{' '}
              <span style={mono}>ethplane.criterion</span> sentence. Status and head are written by
              the verifier, which holds the writer role for those keys. The resolver&apos;s owner can
              also write them.
            </Row>
          </section>

          <section>
            <H id="privy">Privy</H>
            <Row>
              The treasury is a Privy server wallet, id <span style={mono}>{PRIVY.wallet}</span>,
              bound to policy <span style={mono}>{PRIVY.policy}</span>. A policy is an allowlist, so
              what no rule allows is refused before anything is signed. Read from the Privy API on{' '}
              {READ_ON}:
            </Row>
            <ul style={{ margin: '0 0 12px', paddingLeft: 20 }}>
              {PRIVY.rules.map((r) => <li key={r} style={{ marginBottom: 4 }}>{r}</li>)}
            </ul>
            <Row>
              Each is two rules, one for <span style={mono}>eth_sendTransaction</span> and one for{' '}
              <span style={mono}>eth_signTransaction</span>, because a rule matches a single RPC
              method. Six in total.
            </Row>
            <Row>
              We tried a fourth shape: a <span style={mono}>transfer</span> of 1 PLANE to a burn
              address. Privy refused it at {PRIVY.refusedAt}, before signing:{' '}
              <span style={mono}>{PRIVY.refusal}</span>. That refusal is why the attribution split
              cannot be set to something that starves the verifier: the policy will not sign a{' '}
              <span style={mono}>defineNode</span> whose verifier share is under 10%.
            </Row>
            <Row>
              Guests use Privy too. Signing in with an email creates an embedded wallet and issues a
              name under <span style={mono}>guests.ethplane.eth</span>.
            </Row>
          </section>

          <section>
            <H id="verifier">The verifier</H>
            <Row>
              The verifier is a Unix user of its own on the host, with its own key that no model can
              read. It watches the chain for submissions, fetches the artifact, and rebuilds it at
              the pinned reference commit.
            </Row>
            <Row>
              The editable surface is per worknode.{' '}
              <span style={mono}>{WORKNODES[0].name}</span> admits{' '}
              <span style={mono}>{WORKNODES[0].editable}</span> only, so nothing a submission writes
              is compiled as Rust and no build script runs on the verifier&apos;s host.{' '}
              <span style={mono}>{WORKNODES[1].name}</span> also admits{' '}
              <span style={mono}>crates/lean_compiler/</span>, which is a larger surface and a larger
              risk, and it is stated as such rather than hidden.
            </Row>
            <Row>
              The baseline is recorded once and cannot be reset: {WORKNODES[0].baseline} for the
              first worknode, {WORKNODES[1].baseline} for the second. Time gets a spread fixed at
              that moment. Proof size gets none. A measurement is written for a failure as well as a
              pass, with the numbers that produced it.
            </Row>
          </section>

          <section>
            <H id="swarms">The swarms</H>
            <Row>
              Two swarms worked the two worknodes overnight. Each is four panes on one host running
              one program with different tools: an orchestrator that can only plan and hand off, a
              designer, a builder that can edit and measure, and a critic whose shell refuses any
              command that mutates.
            </Row>
            <Row>
              The first worknode admits the guest program only, and its cycle count did not move:
              1,542,812 on both recorded attempts, the baseline exactly. The second admits the
              compiler, and a local model editing <span style={mono}>crates/lean_compiler/</span>{' '}
              found 1,541,462 cycles, 1,350 below the baseline, on three attempts. All three failed
              on size: 302,489 bytes against a bound of 302,182.
            </Row>
          </section>

          <section>
            <H id="run">Run it yourself</H>
            <Row>Everything below runs against Sepolia with a public RPC.</Row>
            <pre style={{ ...mono, background: '#F5F5F7', padding: 12, borderRadius: 4, overflowX: 'auto', margin: '0 0 12px' }}>
{`git clone ${REPO.replace('https://', '')} && cd ethplane

# the site
cd web && pnpm install && pnpm build          # -> web/out

# the read API
cd api && pnpm install && pnpm build && node dist/src/server.js

# the verifier, on one artifact
LEANVM_REF=/path/to/leanVM python3.12 verifier/run.py <artifact.tar> --self-test

# resolve a worknode through the hackathon Universal Resolver
cast call ${UNIVERSAL_RESOLVER} \\
  "resolve(bytes,bytes)" ... --rpc-url $SEPOLIA_RPC_URL`}
            </pre>
            <Row>
              The tests are <span style={mono}>pnpm vitest run</span> in{' '}
              <span style={mono}>web/</span> and{' '}
              <span style={mono}>python -m pytest verifier/tests swarm/tests -q</span> at the root.
            </Row>
          </section>

          <section>
            <H id="join">Join</H>
            <Row>
              Sign in with an email at <a href="/join" style={{ color: BLUE }}>/join</a>. Privy
              creates your wallet, and you get a name under{' '}
              <span style={mono}>guests.ethplane.eth</span>. From there you can start a session on
              either open worknode.
            </Row>
            <Row>
              The long-form documents are in the repository:{' '}
              <a href={`${REPO}/tree/main/docs`} style={{ color: BLUE }}>docs/</a> carries the spec,
              the criterion, the deployments, the ENS probes, the verifier notes and the judge&apos;s
              checklist.
            </Row>
          </section>
        </div>
      </div>
    </div>
  );
}
