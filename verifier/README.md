# Verifier

The verifier component ensures that submissions to the ethplane network genuinely reduce VM cycles without weakening the proof. It operates under three core principles: fail closed, one schema, and the submission never runs the check on itself.

## How run.py Works Step-by-Step

1. **Input Validation**: 
   - Takes an artifact tarball as input
   - Validates that the submitted files are only from the editable set (`crates/rec_aggregation/guests/`; the compiler was frozen on 2026-09-08 because a Rust crate under a submitter's control runs `build.rs` and proc macros as the verifier user)
   - Extracts the tarball to a temporary directory with safety checks

2. **Environment Setup**:
   - Reads environment variables:
     - `LEANVM_REF`: Path to reference leanVM (defaults to `/home/ubuntu/leanVM`)
     - `REFERENCE_COMMIT`: Git commit to use as reference (defaults to `a210ef1b`)  
     - `VERIFIER_CORES`: core list for `taskset -c` (default: **no pinning**)

3. **Worktree Creation**:
   - Creates two worktrees: one for the reference (using pinned commit) and one for the submission
   - The submission worktree is built from the extracted artifact

4. **Binary Verification**:
   - Builds the reference leanVM binary
   - Compares the submission's binary hash with the reference's
   - If they are **identical**, the build did not take: rejects with "stale-binary". A failed
     reference build is "reference-build" and stops the run — it must never be what disables this
     comparison

5. **Performance Measurement**:
   - Runs the pinned command once (three timed runs are `--baseline`'s procedure, not a
     submission's)
   - Parses the output to extract metrics (cycles, provingMicros, proofSizeBytes, verifyMicros)
   - If parsing fails, rejects with "parse" reason

6. **Non-Regression Check**:
   - Compares measurements against baseline values
   - Rejects if proving time exceeds baseline + spread, proof size increases, or verify time exceeds 5%
   - Uses specific reasons like "regression-provingMicros", "regression-proofSizeBytes", "regression-verifyMicros"

7. **Reference Verification**:
   - Runs the reference verifier on the submission
   - If it fails, rejects with the reference verifier's reason

8. **Statement Check**:
   - Applies a corrupt-index patch to the reference worktree (this path is frozen and unreachable by submission)
   - Runs probes to verify the submission handles corruption correctly
   - If any probe fails, rejects with specific reason like "probe-corrupt-index"

9. **Final Verdict**:
   - Emits a JSON verdict with these fields:
     - `cycles`: VM cycles measured
     - `provingMicros`: Proving time in microseconds
     - `proofSizeBytes`: Proof size in bytes
     - `verifyMicros`: Verification time in microseconds
     - `verifierAccepted`: Boolean indicating acceptance
     - `reason`: String explaining rejection reason or empty for acceptance
     - `binarySha256`: Hash of the binary

## Environment Variables

The verifier reads these environment variables:
- `LEANVM_REF`: Path to reference leanVM (defaults to `/home/ubuntu/leanVM`)
- `LEANVM_COMMIT` (or `REFERENCE_COMMIT`): commit to measure against (defaults to `a210ef1b`)
- `VERIFIER_CORES`: core list for `taskset -c`, e.g. `0-7`. **Default: no pinning at all.**
  A baseline and the submissions judged against it must be measured the same way. run.py used to
  pin `taskset -c 0-7` unconditionally while the PoC node's baseline had been recorded on all 26
  cores of the host — so on 2026-09-09 a correct submission came back `regression-provingMicros`
  at 3,737,000 µs against a 1,433,000 µs bound, with nothing wrong but the number of cores. Set
  this only when a host needs isolation, and set it for the baseline as well.
  (`VERIFIER_CPUS` is the old name; it still works when set explicitly, never as a default.)
- `ETHPLANE_CORRUPT_INDEX`: Used internally for statement checks (not exposed to users)

## Measuring a node's baseline

```bash
verifier/run.py --baseline [/path/to/leanVM]
```

Creates a worktree at the pinned commit, builds it, runs the pinned command three times on the same
cores a submission would get, and prints the summary plus the `recordBaseline(...)` cast line ready
to send. Cycles must agree across the three runs — they are deterministic, so runs that disagree
are `nondeterministic-cycles`, not a number to average. `spreadBps` is the full range of proving
time over its mean, rounded up, and becomes the allowance every later submission is judged by.

A node's baseline should always come from this command, on the host that will do the judging. The
PoC node's did not: it was measured by a different process on all cores and recorded once-only, and
that mismatch is what `--baseline` exists to prevent for every node after it.

## Whole numbers only

`recordMeasurement` takes four uint256 arguments and cast refuses a decimal point outright
(`parser error: 1500000.0 expected at most 0 decimals`). On 2026-09-09 a submission was measured
and judged and then *not recorded* for that reason, and it stayed pending with its verdict
unspoken. The parser returns ints, `verdict()` coerces whatever reaches it, and `watch.py` coerces
again at the argument list — three places, because losing this loses the verdict rather than a
digit.

## Not as root

`watch.py` refuses to run as root, and `run.py` answers `host-config` instead of measuring. git
will not create a worktree inside another user's checkout for root ("dubious ownership"), so every
such run fails at the same place — and on 2026-09-09 that failure was recorded on chain as a `FAIL`
verdict against two artifacts that had done nothing wrong, permanently, because
`recordMeasurement` refuses anything that is no longer PENDING. Run both as the user that owns
`$LEANVM_REF` and holds the verifier key. `watch.py` now also declines to record any verdict whose
reason describes the host rather than the submission (`host-config`, `reference-build`, `worktree`,
`patch-missing`, `patch-failed`, `probe-build`, `binary-missing`): it logs and leaves the
submission pending.

## Running Tests

```bash
# from the repository root, so watch.py's tests can import the package
for f in verifier/tests/test_*.py; do PYTHONPATH=. python3.12 "$f"; done
```

## How watch.py Works

The `watch.py` script polls the ethplane API for pending submissions and processes them:

1. Reads `/api/nodes/<NODE_ID>`, where PENDING is a submission with no verdict (the API has no
   status column)
2. Skips any artifact hash already in the ledger
3. Fetches each artifact from `/api/artifacts/<hash>`
4. Runs `verifier/run.py` on each artifact
5. Sends `recordMeasurement` with the verifier wallet (`--dry-run` prints the line instead)
6. Appends the artifact hash to the ledger — after the verdict is on chain, never before. The
   ledger is `~/.ethplane-watched` (override with `WATCHED_FILE`), not `./.watched`: watch.py runs
   from wherever it is started, and on 2026-09-09 that was a directory the verifier user could not
   write

The script supports:
- `--dry-run`: Shows what would happen without executing
- `--once`: Run only once, then exit
- `--interval`: Polling interval in seconds (default 30)