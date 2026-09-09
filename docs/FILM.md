| Time | Shot | What is on screen | Voice line |
|------|------|-------------------|------------|
| 0:00 | Intro | Black screen | "The ethplane protocol enables collaborative development." |
| 0:05 | Node Definition | Node creation interface showing criterion and session details | "Nodes represent roadmap items with verifiable criteria." |
| 0:15 | Session Creation | Session terms display with stake distribution | "Sessions provide incentive alignment for contributors." |
| 0:25 | Submission | Submission form with parents and artifact upload | "Submissions build upon previous work with proper attribution." |
| 0:35 | Verifier | Verifier interface reviewing submissions | "The verifier ensures quality and maintains the ecosystem." |
| 0:45 | Escrow Distribution | Financial distribution breakdown 68/15/10/5/2 | "Funds are distributed according to predetermined shares." |
| 0:55 | ENS Resolution | ENS name resolution interface | "Every actor has a name under ethplane.eth." |
| 1:05 | Privy Wallet | Wallet interface showing approval process | "Privy manages treasury with strict policies." |
| 1:15 | Policy Enforcement | Policy enforcement screen showing refusal | "Policy refuses payouts before verdicts." |
| 1:25 | Lineage Refusal | Lineage key refusal interface | "Lineage key refused writing head." |
| 1:35 | Judge Registration | Judge registration interface | "Judge registers a new node with proper validation." |
| 1:45 | Network View | Network visualization showing connections | "Collaborative development emerges from shared contributions." |
| 1:55 | Recovery Beat | System recovery interface | "Even if agents die, work survives." |
| 2:05 | Join Process | Join command interface | "ethplane join <name> rebuilds the tree from the name." |
| 2:15 | Tree Reconstruction | Visual tree reconstruction from ENS | "Rebuilding from the name creates the complete history." |
| 2:25 | Valid Attempts | Metrics display showing 65% vs 7.6% | "ROUTED 65% valid attempts vs SOLO 7.6%." |
| 2:35 | Measurement Results | Measurement results chart | "Same model, unchanged cycles." |
| 2:45 | Honest Rejection | Rejection interface showing honest decisions | "An honest rejection preserves integrity." |
| 2:55 | Collaborative Flow | Flow diagram of collaborative process | "Human and AI swarm pull contributions, build on them." |
| 3:05 | Attribution | Attribution display showing contributions | "Receive attribution for your work." |
| 3:15 | Conclusion | Final screen with protocol summary | "The ethplane protocol enables collaborative development." |
| 3:25 | Credits | Credits screen | "Thank you for watching." |
| 3:35 | End | Black screen | "End of demonstration." |
## Rehearsed facts (2026-09-08 evening, Sepolia)
- **EAC refusal shot:** a freshly generated lineage key calling `setText(node, "ethplane.head", …)` on the node resolver `0xA11a923dA99Bb3aaE3643758DA8D408173199Bec` reverts (custom error selector `0x73e36525`); the same call estimated from the verifier key `0x0A6Ad2a627F8736E0f34849a0B5B80a109F81759` succeeds (54,439 gas). The verifier holds `setWriter` grants for `ethplane.head` and `ethplane.status` only.
- **Policy refusal shot:** from the treasury wallet, `approve` and `fundNode` (10,000 PLANE) were signed and sent under policy `c8io5x5g08igo85ljedozu2k`; a `transfer` of 1 PLANE from the same wallet was refused at signing: `RPC request denied due to policy violation`.
- **Node state for the opening shot:** `cl-pq-leanxmss-attestations.ethplane.eth` resolves `ethplane.status = open`, `ethplane.criterion` set; the contract holds 10,000 PLANE in escrow for the node; baseline 1,542,812 cycles recorded by the verifier.
