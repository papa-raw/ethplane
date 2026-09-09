# Criterion: post-quantum signature aggregation (leanVM)

The node is `cl-pq-leanxmss-attestations` on the Ethereum roadmap. The task is the pinned command
`cargo run --release -- aggregate --xmss 900 --log-inv-rate 1 --repeat 3` in leanEthereum/leanVM at the pinned commit.

**Metric.** `cycles (VM steps)` printed by the pinned command. It is the length of the execution trace, deterministic for a given program and input. Pass = strictly fewer cycles than the recorded baseline. Cycles is exact and reproducible, so any reduction is a repeatable fact and no noise margin applies; the project's own reachability check found upstream history moving the editable surface by exactly zero cycles, which is stated here so a rejection is read as honest, not as a broken verifier. Pinned commit: a210ef1b; baseline 1,542,812 cycles. Non-regression: proving time not above the baseline mean plus its measured spread; proof size and verify time not larger.

**Editable.** `crates/rec_aggregation/guests/` only: the guest program is a zkDSL text compiled by the frozen compiler, so nothing a submission writes is compiled as Rust and no `build.rs`, procedural macro or linker path can run on the verifier's host. Everything else is frozen, including the compiler, the signature schemes, the polynomial commitment, the transcript and the VM; a diff touching a frozen path is rejected before anything is built. (The compiler was editable in the first version of this criterion; it was frozen on 2026-09-08 after review, because a Rust crate under a submitter's control executes code at build time.)

**Node 2 (`dl-leanvm`) admits the compiler, and that is a different bargain.** Sixteen guest-only
measurements on 2026-09-09, from two independent swarms, all returned exactly 1,542,812 cycles: at
this commit the guest program is not where the cycles are, and the overnight arms that edited
`crates/lean_compiler/src/cse.rs` did move them. So `dl-leanvm`'s surface is
`crates/rec_aggregation/guests/` **and** `crates/lean_compiler/`, set per node through the
verifier's `EDITABLE`. The risk the freeze was about does not go away by being useful: `cargo build`
and the reference harness's `cargo test` both run `build.rs` and procedural macros as the invoking
user. So on that node the build runs `--offline --locked`, and it runs as a user that cannot read
the verifier's key — the verifier refuses the surface (`host-config`, no verdict about the
submission) unless `BUILD_USER` is set to such a user, or the risk is accepted deliberately with
`ALLOW_UNSANDBOXED_BUILD=1`. Node 1 is unchanged: guests only, no Rust from a submitter, nothing to
isolate.

**Statement.** The verifier builds the submission and runs it on inputs it generates itself with the reference build: fresh keys, messages and 900 signatures, plus negative vectors (a flipped signature, a wrong message, a wrong key). The proof must verify with the reference `python-verifier/verifier.py` on the positive inputs and the run must fail on every negative vector. The Python verifier binds the bytecode hash into the transcript and fixes the proof-system parameters, so a proof of a weaker statement does not verify.

**Review floor.** A cycle reduction above 20 % is recorded as REVIEW rather than PASS and released only after a human reads the diff.

**Recorded onchain.** Baseline (cycles, proving micros, proof bytes, verify micros, spread) at node definition; each measurement with the artifact hash; the contract compares and decides. The verifier never decides in prose.

**Every signature checked, by differential probes.** The verifier owns the reference checkout and patches it so that `ETHPLANE_CORRUPT_INDEX=i` corrupts signature `i` as the signer set is returned (a patch on a frozen path, so a submission cannot remove it). A probe runs the reference binary with the index set (it must fail, or the probe is invalid) and then the submission binary with the same index (it must fail, or the submission skipped that signature). Every measured submission gets three probes at index 0, index 899 and a random index. A submission whose result would release the full target gain is probed at all 900 indices before its measurement is recorded (about 3.75 hours at 15 s a probe on the verifier's host). Smaller releases and non-paying passes are probed at three indices, which detects a submission that skips k of the 900 signatures with probability about 3k/900: strong against a large skip, weak against a small one, and a small skip is worth little. A probe whose reference leg does not fail, or that times out on either leg, counts as a failed probe, never as evidence.

**Measured binary.** The verifier records the hash of the binary it ran with every measurement. If a submission's diff is non-empty and the built binary hashes the same as the reference, the verifier refuses to measure: it will not credit a submission with another build's numbers. Negative vectors flip a byte at a random offset inside the signature, so partial verification of a signature is caught as well as a skipped one.


**Procedure note (2026-09-09, from the rehearsal).** The baseline must be recorded by the verifier's own `run.py --baseline` on the reference checkout, on the same host, with the same core pinning the verifier uses for submissions; otherwise the non-regression bounds compare unlike measurements. The first node's baseline was recorded from an earlier measurement taken with all cores, while the verifier pinned eight, and the first measured submission therefore failed non-regression on proving time (3.74 s against 1.43 s) although its cycle count was identical to the baseline. The baseline is once-only by contract, so this is recorded here rather than corrected; the verifier now runs unpinned on this host so its numbers are comparable.
