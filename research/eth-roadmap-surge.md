# Ethereum roadmap — The Surge (Vitalik's "Possible futures of the Ethereum protocol", part 2)

Source: https://vitalik.eth.limo/general/2024/10/17/futures2.html (2024-10-17). FACT — direct quote of the post's own "key goals" and "in this chapter" lists.

## Node list (as stated on the page)
**Key goals:**
- 100,000+ TPS on L1+L2
- Preserve decentralization and robustness of L1
- At least some L2s fully inherit Ethereum's core properties (trustless, open, censorship resistant)
- Maximum interoperability between L2s — "Ethereum should feel like one ecosystem, not 34 different blockchains"

**Sub-tracks ("in this chapter"):**
- Aside: the scalability trilemma
- Further progress in data availability sampling (PeerDAS → 2D sampling)
- Data compression
- Generalized Plasma
- Maturing L2 proof systems (Stage 0 → 1 → 2, formal verification, multi-provers)
- Cross-L2 interoperability and UX improvements (chain-specific addresses, keystore wallets, shared token bridges)
- Scaling execution on L1

## One paragraph
The Surge is the rollup-centric scaling roadmap: Ethereum L1 stays a robust, decentralized settlement layer while L2s (each acting like a "shard") absorb throughput. The chapter's spine is the scalability trilemma (decentralization / scalability / security) and the claim that data-availability sampling + SNARKs is the one combination that actually breaks it rather than faking it with beefier hardware. Concretely it walks through PeerDAS (live path to ~926 TPS in calldata, with a 16 MB/slot medium-term target implying ~58,000 TPS combined with compression), data compression (from ~188 bytes per ERC-20 transfer down toward ~23 bytes with full stateful compression), Plasma as a cheaper-than-rollup fallback for high-volume low-value use, the L2 "stage" system (0/1/2) that measures how trustless a rollup actually is versus still-centralized security councils, and the unglamorous but real problem that L2-land today feels like 34 different chains, not one Ethereum — fixed by chain-specific addresses, keystore wallets, and shared bridges. **Coharness mapping (INFERRED, per concept-notes-orchestrator.md §5):** Surge = "fan-out, hub-spoke lanes as rollups settling to the board." The direct analogy: L2s process independently and settle back to L1 the same way coharness's hub-spoke lane fans work out to specialist agents and settles the result back to the shared board — and the Surge's own "stage 0/1/2" trust ladder (does a security council still have to sign off, or is the proof system alone sufficient) is structurally the same shape as coharness's held-out gate promoting a skill from experimental → stable → core (§28).
