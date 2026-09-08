# Ethereum roadmap — The Merge (Vitalik's "Possible futures of the Ethereum protocol", part 1)

Source: https://vitalik.eth.limo/general/2024/10/14/futures1.html (2024-10-14). FACT — direct quote of the post's own "key goals" and "in this chapter" lists.

## Node list (as stated on the page)
**Key goals:**
- Single slot finality
- Transaction confirmation and finalization as fast as possible, while preserving decentralization
- Improve staking viability for solo stakers
- Improve robustness
- Improve Ethereum's ability to resist and recover from 51% attacks (including finality reversion, finality blocking, and censorship)

**Sub-tracks ("in this chapter"):**
- Single slot finality and staking democratization
- Single secret leader election
- Faster transaction confirmations
- Other research areas (51% attack recovery, quorum threshold, quantum-resistance)

## One paragraph
The Merge track is about finishing proof-of-stake, not the 2022 PoW→PoS transition itself (that part is done and is now just called "the Merge" retroactively). The live problem is a three-way tension between finality speed (currently ~15 min to finalize), staking accessibility (currently a 32 ETH minimum), and node overhead (verifying every validator's signature). Vitalik lays out four non-exclusive paths — brute-force signature aggregation, "Orbit" randomly-sampled committees that relax economic finality slightly, two-tiered staking, or doing nothing — and treats none of them as decided. The chapter also covers single secret leader election (hiding which validator proposes the next block, to stop targeted DoS) and faster confirmations (4s slots or proposer pre-confirmations), both still open research with named tradeoffs (SSLE adds real protocol complexity; fast slots risk validator-set centralization). **Coharness mapping (INFERRED, from concept-notes-orchestrator.md §5):** Merge = "from one human orchestrator to a shared record agents agree on" — i.e., the track about what the group finalizes on, and how fast/cheaply consensus is reached without re-centralizing around a few big participants. The node-unlock analogy: none of the Merge's four paths is chosen yet, matching coharness's own stance that hub-spoke should not be assumed to have "won" — it's one candidate the routing table picks per task shape, evidence-gated (§28), not asserted.
