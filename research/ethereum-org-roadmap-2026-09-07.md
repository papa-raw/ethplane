# ethereum.org/roadmap — fetched 2026-09-07

Source: https://ethereum.org/roadmap/ (also /en/roadmap/). FACT.

Note: this page organizes by **named hard forks with ship dates**, not by Vitalik's six-part Merge/Surge/Scourge/Verge/Purge/Splurge framing (that framing is his own blog series, saved separately as `eth-roadmap-<track>.md` in this directory — the two are complementary, not the same list). Ethereum.org's list, as shipped/scheduled:

| Fork | Date | Headline features |
|---|---|---|
| Paris (The Merge) | 2022-09-15 | PoS transition, Beacon Chain merge, difficulty bomb removal |
| Shapella | 2023-04-12 | Staking withdrawals (EIP-4895), Warm COINBASE (EIP-3651) |
| Dencun | 2024-03-13 | Proto-danksharding / blobs (EIP-4844), transient storage (EIP-1153), beacon block root in EVM (EIP-4788) |
| Pectra | 2025-05-07 | EOA smart-contract-wallet features, max effective balance up to 2048 ETH, blob throughput increase (6 target / 9 max) |
| Fusaka | 2025-12-03 | PeerDAS, Blob Parameter Only (BPO) forks, gas limit & DoS hardening (16.7M gas/tx cap, 60M default limit) |
| Glamsterdam | Q4 2026 (in development) | Enshrined proposer-builder separation, block-level access lists |
| Hegotá | 2027 | Fork-choice enforced inclusion lists (FOCIL), "Frame transactions" (account decides its own validity rule — the AA endgame) |

Also on the page: four cross-cutting improvement themes (post-quantum security, single slot finality, zkEVM, statelessness, account abstraction, danksharding) that map onto the six Vitalik tracks rather than onto individual forks — e.g. single slot finality is the Merge track's headline item; danksharding/zkEVM/statelessness sit under Surge/Verge; account abstraction is the Splurge track.

Governance note (from the same page): "The roadmap is mostly the result of years of work by researchers and developers... Ideas usually start off as discussions on a forum such as ethresear.ch, Ethereum Magicians or the Eth R&D discord server... When these ideas mature, they can be proposed as Ethereum Improvement Proposals. This is all done in public." — i.e. nodes on this roadmap are also evidence-gated (research maturity → EIP → shipped fork), not spent-into-existence, which is the same "nodes unlock by evidence, not spending" principle concept-notes-orchestrator.md §4 already claims for coharness's own tech tree.
