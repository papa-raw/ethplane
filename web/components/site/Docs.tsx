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
  oversize: 'cycles 1,350 below; proof 307 B over the bound',
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
  { id: 'swarms', title: 'Swarms' },
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
              The Ethereum Foundation publishes a roadmap called the strawmap: 65 items of research
              and engineering work, sorted by layer and by the fork they target. Ethplane takes that
              map and makes each item something you can work on and get paid for.
            </Row>
            <Row>
              Each item is a Roadmap Worknode. A worknode has three parts: a name on ENS, so it can
              be found and its state read from anywhere; an acceptance criterion a machine can check,
              for example fewer VM cycles than 1,542,812; and an escrow of PLANE tokens that pays out
              when a verifier confirms a submission meets the criterion.
            </Row>
            <Row>
              You work a worknode by starting a session on it, from the current best version, alone
              or with a swarm of local models. When you have an improvement, you submit it. The
              worknode&apos;s verifier rebuilds your submission from the reference, runs the check,
              and records a verdict on chain. A pass releases the escrow by a fixed split: most to
              you, a share to whoever&apos;s work you built on, a share to the verifier. A fail costs
              nothing and is recorded with its reason.
            </Row>
            <Row>
              Today two worknodes are open, each funded with 10,000 PLANE. Seven submissions have
              been judged. None has passed. The results are further down, with the reasons.
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
              Two worknodes are open. Both carry the same task: make leanVM aggregate 900 signatures
              in fewer VM cycles than the reference, which takes 1,542,812. A submission is a set of
              changed files a worker sends in. The verifier, a separate machine account with its own
              key, rebuilds the reference with those changes, runs the benchmark, and writes the
              result on chain. To pass, a submission must cut cycles below 1,542,812 and must not
              make three other things worse: proving time, verification time, and the size of the
              proof.
            </Row>
            <Row>Seven submissions have been judged. None passed.</Row>
            <ul style={{ margin: '0 0 12px', paddingLeft: 20, maxWidth: '84ch' }}>
              <li style={{ marginBottom: 4 }}>
                Two on node 1 could not be built or run by the verifier. They were rejected before
                any measurement.
              </li>
              <li style={{ marginBottom: 4 }}>
                Two on node 1 ran and produced exactly the baseline count. Nothing changed.
              </li>
              <li style={{ marginBottom: 4 }}>
                Three on node 2 cut cycles by 1,350, about 0.09%. The same change made the proof 307
                bytes larger. Proof size is allowed no growth at all, so all three were rejected.
              </li>
            </ul>
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
              What this shows: the swarm found a real optimisation in the compiler and paid for it in
              proof size. The rule caught the trade. No money moved; the escrow pays only on a pass.
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
            <h3 style={{ fontSize: 'var(--ep-size-md)', fontWeight: 500, margin: '0 0 8px' }}>Money</h3>
            <Row>
              Every worknode has an escrow: PLANE tokens locked in the contract until a submission
              passes. The tokens come from the plane&apos;s treasury. The treasury is a Privy server
              wallet, and it can only sign three kinds of transaction: approve PLANE for the contract,
              fund a worknode (at most 100,000 PLANE per call), and define a worknode whose payout
              split gives the verifier at least 10%. Anything else is refused before it is signed. So
              the treasury cannot pay a person, cannot move funds anywhere but the contract, and
              cannot create a worknode that starves the judge. Payouts are made by the contract on a
              verdict, not by anyone&apos;s hand.
            </Row>
            <h3 style={{ fontSize: 'var(--ep-size-md)', fontWeight: 500, margin: '16px 0 8px' }}>Your wallet</h3>
            <Row>
              Joining needs no wallet and no tokens. You sign in with an email; Privy creates an
              embedded wallet for you and the plane gives you a name under{' '}
              <span style={mono}>guests.ethplane.eth</span>. Sessions you start and submissions you
              send are recorded against that name, so what you built on and who built on you stays
              attributable. If a submission of yours passes, the contract pays your lineage&apos;s
              share into that wallet.
            </Row>
            <h3 style={{ fontSize: 'var(--ep-size-md)', fontWeight: 500, margin: '16px 0 8px' }}>
              For the record (read from the Privy API on {READ_ON})
            </h3>
            <Row>
              Treasury wallet id <span style={mono}>{PRIVY.wallet}</span>, policy{' '}
              <span style={mono}>{PRIVY.policy}</span>. Six rules: the three permissions above, each
              once for <span style={mono}>eth_sendTransaction</span> and once for{' '}
              <span style={mono}>eth_signTransaction</span>. Test of the refusal: a transfer of 1
              PLANE to a burn address was refused at {PRIVY.refusedAt} with{' '}
              <span style={mono}>&quot;{PRIVY.refusal}&quot;</span>. Embedded wallets are created on
              login for users without one; the API verifies Privy&apos;s auth token before issuing a
              name.
            </Row>
          </section>

          <section>
            <H id="verifier">The verifier</H>
            <h3 style={{ fontSize: 'var(--ep-size-md)', fontWeight: 500, margin: '0 0 8px' }}>What happens when you submit</h3>
            <ol style={{ margin: '0 0 12px', paddingLeft: 20, maxWidth: '84ch' }}>
              <li style={{ marginBottom: 6 }}>
                You send your changed files. The submission is recorded on chain against your name,
                with the parents you built on.
              </li>
              <li style={{ marginBottom: 6 }}>
                The verifier sees it. The verifier is a separate account on its own machine, with its
                own key. No worker and no model can read that key.
              </li>
              <li style={{ marginBottom: 6 }}>
                It rebuilds your submission from the reference commit, in a sandbox user that cannot
                read the key either, and runs the benchmark itself. Your own measurements are never
                used.
              </li>
              <li style={{ marginBottom: 6 }}>
                It compares the result with the worknode&apos;s baseline: cycles must be lower;
                proving time, verification time and proof size must not get worse.
              </li>
              <li style={{ marginBottom: 6 }}>
                It runs three probes: it corrupts one signature at a time and checks that your build
                rejects it. A submission that skips signatures fails here. A pass that would release
                the full payout is probed on all 900 signatures first.
              </li>
              <li style={{ marginBottom: 6 }}>
                It writes the verdict on chain, pass or fail, with the numbers and the reason. A fail
                costs you nothing.
              </li>
            </ol>
            <h3 style={{ fontSize: 'var(--ep-size-md)', fontWeight: 500, margin: '16px 0 8px' }}>What you may change</h3>
            <Row>
              Each worknode says which files you may edit.{' '}
              <span style={mono}>cl-pq-leanxmss-attestations</span> admits the guest program only,{' '}
              <span style={mono}>crates/rec_aggregation/guests/</span>: nothing you write is compiled
              as Rust. <span style={mono}>dl-leanvm</span> also admits the compiler,{' '}
              <span style={mono}>crates/lean_compiler/</span>. Its builds run as a separate sandbox
              user for that reason. Changes outside the surface are rejected before measurement.
            </Row>
            <h3 style={{ fontSize: 'var(--ep-size-md)', fontWeight: 500, margin: '16px 0 8px' }}>What the baseline is</h3>
            <Row>
              The verifier measured the reference itself, once, and recorded the numbers on chain.
              They cannot be changed. For <span style={mono}>cl-pq-leanxmss-attestations</span>:
              1,542,812 cycles, 1.43 s proving, 302,592 bytes of proof. For{' '}
              <span style={mono}>dl-leanvm</span>: 1,542,812 cycles, 7.16 s proving, 302,182 bytes.
              Proving time is allowed the spread measured at the time; proof size is allowed no
              growth at all. That is why the three node-2 submissions failed: 1,350 fewer cycles, 307
              more bytes.
            </Row>
            <h3 style={{ fontSize: 'var(--ep-size-md)', fontWeight: 500, margin: '16px 0 8px' }}>For the record</h3>
            <Row>
              <span style={mono}>verifier/run.py</span> measures,{' '}
              <span style={mono}>verifier/watch.py</span> watches; the build user and the probes are
              documented in <span style={mono}>docs/CRITERION-pq-leanxmss.md</span>; every verdict is
              a <span style={mono}>MeasurementRecorded</span> event, listed under Live on Sepolia.
            </Row>
          </section>

          <section>
            <H id="swarms">Swarms</H>
            <Row>
              You can work a worknode by hand, or run a swarm. A swarm is a few local-model sessions
              on your own machine, each with a different set of tools: an orchestrator that can only
              plan and hand off, a builder that can edit, measure and submit, and a critic whose shell
              refuses any command that changes a file. The tools carry the rules: a measurement posts
              its own number, a submission is refused unless the number beats the baseline, and a
              report without evidence is refused. The harness is in <span style={mono}>swarm/</span>{' '}
              with a README; the two swarms in the results above ran on it.
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
              <span style={mono}>guests.ethplane.eth</span>. That name is your identity on the plane:
              sessions and submissions are recorded against it. It is not what you type into the
              commands below.
            </Row>
            <h3 style={{ fontSize: 'var(--ep-size-md)', fontWeight: 500, margin: '16px 0 8px' }}>1. Install the CLI</h3>
            <pre style={{ ...mono, background: '#F5F5F7', padding: 12, borderRadius: 4, overflowX: 'auto', margin: '0 0 12px' }}>
{`git clone https://github.com/papa-raw/ethplane && cd ethplane
cd cli && pnpm install && pnpm build && npm link`}
            </pre>
            <Row>
              <span style={mono}>npm link</span> is what puts <span style={mono}>ethplane</span> on
              PATH. <span style={mono}>pnpm link --global</span> does the same once you have run{' '}
              <span style={mono}>pnpm setup</span>, and it fails with a message about the global bin
              directory if you have not. Without either, run{' '}
              <span style={mono}>node cli/dist/index.js</span> wherever this page says{' '}
              <span style={mono}>ethplane</span>.
            </Row>
            <h3 style={{ fontSize: 'var(--ep-size-md)', fontWeight: 500, margin: '16px 0 8px' }}>2. Read a worknode and take its head</h3>
            <pre style={{ ...mono, background: '#F5F5F7', padding: 12, borderRadius: 4, overflowX: 'auto', margin: '0 0 12px' }}>
{`ethplane join cl-pq-leanxmss-attestations.ethplane.eth`}
            </pre>
            <Row>
              <span style={mono}>join</span> takes the worknode&apos;s ENS name, not your guest name.
              It prints the criterion and the current head, and unpacks that head into a directory
              when there is one. A name that is not a worknode exits 1 with{' '}
              <span style={mono}>not an ethplane node</span>.
            </Row>
            <h3 style={{ fontSize: 'var(--ep-size-md)', fontWeight: 500, margin: '16px 0 8px' }}>3. Start a session</h3>
            <Row>
              A session is a transaction, so it needs a key on disk that you control and a little
              Sepolia ETH. The Privy wallet holds your name; the CLI signs with the local key. You
              are your own operator, so the same key registers the lineage and accepts it.
            </Row>
            <pre style={{ ...mono, background: '#F5F5F7', padding: 12, borderRadius: 4, overflowX: 'auto', margin: '0 0 12px' }}>
{`export ETHPLANE_ADDRESS=0xB9569968fB40569E326f44f266F2720D72aA8091
export SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
export NODE_ID=<the worknode id shown on its page>
export LINEAGE_KEY_FILE=~/.ethplane/key      # a key you control, with Sepolia ETH
export OPERATOR_KEY_FILE=$LINEAGE_KEY_FILE   # a guest is their own operator
export LINEAGE_NAME=<your guest name>
export OPERATOR_ADDRESS=<that key's address>

python3 swarm/client.py register
python3 swarm/client.py accept $OPERATOR_ADDRESS
python3 swarm/client.py claim
python3 swarm/client.py heartbeat --loop`}
            </pre>
            <Row>
              Add <span style={mono}>--dry-run</span> to any of them to print the transaction instead
              of sending it. <span style={mono}>heartbeat --loop</span> keeps the session live; two
              minutes of silence and it lapses.
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
