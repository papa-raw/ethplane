# Ethereum roadmap — The Verge (Vitalik's "Possible futures of the Ethereum protocol", part 4)

Source: https://vitalik.eth.limo/general/2024/10/23/futures4.html (2024-10-23). FACT — direct quote of the post's own "key goals" and "in this chapter" lists.

## Node list (as stated on the page)
**Key goals:**
- Stateless clients: fully-verifying clients and staking nodes should not need more than a few GB of storage
- (Longer term) fully verify the chain (consensus and execution) on a smart watch — download some data, verify a SNARK, done

**Sub-tracks ("in this chapter"):**
- Stateless verification: Verkle or STARKs
- Validity proofs of EVM execution
- Validity proofs of consensus

## One paragraph
The Verge is about making verification itself cheap enough that anyone — in the limit, a smart watch — can check that Ethereum's history is correct, without storing hundreds of gigabytes of state or re-executing every transaction. Today a full client needs the entire state trie to verify blocks; the Verge's fix is stateless clients (Verkle trees or STARKed Merkle proofs let a client verify a block using only a small witness, not the full state) combined with validity proofs of EVM execution (a SNARK that attests "this block's execution was correct" so a light client doesn't have to redo the computation) and validity proofs of consensus (the same idea applied to the beacon chain / attestations layer). **Coharness mapping (INFERRED, per concept-notes-orchestrator.md §5):** Verge = "verifier on a channel the agent cannot write to, path not output" — this is the single cleanest 1:1 mapping of the six tracks. The Verge's whole point is that you don't have to trust the block producer's claim of correctness; you can check it independently and cheaply, on a channel the producer does not control (a validity proof, not a self-report). That is exactly §76's rule that a verifier must read tool-call logs or an independent execution trace, never the agent's own account of what it did — the Verge is the Ethereum-protocol version of "verify the path, not the output" (§68).
