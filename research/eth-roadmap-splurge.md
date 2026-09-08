# Ethereum roadmap — The Splurge (Vitalik's "Possible futures of the Ethereum protocol", part 6)

Source: https://vitalik.eth.limo/general/2024/10/29/futures6.html (2024-10-29). FACT — direct quote of the post's own "key goals" and "in this chapter" lists.

## Node list (as stated on the page)
**Key goals:**
- Bring the EVM to a performant and stable "endgame state"
- Bring account abstraction in-protocol, allowing all users to benefit from much more secure and convenient accounts
- Optimize transaction fee economics, increasing scalability while reducing risks
- Explore advanced cryptography that could make Ethereum far better in the long run

**Sub-tracks ("in this chapter"):**
- EVM improvements (EOF and beyond)
- Account abstraction
- EIP-1559 improvements
- VDFs
- Obfuscation and one-shot signatures: the far future of cryptography

## One paragraph
The Splurge is the everything-else bucket: the parts of the roadmap that don't fit neatly under Merge/Surge/Scourge/Verge/Purge but still matter, chiefly account abstraction. Today's EVM is hard to statically analyze and inefficient to optimize; the near-term fix is the EVM Object Format (EOF), which separates code from data so implementations and formal verification tools can reason about bytecode more easily. The centerpiece for our purposes is account abstraction: moving from EOA-only signature verification toward native smart-contract-wallet behavior for every account — arbitrary signature schemes, sponsored/batched transactions, social recovery, spending limits — as a protocol-level primitive rather than a bolted-on middleware layer (which is what ERC-4337 is today). The chapter also covers EIP-1559 fee-market refinements and, at the speculative end, VDFs and advanced obfuscation/one-shot-signature cryptography. **Coharness mapping (INFERRED, per concept-notes-orchestrator.md §5):** Splurge = "account abstraction: agent wallets, spend policies, delegated permissions." This is the most direct of the six mappings — account abstraction is literally the primitive an "agentic DAO" needs for every agent-member to hold a scoped wallet with its own spend policy, exactly the attenuated-permission model §35 already requires for sub-agents ("a sub-agent receives a strict subset of the parent's tools/paths/authority") — the Splurge's AA track is Ethereum shipping, as a base-layer primitive, the exact envelope-attenuation mechanism coharness's own dispatch rules assume must exist.
