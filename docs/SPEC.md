# Ethplane — technical specification (public)

Derived from the internal plan on 2026-09-08. Strategy, budget, prize and judging material is kept private; this file carries the design. Planning only: nothing here is built yet.

## 0. The question this plan answers
Pat, 2026-09-08: **"How can we design a collaborative plane that allows humans and AI as a swarm to pull and rebuild a history of contributions, build on it, and receive attribution for their own contributions?"**

Each clause maps to a part of the design:
- *pull and rebuild a history of contributions*: the contribution tree addressed by ENS names and reconstructed by the resolver (§17); the public record and boards (§3, §10.2).
- *build on it*: leases, submissions with declared parents, the join and resume path from a name (§4, §15.2, §17.3); the routing function deciding how a group organises inside a node (§1, §13).
- *as a swarm, humans and AI*: any harness or person is a group under an operator identity; execution is isolated, everything else is shared (§9.2, §10).
- *receive attribution for their own contributions*: attribution rows for verified results, criteria, reuse, verification and compute, accruing to operator identities, judged by verifiers the contributors cannot write to (§9.4, §9.6, §10.3).
The Ethereum roadmap (§5, §16) is the first history the plane holds, because its owners have said in writing that it needs more hands in parallel than a linear process can supply (§16.1).


## 1. What coharness is

Coharness is three things. The first two exist in this repository today; the third is the sibling repository `ai-mech-atlas`:

1. **A routing function.** Input: a task description. Output: one of four coordination modes (single agent; ordered chain of agents; orchestrator with specialists and a separate reviewer; open claim by any qualified agent) plus a model tier and a budget. The decision rule is `routing-table.md`. The stop rule in that file states when a task must not be split: when one part's result would change a decision another part already made.
2. **A coordination protocol.** A shared append-only record (the board), a fixed handoff format with an acceptance criterion on every handoff, a reviewer that never edits and a builder that never approves, and slot management for adding and removing agents during a run. Implemented in `dogfood/`.
3. **A catalogue of coordination mechanisms and failure modes.** `ai-mech-atlas` (58 coordination mechanisms and 58 failure modes per its own README) plus the empirical base in `research/` (N=260 scaling study; error amplification 17.2x for independent agents vs 4.4x with a central reviewer).

Ethplane applies these three to one domain: research and engineering tasks defined by the Ethereum protocol roadmap. The routing function is visible in the product, not only asserted here: every node in the coverage table (§13) carries a routing mode, and every node page (§12.3) shows the mode chosen for the current task and the stop-rule reason.


## 2. What Ethplane does

Ethplane is a task registry and verification system. It holds the Ethereum roadmap as a set of tasks, lets many independent agent groups work on those tasks in parallel, verifies results with code the agents cannot modify, and records the outcome on a public chain.

- **Scope: the whole strawmap.** Every node on the EF strawmap (consensus, data and execution layers; forks G through L, longer term, north stars; 65 nodes: consensus 22, data 12, execution 31, including three trend bars and four north stars (strawmap-nodes.json; 13 tagged EIP, 3 SFI, 4 CFI, 45 untagged)) is a task. Not six. Nodes have the strawmap's own status (EIP, SFI, CFI, onchain, offchain, north star) and fork target.
- **Many loops, not one.** Each claimed node runs its own research loop. Loops run in parallel. Concurrency is bounded by the compute budget, the dispatcher queue (§10.4) and the verifier's re-scoring capacity (§10.3).
- **A task is defined by a metric.** Each node carries an acceptance criterion that a program can evaluate: a benchmark, a test suite, a proof check, a spec-conformance test, or a reviewed deliverable with a checklist. Nodes without a computable criterion are marked "specification only" and carry a checklist criterion evaluated by a reviewer agent that did not do the work.


## 3. System components

| Component | Function | Implementation |
|---|---|---|
| Node registry | Stores every roadmap node: id, layer, track, fork target, status, criterion, dependencies, current lease | Smart contract on Sepolia (or Hedera; decided by spike); ENSv2 names as identifiers |
| Lease | Time-bounded right to submit work on a node. Has a duration, a heartbeat interval and a holder | Contract state. Default duration 12 min for compute tasks, 24 h for specification tasks |
| Submission | A signed reference to work: a diff, a document hash, a benchmark run id | Contract event + content on IPFS or in the public repo |
| Verifier | Runs the node's criterion on the submission using verifier-owned code and data. Signs the result | Separate process, separate OS user, separate key. For compute tasks: a GPU runner that executes the submitted diff and computes the metric on a held-out split the submitter never sees |
| Release | Pays the bounty and marks the node's progress when a verified result meets the criterion | Escrow contract releases on the verifier's signature |
| Record | Every claim, heartbeat, submission, verdict and release, in order | Contract events, indexed by a subgraph; readable by agents through a query API |
| Agent groups | Any set of agents that claims a node. Internal organisation chosen by the routing function | coding-agent sessions, or any harness; identity is a key |
| Treasury | Holds funds; releases only against verifier signatures under a policy | Organisation wallet with spend policies (Privy or equivalent) |


## 4. Rules

1. Agents can read all records. Agents can write only claims, heartbeats and submissions for leases they hold.
2. The verifier's code, data and key are set by the operator. No agent can modify them through any path.
3. A lease expires when its holder misses a heartbeat or the duration ends. No group of the same operator can re-claim that node for one lease duration.
4. Several groups may hold leases on the same node when the node is marked open. The first verified result that meets the criterion is paid. Other submissions remain on record.
5. Arrows on the strawmap are NOT dependencies in Ethplane. Source conflict found by the researcher (eth-governance.md (d)): the image dated 2026-08-04 says arrows "represent throughlines, not hard dependencies"; the live strawmap.org FAQ says arrows are "hard technical dependencies or natural upgrade progressions". Decision: the ingested artefact's own disclaimer governs. Throughlines are stored as `throughlines_to` for display only; a hard dependency exists only when the registry maintainer sets it explicitly on a node, with a source. Pat can overrule.
6. When the verifier cannot run (no data, no compute, no key), it emits no verdict. No verdict means no release and no status change.
7. Rule changes to the registry or verifier go through a proposal process (section 5). Rule changes to agent-side code (prompts, skills, routing) need no approval; they are recorded.


## 5. Governance, wired to Ethereum's process

Ethplane follows Ethereum's existing governance where it applies and states the differences. Mapping, to be confirmed by the researcher's ingestion:

| Ethereum | Ethplane |
|---|---|
| Roadmap node on the strawmap (EF Protocol, strawmap@ethereum.org) | Node in the registry |
| EIP lifecycle: Idea → Draft → Review → Last Call → Final (EIP-1) | Two separate things (researcher: CORRECTED, partial). Ethplane's submission lifecycle (claimed → submitted → verified → released) is an internal state machine and does not copy EIP-1. A node whose subject is an EIP shows that EIP's current EIP-1 status as a read-only field, fetched from eips.ethereum.org |
| Fork inclusion: Proposed for Inclusion (PFI) → Considered for Inclusion (CFI) → Scheduled for Inclusion (SFI) → shipped | Node priority and bounty weight follow the strawmap tag: SFI nodes are funded first, CFI next, others by operator choice |
| Fork = named milestone (Glamsterdam, Hegotá, I…L) | Milestone grouping in the registry; progress reports per fork |
| All Core Devs calls (ACDE, ACDC) decide inclusion; client teams implement independently; devnets and testnets verify | Operator review cadence decides funding changes; independent agent groups implement; the verifier's held-out tests play the role devnets play, a shared test environment every implementation must pass |
| EIP editors check format and process, not merit | Registry maintainers check that a node has a computable criterion, not whether the work is good |
| Ethereum Magicians and EIP repository as the public record [UNVERIFIED this pass] | The onchain record plus the public repository |
| Strawmap arrows: throughlines per the 2026-08-04 image; "hard technical dependencies or natural upgrade progressions" per the live FAQ | Display-only throughlines; explicit maintainer-set hard dependencies (rule 4.5) |

What the researcher must supply: the current EIP-1 status list and rules, the current fork-inclusion process document and its definitions, the ACD call structure, the strawmap's source page and update history, and for each strawmap node the EIP number or spec link where one exists.


## 6. Scaling

- **Parallelism.** N nodes, N independent loops. There is no orchestrator across nodes; coordination cost grows with the number of nodes and with the shared record and queue that every group reads (§10.2, §10.4).
- **Compute.** Compute-bound nodes run on rented GPUs with a fixed budget per experiment; cost per verified result is one experiment plus one verification. Specification nodes cost reviewer time only.
- **Entry.** Any harness can participate: the interface is a contract and a query API. coding-agent sessions are the first client.
- **Growth of the criterion set.** Nodes start as "specification only" and become "computable" when someone contributes a benchmark or test harness for them. Contributing a criterion is itself a paid task.


## 9. Identity and attribution (added 2026-09-08, Pat: "consider the ENS and agent identity parts ... to establish attribution, which can lead to allocation in the future")

### 9.1 Purpose
Every unit of work in Ethplane must be attributable to an identity that persists longer than the agent session that did it. Attribution is the record of who contributed what to which node, verified. Allocation is a later function that reads that record and distributes funds or weight. This plan builds attribution and leaves allocation as a defined interface.

### 9.2 Identity levels
| Level | What it is | Lifetime | Identifier | Key |
|---|---|---|---|---|
| Operator | A person or organisation that runs agents and is accountable for them | Permanent | ENS name owned by the operator (e.g. `ecofrontiers.eth`) | Operator key; used to create groups and set policy |
| Agent group | One configuration: harness, model tier, prompts, routing rules. Equivalent to a client team in Ethereum's process | Months | Non-transferable subname under the operator (e.g. `swarm-a.ecofrontiers.eth`) plus an entry in a Ethplane-deployed instance of the ERC-8004 identity registry with a capability card URI (ERC-8004 is Draft status and has no canonical deployed registry; researcher, identity-checks.md (1)) | Group key; signs claims and submissions |
| Agent instance | One running session | Minutes to hours | No name. A session id recorded in the claim, bound to the group key | Uses the group key through the harness; never holds it directly |
| Verifier operator | Whoever runs a node's verifier | Per node | Subname under the registry's name (e.g. `verify.sparse-blobpool.ethplane.eth`), set by the registry maintainer | Verifier key; signs verdicts. A verifier operator cannot hold a lease on the node it verifies |

### 9.3 ENS use
- **Nodes are names.** Each strawmap node is a subname under the registry name: `sparse-blobpool.ethplane.eth`. Text records hold the node's status, fork target, criterion hash and current lease holder. Only the registry maintainer's key and the node's verifier key can write these records (ENSv2 Enhanced Access Control roles; confirmed: the Permissioned Resolver has 11 roles, 8 of them per-record, identity-checks.md (2)).
- **Groups are names.** Operators register groups as subnames under their own name. Subnames are non-transferable, so a reputation cannot be sold, and revocable, so an operator can retire a group.
- **Leases are records, not names.** Creating a subname per lease costs a transaction per claim and adds nothing the contract event does not already hold. The lease is a contract state; the node's text record mirrors the current holder for human lookup.
- **Resolution.** Any client resolves a node name to its contract, its verifier key and its record; any group name resolves to its operator, its capability card and its attribution total. Resolution of every node under the registry through the Universal Resolver V2 traversing the hierarchical registry (confirmed functionally; the phrase "wildcard" is not used in the ENSv2 docs, identity-checks.md (2)).

### 9.4 What is attributed
Each verified event writes one attribution row: `(node, group, operator, event type, weight, submission hash, verifier signature, block)`. Event types:
1. **Verified result.** A submission met the node's criterion. Weight: the node's bounty weight times the fraction of the criterion achieved, when the criterion is a metric.
2. **Criterion contributed.** A group supplied a benchmark, test suite or spec test that made a "specification only" node computable. Weight: fixed per node, paid once.
3. **Reused work.** A winning submission built on an earlier submission by another group (its diff or its recorded partial). Detected from the submission's declared parents and checked by the verifier against the record. Weight: a fixed share of the winner's weight, paid to the parent's group.
4. **Verification performed.** A verifier operator produced a verdict. Weight: fixed per verdict.
5. **Dependency unblocked.** A verified result on a node that other nodes list as a hard dependency. Weight: a fixed bonus per unblocked node.

Rows are contract events. The subgraph aggregates them per group, per operator, per node and per fork milestone.

### 9.5 Allocation interface (not built for the hackathon)
The attribution table is designed so that a later allocation function can consume it without changes. Two Ethereum precedents define the shape:
- **Protocol Guild** (confirmed, exact formula quoted in identity-checks.md (3)): `time_weight = SQRT((start_date − months_inactive) × full_or_part_time)`, normalised to a share; the square root compresses the range so long-term members are not over-privileged; $39M distributed since 2022 to 190 contributors. Ethplane analogue: an operator's weight is the square root of its bounty-weighted verified events in the period, so one large result does not dominate.
- **Optimism Retro Funding** (confirmed; identity-checks.md (4)): retroactive, impact-based, with a scoping, scoring and settlement structure per round. Ethplane analogue: per fork milestone, a share of the treasury is distributed by attribution weight accumulated during that milestone; scoring is the attribution table, settlement is the treasury release.
The allocation function is: input, attribution rows for one period; output, a distribution per operator. It is a proposal under section 5, not a hard-coded rule.

### 9.6 Controls against gaming
- **Sybil groups.** A group needs an operator name, which costs a registration and is accountable. Weight accrues to operators, not to groups, so splitting one operator into many groups gains nothing.
- **Self-verification.** A verifier operator's key cannot hold a lease on the same node. Checked by the registry on claim.
- **Reuse fraud.** Declared parents must exist in the record before the child submission; the verifier rejects submissions whose parents post-date them.
- **Metric gaming.** The verifier computes the metric on data the submitter never sees, on verifier-owned compute (§10.3); a submission only ever earns the fraction the verifier computes.
- **Criterion author advantage.** The group that contributed a node's criterion cannot hold a lease on that node for the first two lease periods after the criterion is accepted.
- **Reuse under-declaration and self-dealing.** The verifier compares a submission against all prior submissions on the node (diff similarity) and adds missing parents; reuse rows between groups of the same operator pay nothing, since weight accrues to the operator.
- **Lease squatting and verdict farming.** Cooldown (§4 rule 3) applies per operator, not per group; verification rows pay only after the verdict survives the spot-check window.
- **Identity cost.** An operator identity requires the ENS registration and a bonded deposit held by the treasury, forfeited on a proven fraud (fabricated result, forged parent, untrusted runner).
- **Weight inflation by cheap nodes.** Weights are set per node by the registry maintainer, following the strawmap tag (SFI highest), so many trivial nodes cannot outweigh one scheduled one.

### 9.7 Hackathon scope for this section
Register the registry name and node subnames on Sepolia ENSv2 with text records written by the verifier key; register at least two agent groups under one operator name; emit attribution rows for every verified event in the demo; show one group's attribution total resolving from its name. Deploy a Ethplane instance of the ERC-8004 identity registry (Draft standard, no canonical deployment) only if it costs under an hour; otherwise the ENS group subname is the identity for the hackathon.


## 10. Shared plane: pooling compute and work, with attribution (added 2026-09-08, Pat: "users should be able to pool compute resources / work across a shared collaborative plane and receive attribution")

### 10.1 What is pooled
| Resource | How a user contributes it | How it is used | Attribution event |
|---|---|---|---|
| Compute | Registers a runner: a machine running the fixed runner image, reachable by the dispatcher, with a declared GPU type and hours offered | The dispatcher sends queued TRAINING jobs (submitted diffs under the node's fixed budget) to any idle pooled runner; the runner returns the trained artefact. Scoring never runs on pooled compute | **Compute provided**: per job whose artefact the verifier accepted, weighted by measured GPU-seconds; provisional until the spot-check window closes |
| Work | Submits diffs, partials, documents or test harnesses on any open node under a group identity (section 9) | Other groups read them from the record and may build on them | **Verified result**, **reused work**, **criterion contributed** (section 9.4) |
| Verification | Registers as a verifier operator for a node, under the constraint in section 9.2 | Scores submissions for that node | **Verification performed** |
| Review | Serves as reviewer for "specification only" nodes; assigned by the registry, not chosen by the submitter | Produces a checklist verdict | **Verification performed** |

All four accrue to the contributor's operator identity in the same attribution table. Allocation (section 9.5) reads one table.

### 10.2 The shared plane
- **One record, all operators.** Every node, lease, submission, partial and verdict is on the same registry and readable by every participant. A group from operator A can claim a node, read operator B's partial, and build on it; B receives a reused-work row when A's submission is verified.
- **Cross-group sub-tasks.** A group that reaches a sub-problem outside its capability publishes it as a child task on the same node with its own criterion and lease. Any group may claim it. The routing function decides the child's mode: pre-assigned if the child's result would change decisions the parent has already made (the stop rule), open claim otherwise.
- **Shared boards.** Each group's working board is public and append-only. Execution state (sandboxes, contexts, worktrees) is private to the group. This is the only isolation.

### 10.3 Trust in pooled compute
A pooled runner belongs to a contributor, so its output is a claim, not a verdict. The held-out data never leaves the verifier: pooled runners TRAIN the submitted diff; the verifier SCORES the returned artefact on its own compute. Three further controls:
1. **Fixed image.** Runners execute one signed training image. Without hardware attestation the image check is a convention, which is why scoring is not delegated to it (above) and why compute rows stay provisional.
2. **Spot-check re-training.** The verifier operator re-executes a random fraction of training jobs (initially 20 percent, adjustable per node) on verifier-owned compute and compares artefacts within tolerance. Compute rows are provisional until this window closes, so a mismatch voids unpaid rows and marks the runner untrusted; nothing is paid before detection can happen.
3. **No self-scoring.** A runner registered by operator X cannot execute jobs whose submission is from operator X. Enforced by the dispatcher from the registry.
Hardware attestation (TEE) is a later upgrade, not a hackathon dependency.

### 10.4 Dispatcher
A service that reads the queue of submissions, matches each to an idle runner that satisfies the node's compute requirement and the no-self-scoring rule, records the assignment, and forwards the runner's signed output to the verifier operator. It is stateless except for the queue; the record is the state. Runners heartbeat like leases; a runner that misses heartbeats is marked offline and its jobs re-queued.

### 10.5 Hackathon scope
Two runners from two operator identities in the pool; jobs from a third identity dispatched across both; one spot-check re-score shown agreeing; compute-provided rows visible per operator in the attribution query. Cross-group reuse shown once: the recovering group in the demo builds on the killed group's partial and both receive rows.


## 12. Main deliverable: the dashboard as collaboration surface (added 2026-09-08; Pat: "the main deliverable here to be an interactive dashboard where each roadmap item is a node you can click into ... get all the info you need for that collaboration surface")

### 12.1 What it is
A web application that renders the EF strawmap as an interactive graph. Every roadmap item is a node. Clicking a node opens its page: what the problem is, how it is judged, who is working on it, what has been submitted and verified, what it depends on, and how to join. The dashboard reads the registry, the record and the attribution table through the query API (subgraph or HCS mirror). It writes through the same contract calls an agent uses (claim, submit), signed by the user's key, and through one operator-run service, the launcher (§15.2), which owns the cloud credential and spends only against one-time codes and an account ceiling.

### 12.2 Layout
The strawmap's own grid is the layout: three layer bands (consensus, data, execution), fork columns (G, H, I, J, K, L, longer term, north stars), track rows within each band, throughlines as arrows. Node colour follows the strawmap legend (headliner, onchain, offchain, north star) and an added state ring: open, leased, verified, specification only, locked by dependency. Filters: layer, fork, tag (EIP, SFI, CFI), state, operator.

### 12.3 Node page: fields and their sources
| Field | Source | Notes |
|---|---|---|
| Label, layer, track, subtrack, fork target, tag, uncertainty flag | `strawmap-nodes.json` (researcher, from the strawmap image) | Static seed, versioned with the strawmap date (2026-08-04) |
| Governance links: EIP numbers and status, spec links, ethereum-magicians thread, ACD mentions | `strawmap-nodes.json` + `eth-governance.md` | Fetched from eips.ethereum.org at build time; status shown as of fetch date |
| Throughlines in and out; hard dependencies | `strawmap-nodes.json` | The strawmap says arrows are throughlines, not hard dependencies; the registry maintainer marks which are hard |
| Acceptance criterion: type (metric, test suite, proof check, spec conformance, reviewed checklist), definition, held-out data policy, current baseline | Registry contract (`criterion_hash`) + the criterion document in the public repo | "Specification only" nodes show the checklist and the reviewer assignment rule |
| Bounty weight and funding state | Registry + treasury | Weight follows the tag (SFI > CFI > others) |
| Current lease: holder group, operator, started, expires, last heartbeat | Registry events | Countdown shown live |
| Lease timeline: every claim, heartbeat, missed heartbeat, FORFEIT and expiry on this node, in order, with the group and operator | Registry events | The demo's kill-and-recover beat happens here; the design brief's countdown lives on the current entry |
| Coordination mode for the current task: the routing mode chosen (single, sequential, orchestrated, open claim) and the stop-rule reason in one sentence | Routing function output, recorded with the claim | This is where coharness is visible on the product |
| Submissions: list with group, time, hash, declared parents, verdict, metric value | Record events | Partials are submissions without a verdict request; visible to everyone |
| Verdicts: verifier operator, metric computed, pass/fail, spot-check status | Record events (verifier key) | Only these change node state |
| Attribution on this node: rows by type and operator | Attribution events via subgraph | Links to each operator's page |
| Boards: each group's public working board for this node | Board topic or repo path per lease | Read-only view, newest first |
| Runner queue for this node: jobs waiting, running, done; pooled runners eligible | Dispatcher state | From §10.4 |
| How to join: claim button (if open), required capability, compute requirement, the CLI or harness command that does the same | Registry + docs | The button issues the same contract call an agent makes |
| Freshness and provenance: time of the last indexed block behind this page, and on every event row a link to the transaction on a chain explorer and to the subgraph query that produced it | Query API metadata + explorer URL pattern | The field that lets a judge confirm the data is live rather than take it on trust |

### 12.4 Other pages
- **Operator page:** name, groups, attribution totals by type and milestone, runners offered, nodes worked.
- **Milestone page (per fork):** nodes in the fork, funded vs open vs verified, attribution for the period, the allocation preview (read-only projection using the §9.5 interface).
- **Record page:** the raw event stream, filterable, with links to chain explorers.

### 12.5 Live-data rule
The dashboard reads live chain data through Ethplane's own indexer (a viem `getLogs` poller over the contract, SQLite, REST at `/api`). Mocked or static datasets disqualify the Graph prize and would misrepresent the record; the static seed is only the strawmap description, never the state.

### 12.6 Process
UI work goes to the designer role first: brief, three variants as snapshots, comparative pick, tokens, visual QA. The builder receives the brief, the chosen variant and the tokens. Brief: `DESIGN-BRIEF-dashboard.md` in the run dir. Stack default per the winner study: Next.js, Tailwind, shadcn, static export where possible.


## 13. Coverage plan: one row per strawmap node (added 2026-09-08; Pat: "a plan for 100% coverage")

Definition of coverage: a node is covered when the plan states, for that node, (a) what a contributing group would produce, (b) how a verifier would judge it, (c) what data or tests the judgement needs and whether they exist today, (d) its compute class, (e) its hard dependencies, and (f) its priority from the strawmap tag. A node with no computable judgement is still covered if (b) names the reviewed checklist and the reviewer assignment rule.

Source of the node list: `strawmap-nodes.json` (from the strawmap image dated 2026-08-04). The table below is generated from that file once it lands and is versioned with the strawmap date. Until then this section holds the schema and the criterion types.

### 13.1 Criterion types
| Type | Judged by | Examples of nodes it fits |
|---|---|---|
| Metric | Verifier computes a number on held-out data; pass if past threshold | throughput and latency items: slot duration decreases, data availability increases, gas limit increases, local blob reconstruction, multidimensional pricing simulations |
| Test suite | Verifier runs a fixed suite (spec tests, consensus-spec tests, EVM test vectors, hive) against the submission | client-side items: BALs, ePBS, FOCIL, ethp2p broadcast, partitioned binary tree, frame transactions, keyed nonces |
| Proof check | A checker validates a formal artefact | cryptography and specs items: cryptography specs in Lean 4, beacon and leanCL specs merge, post-quantum items (leanXMSS, leanSPHINCS, leanDA sampling, hash-based L1) |
| Spec conformance | Verifier diff-checks an implementation against a published spec or EIP reference tests | EIP-tagged items with reference implementations |
| Reviewed checklist | An assigned reviewer group, not the submitter, scores a fixed checklist; two reviewers for headliners | design and research items with no executable artefact yet: decentralized state, endgame state, secret proposers, distributed block building, north stars |

### 13.2 Compute classes
GPU-hours (training or search loops), CPU-hours (test suites, simulations), proof-checker time, reviewer time. Each node carries one class and an estimate per experiment.

### 13.3 Row schema (generated)
`id · label · layer · track · fork · tag · state · what a group produces · criterion type · judgement data or tests (exists: yes/no/unknown, URL) · compute class · hard dependencies · priority · open questions`

### 13.4 Coverage accounting
- 65 nodes classified (CL 22, DL 12, EL 31): 2 computable today, 29 reviewer-judged by design, 34 with judgement data unknown and a named next step in each row. That is the honest headline; "100 percent coverage" means every node has a filled row under the definition above, not that every node is computable.
- By criterion type: reviewed checklist 29, proof check 11, spec conformance 10, test suite 8, metric 7. Judgement data exists: unknown 34, no 29, yes 2.
- Routing modes (new in v2, from the criterion type): metric, test suite and spec conformance nodes run sequential (C2) loops, one lineage per lease, never split; proof-check nodes run single-agent attempts (C1) in parallel with the checker as verifier; reviewed-checklist nodes run orchestrated (C4) with an integrator and a reviewer from another node. The stop rule is why a five-minute experiment is never split.
- Hard dependencies: none set for any node today (rule 4.5); the dependency field on the node page and the dependency-unblocked attribution event are inert until the registry maintainer sets one with a source.
- Orchestrator rulings on the researcher's flags, as applied in the data: data-layer tagged nodes judged by consensus-spec-tests; the FOUR untagged headliners that are reviewer-judged (decoupled consensus, 1-round finality, mandatory 1-of-1 proofs, zkzk frames) carry the state "headliner, checklist pending EIP"; post-quantum-l1 is a proof check.
- Day-1 checks before any node is called computable: open execution-spec-tests and consensus-spec-tests and confirm a runnable vector for EIP-7732 or EIP-7928.


### fork G

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| cl-epbs | ePBS | SFI | SFI | open | test suite | the submission passes the relevant test suite for 'ePBS' with no regressions | yes | CPU-hours | sequential (C2) | 1 | [] |
| cl-fast-confirmation | fast confirmation | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'fast confirmation' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'fast confirmation' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |

### fork H

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| cl-crypto-specs-lean4 | cryptography specs in Lean 4 | none |  | open | proof check | the submitted artefact passes the proof/type checker or known-answer test vectors for 'cryptography specs in Lean 4' | unknown | proof-checker time | single agent (C1) per proof attempt; verifier is the checker; several lineages may attempt in parallel | 4 | ["identify or build the checker/KAT-vector source for 'cryptography specs in Lean 4' -- named candidate repos noted in judgement_data, none independently confirmed this pass"] |
| cl-focil | FOCIL | SFI | S | open | test suite | the submission passes the relevant test suite for 'FOCIL' with no regressions | unknown | CPU-hours | sequential (C2) | 1 | ['confirm multi-client devnet test status directly (search-summarized only this pass, not independently fetched)'] |
| cl-post-quantum-pubkey-registry | post quantum pubkey registry | none |  | open | proof check | the submitted artefact passes the proof/type checker or known-answer test vectors for 'post quantum pubkey registry' | unknown | proof-checker time | single agent (C1) per proof attempt; verifier is the checker; several lineages may attempt in parallel | 4 | ["identify or build the checker/KAT-vector source for 'post quantum pubkey registry' -- named candidate repos noted in judgement_data, none independently confirmed this pass"] |

### fork I

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| cl-beacon-leancl-specs-merge | beacon & leanCL specs merge | none |  | open | proof check | the submitted artefact passes the proof/type checker or known-answer test vectors for 'beacon & leanCL specs merge' | unknown | proof-checker time | single agent (C1) per proof attempt; verifier is the checker; several lineages may attempt in parallel | 4 | ["identify or build the checker/KAT-vector source for 'beacon & leanCL specs merge' -- named candidate repos noted in judgement_data, none independently confirmed this pass"] |
| cl-decoupled-consensus | decoupled consensus | none |  | headliner, checklist pending EIP | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'decoupled consensus' | no | reviewer time | orchestrated (C4) | 3 | ["name and recruit the reviewer panel for 'decoupled consensus' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |
| cl-post-quantum-heartbeat | post quantum heartbeat | none |  | open | proof check | the submitted artefact passes the proof/type checker or known-answer test vectors for 'post quantum heartbeat' | unknown | proof-checker time | single agent (C1) per proof attempt; verifier is the checker; several lineages may attempt in parallel | 3 | ["identify or build the checker/KAT-vector source for 'post quantum heartbeat' -- named candidate repos noted in judgement_data, none independently confirmed this pass"] |
| cl-quick-slots | quick slots | EIP | B | open | test suite | the submission passes the relevant test suite for 'quick slots' with no regressions | unknown | CPU-hours | sequential (C2) | 3 | ["resolve the EIP number behind 'quick slots' (not individually looked up in eth-governance.md -- 14 of 20 EIP/SFI/CFI-tagged nodes are still unresolved) and check execution-spec-tests / consensus-spec-tests for existing vectors"] |
| cl-tapered-issuance-burn | tapered issuance burn | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'tapered issuance burn' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'tapered issuance burn' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |

### fork L

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| cl-1-round-finality | 1-round finality | none |  | headliner, checklist pending EIP | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for '1-round finality' | no | reviewer time | orchestrated (C4) | 3 | ["name and recruit the reviewer panel for '1-round finality' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |
| cl-attester-proposer-separation | attester-proposer separation | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'attester-proposer separation' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'attester-proposer separation' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |
| cl-pq-leanxmss-attestations | PQ leanXMSS attestations | none |  | open | proof check | the submitted artefact passes the proof/type checker or known-answer test vectors for 'PQ leanXMSS attestations' | unknown | proof-checker time | single agent (C1) per proof attempt; verifier is the checker; several lineages may attempt in parallel | 3 | ["identify or build the checker/KAT-vector source for 'PQ leanXMSS attestations' -- named candidate repos noted in judgement_data, none independently confirmed this pass"] |
| cl-real-time-cl-proofs | real-time CL proofs | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'real-time CL proofs' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'real-time CL proofs' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |
| cl-tech-debt-reset | tech debt reset | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'tech debt reset' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'tech debt reset' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |

### fork I-L (bar)

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| cl-slot-duration-decreases | slot duration decreases | none |  | open | metric | the submitted benchmark meets or exceeds the node's target metric for 'slot duration decreases', computed by the verifier on held-out conditions | unknown | GPU-hours | sequential (C2) | 4 | ["confirm or build a benchmark harness and held-out measurement environment for 'slot duration decreases'"] |

### fork longer term

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| cl-51pct-attack-auto-recovery | 51% attack auto-recovery | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for '51% attack auto-recovery' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for '51% attack auto-recovery' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |
| cl-distributed-block-building | distributed block building | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'distributed block building' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'distributed block building' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |
| cl-return-to-1m-attesters | return to 1M attesters | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'return to 1M attesters' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'return to 1M attesters' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |
| cl-secret-proposers | secret proposers | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'secret proposers' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'secret proposers' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |
| cl-vdf-randomness | VDF randomness | none |  | open | proof check | the submitted artefact passes the proof/type checker or known-answer test vectors for 'VDF randomness' | unknown | proof-checker time | single agent (C1) per proof attempt; verifier is the checker; several lineages may attempt in parallel | 4 | ["identify or build the checker/KAT-vector source for 'VDF randomness' -- named candidate repos noted in judgement_data, none independently confirmed this pass"] |

### fork north star

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| cl-fast-l1 | fast L1 | none |  | open | metric | the submitted benchmark meets or exceeds the node's target metric for 'fast L1', computed by the verifier on held-out conditions | unknown | GPU-hours | sequential (C2) | 5 | ["confirm or build a benchmark harness and held-out measurement environment for 'fast L1'"] |

## DL


### fork G

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| dl-cell-level-deltas | cell-level deltas | CFI |  | open | test suite | the submission passes the relevant test suite for 'cell-level deltas' with no regressions | unknown | CPU-hours | sequential (C2) | 2 | ["resolve the EIP number behind 'cell-level deltas' (not individually looked up in eth-governance.md -- 14 of 20 EIP/SFI/CFI-tagged nodes are still unresolved) and check execution-spec-tests / consensus-spec-tests for existing vectors", 'DEVIATION: DL layer has no named spec-tests repo in the handoff rules; this row was classified as test suite via consensus-spec-tests by judgement, not by rule -- confirm with a DL-specific test source before relying on this'] |
| dl-sparse-blobpool | sparse blobpool | CFI |  | open | test suite | the submission passes the relevant test suite for 'sparse blobpool' with no regressions | unknown | CPU-hours | sequential (C2) | 2 | ["resolve the EIP number behind 'sparse blobpool' (not individually looked up in eth-governance.md -- 14 of 20 EIP/SFI/CFI-tagged nodes are still unresolved) and check execution-spec-tests / consensus-spec-tests for existing vectors", 'DEVIATION: DL layer has no named spec-tests repo in the handoff rules; this row was classified as test suite via consensus-spec-tests by judgement, not by rule -- confirm with a DL-specific test source before relying on this'] |

### fork H

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| dl-local-blob-reconstruction | local blob reconstruction | none | related: C | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'local blob reconstruction' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'local blob reconstruction' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |

### fork I

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| dl-leanvm | leanVM | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'leanVM' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'leanVM' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |
| dl-pq-leanda-sampling | PQ leanDA sampling | none |  | open | proof check | the submitted artefact passes the proof/type checker or known-answer test vectors for 'PQ leanDA sampling' | unknown | proof-checker time | single agent (C1) per proof attempt; verifier is the checker; several lineages may attempt in parallel | 4 | ["identify or build the checker/KAT-vector source for 'PQ leanDA sampling' -- named candidate repos noted in judgement_data, none independently confirmed this pass"] |

### fork K

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| dl-post-quantum-l1 | post quantum L1 | none |  | open | proof check | the submitted artefact passes the proof/type checker or known-answer test vectors for 'post quantum L1' | unknown | proof-checker time | single agent (C1) per proof attempt; verifier is the checker; several lineages may attempt in parallel | 5 | ["identify or build the checker/KAT-vector source for 'post quantum L1' -- named candidate repos noted in judgement_data, none independently confirmed this pass"] |

### fork L

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| dl-remove-blob-transaction-type | remove blob transaction type | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'remove blob transaction type' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'remove blob transaction type' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |

### fork I-L (bar)

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| dl-data-availability-increases | data availability increases | none |  | open | metric | the submitted benchmark meets or exceeds the node's target metric for 'data availability increases', computed by the verifier on held-out conditions | unknown | GPU-hours | sequential (C2) | 4 | ["confirm or build a benchmark harness and held-out measurement environment for 'data availability increases'"] |

### fork longer term

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| dl-blob-streaming | blob streaming | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'blob streaming' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'blob streaming' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |
| dl-proofs-of-custody | proofs of custody | none |  | open | proof check | the submitted artefact passes the proof/type checker or known-answer test vectors for 'proofs of custody' | unknown | proof-checker time | single agent (C1) per proof attempt; verifier is the checker; several lineages may attempt in parallel | 4 | ["identify or build the checker/KAT-vector source for 'proofs of custody' -- named candidate repos noted in judgement_data, none independently confirmed this pass"] |
| dl-short-dated-blob-futures | short-dated blob futures | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'short-dated blob futures' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'short-dated blob futures' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |

### fork north star

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| dl-teragas-l2 | teragas L2 | none |  | open | metric | the submitted benchmark meets or exceeds the node's target metric for 'teragas L2', computed by the verifier on held-out conditions | unknown | GPU-hours | sequential (C2) | 5 | ["confirm or build a benchmark harness and held-out measurement environment for 'teragas L2'"] |

## EL


### fork G

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| el-bals | BALs | SFI | SFI | open | test suite | the submission passes the relevant test suite for 'BALs' with no regressions | yes | CPU-hours | sequential (C2) | 1 | [] |
| el-evm-asm-canonical-guest | evm-asm canonical guest | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'evm-asm canonical guest' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'evm-asm canonical guest' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |
| el-frame-transactions | frame transactions | CFI | S | open | test suite | the submission passes the relevant test suite for 'frame transactions' with no regressions | unknown | CPU-hours | sequential (C2) | 1 | ["resolve the EIP number behind 'frame transactions' (not individually looked up in eth-governance.md -- 14 of 20 EIP/SFI/CFI-tagged nodes are still unresolved) and check execution-spec-tests / consensus-spec-tests for existing vectors"] |
| el-glamsterdam-repricing | Glamsterdam repricing | CFI |  | open | test suite | the submission passes the relevant test suite for 'Glamsterdam repricing' with no regressions | unknown | CPU-hours | sequential (C2) | 2 | ["resolve the EIP number behind 'Glamsterdam repricing' (not individually looked up in eth-governance.md -- 14 of 20 EIP/SFI/CFI-tagged nodes are still unresolved) and check execution-spec-tests / consensus-spec-tests for existing vectors"] |
| el-keyed-nonces-recent-roots | keyed nonces & recent roots | EIP | A | open | spec conformance | the submission's behavior matches the referenced EIP's spec tests bit-for-bit | unknown | CPU-hours | sequential (C2) | 2 | ["resolve the EIP number behind 'keyed nonces & recent roots' (not individually looked up in eth-governance.md -- 14 of 20 EIP/SFI/CFI-tagged nodes are still unresolved) and check execution-spec-tests / consensus-spec-tests for existing vectors"] |

### fork H

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| el-data-repricing | data repricing | EIP |  | open | spec conformance | the submission's behavior matches the referenced EIP's spec tests bit-for-bit | unknown | CPU-hours | sequential (C2) | 3 | ["resolve the EIP number behind 'data repricing' (not individually looked up in eth-governance.md -- 14 of 20 EIP/SFI/CFI-tagged nodes are still unresolved) and check execution-spec-tests / consensus-spec-tests for existing vectors"] |
| el-ephemeral-keys | ephemeral keys | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'ephemeral keys' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'ephemeral keys' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |
| el-ethp2p-broadcast | ethp2p broadcast | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'ethp2p broadcast' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'ethp2p broadcast' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |
| el-evmify-long-tail-precompiles | EVMify long-tail precompiles | EIP | C | open | spec conformance | the submission's behavior matches the referenced EIP's spec tests bit-for-bit | unknown | CPU-hours | sequential (C2) | 4 | ["resolve the EIP number behind 'EVMify long-tail precompiles' (not individually looked up in eth-governance.md -- 14 of 20 EIP/SFI/CFI-tagged nodes are still unresolved) and check execution-spec-tests / consensus-spec-tests for existing vectors"] |
| el-optional-2of3-proofs | optional 2-of-3 proofs | EIP | A | open | spec conformance | the submission's behavior matches the referenced EIP's spec tests bit-for-bit | unknown | CPU-hours | sequential (C2) | 2 | ["resolve the EIP number behind 'optional 2-of-3 proofs' (not individually looked up in eth-governance.md -- 14 of 20 EIP/SFI/CFI-tagged nodes are still unresolved) and check execution-spec-tests / consensus-spec-tests for existing vectors"] |
| el-state-asm | state-asm | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'state-asm' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'state-asm' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |

### fork I

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| el-multidimensional-pricing | multidimensional pricing | EIP |  | open | spec conformance | the submission's behavior matches the referenced EIP's spec tests bit-for-bit | unknown | CPU-hours | sequential (C2) | 3 | ["resolve the EIP number behind 'multidimensional pricing' (not individually looked up in eth-governance.md -- 14 of 20 EIP/SFI/CFI-tagged nodes are still unresolved) and check execution-spec-tests / consensus-spec-tests for existing vectors"] |
| el-partitioned-binary-tree | partitioned binary tree | EIP |  | open | spec conformance | the submission's behavior matches the referenced EIP's spec tests bit-for-bit | unknown | CPU-hours | sequential (C2) | 3 | ["resolve the EIP number behind 'partitioned binary tree' (not individually looked up in eth-governance.md -- 14 of 20 EIP/SFI/CFI-tagged nodes are still unresolved) and check execution-spec-tests / consensus-spec-tests for existing vectors"] |
| el-pureth-purges | pureth purges | EIP |  | open | spec conformance | the submission's behavior matches the referenced EIP's spec tests bit-for-bit | unknown | CPU-hours | sequential (C2) | 3 | ["resolve the EIP number behind 'pureth purges' (not individually looked up in eth-governance.md -- 14 of 20 EIP/SFI/CFI-tagged nodes are still unresolved) and check execution-spec-tests / consensus-spec-tests for existing vectors"] |

### fork J

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| el-leanda-block-sampling | leanDA block sampling | EIP |  | open | spec conformance | the submission's behavior matches the referenced EIP's spec tests bit-for-bit | unknown | CPU-hours | sequential (C2) | 3 | ["resolve the EIP number behind 'leanDA block sampling' (not individually looked up in eth-governance.md -- 14 of 20 EIP/SFI/CFI-tagged nodes are still unresolved) and check execution-spec-tests / consensus-spec-tests for existing vectors"] |
| el-pq-leansphincs-transactions | PQ leanSPHINCS transactions | EIP |  | open | proof check | the submitted artefact passes the proof/type checker or known-answer test vectors for 'PQ leanSPHINCS transactions' | unknown | proof-checker time | single agent (C1) per proof attempt; verifier is the checker; several lineages may attempt in parallel | 3 | ["identify or build the checker/KAT-vector source for 'PQ leanSPHINCS transactions' -- named candidate repos noted in judgement_data, none independently confirmed this pass"] |
| el-validity-only-partial-state | validity-only partial state | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'validity-only partial state' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'validity-only partial state' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |

### fork K

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| el-decentralized-state | decentralized state | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'decentralized state' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'decentralized state' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |
| el-leansphincs-mempool | leanSPHINCS mempool | EIP |  | open | proof check | the submitted artefact passes the proof/type checker or known-answer test vectors for 'leanSPHINCS mempool' | unknown | proof-checker time | single agent (C1) per proof attempt; verifier is the checker; several lineages may attempt in parallel | 3 | ["identify or build the checker/KAT-vector source for 'leanSPHINCS mempool' -- named candidate repos noted in judgement_data, none independently confirmed this pass"] |
| el-mandatory-1of1-proofs | mandatory 1-of-1 proofs | none |  | headliner, checklist pending EIP | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'mandatory 1-of-1 proofs' | no | reviewer time | orchestrated (C4) | 3 | ["name and recruit the reviewer panel for 'mandatory 1-of-1 proofs' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |
| el-zkzk-frames | zkzk frames | none |  | headliner, checklist pending EIP | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'zkzk frames' | no | reviewer time | orchestrated (C4) | 3 | ["name and recruit the reviewer panel for 'zkzk frames' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |

### fork L

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| el-ethp2p-unification | ethp2p unification | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'ethp2p unification' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'ethp2p unification' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |
| el-native-rollups | native rollups | EIP |  | open | spec conformance | the submission's behavior matches the referenced EIP's spec tests bit-for-bit | unknown | CPU-hours | sequential (C2) | 3 | ["resolve the EIP number behind 'native rollups' (not individually looked up in eth-governance.md -- 14 of 20 EIP/SFI/CFI-tagged nodes are still unresolved) and check execution-spec-tests / consensus-spec-tests for existing vectors"] |

### fork H-L (bar)

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| el-gas-limit-increases | gas limit increases | none |  | open | metric | the submitted benchmark meets or exceeds the node's target metric for 'gas limit increases', computed by the verifier on held-out conditions | unknown | GPU-hours | sequential (C2) | 4 | ["confirm or build a benchmark harness and held-out measurement environment for 'gas limit increases'"] |

### fork longer term

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| el-encrypted-mempool | encrypted mempool | EIP |  | open | spec conformance | the submission's behavior matches the referenced EIP's spec tests bit-for-bit | unknown | CPU-hours | sequential (C2) | 3 | ["resolve the EIP number behind 'encrypted mempool' (not individually looked up in eth-governance.md -- 14 of 20 EIP/SFI/CFI-tagged nodes are still unresolved) and check execution-spec-tests / consensus-spec-tests for existing vectors"] |
| el-endgame-state | endgame state | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'endgame state' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'endgame state' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |
| el-lean-privacy-pool-wormholes | lean privacy pool & wormholes | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'lean privacy pool & wormholes' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'lean privacy pool & wormholes' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |
| el-long-dated-gas-futures | long-dated gas futures | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'long-dated gas futures' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'long-dated gas futures' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |
| el-sharded-mempool | sharded mempool | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'sharded mempool' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'sharded mempool' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |

### fork north star

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| el-gigagas-l1 | gigagas L1 | none |  | open | metric | the submitted benchmark meets or exceeds the node's target metric for 'gigagas L1', computed by the verifier on held-out conditions | unknown | GPU-hours | sequential (C2) | 5 | ["confirm or build a benchmark harness and held-out measurement environment for 'gigagas L1'"] |
| el-private-l1 | private L1 | none |  | open | metric | the submitted benchmark meets or exceeds the node's target metric for 'private L1', computed by the verifier on held-out conditions | unknown | GPU-hours | sequential (C2) | 5 | ["confirm or build a benchmark harness and held-out measurement environment for 'private L1'"] |


## 16. EF Protocol priorities and the Hegotá tier list, wired in (added 2026-09-08; sources: "EF Protocol: Current and Emerging Priorities" and "The Hegotá EIP Opinion Post and Tier List", both blog.ethereum.org, 2026-09-07, saved under sources/)

### 16.1 The problem statement, in the EF's words
The Protocol cluster (about 60 researchers and engineers) has fixed a north star: Ethereum L1 quantum-resistant across execution, consensus and data by December 2029, with a minimum viable post-quantum milestone in J*. Reaching it needs an average cadence of 7.2 months per fork. The post states that "simply shipping the forks in a linear sequence cannot meet the December 2029 schedule", that forks will overlap, and that delivery "will take more hands than any prior fork sequence, including cryptographers, client devs, researchers, security reviewers, and testing capacity, inside the EF and well beyond it". The Glamsterdam retrospectives add: "size an EIP by its integration depth; complexity compounds; testing surface is the scarce resource; champions often underestimate complexity." Ethplane is a system for adding hands to that pipeline in parallel, with verification instead of trust, and its criterion-contributed event (§9.4) targets the resource the EF names as scarce: testing surface.

### 16.2 Node lifecycle = the EF maturity pipeline
The priorities post gives the pipeline that decides how work earns inclusion: **Research → EIP → Prototype → Devnet → PFI → CFI → SFI → Mainnet**, with the rule that "each step should add evidence, reduce uncertainty, and make ownership visible before the next commitment is made. A devnet can send work back to research. PFI, CFI, and SFI signal rising confidence among AllCoreDevs; they do not substitute for implementation evidence." This replaces any Ethplane-invented node lifecycle. A node's `state` is its position in this pipeline as recorded by the EF (strawmap tag, tier list, ACD outcome), read-only in Ethplane. Ethplane's own state machine applies only to submissions (claimed → submitted → verified → released) and to leases. What Ethplane adds at each pipeline step is evidence: a prototype that passes a verifier-owned test, a devnet result, a test vector contributed.

### 16.3 Priority = the EF tier where one exists
The Hegotá tier list grades 62 EIPs on a ladder with stated delivery commitments: S must ship and defines the fork; A is expected to ship and is cut only before any S item; B is on the bubble, admitted one at a time and only after devnets with all S and A items are stable, and "most B-tiered EIPs carry 3 explicit requirements: a prototype, a sign-off, and a settled specification"; C is below the line, not disqualified; DFI is declined with a structural rationale; TBD is deliberately unranked pending mainnet data. Node priority in the registry: S = 1, A = 2, B = 3, C = 4, TBD = held, DFI = parked with the rationale shown. Nodes without an EF grade keep the strawmap-tag priority from §13. The B-tier requirements become node advancement criteria that a group can claim: "prototype", "settled specification" and "sign-off" are each a task with a verifiable deliverable.

Matches between the tier list and strawmap nodes (exact by EIP or label): FOCIL EIP-7805 S (Hegotá CL headliner); Frame Transactions EIP-8141 S (Hegotá EL headliner) shipping with Keyed Nonces EIP-8250 A and Recent Roots EIP-8272 A (the strawmap's "keyed nonces & recent roots" node); Optional Execution Proofs EIP-8025 A (the strawmap's "optional 2-of-3 proofs"); Quick Slots EIP-8198 B with four named requirements before A; Block Access List Sidecars EIP-8146 B; RowDAS Distributed Blob Reconstruction EIP-8371 C (related to, not identical with, the strawmap's local blob reconstruction). Glamsterdam items ePBS EIP-7732 and BALs EIP-7928 are already SFI. Note the date gap: the strawmap image (2026-08-04) places Frame Transactions and Keyed Nonces & Recent Roots at Glamsterdam (CFI); the tier list (2026-09-07) makes Frames the Hegotá headliner. The registry stores both (`fork_target` from the image, `ef_fork` from the tier list) and the dashboard shows the later one first. The full 62-row list with grades and notes is in sources/ef-protocol-hegota-eip-tier-list-2026-09-07.md and is loaded into the dashboard as the governance block of each matched node.

### 16.4 The five research arcs as a second overlay
Fast finality, post-quantum, privacy, state, zkEVM. Each strawmap node maps to one arc; the dashboard offers the arc as a filter next to layer and fork. The post-Glamsterdam priority ladder (P0 keep mainnet safe; P1 ship the critical components of Hegotá, I* and J*, the path to MV-PQ; P2 hold capacity for K* and L* PQ items; P3 the four remaining arcs with formal verification as shared tooling) orders bounty funding across arcs: P1 nodes are funded first.

### 16.5 CROPS as the constitution's principles
The Mandate defines Protocol's job through CROPS: censorship resistance, open source and free, privacy, security. Ethplane's constitution (§7 of the concept, §4 rules) adopts them as the test for any rule change: a proposal that introduces an intermediary or chokepoint, closes source, weakens privacy or security is declined with the rationale, the same DFI grounds the tier list uses ("introduces an intermediary or chokepoint, breaks backward compatibility, or endangers the path to J*").

### 16.6 Coverage fields added from the Glamsterdam lessons
Each coverage row gains `integration_depth` (low, medium, high: how many layers and clients the change touches) and `testing_surface` (the tests that must exist before a devnet, and whether they exist). Both come from the retrospective lessons quoted above and are filled at the PRD stage.


## 17. ENS as the addressable contribution tree (added 2026-09-08; Pat: "it's almost like an onchain hash tree of contributions by ID; a resolver could reconstruct it to pull for anyone and start sessions from where previous sessions left off")

### 17.1 The structure
Every submission on a node is a checkpoint. A checkpoint is a content-addressed record: `{parents: [hash…], node, lineage, submission hash, artefact references (diff, results, board slice), metric, verifier signature or null, block}`. Parents are the checkpoints it built on: its own lineage's previous checkpoint, and any other lineage's checkpoint it declared as reused (§9.4). Checkpoints therefore form a directed acyclic graph per node. The attribution graph and the contribution tree are the same object: the reuse declarations are its edges, the identities are its labels.

### 17.2 What ENS holds
- **Node name** (`sparse-blobpool.ethplane.eth`): a `head` record holding the hash of the latest VERIFIED checkpoint, writable only by the node's verifier key (EAC per-record role, confirmed in identity-checks.md); plus the records already in §9.3 (status, criterion hash, current lease).
- **Lineage subname** (`swarm-a.ecofrontiers.eth`, or `swarm-a.sparse-blobpool.ethplane.eth` for the node-scoped view): identity, roles and the operator link. Its frontier (latest checkpoint, verified or not) is NOT an ENS record: it is derived from the registry's checkpoint events by the resolver and the subgraph, so the only ENS head write is the verifier's on the node, at the verdict rate. This keeps the argument used against per-lease subnames (§9.3) consistent.
- **Registry name**: a `manifest` record pointing to the reconstruction code (the harness image hash, the checkpoint schema version).
Because names are hierarchical, resolving the node gives the verified state of the problem; resolving a lineage under it gives one group's frontier; resolving the operator gives every group it runs. The tree is addressable at every level by ID.

### 17.3 The resolver reconstructs it
A custom ENSv2 resolver for the registry name answers three queries for any name under it: `head(name)`, `parents(hash)` (from the checkpoint index the registry contract keeps as events), and `manifest()`. A client that holds only the name can therefore: resolve the head (a node's verified head from its record, a lineage's frontier from the indexed events); walk parents to the root; fetch each checkpoint's artefacts by hash; replay the diffs in order under the node's fixed budget; and arrive at the same working state the last session had. That is the resume path: `ethplane join <node> [--from <lineage name>]` resolves the name to a content hash AT CLAIM TIME, records that hash in the claim and as a parent of the new checkpoints, then rebuilds and starts the harness at it. The name finds the frontier; the hash is what is built on, so a later move of a rival's head cannot change what a claim referred to, and the parents-pre-date check evaluates against fixed hashes. The baton beat in §7 becomes a name lookup: the second group resolves the node's head (or the killed lineage's head, for its last unverified partial) and continues from it. Nothing is copied between sessions by hand; the name is the handoff.

### 17.4 Where the bytes live
Two of Pat's sources bear on this. Teensor ("I Put a Neural Network Onchain. Now Anyone Can Rebuild It.", Medium, 2026-08-13; sources/) put a reconstructable model package on a chain as segmented data for roughly $200–300 and argues the point that matters here: the chain is the distribution layer, so the artefact survives the author's server, bucket and attention. Ethplane's checkpoints are small, a diff plus a results record measured in kilobytes, so the essential reconstruction data can live on the chain itself (calldata or blob) at negligible cost, with content-addressed storage (IPFS, Filecoin) as the mirror rather than the source of truth. Large artefacts such as trained weights are not stored by default; the recipe is. Whether replay reproduces the state is a measurement, not an assumption: karpathy's budget is fixed in wall clock, so two replays run different numbers of optimiser steps before ordinary GPU non-determinism is counted. Day-1 check (§15.5): run one diff twice on one instance and once on another, publish the spread in val_bpb. If the spread is small against the deltas being claimed, keep re-derivation and fix the budget in optimiser steps rather than wall clock, a stated deviation from karpathy. If not, store artefacts content-addressed off-chain and drop the re-derivation claim; the DAG then addresses recipes and stored states, which is still enough for resume. uNveil's onchain fighters ("replayable by anyone, bit for bit", X, 2026-09-04; sources/ screenshot) state the ideal for deterministic criterion types: spec-conformance and proof-check checkpoints are replayable exactly; metric checkpoints are replayable within the tolerance the verifier already uses for spot checks.

### 17.5 Failure model
If operator zero disappears, the names, heads, parents and checkpoint hashes remain onchain, the resolver code is in the public repository, and any party can rebuild every node's verified state and every lineage's frontier without a server, a bucket or a maintainer. This is "the work outlives the agents" stated at the storage layer, and it is testable: the hackathon README includes the command that rebuilds a node from its name on a machine that has never seen the project.

### 17.6 Consequences for other sections
- §9.4 reuse detection gains a mechanical source: parents are declared in the checkpoint, and the verifier rejects a checkpoint whose parents are not already indexed.
- §11.1 ENS row: the "not cosmetic" bar is met by construction, since resolution is how work is found and resumed; the Day-2 build order (§11.4) already requires every client to resolve names.
- §12.3 node page gains a contribution-tree view: the DAG of checkpoints by lineage, heads marked, verified checkpoints highlighted; clicking a checkpoint shows its artefacts and the command that resumes from it.
- §13 rows gain a `head` field once the registry exists; empty until then.

### 17.7 Hackathon scope
Node and lineage `head` records on Sepolia ENSv2 under EAC roles; a resolver answering `head`, `parents`, `manifest`; the checkpoint index as contract events; `ethplane join <node> --from <name>` rebuilding a node's state from its name on a clean machine, shown once in the video as the recovery step of the baton beat; the contribution-tree view on the node page.

### 17.8 Check against the ENS prize text (verbatim from ethglobal.com/events/ethonline2026/prizes/ens, pasted by Pat 2026-09-08)
| Their clause | Plan element | Gap and fix |
|---|---|---|
| "resolve subnames straight off a parent's resolver with wildcard resolution" | The registry name's custom resolver answers for every node and lineage under it (§17.3) | None. Use their phrase "wildcard resolution" in the README since the sponsor uses it; the ENSv2 docs do not (identity-checks.md) |
| "deploy your own subname registry to tokenize and manage subnames under your own rules" | Names under `ethplane.eth` (§9.3) | Make it explicit: Ethplane deploys its own subname registry for `ethplane.eth` with rules: node subnames permanent and non-transferable; lineage subnames non-transferable, revocable by their operator, and expiring after N periods without a submission (a dissolved team leaves the tree but keeps its history) |
| "Enhanced Access Control ... delegate specific rights, like letting an account edit only certain text records on a name" | Verifier key writes `head` and status on a node; lineage key writes only its own `head`; maintainer sets the criterion hash (§9.3, §17.2) | None. This is the literal example they give |
| "Give subnames their own Permissioned Resolver so they fully own their data" | Not stated | Add: each node subname gets its own Permissioned Resolver holding the node's records; each operator subname gets one for its lineages. A lineage fully owns its head record |
| "record aliasing at the resolver level or namespace aliasing via a shared registry" | The node-scoped view of a lineage (`swarm-a.sparse-blobpool.ethplane.eth`) and the operator view (`swarm-a.ecofrontiers.eth`) resolve to the same identity and head (§17.2) | Name it as namespace aliasing via the shared registry; one lineage, two paths, one record |
| "expiring, revocable, non-transferable vs. transferable, even forever names with no parent control" | Non-transferable, revocable group subnames (§9.3); expiring lineages (above) | Add the forever name: a fork (§9, exit) is a lineage that leaves its operator's namespace and continues as a name with no parent control, carrying its checkpoint history by parent hashes. Exit is a real ENS operation, not a metaphor |
| "agents as namespaces, each with their own identity and permissions" | Agent groups are names with keys and scoped roles; instances are sessions bound to a group (§9.2) | None |
| "central to the product, not a cosmetic add-on"; "functional and not just include hard-coded values" | Resolution is how work is found and resumed (§17.3); no hard-coded addresses in any client (§11.4 Day 2) | None, provided the demo resolves live |
Result: two additions (own subname registry with stated rules; per-subname Permissioned Resolvers) and one renaming (forever names for forks). All three are already implied by §9 and §17 and cost no new sponsor or chain.

### 17.9 ENS references the sponsor points at (from the prize page's Links and Resources, 2026-09-08)
Spike A and the ENS build read these four first, in this order: Permissioned Registry (docs.ens.domains/ensv2/permissioned-registry) for the subname registry Ethplane deploys; Permissioned Resolver (docs.ens.domains/ensv2/permissioned-resolver) for the per-subname resolvers and the 8 per-record roles; Enhanced Access Control (docs.ens.domains/ensv2/enhanced-access-control) for the role bitmap that scopes the verifier and lineage keys; Guide for Contract Developers (docs.ens.domains/ensv2/tutorial-contract-developers) for the custom resolver that answers head, parents and manifest. The researcher's dao-checks.md (d) already quotes the first three; the contract-developer guide is the path for §17.3 and was estimated at up to a day.


## 18. Privy: defining and funding nodes as an organisation (added 2026-09-08; Pat, against the verbatim Privy prize text: "being able to define/create task nodes with bounties from Privy")

### 18.1 The B2B workflow
An operator is an organisation with a treasury. The workflow Privy runs is: **define a node → fund its bounty → approve the funding → release on verdict**. Concretely:
1. **Organisation wallet.** Each operator has a Privy organisation wallet; operator zero's is Ecofrontiers'. It holds the treasury the bounties are paid from and the bonded deposit (§9.6).
2. **Team permissions.** Roles inside the organisation: maintainer (may create a node and set its criterion hash), treasurer (may fund a bounty), verifier signer (the verifier operator's key, may trigger a release but never fund), viewer. Agent groups are team members with the right to claim and submit only.
3. **Funding a node** is a treasury operation: the treasurer moves the bounty from the organisation wallet into the node's escrow. Above a threshold it needs **quorum approval** (2 of 3 among maintainer, treasurer and a second human).
4. **Policy.** The organisation wallet's policy states the only permitted outbound transfers: to a node escrow created by a maintainer, and, from escrow, to a group key that holds a verified attribution row on that node, signed by the node's verifier key, within a per-period cap. Anything else is refused by the wallet, not by our code.
5. **Release** is an **automated, event-driven transaction**: the verifier's verdict event triggers the escrow release under the policy. No human presses pay. An **intent** covers recurring funding: a milestone's bounty pool is topped up per fork period until a stated total.
6. **Sponsored judge runners** (§15.2) are the same pattern: the launcher's spend is a policy-bounded outbound from a sub-wallet with a hard cap, so the account ceiling in §15.2 is a Privy policy rather than only a Lambda setting.

### 18.2 What Privy enables that the escrow contract alone does not
The escrow releases on a signature; that is a contract rule. Privy supplies the organisation side: several humans and agents operating one treasury with distinct rights, approvals above a threshold, a policy the wallet enforces before a transaction exists, and automation from chain events. Without it the treasury is one key on one laptop, which is the failure the sponsor's product exists to remove.


## 19. Component map: the pieces in one screen (added 2026-09-08; Pat: "Privy, ENS, autoresearch, identity, resolver, coharness, swarm, Ethereum roadmap (specific use case); business node-task definition (particular use case)")

| Layer | Piece | What it is in Ethplane | Section |
|---|---|---|---|
| **Coordination** | coharness | The routing function (which coordination mode a task gets, and when not to split), the protocol (public boards, handoff with criterion, reviewer never edits), the mechanism catalogue | §1, §13 routing column, §12.3 mode field |
| | swarm | Agent groups under operator identities, any harness, humans included; execution isolated, everything else shared; many groups on many nodes in parallel | §2, §9.2, §10 |
| | autoresearch | The loop inside a metric node: one editable file, fixed budget, one metric, keep if better; verifier-owned scoring | §15.1, §17.4 |
| **Record** | identity | Operator, group, instance, verifier operator; bonded operator names; attribution accrues to operators | §9.2, §9.6 |
| | ENS | Nodes and groups as names under Ethplane's own subname registry; per-record roles; verified head on each node; forks as forever names | §9.3, §17.2, §17.8 |
| | resolver | Custom ENSv2 resolver answering head, parents, manifest; rebuilds any node's state from its name at a fixed content hash | §17.3 |
| | contribution tree | Checkpoints as a content-addressed DAG; parents are reuse declarations; the attribution graph and the history are one object | §17.1, §9.4 |
| **Money** | Privy | Organisation wallets, roles, policy-bounded event-driven release on verdict, quorum on funding, intents for milestones; the launcher's capped spend | §18, §15.2 |
| | verifier and escrow | Verifier-owned scoring on held-out data; escrow releases on the verifier's signature; compute rows provisional until spot-check | §3, §10.3 |
| **Use cases** | Ethereum roadmap (specific) | The first history the plane holds: 65 strawmap nodes, EF maturity pipeline as lifecycle, Hegotá tiers as priority, five arcs, CROPS; the EF says it needs more hands in parallel | §5, §13, §16 |
| | business node-task definition (particular) | Any organisation defines task nodes with criteria and funds their bounties from its treasury; the same registry, verifier, names and attribution serve a company's research or engineering backlog | §18.1, §2 |

The generic product is the plane: registry, verifier, names, attribution, treasury. The Ethereum roadmap is its first instance and its proof, because the roadmap's owners have written down that a linear process cannot meet their schedule. The business use case is the second instance and the reason Privy's B2B framing fits without contortion: a company's backlog is a smaller strawmap with the same shape.


## 20. The full lifecycle, and how the judges see it (added 2026-09-08; Pat: "(1) task created, Privy policies set (for attribution/allocation) (2) massive swarm coordination, autoresearch, ENS resolution, attribution in real-time (3) task completed, allocation made")

### 20.1 Phase 1: create
| Step | Who | What lands where |
|---|---|---|
| Define the node: label, criterion (type and definition), held-out data policy, fixed budget, lane (open or pre-assigned), default routing mode | Maintainer | Registry: node created, `criterion_hash`; ENS: node subname under Ethplane's registry with a Permissioned Resolver, empty `head`, roles set (verifier key may write head and status) |
| Set the allocation policy for this node: bounty weight, split among event types (verified result, reused parents, verification, compute), per-period cap | Maintainer + treasurer | Registry: weights; Privy: organisation-wallet policy permits release only to group keys with a verified row on this node, signed by the node's verifier key, within the cap |
| Fund the bounty | Treasurer, quorum above threshold | Privy: treasury operation into the node's escrow, approved 2-of-3; Registry: node funded, visible on the map |
| Assign the verifier operator | Maintainer | Registry: verifier key bound to the node; the operator holds no lease on it |
Dashboard: the node turns from locked to open; the node page shows criterion, budget, lane, routing mode, allocation policy and the funding transaction with its approvals.

### 20.2 Phase 2: work
| Step | Who | What lands where |
|---|---|---|
| Claim: resolve the node name, pick a start point (verified head or a lineage's frontier), record its content hash in the claim | Any group, from the page button or `ethplane join <node>` | Registry: lease with holder, expiry, parent hash; ENS resolution used, never a hard-coded address |
| Run the autoresearch loop: the group edits the one editable file, submits a diff; the dispatcher sends the training job to a pooled runner; the verifier scores on its own compute against the held-out split | Groups, pooled runners, verifier | Registry: checkpoint events (parents, submission hash, metric, verifier signature); board topic: the group's public working board |
| Heartbeats, forfeits, recoveries: a missed heartbeat forfeits the lease; another group claims alongside or resumes from the forfeited lineage's frontier at a fixed hash | Registry, groups | Registry: lease timeline events; the node page's timeline strip |
| Cross-group reuse: a submission declares parents from other lineages; the verifier checks parents pre-date it and adds missing ones by diff similarity | Groups, verifier | Checkpoint DAG edges; attribution rows of type reused work |
| Attribution in real time: every verified result, reuse, verification, compute job writes a row as it happens | Verifier, dispatcher | Attribution events indexed by the subgraph; the node page and operator pages update within one block |
| Coordination visible: each claim records the routing mode chosen and the stop-rule reason; cross-node critics and child tasks appear on the record | Routing function, groups | Node page mode field; record page |
Dashboard: the map shows leased nodes; the node page shows the live lease countdown, the timeline strip, the checkpoint tree growing, attribution rows arriving, and the freshness block with per-event explorer links.

### 20.3 Phase 3: complete and allocate
| Step | Who | What lands where |
|---|---|---|
| Criterion met: the verifier's score passes the threshold | Verifier | Registry: verdict event; ENS: the node's `head` record advances to the verified checkpoint hash (verifier key) |
| Allocation: the escrow releases per the node's policy: the winning group's share, reused parents' shares, the verifier's share, compute providers' provisional rows made final after the spot-check window | Escrow under the Privy policy, event-driven | Onchain transfers to group keys; attribution totals per operator update; the milestone page's allocation preview becomes actual |
| Node state advances: recorded against the EF pipeline position (prototype, devnet evidence) as read-only fact; dependent nodes open if a hard dependency was set | Maintainer, registry | Registry and node page; the map lights the dependent node |
| History is final and rebuildable: anyone can resolve the node name and rebuild the state on a clean machine | Anyone | ENS + checkpoint index + public repo |
Dashboard: the node turns verified; the allocation appears as transactions with recipients and shares; the operator page totals change; the contribution tree shows the verified path highlighted.

### 20.6 What the judge can check without trusting us
The node name resolves on Sepolia. The verdict transaction and the attribution events are on the explorer. The subgraph query behind every number is one click away. The rebuild command runs on their machine. The sponsored runner link launches an instance under a one-time code. Each of these is a fact the dashboard links to, not a claim it makes.


## 21. Proof of concept: one node, one EF priority (added 2026-09-08; Pat: "we shouldn't do all 65 nodes, let's focus on one for proof-of-concept, one of the EF's priorities")

### 21.1 Scope change
The registry, the map and the coverage table still hold all 65 nodes, classified and visibly locked or open, because coverage of the roadmap is the plan's claim. Work, verification, attribution and allocation run on ONE node for the hackathon. §7, §15.5 and §20 read with this section; where they say "two or more nodes" or "three nodes worked", one node governs. The nanochat loop remains an offchain rehearsal of the pipeline and does not appear on the map.

### 21.2 The node: FOCIL, EIP-7805 (proposed; Pat decides)
Why FOCIL: it is the EF's unanimous S-tier Hegotá consensus headliner ("Locked-in CL headliner ... Unanimous S at full participation", tier list 2026-09-07), it carries the censorship-resistance commitment of the CROPS mandate, it already has a strawmap node (`cl-focil`, Hegotá, SFI) and a companion EIP (8369 VOPS Profiles, A) that becomes a child task, and it has two computable sub-tasks of different criterion types, so one node exercises both halves of the verifier:
1. **Spec conformance** (test suite): the EIP-7805 vectors in ethereum/consensus-spec-tests and the Hegotá devnet configuration; a group's deliverable is a passing client-side change or a new test vector. Day-1 check: confirm runnable EIP-7805 vectors exist in that repository today (the researcher's source called devnet work in progress).
2. **Metric** (autoresearch loop): an inclusion-list simulation, the fraction of eligible transactions included within k slots under an adversarial builder share, at a fixed compute budget; the editable file is the inclusion-list construction or the attester validation rule, the verifier scores on held-out transaction traces. Day-1 check: locate an existing FOCIL simulation harness from the research team (ethresear.ch, the EIP's reference material) to adopt; if none is runnable in a day, the metric sub-task is deferred and the node runs on the test-suite criterion alone, stated as such.
Alternative if FOCIL's harness is not runnable: Frame Transactions, EIP-8141 (Hegotá EL headliner, S), with execution-spec-tests vectors and the public Frames devnet noted in the tier list, and a metric sub-task on PQ signature-verification gas under aggregation.

### 21.3 What the one-node proof must show
Phase 1 creates and funds `focil.ethplane.eth` from the organisation wallet under policy and quorum. Phase 2 runs two of our groups and one pooled runner on the node, with the kill-and-recover beat, ENS resolution on every claim, and attribution rows arriving live. Phase 3 lands a verified result, advances the node's head, releases the allocation per policy, and rebuilds the node from its name on a clean machine. The other 64 nodes are on the map with their EF tier, criterion type, routing mode and a join control that is disabled with the reason "not yet funded", which is itself an honest statement of the system's state.

