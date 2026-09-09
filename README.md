# Ethplane

**The question:** how can we design a collaborative plane that lets humans and AI, working as a swarm, pull and rebuild a history of contributions, build on it, and receive attribution for their own contributions?

Ethplane is a task registry and verification system for research and engineering work. It holds a roadmap as a set of nodes, lets many independent agent groups and people work on those nodes in parallel, verifies results with code the contributors cannot modify, records every contribution as a content-addressed checkpoint addressable by an ENS name, and pays out on verified results under an organisation's policy.

Its first history is the Ethereum protocol roadmap: the 65 nodes of the EF strawmap, classified by criterion type and routed by task shape, with the EF's own maturity pipeline as the node lifecycle and the Hegotá tier list as priority. The proof of concept runs one node.

**Live:** https://ethplane.ecofrontiers.xyz — the 65-node map, the node pages, the deck and the docs. Contracts, names and treasury on Sepolia: `docs/DEPLOYMENTS.md`. The first node, `cl-pq-leanxmss-attestations.ethplane.eth`, is open with a funded bounty and a recorded baseline; its acceptance criterion is `docs/CRITERION-pq-leanxmss.md`.

Built for ETHOnline 2026. The design is in `docs/SPEC.md`; the research it rests on is in `research/`; who wrote what is in `ATTRIBUTION.md`.

## How it fits together
- **Coordination:** the routing table from [coharness](https://github.com/Ecofrontiers) decides how a group organises inside a node and when a task must not be split; execution is isolated, boards, judges and history are shared.
- **Record:** nodes and groups are ENS names under Ethplane's own subname registry; a custom resolver rebuilds any node's verified state from its name; checkpoints form a DAG whose edges are the reuse declarations, so the attribution graph and the history are one object.
- **Verification:** a verifier operator scores every submission on its own compute against held-out data; only the verifier's key advances a node's head or triggers a release.
- **Money:** an organisation wallet funds a node's bounty under policy and quorum; release is an event-driven transaction on the verifier's verdict; attribution rows accrue to operator identities.

## Sponsors: what each layer does here

**ENS (ENSv2, Sepolia).** Every actor is a name under `ethplane.eth`: the 65 roadmap nodes, operators, their lineages (the agents), the verifier and guests. `ethplane.eth` is registered on the hackathon ENSv2 deployment; its subregistry is `EthplaneSubregistry`, our own contract implementing ENSv2's `IRegistry`, because hierarchical registries are the point of ENSv2, and each node has its own `EthplaneResolver` holding the node's records (`ethplane.status`, `ethplane.criterion`, `ethplane.head`, `ethplane.session`). Only the verifier's key may write `head` and `status`: a lineage key that tries is refused by the resolver, on chain. Lineage names expire with their session and guest names after fourteen days. Resolution runs through ENS's own Universal Resolver, so `ethplane join <name>` works from any machine. Why the resolvers and the subregistry are ours rather than the deployment's own: `docs/ENS-PROBES.md`.

**Privy.** The bounty treasury is a Privy server wallet bound to a policy that allows exactly three things, `approve(PLANE → Ethplane)`, `fundNode` under a cap, and `defineNode` whose split gives the verifier at least ten percent, for signing as well as sending; everything else is refused before a signature exists (`RPC request denied due to policy violation`, recorded on the node page). Guests log in with email or a wallet, receive an embedded wallet, and get a guest name under `guests.ethplane.eth`; their sessions and submissions go through a relay with EIP-712 signatures. The contract, not the wallet, decides pass or fail and the split.

## How to run

```
# contracts (Foundry 1.5 or later)
forge build && forge test                        # 55 passed, 1 skipped (the ENS fork test needs SEPOLIA_RPC_URL)
# api (Node 22, pnpm)
cd api && pnpm install && pnpm build && ETHPLANE_ADDRESS=… PLANE_ADDRESS=… SEPOLIA_RPC_URL=… PORT=4100 node dist/src/server.js
# web (static export)
cd web && pnpm install && pnpm build             # → web/out
# verifier tests (Python 3.12; run.py itself needs only the standard library)
pip install -r verifier/requirements-dev.txt && python3.12 -m pytest verifier/tests swarm/tests -q
# verifier against a real artifact (optional: needs a leanVM checkout at the pinned commit)
LEANVM_REF=/path/to/leanVM python3.12 verifier/run.py <artifact.tar> --self-test
# swarm (three local-model role sessions in tmux; see swarm/README.md)
```

## Repository layout
- `contracts/`, `script/`, `test/` — Ethplane, PlaneToken, EthplaneResolver, EthplaneSubregistry and their tests and deploy scripts.
- `api/` — indexer (viem `getLogs` poller) + REST + SQLite; `web/` — the dashboard (Next.js static export); `cli/` — `ethplane resolve|join`; `verifier/` — the measurement runner; `swarm/` — the role scripts for a local-model swarm.
- `docs/` — SPEC, CRITERION, DEPLOYMENTS, ENS-PROBES, DECK, FILM, JOIN, ROLES.
- `research/strawmap-nodes.json` — every node of the EF strawmap (2026-08-04 image), with layer, track, fork, tag and EF Hegotá tier where one exists.
- `research/coverage.json`, `research/coverage-table-v2.md` — one row per node: what a group produces, how it is judged, whether the judgement data exists (confirmed by opening the test repositories, not by search: FOCIL, ePBS and BALs vectors and the leanVM verifier were checked directly), compute class, routing mode, priority.
- `research/eth-governance.md` — EIP-1, fork inclusion, All Core Devs, the strawmap's ownership, with quotes and URLs.
- `research/identity-checks.md` — ERC-8004 status, ENSv2 Enhanced Access Control, Protocol Guild's formula, Optimism Retro Funding, attestation schemas.
- `research/eth-roadmap-*.md` — the six roadmap tracks from Vitalik's "Possible futures" series, node lists quoted.

## AI attribution
AI-assisted files are listed in `ATTRIBUTION.md`, as ETHGlobal's rules require.

## License
MIT. See `LICENSE`.

A session is not permission or exclusivity: it says you are working on the node from a known head, heartbeats keep it live, it lapses when they stop, and many sessions run on one node at once.
