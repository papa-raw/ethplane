# Deployments (Sepolia, ETHOnline 2026)

Chain id 11155111. Source of truth: `contracts/deployments/sepolia.json` and `sepolia-ens.json`, written by the deploy scripts.

| contract | address |
|---|---|
| Ethplane (registry, sessions, submissions, measurements, escrow, attribution) | `0xB9569968fB40569E326f44f266F2720D72aA8091` |
| PlaneToken (PLANE, test ERC-20; whole supply to the treasury) | `0x814817A2e7332749990500c324cb6B0c77deBFC1` |
| EthplaneSubregistry (our ENSv2 registry under `ethplane.eth`) | `0x58CB4caaDb0ebEdf7E1c96CeA6578Afb2f99d05b` |
| EthplaneResolver for `cl-pq-leanxmss-attestations.ethplane.eth` | `0xA11a923dA99Bb3aaE3643758DA8D408173199Bec` |
| EthplaneResolver for `dl-leanvm.ethplane.eth` | `0xaFE89fc8d99950B7F4c61BAE2602A80BC31De872` |
| Ethplane maintainer / registrant / reviewer | `0x3D70eA482c25e203bb650a86d6FDbe291E59b6b8` |
| Verifier (records measurements, writes head and status) | `0x0A6Ad2a627F8736E0f34849a0B5B80a109F81759` |
| EthplaneResolver for operator, lineage and guest names | `0x47572265f1795F26A3e657DA154577904aAA57Ed` |

## Nodes

| node | id | escrow | editable surface |
|---|---|---|---|
| `cl-pq-leanxmss-attestations` | `0x8e67c816b1f39fa072094b67f4f74937bd1920a7a9d79e4b98e785ae9aa29d58` | 10,000 PLANE | `crates/rec_aggregation/guests/` |
| `dl-leanvm` | `0x662b44f5cf418a3e3d4126a187d0154034afbdc8d2536b9076c68f2a4440c37e` | 10,000 PLANE (`0x188306499ff4e106b9d8a35981c1c76bbfec7378247096164a15a64b6d9df2d9`) | `crates/rec_aggregation/guests/`, `crates/lean_compiler/` |

The surface is per node and it is the verifier's `EDITABLE`, not a constant: one watcher per node, each
with its own value. Node 2 admits Rust, which is why its watcher also needs `BUILD_USER` — see
`verifier/README.md`, "Whole numbers only" and the criterion's Editable paragraph.

Every field in this table and the two below was read from the chain on 2026-09-09, not carried from a
plan: `nodeParties`, `nodeMetrics` and `nodeMoney` give registrant `0x3D70eA48…`, verifier
`0x0A6Ad2a6…`, reviewer `0x3D70eA48…`, originalMetric 1,542,812, no head yet, bounty 10,000 PLANE and
open true for both nodes.

### The recorded baselines, and which criterion decides

`recordBaseline` is once-only, so both of these are final. They are quoted here because the second one
looks wrong until you know how it was measured.

| node | cycles | provingMicros | spreadBps | the bound that follows | block |
|---|---:|---:|---:|---:|---:|
| `cl-pq-leanxmss-attestations` | 1,542,812 | 1,433,000 (1.43 s) | 190 | 1,460,227 µs ≈ 1.46 s | 11662947 |
| `dl-leanvm` | 1,542,812 | 7,158,000 (7.16 s) | 2367 | 8,852,298 µs ≈ 8.85 s | 11668042 |

Decoded from the `BaselineRecorded` logs, not from a note. Node 2's was recorded while both swarms
were working the host, so its proving time is five times node 1's and its spread is 23.67 % rather
than 1.9 %: the time bound it produces, 8.85 s against roughly 1.43 s on a quiet host, is lenient.
That is the safe direction — a lenient time bound cannot wrongly reject a good submission, only fail
to catch a slow one — and on both nodes the decision is the cycles criterion anyway: strictly below
1,542,812, thresholdBps 0, measured by the verifier and re-measured by the critic. Node 1 is the
opposite case and is worth stating plainly: its 1.46 s bound against ~1.5 s measured on the same host
today is tight enough to fail a correct submission on time alone.

### Verdicts recorded so far

| artifact | node | recorded | reason as recorded | what it means |
|---|---|---|---|---|
| `0x7d958feb…` (`0x46a9e099…`) | dl-leanvm | FAIL | see below | judged against node 1's constants |
| `0x1336adaf…` (`0x55a14b41…`) | dl-leanvm | FAIL | `regression-provingMicros` | judged against node 1's constants |

Both are honest records of what the verifier measured and dishonest about why. `watch.py` invoked
`run.py` with the tarball alone, and `run.py` carries node 1's baseline as constants — 1,433,000 µs
and spreadBps 190, a bound of 1.46 s — so node 2's submissions were judged against another node's
yardstick. `0x1336adaf…` measured cycles **1,541,462** (below the 1,542,812 baseline), proving
**1.709 s**, proof **302,489 B**, verify **47.5 ms**. Under node 2's own recorded baseline the 1.709 s
is well inside the 8.85 s bound and no regression at all; what actually fails it is proof size,
302,489 against 302,182 recorded, which has no allowance. The verdict on chain stands — a measurement
cannot be recorded twice — and this row is the correction beside it.

Fixed on `submission-sweep`: `watch.py` reads the node's own `BaselineRecorded` log (or `BASELINE_JSON`)
and hands it to `run.py` as its baseline file, and refuses to judge at all when it cannot read one,
because a verdict against the wrong baseline is permanent.

## Names (ENSv2, hackathon deployment on Sepolia)

`ethplane.eth` is registered on the hackathon ETHRegistry `0x1D78834d97c1D7b1A38c1deDBD1a287cFEd3971e`; its subregistry is ours. Resolution runs through ENS's Universal Resolver `0xd26f2040d083af1cd2962ba303f4bea0c4faf142`: root → `.eth` → `ethplane` → our subregistry → our per-node resolver. Registered so far: `cl-pq-leanxmss-attestations.ethplane.eth` and `dl-leanvm.ethplane.eth` (both resolve `ethplane.status` = `open` and an `ethplane.criterion` sentence), `ecofrontiers.ethplane.eth`, `qwen-a`, `fast-b`, `verifier` under it, `guests.ethplane.eth`. Every address in this file was resolved or read on 2026-09-09; the commands and their outputs are in `docs/ENS-PROBES.md`. Any of the 65 roadmap ids can be registered once by anyone (`EthplaneSubregistry.register`).

Why our own subregistry and resolvers: the hackathon deployment's registry and resolver implementations expose no initializer, so proxies from its factory hold no roles and cannot register names or write records; and the deployed resolver scopes record roles per key rather than per name. Probes and transaction hashes are in `research/` and the repository history. Everything above the name (root, `.eth`, the Universal Resolver, hierarchical registries) is ENSv2's.

## Treasury (Privy)

The PLANE supply sits in a Privy server wallet bound to a policy that allows only: `approve(PLANE → Ethplane)`, `fundNode` with amount ≤ 100,000 PLANE, and `defineNode` whose split gives the verifier at least 10 %. Every other transaction is refused at signing.
