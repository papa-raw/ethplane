# For a judge, in the order that answers "is any of this real"

Every line below was run against Sepolia or the live site on 2026-09-09, and says what it returned.
Where a check has a caveat, the caveat is here rather than in a footnote.

```
export RPC=https://ethereum-sepolia-rpc.publicnode.com
export UR=0xd26f2040d083af1cd2962ba303f4bea0c4faf142      # ENS Universal Resolver (hackathon)
export ETHPLANE=0xB9569968fB40569E326f44f266F2720D72aA8091
export PLANE=0x814817A2e7332749990500c324cb6B0c77deBFC1
```

## 1. The names resolve through ENS, not through us

Two live nodes, each with its own resolver under our subregistry:

```
cl-pq-leanxmss-attestations.ethplane.eth → resolver 0xA11a923dA99Bb3aaE3643758DA8D408173199Bec
                                           ethplane.status = "open"
dl-leanvm.ethplane.eth                   → resolver 0xaFE89fc8d99950B7F4c61BAE2602A80BC31De872
                                           ethplane.status = "open"
```

The exact `cast` calls, the DNS encoding and every text record are in `docs/ENS-PROBES.md`. The walk
is root → `.eth` → `ethplane` → our subregistry → the node's resolver, and the resolver address in
the output is the one the Universal Resolver picked, not one we asserted.

## 2. The subregistry is set on ENS's own registry

```
cast call 0x1D78834d97c1D7b1A38c1deDBD1a287cFEd3971e 'getSubregistry(string)(address)' ethplane --rpc-url $RPC
→ 0x58CB4caaDb0ebEdf7E1c96CeA6578Afb2f99d05b
```

## 3. Both nodes are defined, funded and open — read from the contract, not from us

```
cast call $ETHPLANE 'nodeMoney(bytes32)(uint256,uint256,bool,bool)' <nodeId> --rpc-url $RPC
→ 10000000000000000000000  0  true  false        (10,000 PLANE escrowed, open, not closed)

node 1  cl-pq-leanxmss-attestations  0x8e67c816b1f39fa072094b67f4f74937bd1920a7a9d79e4b98e785ae9aa29d58
node 2  dl-leanvm                    0x662b44f5cf418a3e3d4126a187d0154034afbdc8d2536b9076c68f2a4440c37e
```

`nodeParties` gives registrant `0x3D70eA48…`, verifier `0x0A6Ad2a6…`; `nodeMetrics` gives
originalMetric 1,542,812 on both and no head yet. Node pages:

```
https://ethplane.ecofrontiers.xyz/node/0x8e67c816b1f39fa072094b67f4f74937bd1920a7a9d79e4b98e785ae9aa29d58
https://ethplane.ecofrontiers.xyz/node/0x662b44f5cf418a3e3d4126a187d0154034afbdc8d2536b9076c68f2a4440c37e
```

(The route is the node id. `/node/<name>` serves the map, not the node.)

## 4. Sessions, submissions and verdicts are on chain

From the rehearsal on node 1, each verifiable with `cast tx <hash> --rpc-url $RPC`:

| what | transaction | block |
|---|---|---|
| a session started (qwen-a) | `0xd13b5146c4ea8c61ad91b2db303586642e46275a66bc5eec0870a463ce077024` | 11667679 |
| a submission | `0xe02ca9c39a31b28079ad7c5edadb9761e19df9ce32d5277d9799da89bb5c7053` | 11667682 |
| the verifier's verdict (FAIL) | `0x849b6baf6ec7eff608a2a808c9c18dfee38e2fe536b3546ef1bc2e5a555e5793` | 11667718 |

Node 2 has two recorded verdicts of its own, both FAIL, and `docs/DEPLOYMENTS.md` carries them with
the reason as recorded **and** the correction beside it: the watcher judged them against node 1's
baseline constants rather than node 2's own recorded baseline. The measurements were right and the
yardstick was another node's; the fix is in `verifier/watch.py`, and the verdicts stand because a
measurement cannot be recorded twice. We would rather show you that than a clean table.

## 5. The treasury cannot pay anyone

The PLANE supply sits in a Privy server wallet bound to policy `c8io5x5g08igo85ljedozu2k`, six rules,
all ALLOW, listed in full in `docs/DEPLOYMENTS.md`: approve PLANE to the Ethplane contract, fund a
node up to 100,000 PLANE, define a node whose split gives the verifier at least 10 % — once for
`eth_sendTransaction` and once for `eth_signTransaction`. A Privy policy is an allowlist, so
everything else is refused before anything is signed. Re-run at 2026-09-09 14:52:33 UTC, a plain
`transfer` of 1 PLANE from the treasury:

```
→ HTTP 400  {"error":"RPC request denied due to policy violation","code":"policy_violation"}
```

Ask us to run it live; it is a single API call and nothing is signed.

## 6. The verifier can be run, and it refuses more than it accepts

```
git clone <this repository> && cd ethplane
forge test                                   # 55 passed, 1 skipped, 56 total
SEPOLIA_RPC_URL=$RPC forge test              # 56 passed — the skipped one is the ENS fork test,
                                             # which needs an RPC. A skipped test is not a pass.
python3.12 verifier/tests/test_r16.py        # the verifier's own contracts, one test per rule
```

The verifier is `verifier/run.py`: it builds the submission in a worktree of the pinned commit, runs
the criterion's own command, checks non-regression against the node's recorded baseline, runs the
reference proof verifier, and probes the submission with corrupted signatures the submission cannot
see. Every path that cannot establish something returns a reason instead of an acceptance — including
`host-config`, which says the host is wrong rather than blaming the submission. Node 2's editable
surface includes the compiler, so its builds run as a user that cannot read the verifier's key
(`verifier/host-setup-build-user.sh`), and the measurement runs as that user too.

## 7. The swarm is not a demo video

`swarm/agent.py` is the harness the local models run in — our own loop against an OpenAI-compatible
endpoint, written after the off-the-shelf one stopped at an action cap and rendered tool calls as
parameter blocks. What a session may claim is a tool contract, not a prompt: a report without a
number, a command's output or a `path:line` is refused, a second handoff to a peer that has not
answered is refused, and a claim naming a file the session never opened is refused. Every transcript
line is mirrored to journald as it is written and chained by sha256, so `swarm/audit.py --journal`
reads what the harness recorded rather than what the model says about itself — including an
INJECTION line if anything else writes under the tag. The counts that produced those rules, from a
day of real transcripts, are in `swarm/README.md`.

## 8. What the swarms tried

Read from the chain and from the two swarm boards on the host, on 2026-09-09. Every measurement the
verifier recorded, in order, decoded from the `MeasurementRecorded` logs:

| block | node | artifact | cycles | proving µs | proof B | verify µs | accepted | status | tx |
|---|---|---|---:|---:|---:|---:|---|---|---|
| 11667718 | node 1 | `0x0caf464b…` | 0 | 0 | 0 | 0 | false | FAIL | `0x849b6baf…` |
| 11667719 | node 1 | `0xb8ac6f31…` | 0 | 0 | 0 | 0 | false | FAIL | `0x94190055…` |
| 11668015 | node 1 | `0x8ef9245f…` | 1,542,812 | 7,240,000 | 302,182 | 54,200 | false | FAIL | `0x08fc8db1…` |
| 11668029 | node 1 | `0x87c3367e…` | 1,542,812 | 6,696,000 | 302,182 | 108,000 | false | FAIL | `0xeaf2f490…` |
| 11668581 | node 2 | `0x7d958feb…` | **1,541,462** | 1,731,000 | 302,489 | 49,100 | false | FAIL | `0x46a9e099…` |
| 11668587 | node 2 | `0x1336adaf…` | **1,541,462** | 1,741,000 | 302,489 | 50,600 | false | FAIL | `0x55a14b41…` |
| 11668625 | node 2 | `0x471b8911…` | **1,541,462** | 1,777,000 | 302,489 | 49,300 | false | FAIL | `0x905609d1…` |

The first two carry zeroes because they were rejected before anything was measured. The next two are
node 1's guest-only attempts: the cycle count did not move at all — 1,542,812, the baseline exactly.
That is the whole story of node 1, and the boards say the same thing at greater length: of 80 MEASURED
lines on swarm A's board, 56 report `cycles=1542812`, the baseline unchanged, and the rest are runs
that produced no number. At this commit the guest program is not where the cycles are.

Node 2 admits the compiler as well, and that is where the last three rows come from: **1,541,462
cycles, 1,350 below the baseline, on all three attempts** — a real cut, found by a local model editing
`crates/lean_compiler/`. Swarm B's board carries 217 MEASURED lines, 166 of them the unchanged
baseline and 32 at 1,541,462: the swarm searched, most hypotheses did nothing, and one worked.

And then the judge held the bound. Every one of those three is FAIL, because the proof grew:
**302,489 bytes against the 302,182 recorded**, and proof size is the one field of the four with no
allowance at all. The swarm found a cycles cut and paid for it in proof size; the verifier would not
take the trade. Nothing here was accepted: `verifierAccepted` is false on all seven, so none of them
even reached the contract's cycles comparison — `_judge` returns FAIL on the flag before it looks at
the number.

Two of those verdicts were also judged against the wrong yardstick, which is written up in
`docs/DEPLOYMENTS.md` rather than quietly fixed: the watcher passed node 1's baseline constants while
judging node 2. The measurements were right, the reason recorded was not, and the record stands
because a measurement cannot be recorded twice.

A PASS was never the deliverable. The framework is: a node with a criterion, an escrow, sessions that
lapse, a verifier that refuses, and a record anyone can read. These rows are what it looks like when
the thing works and the answer is no.

## 9. What is honest about the state of it

- Node 1's recorded baseline was measured by a different process on all cores; its non-regression
  bound is 1.46 s against ~1.5 s measured on the same host today, so a correct submission can fail it
  on time alone. `recordBaseline` is once-only, so it stands. `run.py --baseline` exists so the next
  node's baseline comes from the verifier's own procedure on the judging host.
- Node 2's baseline was recorded under swarm load: 7,158,000 µs, spread 2367, a lenient 8.85 s bound.
  Lenient cannot wrongly reject; the cycles criterion decides.
- No submission has passed yet. The nearest is node 2's `0x1336adaf…` at 1,541,462 cycles, below the
  1,542,812 baseline, failing on proof size (302,489 B against 302,182 recorded, the one field with
  no allowance).
- `addr` is unset on all three ENS names, and `ethplane.node` is unset on both nodes; neither affects
  resolution. The cast lines that would set them are in `docs/ENS-PROBES.md`.
- A lineage name is a label, not an identity the contract enforces. `registerLineage` stores whatever
  `bytes32` the registering key passes (`contracts/Ethplane.sol:284-289`), and the Privy wallet that
  owns the ENS name never signs, so nothing today stops one key registering under another's label.
  Every session, submission and payout is keyed to the signing address, so the record is sound; the
  missing check is name ownership, and it is the next step.
