# Workplane

**The question:** how can we design a collaborative plane that lets humans and AI, working as a swarm, pull and rebuild a history of contributions, build on it, and receive attribution for their own contributions?

Workplane is a task registry and verification system for research and engineering work. It holds a roadmap as a set of nodes, lets many independent agent groups and people work on those nodes in parallel, verifies results with code the contributors cannot modify, records every contribution as a content-addressed checkpoint addressable by an ENS name, and pays out on verified results under an organisation's policy.

Its first history is the Ethereum protocol roadmap: the 65 nodes of the EF strawmap, classified by criterion type and routed by task shape, with the EF's own maturity pipeline as the node lifecycle and the Hegotá tier list as priority. The proof of concept runs one node.

Status: planning. Nothing is built yet. The design is in `docs/SPEC.md`; the research it rests on is in `research/`.

## How it fits together
- **Coordination:** the routing table from [coharness](https://github.com/Ecofrontiers) decides how a group organises inside a node and when a task must not be split; execution is isolated, boards, judges and history are shared.
- **Record:** nodes and groups are ENS names under Workplane's own subname registry; a custom resolver rebuilds any node's verified state from its name; checkpoints form a DAG whose edges are the reuse declarations, so the attribution graph and the history are one object.
- **Verification:** a verifier operator scores every submission on its own compute against held-out data; only the verifier's key advances a node's head or triggers a release.
- **Money:** an organisation wallet funds a node's bounty under policy and quorum; release is an event-driven transaction on the verifier's verdict; attribution rows accrue to operator identities.

## Repository layout
- `docs/SPEC.md` — the technical specification (public part of the plan).
- `research/strawmap-nodes.json` — every node of the EF strawmap (2026-08-04 image), with layer, track, fork, tag and EF Hegotá tier where one exists.
- `research/coverage.json`, `research/coverage-table-v2.md` — one row per node: what a group produces, how it is judged, whether the judgement data exists, compute class, routing mode, priority.
- `research/eth-governance.md` — EIP-1, fork inclusion, All Core Devs, the strawmap's ownership, with quotes and URLs.
- `research/identity-checks.md` — ERC-8004 status, ENSv2 Enhanced Access Control, Protocol Guild's formula, Optimism Retro Funding, attestation schemas.
- `research/eth-roadmap-*.md` — the six roadmap tracks from Vitalik's "Possible futures" series, node lists quoted.

## AI attribution
Every file in this repository so far was drafted by Claude (Anthropic) sessions working under the direction of Patrick Rawson, and reviewed by a separate Claude critic session before merge. Per-file attribution is in `ATTRIBUTION.md` and is kept current as code lands. Planning and prompt artefacts ship here as ETHGlobal's rules require.

## License
MIT. See `LICENSE`.
