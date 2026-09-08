#!/usr/bin/env python3
"""Verifier for the PQ-aggregation node.

It answers one question — does this submission genuinely reduce VM cycles without weakening the
proof — and it answers it in a way the submitter cannot influence. Three rules shape the code:

  * fail closed. Every path that cannot establish something returns a verdict with a reason, never
    an exception and never a default of "accepted". The version this replaces set
    verifierAccepted = True when it could not find the reference verifier, which is the one default
    that must never exist.
  * one schema. Every verdict has the same seven keys whatever happened, so a consumer never has to
    ask which shape it got.
  * the submission never runs the check on itself. The reference verifier and the corrupted-index
    probes live in a worktree of the pinned commit that the submission's files cannot reach.

Usage:  run.py <artifact.tar.gz> [reference_leanvm] [baseline.json]
        run.py --self-test
"""
import argparse
import hashlib
import json
import os
import random
import shutil
import subprocess
import sys
import tarfile
import tempfile
from typing import Dict, Optional, Tuple

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from parse import parse_output  # noqa: E402

REFERENCE_LEANVM_PATH = os.environ.get("LEANVM_REF", "/home/ubuntu/leanVM")
REFERENCE_COMMIT = os.environ.get("LEANVM_COMMIT", "a210ef1b")
BASELINE_CYCLES = 1542812
BASELINE_PROVING_MICROS = 1433000
BASELINE_PROOF_SIZE_BYTES = 302592
BASELINE_VERIFY_MICROS = 30100
BASELINE_SPREAD_BPS = 190

RUN_TIMEOUT_SECONDS = 600
BUILD_TIMEOUT_SECONDS = 1800
TASKSET_CPUS = os.environ.get("VERIFIER_CPUS", "0-7")
EDITABLE_PREFIXES = ("crates/rec_aggregation/guests/", "crates/lean_compiler/")
FROZEN_HINT = "only crates/rec_aggregation/guests/ and crates/lean_compiler/ may change"

VERDICT_KEYS = (
    "cycles", "provingMicros", "proofSizeBytes", "verifyMicros", "verifierAccepted", "reason", "binarySha256",
)


def verdict(
    cycles: Optional[int] = None,
    provingMicros: Optional[int] = None,
    proofSizeBytes: Optional[int] = None,
    verifyMicros: Optional[int] = None,
    verifier_accepted: bool = False,
    reason: str = "",
    binary_sha256: Optional[str] = None,
) -> Dict[str, object]:
    """The only verdict shape. `status` is gone: the contract decides status from these fields, and
    two places deciding it is one place too many."""
    return {
        "cycles": cycles,
        "provingMicros": provingMicros,
        "proofSizeBytes": proofSizeBytes,
        "verifyMicros": verifyMicros,
        "verifierAccepted": verifier_accepted,
        "reason": reason,
        "binarySha256": binary_sha256,
    }


def validate_paths(diff_files) -> Tuple[bool, str]:
    """The frozen-path check: a submission may only touch the guest program and the compiler.

    Archive safety is NOT this function's job — extract_tarball's filter='data' refuses absolute
    paths, escapes and symlinks before anything reaches here. So a path that normalises outside the
    tree is simply a path outside the editable set, and the reason is frozen-path (which is what
    swarm B's test_normpath expects, and it is the more useful answer for a submitter)."""
    for f in diff_files:
        norm = os.path.normpath(f)
        if not norm.startswith(EDITABLE_PREFIXES):
            return False, "frozen-path"
    return True, ""


def extract_tarball(tarball: str, dest: str) -> Tuple[bool, str]:
    """filter='data' is the extraction policy, not a hand-rolled loop: it refuses absolute paths,
    parent escapes, symlinks, devices and setuid bits, which is more than the previous two checks
    caught (a symlink pointing at /etc/passwd passed them)."""
    try:
        with tarfile.open(tarball, "r:gz") as tar:
            tar.extractall(path=dest, filter="data")
    except (tarfile.TarError, ValueError, OSError):
        return False, "unsafe-archive"
    return True, ""


def make_worktree(reference: str, dest: str, commit: str = REFERENCE_COMMIT) -> Tuple[bool, str]:
    """A worktree DETACHED AT THE PINNED COMMIT. Without --detach <commit> the verifier measures
    whatever the reference checkout happens to be on, which is not the criterion."""
    r = subprocess.run(
        ["git", "worktree", "add", "--detach", dest, commit],
        cwd=reference, capture_output=True, text=True,
    )
    return (r.returncode == 0, "" if r.returncode == 0 else "worktree")


def apply_corrupt_patch(worktree: str, patch: Optional[str] = None) -> Tuple[bool, str]:
    """(h) The knob that makes a statement check possible: a patch in the REFERENCE worktree that
    flips one byte of signature `index` when ETHPLANE_CORRUPT_INDEX names it. It lives here, not in
    the submission, because signers_cache.rs is a frozen path — the submission can neither see it
    nor disable it."""
    patch = patch or os.path.join(os.path.dirname(os.path.abspath(__file__)), "patches", "corrupt-index.patch")
    if not os.path.exists(patch):
        return False, "patch-missing"
    r = subprocess.run(["git", "apply", patch], cwd=worktree, capture_output=True, text=True)
    return (r.returncode == 0, "" if r.returncode == 0 else "patch-failed")


def binary_path(worktree: str) -> str:
    """The binary's NAME changed with the package rename: at the pinned commit a210ef1b the crate is
    still `leanvm-b`, and `target/release/leanvm` does not exist there. Invoking a hardcoded path is
    how a stale binary gets measured at every commit (it invalidated a whole afternoon's perf hunt),
    so the name is resolved, newest first, and never assumed."""
    release = os.path.join(worktree, "target", "release")
    candidates = [os.path.join(release, n) for n in ("leanvm", "leanvm-b")]
    existing = [c for c in candidates if os.path.exists(c)]
    if existing:
        return max(existing, key=os.path.getmtime)
    return candidates[0]


def get_binary_hash(worktree: str) -> Optional[str]:
    p = binary_path(worktree)
    if not os.path.exists(p):
        return None
    with open(p, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def build(worktree: str) -> Tuple[bool, str]:
    """Built once. The old code shelled out to `cargo run` per measurement, so every timing carried
    cargo's own resolution and the build could silently differ between runs."""
    r = subprocess.run(
        ["cargo", "build", "--release"], cwd=worktree, capture_output=True, text=True, timeout=BUILD_TIMEOUT_SECONDS
    )
    return (r.returncode == 0, "" if r.returncode == 0 else "build")


def pinned_command(worktree: str) -> list:
    """The criterion's command line, run as the built binary under taskset."""
    return [
        "taskset", "-c", TASKSET_CPUS,
        binary_path(worktree),
        "aggregate", "--xmss", "900", "--log-inv-rate", "1", "--repeat", "3",
    ]


def parse_or_reason(parsed: Dict[str, Optional[int]]) -> str:
    """(d) Any missing value is `parse`. Never an exception: a crash here reads as an outage, and an
    outage is not a verdict."""
    for key in ("cycles", "provingMicros", "proofSizeBytes", "verifyMicros"):
        if parsed.get(key) is None:
            return "parse"
    return ""


def measure(worktree: str) -> Tuple[Optional[Dict[str, int]], str]:
    try:
        r = subprocess.run(pinned_command(worktree), capture_output=True, text=True, timeout=RUN_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        return None, "timeout"
    if r.returncode != 0:
        return None, "run"
    parsed = parse_output(r.stdout)
    reason = parse_or_reason(parsed)
    if reason:
        return None, reason
    return parsed, ""


def check_non_regression(measured: Dict[str, int], baseline: Dict[str, int], spread_bps: int) -> str:
    """(b) Each field against its own bound, and the field that broke is named in the reason.
    The proving-time allowance is the measured spread; proof size has none; verify time gets 5%."""
    if measured["provingMicros"] > baseline["provingMicros"] * (10000 + spread_bps) // 10000:
        return "regression-provingMicros"
    if measured["proofSizeBytes"] > baseline["proofSizeBytes"]:
        return "regression-proofSizeBytes"
    if measured["verifyMicros"] > baseline["verifyMicros"] * 10500 // 10000:
        return "regression-verifyMicros"
    return ""


def run_reference_verifier(worktree: str) -> Tuple[bool, str]:
    """(a)+(g) The independent check. The pinned command does not write the four files
    python-verifier/verifier.py takes (bytecode, public_input, stream, merkle_openings) — the only
    place in leanVM that produces them is the repo's own harness at
    crates/lean_vm/tests/verifiers/python_verifier.rs, which builds a proof, dumps the streams and
    shells out to verifier.py. So the check is that harness, run in the submission's worktree, and
    its exit code is the answer.

    A missing verifier.py is FALSE with reason verifier-missing. That is the whole point of this
    function: the version it replaces returned True when it could not find the file."""
    if not os.path.exists(os.path.join(worktree, "python-verifier", "verifier.py")):
        return False, "verifier-missing"
    env = dict(os.environ)
    # verifier.py uses PEP 695 `type` aliases and needs 3.12+; the box's default python3 is 3.10.
    py312 = shutil.which("python3.12")
    if py312:
        env["PATH"] = os.path.dirname(py312) + os.pathsep + env.get("PATH", "")
    try:
        r = subprocess.run(
            ["cargo", "test", "--release", "-p", "lean_vm", "--test", "verifiers", "--",
             "--include-ignored", "python_verifier"],
            cwd=worktree, capture_output=True, text=True, timeout=RUN_TIMEOUT_SECONDS, env=env,
        )
    except subprocess.TimeoutExpired:
        return False, "verifier-timeout"
    return (True, "") if r.returncode == 0 else (False, "verifier-rejected")


def run_with_corrupt_index(worktree: str, index: int) -> int:
    """Run the pinned command with one signature corrupted. Returns the exit code; non-zero means
    the aggregation refused the bad signature, which is what a correct build must do.

    Measured at a210ef1b with the patch applied: clean run exits 0, ETHPLANE_CORRUPT_INDEX=0 and
    =899 both exit 101. The patch corrupts on the way OUT of get_signers rather than at generation,
    so the on-disk signer cache stays valid and a probe costs one aggregation (~15 s) instead of
    regenerating 900 keys (~28 s). Corrupting at generation also silently does NOTHING when the
    cache is warm, which would have made every probe read as probe-invalid."""
    env = dict(os.environ)
    env["ETHPLANE_CORRUPT_INDEX"] = str(index)
    try:
        r = subprocess.run(
            pinned_command(worktree), capture_output=True, text=True, timeout=RUN_TIMEOUT_SECONDS, env=env
        )
        return r.returncode
    except subprocess.TimeoutExpired:
        return 124


def probe_indices(reaches_target: bool, total: int = 900) -> list:
    """(h) Probe budget by payout: three for any pass — first, last and one the submitter cannot
    predict — and every index when the release would reach targetGainBps. A submission that skips
    one signature is caught deterministically by the full sweep and probabilistically by the three."""
    if reaches_target:
        return list(range(total))
    return [0, total - 1, random.randrange(1, total - 1)]


def statement_probe(reference_wt: str, submission_wt: str, index: int) -> Tuple[bool, str]:
    """Differential: the REFERENCE must reject the corrupted signature (or the probe itself is
    broken and proves nothing), and then the SUBMISSION must reject it too."""
    if run_with_corrupt_index(reference_wt, index) == 0:
        return False, "probe-invalid"
    if run_with_corrupt_index(submission_wt, index) == 0:
        return False, "statement-skip"
    return True, ""


def emit(v: Dict[str, object]) -> None:
    print(json.dumps(v, indent=2))


def run_self_test() -> None:
    parsed = parse_output(
        "cycles (VM steps): 1,542,812\n  proving time: 1.433 s\n  proof size: 295.5 KiB\n  verifying: 0.0301 s\n"
    )
    print(json.dumps(parsed, indent=2))
    if parsed.get("cycles") != BASELINE_CYCLES:
        raise ValueError(f"expected {BASELINE_CYCLES} cycles, parsed {parsed.get('cycles')}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify a leanVM submission against the pinned criterion")
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--reaches-target", action="store_true", help="run the full 900-probe sweep")
    parser.add_argument("artifact_tarball", nargs="?")
    parser.add_argument("reference_leanvm", nargs="?", default=REFERENCE_LEANVM_PATH)
    parser.add_argument("baseline_json", nargs="?")
    args = parser.parse_args()

    if args.self_test:
        run_self_test()
        return
    if not args.artifact_tarball:
        emit(verdict(reason="no-artifact"))
        return

    baseline = {
        "cycles": BASELINE_CYCLES,
        "provingMicros": BASELINE_PROVING_MICROS,
        "proofSizeBytes": BASELINE_PROOF_SIZE_BYTES,
        "verifyMicros": BASELINE_VERIFY_MICROS,
    }
    spread = BASELINE_SPREAD_BPS
    if args.baseline_json and os.path.exists(args.baseline_json):
        with open(args.baseline_json) as f:
            loaded = json.load(f)
        baseline.update({k: loaded[k] for k in baseline if k in loaded})
        spread = loaded.get("spreadBps", spread)

    reference = args.reference_leanvm
    with tempfile.TemporaryDirectory() as temp_dir:
        payload = os.path.join(temp_dir, "payload")
        os.makedirs(payload)
        ok, reason = extract_tarball(args.artifact_tarball, payload)
        if not ok:
            emit(verdict(reason=reason))
            return

        files = [
            os.path.relpath(os.path.join(root, f), payload)
            for root, _, fs in os.walk(payload) for f in fs
        ]
        ok, reason = validate_paths(files)
        if not ok:
            emit(verdict(reason=reason))
            return

        submission_wt = os.path.join(temp_dir, "submission")
        reference_wt = os.path.join(temp_dir, "reference")
        created = []
        try:
            for wt in (submission_wt, reference_wt):
                ok, reason = make_worktree(reference, wt)
                if not ok:
                    emit(verdict(reason=reason))
                    return
                created.append(wt)

            reference_hash = None
            if build(reference_wt)[0]:
                reference_hash = get_binary_hash(reference_wt)

            for rel in files:
                dest = os.path.join(submission_wt, rel)
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                shutil.copy2(os.path.join(payload, rel), dest)

            ok, reason = build(submission_wt)
            if not ok:
                emit(verdict(reason=reason))
                return

            binary_hash = get_binary_hash(submission_wt)
            if files and reference_hash and binary_hash == reference_hash:
                emit(verdict(reason="stale-binary", binary_sha256=binary_hash))
                return

            measured, reason = measure(submission_wt)
            if reason:
                emit(verdict(reason=reason, binary_sha256=binary_hash))
                return

            reason = check_non_regression(measured, baseline, spread)
            if reason:
                emit(verdict(**measured, verifier_accepted=False, reason=reason, binary_sha256=binary_hash))
                return

            accepted, reason = run_reference_verifier(submission_wt)
            if not accepted:
                emit(verdict(**measured, verifier_accepted=False, reason=reason, binary_sha256=binary_hash))
                return

            # (h) statement check, in the reference worktree the submission cannot reach
            patched, reason = apply_corrupt_patch(reference_wt)
            if not patched:
                emit(verdict(**measured, verifier_accepted=False, reason=reason, binary_sha256=binary_hash))
                return
            if not apply_corrupt_patch(submission_wt)[0] or not build(reference_wt)[0] or not build(submission_wt)[0]:
                emit(verdict(**measured, verifier_accepted=False, reason="probe-build", binary_sha256=binary_hash))
                return
            for index in probe_indices(args.reaches_target):
                ok, reason = statement_probe(reference_wt, submission_wt, index)
                if not ok:
                    emit(verdict(**measured, verifier_accepted=False, reason=reason, binary_sha256=binary_hash))
                    return

            emit(verdict(**measured, verifier_accepted=True, reason="", binary_sha256=binary_hash))
        finally:
            for wt in created:
                subprocess.run(["git", "worktree", "remove", "--force", wt], cwd=reference, check=False,
                               capture_output=True)


if __name__ == "__main__":
    main()
