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
        run.py --baseline [reference_leanvm]   measure the reference and print recordBaseline
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
REFERENCE_COMMIT = os.environ.get("LEANVM_COMMIT", os.environ.get("REFERENCE_COMMIT", "a210ef1b"))
BASELINE_CYCLES = 1542812
BASELINE_PROVING_MICROS = 1433000
BASELINE_PROOF_SIZE_BYTES = 302592
BASELINE_VERIFY_MICROS = 30100
BASELINE_SPREAD_BPS = 190
# The live node's release parameters, as defined on chain (defineNode: targetGainBps 1000,
# thresholdBps 100). They are constants here for the same reason the baseline numbers are: the
# verifier must be able to price a release without asking the caller. --baseline-json or the
# environment overrides them for a node with different parameters.
TARGET_GAIN_BPS = int(os.environ.get("ETHPLANE_TARGET_GAIN_BPS", "1000"))
PAID_GAIN_BPS = int(os.environ.get("ETHPLANE_PAID_GAIN_BPS", "0"))

RUN_TIMEOUT_SECONDS = 600
BUILD_TIMEOUT_SECONDS = 1800
BASELINE_RUNS = 3
# The editable surface is per node, and it is a security decision, not a preference.
#
# `cargo build --release` and the reference harness's `cargo test` both compile the submission's
# workspace, and Rust runs build.rs and procedural macros AT COMPILE TIME as the invoking user. So a
# surface that admits any Rust is arbitrary code execution as whoever runs this file — and on hawk
# that user holds VERIFIER_PRIVATE_KEY. That is why node 1 (pq-leanxmss) admits only
# crates/rec_aggregation/guests/: zkDSL text compiled by the frozen compiler, no Rust from the
# submitter, and the class disappears rather than being watched for.
#
# Node 2 (dl-leanvm) needs the compiler editable — sixteen guest-only measurements on 2026-09-09 all
# returned exactly 1,542,812 cycles, while the overnight arms that edited crates/lean_compiler moved
# it — so EDITABLE names the surface per node. When that surface admits Rust, two things become
# required rather than advisable: the build runs `--offline --locked`, and it runs as a user that
# cannot read the verifier's key (BUILD_USER). See build_isolation_reason().
DEFAULT_EDITABLE_PREFIXES = ("crates/rec_aggregation/guests/",)
GUEST_PREFIX = "crates/rec_aggregation/guests/"


def editable_prefixes() -> Tuple[str, ...]:
    """The paths a submission for THIS node may touch, from EDITABLE (comma or space separated).

    swarm/client.py reads the same variable to decide what to put in the artifact, so the worker and
    the verifier cannot disagree about the surface unless the two hosts are configured differently."""
    raw = os.environ.get("EDITABLE", "")
    parts = tuple(p.strip() for p in raw.replace(",", " ").split() if p.strip())
    return parts or DEFAULT_EDITABLE_PREFIXES


def frozen_hint() -> str:
    return "only " + ", ".join(editable_prefixes()) + " may change"


def surface_admits_rust(prefixes: Optional[Tuple[str, ...]] = None) -> bool:
    """True when the surface reaches outside the guest program, which is where Rust lives.

    Conservative on purpose: anything that is not under the guest directory is treated as possibly
    compiled, because being wrong in the other direction means running a submitter's build.rs."""
    for prefix in prefixes if prefixes is not None else editable_prefixes():
        if not os.path.normpath(prefix).startswith(os.path.normpath(GUEST_PREFIX)):
            return True
    return False


def build_user() -> str:
    """The unprivileged user that compiles a submission when the surface admits Rust."""
    return os.environ.get("BUILD_USER", "").strip()


def build_isolation_reason() -> str:
    """"" when it is safe to compile this surface here, or the reason it is not.

    The question is concrete and it is asked of the system rather than of a flag: can the user that
    will run cargo read the verifier's key? If BUILD_USER is set, that is answered by trying the
    read as that user. If it is not set, cargo runs as this process's own user, which on hawk is the
    user holding the key — so the answer is yes and the surface is refused.

    ALLOW_UNSANDBOXED_BUILD=1 overrides it. That is a deliberate, named act; leaving EDITABLE set by
    accident is not."""
    if not surface_admits_rust():
        return ""
    if os.environ.get("ALLOW_UNSANDBOXED_BUILD") == "1":
        print("WARNING: compiling a submitter's Rust as this user, with ALLOW_UNSANDBOXED_BUILD=1. "
              "build.rs and proc macros run with this process's privileges.", file=sys.stderr)
        return ""
    user = build_user()
    if not user:
        return "host-config"
    key_file = os.environ.get("VERIFIER_KEY_FILE", "")
    if not key_file:
        # Nothing to check against, so nothing is established. Fail closed.
        return "host-config"
    readable = subprocess.run(["sudo", "-n", "-u", user, "test", "-r", key_file],
                              capture_output=True, text=True)
    # returncode 0 means the build user CAN read the key: not isolation, just a different name.
    return "host-config" if readable.returncode == 0 else ""


def cargo_prefix() -> list:
    """Run cargo as BUILD_USER when one is configured, otherwise as this user.

    sudo clears the environment, and BUILD_USER cannot read the verifier's toolchain (that is the
    point of it), so the build's CARGO_HOME and RUSTUP_HOME are named explicitly and passed through
    `env`. verifier/host-setup-build-user.sh creates them and prints the two values."""
    user = build_user()
    if not user:
        return []
    prefix = ["sudo", "-n", "-u", user]
    cargo_home = os.environ.get("BUILD_CARGO_HOME", "").strip()
    rustup_home = os.environ.get("BUILD_RUSTUP_HOME", "").strip()
    if not cargo_home and not rustup_home:
        return prefix
    pairs = []
    if cargo_home:
        pairs.append(f"CARGO_HOME={cargo_home}")
        pairs.append(f"PATH={os.path.join(cargo_home, 'bin')}:/usr/local/bin:/usr/bin:/bin")
    if rustup_home:
        pairs.append(f"RUSTUP_HOME={rustup_home}")
    return prefix + ["env"] + pairs


def build_group() -> str:
    """The group both users are in. Defaults to the build user's own name, which is what the setup
    script creates."""
    return os.environ.get("BUILD_GROUP", build_user()).strip()


def share_with_build_user(path: str) -> Tuple[bool, str]:
    """Let BUILD_USER's cargo write inside a directory this user owns.

    A worktree is created by the verifier user under a temp directory that is 0700 by default, so
    the build user cannot even traverse it, and `cargo build` would fail with a permission error
    that reads as `build` — a verdict against a submission for something it did not do. setgid plus
    group-write is the smallest thing that works: cargo creates target/ inside, and the group is
    carried down to whatever it creates.

    Failing to share is `host-config`, never a verdict about the submission."""
    if not build_user():
        return True, ""
    group = build_group()
    try:
        shutil.chown(path, group=group)
        os.chmod(path, 0o2770)
    except (LookupError, PermissionError, OSError):
        return False, "host-config"
    return True, ""


def cargo_flags() -> list:
    """--offline --locked whenever the submitter can write Rust: no dependency the lockfile does not
    already pin, and no fetch during a build that is running their code."""
    return ["--offline", "--locked"] if surface_admits_rust() else []

VERDICT_KEYS = (
    "cycles", "provingMicros", "proofSizeBytes", "verifyMicros", "verifierAccepted", "reason", "binarySha256",
)


def running_as_root() -> bool:
    return hasattr(os, "geteuid") and os.geteuid() == 0


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
    two places deciding it is one place too many.

    The four measurements are integers here whatever arrives: they become uint256 arguments, and
    cast refuses a decimal point (`expected at most 0 decimals`). The parser already returns ints;
    this is the boundary that has to be true even if it stops."""
    whole = lambda v: None if v is None else int(round(float(v)))
    return {
        "cycles": whole(cycles),
        "provingMicros": whole(provingMicros),
        "proofSizeBytes": whole(proofSizeBytes),
        "verifyMicros": whole(verifyMicros),
        "verifierAccepted": verifier_accepted,
        "reason": reason,
        "binarySha256": binary_sha256,
    }


def validate_paths(diff_files) -> Tuple[bool, str]:
    """The frozen-path check: a submission may only touch this node's editable surface.

    Archive safety is NOT this function's job — extract_tarball's filter='data' refuses absolute
    paths, escapes and symlinks before anything reaches here. So a path that normalises outside the
    tree is simply a path outside the editable set, and the reason is frozen-path (which is what
    swarm B's test_normpath expects, and it is the more useful answer for a submitter)."""
    for f in diff_files:
        norm = os.path.normpath(f)
        if not norm.startswith(editable_prefixes()):
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
    whatever the reference checkout happens to be on, which is not the criterion.

    A reference checkout that is not there at all is `host-config`, not `worktree`: the module's
    first rule is that every path returns a reason rather than an exception, and running with
    LEANVM_REF pointing at nothing used to raise FileNotFoundError out of subprocess — which
    reaches watch.py as an outage rather than as anything anyone can act on."""
    if not os.path.isdir(reference):
        return False, "host-config"
    try:
        r = subprocess.run(
            ["git", "worktree", "add", "--detach", dest, commit],
            cwd=reference, capture_output=True, text=True,
        )
    except OSError:
        return False, "host-config"
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
        cargo_prefix() + ["cargo", "build", "--release"] + cargo_flags(),
        cwd=worktree, capture_output=True, text=True, timeout=BUILD_TIMEOUT_SECONDS
    )
    return (r.returncode == 0, "" if r.returncode == 0 else "build")


def verifier_cores() -> str:
    """The core list to pin measurements to, or "" for no pinning, which is the default.

    A timing baseline and the submission that is judged against it must be measured the same way.
    The version this replaces pinned `taskset -c 0-7` unconditionally while the node's recorded
    baseline had been measured on all 26 cores of the host — so a correct submission came back
    `regression-provingMicros` at 3.74 s against a 1.43 s bound, purely because it was given eight
    cores and the bound was not. Not pinning by default means the two agree; VERIFIER_CORES pins
    both when a host needs isolation. (VERIFIER_CPUS is the old name, honoured only when set
    explicitly, never as a default.)"""
    return os.environ.get("VERIFIER_CORES", os.environ.get("VERIFIER_CPUS", "")).strip()


def pinned_command(worktree: str) -> list:
    """The criterion's command line, run as the built binary, on the cores the host asked for."""
    cores = verifier_cores()
    prefix = ["taskset", "-c", cores] if cores else []
    return prefix + [
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


def measure_repeatedly(worktree: str, runs: int = BASELINE_RUNS):
    """Run the pinned command `runs` times and return every measurement, or a reason."""
    measurements = []
    for _ in range(runs):
        measured, reason = measure(worktree)
        if reason:
            return None, reason
        measurements.append(measured)
    return measurements, ""


def summarise_baseline(measurements) -> Tuple[Optional[Dict[str, int]], str]:
    """Mean timings, and a spread taken from the runs rather than assumed.

    Cycles are deterministic for a given program and input, so three runs that disagree on cycles
    mean the measurement is not measuring what the criterion says — that is a reason, not a number
    to average. spreadBps is the full range of proving time over its mean, rounded up, which is the
    allowance the contract then gives every submission judged against this baseline."""
    if not measurements:
        return None, "parse"
    cycles = {m["cycles"] for m in measurements}
    if len(cycles) != 1:
        return None, "nondeterministic-cycles"
    proving = [m["provingMicros"] for m in measurements]
    mean_proving = sum(proving) // len(proving)
    if mean_proving <= 0:
        return None, "parse"
    spread_bps = -((min(proving) - max(proving)) * 10000 // mean_proving)  # ceiling of the range
    return {
        "cycles": measurements[0]["cycles"],
        "provingMicros": mean_proving,
        "proofSizeBytes": max(m["proofSizeBytes"] for m in measurements),
        "verifyMicros": sum(m["verifyMicros"] for m in measurements) // len(measurements),
        "spreadBps": int(spread_bps),
        "runs": len(measurements),
    }, ""


def record_baseline_command(baseline: Dict[str, int]) -> str:
    """The cast line that puts this baseline on chain, with the environment's own names where the
    values are secrets or deployment details. Printed, never sent: the verifier key lives on the
    host, and this file has no business holding it."""
    contract = os.environ.get("ETHPLANE_ADDRESS", "$ETHPLANE_ADDRESS")
    node = os.environ.get("NODE_ID", "$NODE_ID")
    rpc = os.environ.get("SEPOLIA_RPC_URL", "$SEPOLIA_RPC_URL")
    return (
        f"cast send {contract} "
        f"'recordBaseline(bytes32,uint256,uint256,uint256,uint256,uint16)' "
        f"{node} {baseline['cycles']} {baseline['provingMicros']} {baseline['proofSizeBytes']} "
        f"{baseline['verifyMicros']} {baseline['spreadBps']} "
        f"--private-key \"$(cat $VERIFIER_KEY_FILE)\" --rpc-url {rpc}"
    )


def run_baseline(reference: str) -> int:
    """Measure the REFERENCE at the pinned commit, the same way a submission is measured.

    A node's baseline has to come from the verifier's own procedure on the verifier's own host. The
    PoC node's did not — it was measured on all cores by a different process than the one that
    later judged against it — and that mismatch is exactly what `--baseline` exists to prevent for
    the next node."""
    if running_as_root():
        print(json.dumps({"error": "host-config",
                          "detail": "run as the verifier user, not root: git refuses a worktree "
                                    "in another user's checkout (dubious ownership)"}, indent=2))
        return 1
    if not os.path.isdir(reference):
        print(json.dumps({"error": "host-config",
                          "detail": f"no reference checkout at {reference}; pass one as the first "
                                    f"argument or set LEANVM_REF"}, indent=2))
        return 1
    with tempfile.TemporaryDirectory() as temp_dir:
        ok, reason = share_with_build_user(temp_dir)
        if not ok:
            print(json.dumps({"error": reason, "detail": "BUILD_USER is set but the worktree "
                                                         "cannot be shared with it"}, indent=2))
            return 1
        worktree = os.path.join(temp_dir, "reference")
        ok, reason = make_worktree(reference, worktree)
        if not ok:
            print(json.dumps({"error": reason}, indent=2))
            return 1
        ok, reason = share_with_build_user(worktree)
        if not ok:
            print(json.dumps({"error": reason}, indent=2))
            return 1
        try:
            ok, reason = build(worktree)
            if not ok:
                print(json.dumps({"error": "reference-build"}, indent=2))
                return 1
            measurements, reason = measure_repeatedly(worktree)
            if reason:
                print(json.dumps({"error": reason}, indent=2))
                return 1
            baseline, reason = summarise_baseline(measurements)
            if reason:
                print(json.dumps({"error": reason, "runs": measurements}, indent=2))
                return 1
            baseline["cores"] = verifier_cores() or "all (no pinning)"
            baseline["commit"] = REFERENCE_COMMIT
            baseline["binarySha256"] = get_binary_hash(worktree)
            baseline["runsDetail"] = measurements
            print(json.dumps(baseline, indent=2))
            print()
            print(record_baseline_command(baseline))
            return 0
        finally:
            subprocess.run(["git", "worktree", "remove", "--force", worktree], cwd=reference,
                           check=False, capture_output=True)


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


def python312_prefix() -> Tuple[bool, str]:
    """R2. verifier.py uses PEP 695 `type` aliases and needs 3.12+; hawk's default python3 is 3.10.
    The version this replaces ran the harness anyway and the SyntaxError came back as
    `verifier-rejected` — blaming the submission for the host's configuration. A missing interpreter
    is now `host-config`, which is nobody's verdict and everybody's signal to fix the box.

    Returns (ok, directory to put first on PATH). An empty directory means the default python3 is
    already 3.12+, so nothing needs prepending."""
    py312 = shutil.which("python3.12")
    if py312:
        return True, os.path.dirname(py312)
    default = shutil.which("python3")
    if default:
        r = subprocess.run([default, "-c", "import sys; print(sys.version_info >= (3, 12))"],
                           capture_output=True, text=True)
        if r.returncode == 0 and r.stdout.strip() == "True":
            return True, ""
    return False, ""


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
    ok, prefix = python312_prefix()
    if not ok:
        return False, "host-config"
    env = dict(os.environ)
    if prefix:
        env["PATH"] = prefix + os.pathsep + env.get("PATH", "")
    try:
        r = subprocess.run(
            cargo_prefix() + ["cargo", "test", "--release"] + cargo_flags()
            + ["-p", "lean_vm", "--test", "verifiers", "--", "--include-ignored", "python_verifier"],
            cwd=worktree, capture_output=True, text=True, timeout=RUN_TIMEOUT_SECONDS, env=env,
        )
    except subprocess.TimeoutExpired:
        return False, "verifier-timeout"
    return (True, "") if r.returncode == 0 else (False, "verifier-rejected")


def run_with_corrupt_index(worktree: str, index: int) -> Optional[int]:
    """Run the pinned command with one signature corrupted. Returns the exit code, or None if the
    run timed out. Non-zero means the aggregation refused the bad signature, which is what a correct
    build must do.

    R1. None, not 124: the version this replaces returned 124 on timeout and the caller tested only
    `== 0`, so a submission that HUNG on corrupted input read as "correctly rejected" on every probe
    including the full sweep — and a reference leg that hung read as "the probe is valid". A timeout
    is the absence of an answer, and it must not share a value with an answer, because 124 is also
    an exit code a process can return on its own.

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
        return None


def releases_full_target(
    cycles: Optional[int], original_metric: int, target_gain_bps: int, paid_gain_bps: int
) -> bool:
    """R4. The probe budget follows the money, and it is computed HERE from the measurement rather
    than passed in by whoever invoked the verifier — a `--reaches-target` flag makes the strength of
    the check depend on the orchestration layer remembering to set it.

    The arithmetic is the contract's own (Ethplane.sol `_release`): cumulative gain against the
    ORIGINAL baseline, capped at the target, paid only for the part beyond what has already been
    paid. A submission is swept at all 900 indices when it both pays and takes the node all the way
    to its target gain — the point at which the last of the escrow is released. Everything else gets
    the three fixed probes.

    Unknown parameters mean the release cannot be priced, and an unpriced release is swept: the
    expensive direction is the safe one."""
    if original_metric <= 0 or target_gain_bps <= 0:
        return True
    if cycles is None or cycles >= original_metric:
        return False
    gain_bps = (original_metric - cycles) * 10000 // original_metric
    capped = min(gain_bps, target_gain_bps)
    if capped <= paid_gain_bps:
        return False
    return capped >= target_gain_bps


def probe_indices(reaches_target: bool, total: int = 900) -> list:
    """(h) Probe budget by payout: three for any pass — first, last and one the submitter cannot
    predict — and every index when the release would reach targetGainBps. A submission that skips
    one signature is caught deterministically by the full sweep and probabilistically by the three."""
    if reaches_target:
        return list(range(total))
    return [0, total - 1, random.randrange(1, total - 1)]


def statement_probe(reference_wt: str, submission_wt: str, index: int) -> Tuple[bool, str]:
    """Differential: the REFERENCE must reject the corrupted signature (or the probe itself is
    broken and proves nothing), and then the SUBMISSION must reject it too.

    R1. A timeout on either leg is `probe-timeout` and the verdict is not accepted — never
    `statement-skip`, because a slow submission is not a cheating one, and never a pass, because a
    run that did not finish established nothing."""
    reference_code = run_with_corrupt_index(reference_wt, index)
    if reference_code is None:
        return False, "probe-timeout"
    if reference_code == 0:
        return False, "probe-invalid"
    submission_code = run_with_corrupt_index(submission_wt, index)
    if submission_code is None:
        return False, "probe-timeout"
    if submission_code == 0:
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
    parser.add_argument("--baseline", action="store_true",
                        help="measure the reference at the pinned commit and print recordBaseline")
    parser.add_argument("artifact_tarball", nargs="?")
    parser.add_argument("reference_leanvm", nargs="?", default=REFERENCE_LEANVM_PATH)
    parser.add_argument("baseline_json", nargs="?")
    args = parser.parse_args()

    if args.self_test:
        run_self_test()
        return
    if args.baseline:
        # `run.py --baseline /path/to/leanVM` puts the path in the first positional, which is
        # normally the artifact; a directory there is the reference checkout, not a tarball.
        given = args.artifact_tarball or args.reference_leanvm
        sys.exit(run_baseline(given))
    if running_as_root():
        # The host, not the submission. Running as root over another user's checkout made git refuse
        # the worktree ("dubious ownership"), and that reason was recorded on chain as a FAIL
        # against two artifacts that had done nothing wrong.
        emit(verdict(reason="host-config"))
        return
    reason = build_isolation_reason()
    if reason:
        # EDITABLE admits Rust and this host cannot compile it safely. Refusing is the only honest
        # answer: measuring would mean running the submitter's build.rs as the key holder, and the
        # submission has done nothing wrong, so the reason names the host.
        print(f"EDITABLE admits Rust ({', '.join(editable_prefixes())}) but the build is not "
              f"isolated: set BUILD_USER to a user that cannot read $VERIFIER_KEY_FILE, or "
              f"ALLOW_UNSANDBOXED_BUILD=1 to accept the risk deliberately.", file=sys.stderr)
        emit(verdict(reason=reason))
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
    # The node's release parameters. originalMetric is the baseline recorded on chain, which for
    # this node is the same number the criterion pins.
    original_metric = BASELINE_CYCLES
    target_gain_bps = TARGET_GAIN_BPS
    paid_gain_bps = PAID_GAIN_BPS
    if args.baseline_json and os.path.exists(args.baseline_json):
        with open(args.baseline_json) as f:
            loaded = json.load(f)
        baseline.update({k: loaded[k] for k in baseline if k in loaded})
        spread = loaded.get("spreadBps", spread)
        original_metric = loaded.get("originalMetric", loaded.get("cycles", original_metric))
        target_gain_bps = loaded.get("targetGainBps", target_gain_bps)
        paid_gain_bps = loaded.get("paidGainBps", paid_gain_bps)

    reference = args.reference_leanvm
    with tempfile.TemporaryDirectory() as temp_dir:
        ok, reason = share_with_build_user(temp_dir)
        if not ok:
            emit(verdict(reason=reason))
            return
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
                ok, reason = share_with_build_user(wt)
                if not ok:
                    emit(verdict(reason=reason))
                    return

            # R3. A reference build that fails aborts the verification. The version this replaces
            # left reference_hash = None and the stale-binary comparison below guarded on it, so the
            # one check whose whole purpose is catching a build that did not take was silently
            # disabled by a build that did not take.
            ok, _ = build(reference_wt)
            if not ok:
                emit(verdict(reason="reference-build"))
                return
            reference_hash = get_binary_hash(reference_wt)
            if reference_hash is None:
                emit(verdict(reason="reference-build"))
                return

            for rel in files:
                dest = os.path.join(submission_wt, rel)
                os.makedirs(os.path.dirname(dest), exist_ok=True)
                shutil.copy2(os.path.join(payload, rel), dest)

            ok, reason = build(submission_wt)
            if not ok:
                emit(verdict(reason=reason))
                return

            binary_hash = get_binary_hash(submission_wt)
            if binary_hash is None:
                emit(verdict(reason="binary-missing"))
                return
            # No `if files` guard: an artifact that changed nothing produces the reference binary,
            # and stale-binary is the honest reason for it.
            if binary_hash == reference_hash:
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
            sweep = releases_full_target(
                measured.get("cycles"), original_metric, target_gain_bps, paid_gain_bps
            )
            for index in probe_indices(sweep):
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
