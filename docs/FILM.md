# Ethplane, the film

Two to four minutes, real time, my voice, shot on the live product. No slides. Every line below has the thing on screen that proves it. AI disclosure is in ATTRIBUTION.md.

## Script

**0:00, the map.** Screen: ethplane.ecofrontiers.xyz, the roadmap picture, 65 chips in their layers and fork columns.

> This is the Ethereum roadmap as a plane of paid work. 65 nodes from the Foundation's strawmap. Each one is a name under ethplane.eth, a criterion a machine can check, and an escrow that pays only on a verdict.

**0:20, a node.** Screen: the dl-leanvm node page. ENS name, status open, 10,000 PLANE in escrow, the criterion, the baseline.

> Here is one. leanVM aggregates 900 post-quantum signatures into one proof. The criterion: fewer VM cycles than the reference, 1,542,812. The escrow: 10,000 PLANE, put there by a treasury wallet under a Privy policy. The policy allows three shapes of transaction: approve the escrow, fund a node, define a node whose split gives the verifier at least ten percent. We tried a fourth, a plain transfer. Refused at signing.

**0:50, the swarm.** Screen: the Coharness window, four panes. An orchestrator. A builder. A critic. The View console. Qwen3-Coder 30B on one rented GPU box, no cloud model in the loop.

> The work is done by a swarm of local models. An orchestrator hands off, a builder edits the compiler, a critic re-measures every number the builder posts. They cannot mark their own work done; measure is a tool, and the tool posts the number. No model can read a key. A separate user signs.

**1:15, a session.** Screen: the View console, sessions table, a heartbeat every sixty seconds; then the board line MEASURED cycles=1,541,462 BELOW baseline.

> A session is a declaration, not a permission: working on this node, from this head. Heartbeats keep it live; stop for two minutes and anyone can end it. Many sessions run on one node at once. This afternoon the builder posted four changed lines in the compiler's common-subexpression pass and a measurement: 1,541,462 cycles. Below the line, by its own instrument. The judge's number is the one that counts.

**1:45, the judge.** Screen: the verifier's log, live: fetch the artifact, rebuild it at the pinned commit as a user that cannot read the key, run it, three differential probes, then the onchain record.

> The verifier is a separate user with its own key. It rebuilds the submission from the reference commit and runs the benchmark itself. It corrupts signatures one at a time to test that they were checked: three probes on any pass, all nine hundred before a payout that reaches the target. Then it writes the verdict onchain. The contract believes no other account.

**2:15, the verdict.** One of two, whichever the chain shows on the day of the cut.

> *If PASS:* Pass. The contract releases the split: 68 percent to the lineage that won, 15 to the parent it built on, 10 to the verifier, 2 to whoever registered the node. The 5 percent host share stays in escrow in this version. Nobody clicked.
>
> *If FAIL:* Fail. The verifier's own run did not clear the bar, and it wrote the reason onchain. [Read the recorded reason here, as written: cycles, or the proving-time bound, and why.] No payout. An honest rejection, recorded with the numbers, is the product working.

**2:40, the names.** Screen: cast resolving dl-leanvm.ethplane.eth through the hackathon Universal Resolver: addr, ethplane.status, ethplane.head; then the same setText from a fresh key reverting.

> Every node is an ENS name on the v2 registry. Status and head live in its records, and only the verifier can write them. A lineage key that tries gets a revert.

**3:00, join.** Screen: the join page, email login, an embedded wallet created on the spot, a guest name under guests.ethplane.eth.

> Anyone can join. Log in with an email, Privy gives you a wallet, you get a name, and your swarm starts a session on any node.

**3:15, close.** Screen: back to the map.

> A plane where swarms pull roadmap work and get paid only for what a verifier can measure. Two nodes are live on Sepolia. The code is public. Come start a session.

## Two endings, one rule

The verdict beat is filmed after the verifier records it, never before. FILM.md carries both lines so the cut takes whichever is true; the other is deleted on the day.

## Facts the script leans on, with where they are proven

| Line | Proof |
|------|-------|
| 65 nodes, layers and fork columns | seedStrawmap on Ethplane 0xB9569968…; the home page |
| 10,000 PLANE escrow, node 2 | fundNode tx 0x18830649…, approve 0x42923f98… |
| Privy policy: three allowed shapes | policy c8io5x5g08igo85ljedozu2k; refused transfer: "RPC request denied due to policy violation" (docs/DEPLOYMENTS.md) |
| Baseline 1,542,812 cycles | recordBaseline tx 0x0d24ace3… (verifier, run.py --baseline) |
| 1,541,462 cycles, four-line change | swarm B board, 2026-09-09 13:59 host time; artifact hash once submitted |
| Verifier as its own user, build as lean-build | verifier/host-setup-build-user.sh, run.py run_prefix |
| Three probes, full sweep on a paying pass | docs/CRITERION-pq-leanxmss.md |
| Split 6800/1500/1000/500/200 bps | Ethplane.sol Split struct, test_cumulativePayoutEqualsOneShot |
| Names resolve through the Universal Resolver 0xd26f2040… | docs/ENS-PROBES.md |
| Writer refusal from a lineage key | EthplaneResolver.sol onlyServed / writer; rehearsal tx 0x0622b6fe… |
| Join with email, embedded wallet, guest name | api join route, Privy verifyAuthToken; a guest name under guests.ethplane.eth |
| Two nodes live on Sepolia | defineNode for cl-pq-leanxmss-attestations (2026-09-08) and dl-leanvm (defineNode + setNodeVerifier 2026-09-09, resolver 0xaFE89fc8…); GET /api/nodes shows both open with 10,000 PLANE |
| Policy tested on the refused shape | transfer refused; approve and fundNode signed under the policy (2026-09-08, 2026-09-09); defineNode rule present in the policy, not exercised on film |

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
| the worker is killed; no heartbeat for 120 s | | |
| 9 forfeit (the session lapses; anyone may end it) | operator A | 0x2afd79414b00c8124e36efb58cc6ee5fbd2fac4b7b613f579b8432c287f6eb19 |
| 10 claim from qwen-a's artifact | fast-b | 0xaa4c2af0ad4a7a441845fdd921dfde759449c96ae25371ca0086049df0f61a15 |
| 11 submit artifact 0xb8ac6f31… with parent 0x0caf464b… | fast-b | (in the API's artifact store; onchain submit tx in the finish log) |
| 12 recordMeasurement(0x0caf464b…) | verifier | 0x849b6baf6ec7eff608a2a808c9c18dfee38e2fe536b3546ef1bc2e5a555e5793 |
| 13 recordMeasurement(0xb8ac6f31…) | verifier | 0x9419005534e34ebd5a3c97c414826a8117b8ad944530ab5e2b1c5f28509ea8b0 |

Both verdicts are FAIL with reason `worktree`: the watcher was run as root against the verifier user's checkout and git refused the worktree, so the verifier recorded a host failure rather than a measurement. Re-run as the `verifier` user, the same artifact builds and measures (the reason becomes `regression-provingMicros` on a loaded host). Lesson kept for the film: the verifier runs as its own user, on a quiet host, and a FAIL is final per artifact, so a fresh submission is needed for a fresh verdict.
## Changelog
- 2026-09-09 16:4x: critic's film pass applied: probes stated as three-then-nine-hundred, host share stays in escrow, measurement attributed to the builder's instrument, FAIL ending reads the recorded reason, key sentence made true, two proof rows added.
- 2026-09-09 16:2x: script rewritten in place (the day-2 shot table replaced): eight beats, two verdict endings, proof table; rehearsal tables kept below.
