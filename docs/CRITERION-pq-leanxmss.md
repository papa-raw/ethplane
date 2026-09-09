# Criterion: post-quantum signature aggregation (leanVM)

> **Superseded, and the chain says so.** The `criterionHash` recorded on chain for this node is
> `0xa2e71ccbc9418b24f27d6a222f5ec1119815d964b3b1968a4451196c22da4c54`, which is
> `keccak256` of the bytes frozen at **[docs/CRITERION-pq-leanxmss@a2e71ccb.md](CRITERION-pq-leanxmss@a2e71ccb.md)**
> (this file at commit `faafa54c`). Reproduce it with
> `cast keccak "$(cat docs/CRITERION-pq-leanxmss@a2e71ccb.md)"`.
>
> That version's **Editable** clause admitted `crates/lean_compiler/` on this node. On **2026-09-08**
> the surface was narrowed to `crates/rec_aggregation/guests/` after review: `cargo build` and the
> reference harness's `cargo test` run `build.rs` and procedural macros as the invoking user, and on
> the judging host that user holds the verifier's key, so a submitter-controlled Rust crate is code
> execution as the key holder. The narrower surface is what the verifier enforces today
> (`verifier/run.py`, `EDITABLE`), and it is *stricter* than the hashed text — a submission that the
> frozen criterion would have allowed can only be rejected by the live one, never the other way round.
>
> The hash was not re-recorded because `defineNode` sets it once. Node 2 (`dl-leanvm`) carries the
> wider surface deliberately, with the build isolation that makes it safe (below).

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

**Node 2's recorded band, and which criterion decides.** `recordBaseline` is once-only, and node 2's
was recorded while both swarms were working the host: cycles 1,542,812, provingMicros **7,158,000**
(7.16 s), spreadBps **2367** — decoded from the `BaselineRecorded` log at block 11668042, not from a
note. The non-regression bound that follows is 8.85 s against roughly 1.43 s in a local run on a quiet host (not an on-chain figure), so the
time bound on that node is lenient. That is the safe direction: a lenient bound cannot wrongly reject
a good submission, only fail to catch a slow one.

The cycles criterion — strictly below 1,542,812, thresholdBps 0 — is what decides a submission the
verifier has accepted. None has been: as of 2026-09-09 15:19 UTC, all seven `MeasurementRecorded`
events on the two nodes carry
`verifierAccepted = false`, so not one has reached that comparison, and `_judge` returns FAIL on the
flag before it looks at the number. What has actually decided every recorded verdict so far is the
verifier's own non-regression check, and on node 2 that was proof size — 302,489 B against the
302,182 B recorded, the one field with no allowance at all, and 410 bytes tighter than node 1's
302,592 B. `docs/JUDGES.md` §8 lists every row with its transaction.

Node 1 is the opposite case for time and is stated in `docs/DEPLOYMENTS.md`: its bound of 1.46 s,
against roughly 1.5 s in a local run on the same host on 2026-09-09 (a local measurement, not an
on-chain figure), is tight enough to fail a correct submission on time alone.

**Statement.** The verifier builds the submission and runs it on inputs it generates itself with the reference build: fresh keys, messages and 900 signatures, plus negative vectors (a flipped signature, a wrong message, a wrong key). The proof must verify with the reference `python-verifier/verifier.py` on the positive inputs and the run must fail on every negative vector. The Python verifier binds the bytecode hash into the transcript and fixes the proof-system parameters, so a proof of a weaker statement does not verify.

**Review floor.** A cycle reduction above 20 % is recorded as REVIEW rather than PASS and released only after a human reads the diff.

**Recorded onchain.** Baseline (cycles, proving micros, proof bytes, verify micros, spread) at node definition; each measurement with the artifact hash; the contract compares and decides. The verifier never decides in prose.

**Every signature checked, by differential probes.** The verifier owns the reference checkout and patches it so that `ETHPLANE_CORRUPT_INDEX=i` corrupts signature `i` as the signer set is returned (a patch on a frozen path, so a submission cannot remove it). A probe runs the reference binary with the index set (it must fail, or the probe is invalid) and then the submission binary with the same index (it must fail, or the submission skipped that signature). Every measured submission gets three probes at index 0, index 899 and a random index. A submission whose result would release the full target gain is probed at all 900 indices before its measurement is recorded (about 7.5 hours on the verifier's host: two legs per index at about 15 s each; caching the reference leg at baseline would halve it, not done yet). Smaller releases and non-paying passes are probed at three indices, which detects a submission that skips k of the 900 signatures with probability about 3k/900: strong against a large skip, weak against a small one, and a small skip is worth little. A probe whose reference leg does not fail, or that times out on either leg, counts as a failed probe, never as evidence.

**Measured binary.** The verifier records the hash of the binary it ran with every measurement. If a submission's diff is non-empty and the built binary hashes the same as the reference, the verifier refuses to measure: it will not credit a submission with another build's numbers. Negative vectors flip a byte at a random offset inside the signature, so partial verification of a signature is caught as well as a skipped one.


**Procedure note (2026-09-09, from the rehearsal).** The baseline must be recorded by the verifier's own `run.py --baseline` on the reference checkout, on the same host, with the same core pinning the verifier uses for submissions; otherwise the non-regression bounds compare unlike measurements. The first node's baseline was recorded from an earlier measurement taken with all cores, while the verifier pinned eight, and the first measured submission therefore failed non-regression on proving time although its cycle count was identical to the baseline. The 3.74 s that failed against the 1.43 s bound was a local run on the judging host that day, not an on-chain figure: the proving times node 1 actually carries on chain are 0, 0, 7,240,000 and 6,696,000 µs (`docs/JUDGES.md` §8), the two non-zero ones recorded later while both swarms were working the host. Different load, different numbers, same lesson. The baseline is once-only by contract, so this is recorded here rather than corrected; the verifier now runs unpinned on this host so its numbers are comparable.
