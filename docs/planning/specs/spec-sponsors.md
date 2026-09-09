<!-- planning artifact: a day-one specification written for the local-model swarm on 2026-09-07/08. Historical; what shipped is described in docs/ and README.md, and differs where the record says so. -->


# Ethplane spec extract for the build swarms · from the private PRD, 2026-09-08 19:04 · private to host A, never commit this file

## 3.23 Sponsor integration as a judge reads it (2026-09-08 17:15; written so the roles never blur in the film, the deck or the README)
| Layer | Owns | Never does |
|---|---|---|
| **ENS (ENSv2, Sepolia)** | Identity and state: every node, operator, lineage, guest and verifier is a name under `ethplane.eth`; the node's `head`, `status`, `criterion`, `lease` records are the state a client resumes from (`ethplane join <name>`); per-record roles let only the verifier write `head`/`status`; lineage names expire with their lease; guest names are non-transferable; agent-context / agent-endpoint records make agents discoverable | hold money; decide pass/fail |
| **Privy** | Treasury control and human onboarding: the organisation wallet that funds nodes, bound to a policy that allows only PLANE approve and define/fund under a cap and with a split that keeps the verifier and reused-parent shares (P6b decides the exact condition shape); guests log in with email or wallet and receive an embedded wallet that owns their guest name and signs their claims | decide the split at payout; write ENS state; judge work |
| **Ethplane contract** | The single pass/fail authority (`recordMeasurement` compares against baseline and threshold), the escrow, the split, the attribution rows (verified, reused, verification, compute, registered, reviewed), leases and forfeits | trust any off-chain verdict text |
| **Verifier (hawk)** | Measures on its own inputs, signs measurements, writes ENS `head`/`status` with its scoped role | pay anyone; edit submissions |

Film sentences, one per sponsor: "Every actor here is an ENS name, and the only key that can move a node's head is the verifier's; watch a lineage try and fail." "The treasury is a Privy wallet whose policy will not sign a payout before a verdict or a node that stiffs the verifier; watch it refuse, then allow." README "Sponsors" section and deck slides "Why ENS" and "Why Privy" carry the table above (3.12 gate).
- 2026-09-08 17:15 (orchestrator, Pat's sponsor-clarity question): §2.8 allocation line corrected (split is a contract parameter, policy guards it); §3.23 sponsor roles table and film sentences added; P6b and [private note, withheld] dispatched to close the remaining fill-after items.
