# Submission form text (ETHOnline 2026)

Paste as written. Every number is on chain or in this repo; the proof column in docs/FILM.md names where.

# Project name

Ethplane

# One-line description (≤ 120 characters)

The Ethereum roadmap as a plane of paid work: swarms work nodes, a verifier judges, escrow pays on the verdict.

# Description (≤ 250 words)

Ethplane takes the Ethereum Foundation's strawmap, 65 roadmap nodes, and turns each into a name under ethplane.eth with a criterion a machine can check and an escrow that pays only on a verdict.

A worker, human or a swarm of local models, starts a session on a node: a declaration of working, from this head, kept alive by heartbeats. Many sessions run on one node at once. A submission is an artifact plus the parents it built on. The node's verifier rebuilds it from the pinned reference commit as a user that cannot read the verifier key, runs the benchmark itself, corrupts signatures one at a time to test they were checked, and writes the verdict onchain. On a pass the contract releases the split: 68 percent to the winning lineage, 15 to the parent, 10 to the verifier, 2 to the registrant, 5 held for the host.

Two nodes are live on Sepolia with 10,000 PLANE each in escrow. Node 1, cl-pq-leanxmss-attestations: aggregate 900 post-quantum signatures in fewer VM cycles than 1,542,812. Node 2, dl-leanvm: the same criterion with the compiler open to the swarm.

What happened today: two swarms of Qwen3-Coder 30B on one rented GPU box worked both nodes. On node 2 the swarm cut cycles to 1,541,462 with a four-line compiler change, three times. All three grew the proof past the 302,182-byte bound. The verifier said no three times and wrote why. Honest scope: no payout yet. The framework is the product.

# How it is made (≤ 300 words)

Contracts, Foundry, Sepolia: Ethplane (nodes, sessions, submissions with parents, measurement, pull-based cumulative release, EIP-712 relay), PlaneToken, EthplaneSubregistry and one EthplaneResolver per node. 56 tests, one of them a fork test through the hackathon Universal Resolver.

ENS, on the hackathon ENSv2 deployment: ethplane.eth is registered on the v2 registry. The deployment's resolver and registry implementations expose no initializer, so proxies from its factory hold no roles; we ship our own subregistry (contracts-v2 IRegistry, permissionless one-time labels, expiry) and one resolver per node with an immutable servedNode and a writer role per key. Only the verifier writes ethplane.head and ethplane.status. docs/ENS-PROBES.md has every probe with its output.

Privy: the treasury is a server wallet under a policy that allows three transaction shapes, approve, fundNode under a cap, and defineNode whose split gives the verifier at least ten percent. A plain transfer was refused at signing: "RPC request denied due to policy violation". Guests log in with email, get an embedded wallet and a name under guests.ethplane.eth.

Verifier, Python: a separate user with its own key; builds and runs the submission as a second user that cannot read that key; non-regression on proving time, verify time and proof size against a baseline the verifier measured itself; three differential probes on any pass, all 900 before a payout that reaches the target. Two watchers, one per node, judge for real.

Swarm: our own agent loop, standard library only, on vLLM. Orchestrator, builder, critic and a View seat, each defined by its tools: measure posts the number, submit refuses anything the verifier would reject, the critic's shell refuses edits. A submitter loop holds the lineage key; no model can read it.

API and site: Fastify, SQLite, viem indexer; Next.js static export. Everything in this repo; who wrote what is in ATTRIBUTION.md.

# ENS track statement (≤ 150 words)

ENS is the record, not a label. Every actor is a name under ethplane.eth: 65 roadmap nodes, lineages, the verifier, guests. Node status and head live in text records that only the verifier key can write; a lineage key that tries gets a revert, on chain, in the rehearsal log. Names resolve through the hackathon Universal Resolver on the v2 registry. We built an ENSv2 subregistry and per-node resolvers because the hackathon deployment's implementations cannot be seeded with roles; ours use the contracts-v2 IRegistry interface, permissionless one-time labels and expiry. Join rebuilds a node's verified state from its name. docs/ENS-PROBES.md carries the commands and their outputs; the fork test runs through the Universal Resolver.

# Privy track statement (≤ 150 words)

The treasury is a Privy server wallet whose policy allows three shapes of transaction: approve the escrow, fund a node under a cap, define a node whose split gives the verifier at least ten percent. We tried a fourth, a plain transfer. Refused at signing, and the refusal is on the record. That is the money side of a plane where payouts follow verdicts, not people. On the user side, a guest logs in with an email, Privy creates an embedded wallet, the API verifies the auth token and issues a name under guests.ethplane.eth, and the guest can start a session on any node. Smart wallets are enabled with a public bundler for the relay path.

# Links

- Site: https://ethplane.ecofrontiers.xyz
- Repo: https://github.com/papa-raw/ethplane
- Deployments, every address and tx: docs/DEPLOYMENTS.md
- Node 2: https://ethplane.ecofrontiers.xyz/node/0x662b44f5cf418a3e3d4126a187d0154034afbdc8d2536b9076c68f2a4440c37e
- Node 1: https://ethplane.ecofrontiers.xyz/node/0x8e67c816b1f39fa072094b67f4f74937bd1920a7a9d79e4b98e785ae9aa29d58
- Film script and proof table: docs/FILM.md

# Feedback for ENS (the form asks for it)

The hackathon ENSv2 deployment's PermissionedResolverImpl and UserRegistryImpl expose no initializer, so proxies from the VerifiableFactory hold no roles and cannot be seeded; resolver roles scope per key, not per name. We built our own IRegistry subregistry and a resolver per node instead. ens-cli falls back to ENSv1 silently when pointed at this deployment. A seedable resolver implementation and a cli flag for the v2 registry address would have saved a day. The Universal Resolver worked first time, including through Foundry's fork test.

# Feedback for Privy (the form asks for it)

The policy engine did exactly what we needed: an allowlist on the treasury wallet with per-method conditions, and a refusal at signing with a clear error. Two things cost time: the SDK requires camelCase policy fields (chainType, fieldSource) while the dashboard shows snake_case, and an off-policy transaction reports "RPC request denied due to policy violation" without naming the rule that refused it. Embedded wallets with create-on-login and the auth token verification on the server were straightforward.

# Honest limitations (≤ 100 words)

No payout has happened: every verdict so far is a FAIL, recorded with its reason. Node 1 admits only the guest program, which never moved cycles in sixteen measurements. Node 2's baseline was measured under load, so its time bound is lenient and its proof-size bound is strict. The compute share is held, not paid, in this version. The swarm runs on one box we operate; guests bring their own compute. Sepolia only.
