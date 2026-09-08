# Ethereum roadmap — The Purge (Vitalik's "Possible futures of the Ethereum protocol", part 5)

Source: https://vitalik.eth.limo/general/2024/10/26/futures5.html (2024-10-26). FACT — direct quote of the post's own "key goals" and "in this chapter" lists.

## Node list (as stated on the page)
**Key goals:**
- Reducing client storage requirements by reducing or removing the need for every node to permanently store all history, and perhaps eventually even state
- Reducing protocol complexity by eliminating unneeded features

**Sub-tracks ("in this chapter"):**
- History expiry
- State expiry
- Feature cleanup

## One paragraph
The Purge is about forgetting on purpose. A fully-synced Ethereum node needs roughly 1.1 TB for the execution client alone, and the great majority of that is history — years-old blocks, transactions and receipts nobody is actively using — growing by hundreds of gigabytes a year even if the gas limit never rises. The fix leans on a structural property of blockchains: because each block links to the previous one by hash, consensus on the present is enough to prove consensus on the past, so historical data can be expired from node storage (pushed to a distributed/torrent-like layer, retrievable on demand) without losing the ability to verify it if you ever need to. The same logic extends to state expiry (accounts nobody has touched in years) and, separately, to protocol feature cleanup — deleting opcodes, precompiles and edge cases nobody needs, purely to reduce complexity, independent of storage. **Coharness mapping (INFERRED, per concept-notes-orchestrator.md §5):** Purge = "governed forgetting, compaction/expiry as policy." This is close to a literal match to memory-architecture rule §29 in the estate's own CLAUDE.md: "governed forgetting is part of intelligence; a bigger context window solves the wrong problem" — the Purge makes the identical argument about node storage that §29 makes about agent context: keep only what's actively load-bearing, expire the rest under a policy that can still reconstruct anything on demand, rather than storing everything forever by default.
