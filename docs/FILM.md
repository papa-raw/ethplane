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

## Rehearsal on Sepolia (2026-09-09, node `cl-pq-leanxmss-attestations`, thirteen transactions)
| beat | who | tx |
|---|---|---|
| 1 registerLineage | qwen-a (0x3a748389…) | 0x0622b6fe0731ea411f02328988878bfe73a021348f24b6b25c10b248b5473cdb |
| 2 registerLineage | fast-b (0xFDb2f69D…) | 0x298e452a7c7a2a9c85bc26ed740a6dee817fa368b5a98ac18f356791b10d9d44 |
| 3 acceptLineage(qwen-a) | operator A (deployer) | 0xb0c9d9aa8c21322cb11b485c2cd1f29a7d41f4b622d24ba4cb06e006a457e58e |
| 4 acceptLineage(fast-b) | operator B (0x0b7c5A80…) | 0x49a9cf130da753065aea9349ebb7fa6f43af08ec1e74c01ab3edb52352e35b8d |
| 5 claim (session starts from nothing) | qwen-a | 0xd13b5146c4ea8c61ad91b2db303586642e46275a66bc5eec0870a463ce077024 |
| 6 heartbeat | qwen-a | 0xc6ec778079e875e2bee49305c1bc2bbae6a32f9957f0d598f66d49f4089f522a |
| 7 heartbeat | qwen-a | 0x69087a5672d4757df2debc80d8e8cbe3a94674598857dbb7f25c35c081616b15 |
| 8 submit artifact 0x0caf464b… (48,169 bytes, guest only) | qwen-a | 0xe02ca9c39a31b28079ad7c5edadb9761e19df9ce32d5277d9799da89bb5c7053 |
| — the worker is killed; no heartbeat for 120 s | | |
| 9 forfeit (the session lapses; anyone may end it) | operator A | 0x2afd79414b00c8124e36efb58cc6ee5fbd2fac4b7b613f579b8432c287f6eb19 |
| 10 claim from qwen-a's artifact | fast-b | 0xaa4c2af0ad4a7a441845fdd921dfde759449c96ae25371ca0086049df0f61a15 |
| 11 submit artifact 0xb8ac6f31… with parent 0x0caf464b… | fast-b | (in the API's artifact store; on-chain submit tx in the finish log) |
| 12 recordMeasurement(0x0caf464b…) | verifier | 0x849b6baf6ec7eff608a2a808c9c18dfee38e2fe536b3546ef1bc2e5a555e5793 |
| 13 recordMeasurement(0xb8ac6f31…) | verifier | 0x9419005534e34ebd5a3c97c414826a8117b8ad944530ab5e2b1c5f28509ea8b0 |

Both verdicts are FAIL with reason `worktree`: the watcher was run as root against the verifier user's checkout and git refused the worktree, so the verifier recorded a host failure rather than a measurement. Re-run as the `verifier` user, the same artifact builds and measures (the reason becomes `regression-provingMicros` on a loaded host). Lesson kept for the film: the verifier runs as its own user, on a quiet host, and a FAIL is final per artifact, so a fresh submission is needed for a fresh verdict.
