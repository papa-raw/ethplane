# Verifier

The verifier component ensures that submissions to the ethplane network genuinely reduce VM cycles without weakening the proof. It operates under three core principles: fail closed, one schema, and the submission never runs the check on itself.

## How run.py Works Step-by-Step

1. **Input Validation**: 
   - Takes an artifact tarball as input
   - Validates that the submitted files are only from the editable set (`crates/rec_aggregation/guests/` and `crates/lean_compiler/`)
   - Extracts the tarball to a temporary directory with safety checks

2. **Environment Setup**:
   - Reads environment variables:
     - `LEANVM_REF`: Path to reference leanVM (defaults to `/home/ubuntu/leanVM`)
     - `REFERENCE_COMMIT`: Git commit to use as reference (defaults to `a210ef1b`)  
     - `VERIFIER_CPUS`: CPUs to use for taskset (defaults to `0-7`)

3. **Worktree Creation**:
   - Creates two worktrees: one for the reference (using pinned commit) and one for the submission
   - The submission worktree is built from the extracted artifact

4. **Binary Verification**:
   - Builds the reference leanVM binary
   - Checks that the submission's binary matches the reference binary hash
   - If not, rejects with "binary-mismatch" reason

5. **Performance Measurement**:
   - Runs three timed measurements of the pinned command
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
- `REFERENCE_COMMIT`: Git commit to use as reference (defaults to `a210ef1b`)
- `VERIFIER_CPUS`: CPUs to use for taskset (defaults to `0-7`)
- `ETHPLANE_CORRUPT_INDEX`: Used internally for statement checks (not exposed to users)

## Running Tests

```bash
cd verifier/tests
python3 -m pytest -v
```

## How watch.py Works

The `watch.py` script polls the ethplane API for pending submissions and processes them:

1. Polls `/api/nodes/<NODE_ID>/submissions` for PENDING artifacts
2. Filters submissions by checking if artifact hash is not in `.watched` file
3. Fetches each artifact from `/api/artifacts/<hash>`
4. Runs `verifier/run.py` on each artifact
5. Prints the `cast send` command for `recordMeasurement` with all required parameters
6. Appends artifact hash to `.watched` file

The script supports:
- `--dry-run`: Shows what would happen without executing
- `--once`: Run only once, then exit
- `--interval`: Polling interval in seconds (default 30)