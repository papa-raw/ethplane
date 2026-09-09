# Deployments (Sepolia, ETHOnline 2026)

Chain id 11155111. Source of truth: `contracts/deployments/sepolia.json` and `sepolia-ens.json`, written by the deploy scripts.

| contract | address |
|---|---|
| Ethplane (registry, sessions, submissions, measurements, escrow, attribution) | `0xB9569968fB40569E326f44f266F2720D72aA8091` |
| PlaneToken (PLANE, test ERC-20; whole supply to the treasury) | `0x814817A2e7332749990500c324cb6B0c77deBFC1` |
| EthplaneSubregistry (our ENSv2 registry under `ethplane.eth`) | `0x58CB4caaDb0ebEdf7E1c96CeA6578Afb2f99d05b` |
| EthplaneResolver for `cl-pq-leanxmss-attestations.ethplane.eth` | `0xA11a923dA99Bb3aaE3643758DA8D408173199Bec` |
| EthplaneResolver for `dl-leanvm.ethplane.eth` | `0xaFE89fc8d99950B7F4c61BAE2602A80BC31De872` |
| EthplaneResolver for operator, lineage and guest names | `0x47572265f1795F26A3e657DA154577904aAA57Ed` |

## Nodes

| node | id | escrow | editable surface |
|---|---|---|---|
| `cl-pq-leanxmss-attestations` | `0x8e67c816b1f39fa072094b67f4f74937bd1920a7a9d79e4b98e785ae9aa29d58` | 10,000 PLANE | `crates/rec_aggregation/guests/` |
| `dl-leanvm` | `0x662b44f5cf418a3e3d4126a187d0154034afbdc8d2536b9076c68f2a4440c37e` | 10,000 PLANE (`0x188306499ff4e106b9d8a35981c1c76bbfec7378247096164a15a64b6d9df2d9`) | `crates/rec_aggregation/guests/`, `crates/lean_compiler/` |

The surface is per node and it is the verifier's `EDITABLE`, not a constant: one watcher per node, each
with its own value. Node 2 admits Rust, which is why its watcher also needs `BUILD_USER` — see
`verifier/README.md`, "Whole numbers only" and the criterion's Editable paragraph.

## Names (ENSv2, hackathon deployment on Sepolia)

`ethplane.eth` is registered on the hackathon ETHRegistry `0x1D78834d97c1D7b1A38c1deDBD1a287cFEd3971e`; its subregistry is ours. Resolution runs through ENS's Universal Resolver `0xd26f2040d083af1cd2962ba303f4bea0c4faf142`: root → `.eth` → `ethplane` → our subregistry → our per-node resolver. Registered so far: `cl-pq-leanxmss-attestations.ethplane.eth` (record `ethplane.status` = `open`), `ecofrontiers.ethplane.eth`, `qwen-a`, `fast-b`, `verifier` under it, `guests.ethplane.eth`. Any of the 65 roadmap ids can be registered once by anyone (`EthplaneSubregistry.register`).

Why our own subregistry and resolvers: the hackathon deployment's registry and resolver implementations expose no initializer, so proxies from its factory hold no roles and cannot register names or write records; and the deployed resolver scopes record roles per key rather than per name. Probes and transaction hashes are in `research/` and the repository history. Everything above the name (root, `.eth`, the Universal Resolver, hierarchical registries) is ENSv2's.

## Treasury (Privy)

The PLANE supply sits in a Privy server wallet bound to a policy that allows only: `approve(PLANE → Ethplane)`, `fundNode` with amount ≤ 100,000 PLANE, and `defineNode` whose split gives the verifier at least 10 %. Every other transaction is refused at signing.
