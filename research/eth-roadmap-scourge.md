# Ethereum roadmap — The Scourge (Vitalik's "Possible futures of the Ethereum protocol", part 3)

Source: https://vitalik.eth.limo/general/2024/10/20/futures3.html (2024-10-20). FACT — direct quote of the post's own "key goals" and "in this chapter" lists.

## Node list (as stated on the page)
**Key goals:**
- Minimize centralization risks at Ethereum's staking layer (notably, in block construction and capital provision, i.e. MEV and staking pools)
- Minimize risks of excessive value extraction from users

**Sub-tracks ("in this chapter"):**
- Fixing the block construction pipeline
- Fixing staking economics
- Application-layer solutions

## One paragraph
The Scourge is about the economic centralization risk that proof-of-stake didn't solve just by existing: if there are economies of scale in block construction (MEV extraction) or in capital provision (liquid staking tokens let mega-stakers dominate without locking up capital), large actors squeeze out small ones, which raises 51%-attack and censorship risk and lets a small group extract value that should have gone to users. The chapter's own framing names two distinct failure sites — block construction (fixed today only by extra-protocol proposer-builder separation via MEV-Boost, which leaves validators as a "dumb pipe" bidding on builder auctions) and staking economics (LSTs concentrating capital) — plus a third, softer layer of application-level mitigations. **Coharness mapping (INFERRED, per concept-notes-orchestrator.md §5):** Scourge = "fair task claiming, no front-running/collusion (Krier randomised critics)." The direct analogy: MEV extraction is what happens when whoever assembles the block (or, in coharness terms, whoever claims a task) has an economy-of-scale advantage that lets it systematically extract value from the process rather than doing honest work — the same failure mode a routing table has to guard against when agents can see and front-run each other's task claims. Vitalik's proposed fix (specialized, economies-of-scale-neutral roles plus committee-style randomization) is the same shape as a randomized-critic assignment rule, which prevents one agent from always reviewing (and thus quietly favoring) the same claimant.
