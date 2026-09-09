# Criterion: post-quantum signature aggregation (leanVM)

The node is `cl-pq-leanxmss-attestations` on the Ethereum roadmap. The task is the pinned command
`cargo run --release -- aggregate --xmss 900 --log-inv-rate 1 --repeat 3` in leanEthereum/leanVM at the pinned commit.

**Metric.** `cycles (VM steps)` printed by the pinned command. It is the length of the execution trace, deterministic for a given program and input. Pass = strictly fewer cycles than the recorded baseline. Cycles is exact and reproducible, so any reduction is a repeatable fact and no noise margin applies; the project's own reachability check found upstream history moving the editable surface by exactly zero cycles, which is stated here so a rejection is read as honest, not as a broken verifier. Pinned commit: a210ef1b; baseline 1,542,812 cycles. Non-regression: proving time not above the baseline mean plus its measured spread; proof size and verify time not larger.

**Editable.** `crates/rec_aggregation/guests/aggregate.py` (the guest program) and `crates/lean_compiler/`. Everything else is frozen; a diff touching a frozen path is rejected before measurement. The frozen set includes the signature schemes, the polynomial commitment, the transcript and the VM, so a submission cannot weaken the statement it proves.

**Statement.** The verifier builds the submission and runs it on inputs it generates itself with the reference build: fresh keys, messages and 900 signatures, plus negative vectors (a flipped signature, a wrong message, a wrong key). The proof must verify with the reference `python-verifier/verifier.py` on the positive inputs and the run must fail on every negative vector. The Python verifier binds the bytecode hash into the transcript and fixes the proof-system parameters, so a proof of a weaker statement does not verify.

**Review floor.** A cycle reduction above 20 % is recorded as REVIEW rather than PASS and released only after a human reads the diff.

**Recorded onchain.** Baseline (cycles, proving micros, proof bytes, verify micros, spread) at node definition; each measurement with the artifact hash; the contract compares and decides. The verifier never decides in prose.

**Every signature checked.** The public input binds the signer count and the key set, so the statement cannot shrink. To ensure each signature is actually verified, every submission first runs three negative vectors at the first, the last and a random index; a submission that earns a payout then runs the full sweep of 900 single-bad-signature inputs, one per index, in parallel. Each run must fail. A guest that skips any index fails the sweep at that index.

**Measured binary.** The verifier records the hash of the binary it ran with every measurement. If a submission's diff is non-empty and the built binary hashes the same as the reference, the verifier refuses to measure: it will not credit a submission with another build's numbers. Negative vectors flip a byte at a random offset inside the signature, so partial verification of a signature is caught as well as a skipped one.
