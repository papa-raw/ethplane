#!/usr/bin/env python3
"""The verifier's watcher: find submissions nobody has judged, judge them, record the verdict.

It is deliberately dull. The interesting decisions all live in run.py; this file only has to be
honest about three things:

  * one artifact at a time. Each submission is fetched, verified and recorded before the next one
    is looked at, so a 900-probe sweep never overlaps another run on the same cores and the
    measurement means what the criterion says it means.
  * a hash is checked, not trusted. The store is content-addressed, so bytes that do not hash to
    the name they were fetched under are a mismatch, and a mismatch is not measured.
  * the ledger is written after the verdict is sent, never before. A crash between the two costs a
    repeat, and a repeat is refused by the contract (NotPending); the other order would silently
    drop a submission nobody ever judges.

The wallet helpers are duplicated from swarm/client.py on purpose: the verifier does not import the
submitter's code. That is the same boundary as the frozen paths, expressed in the import graph.

Environment: VERIFIER_KEY_FILE (or VERIFIER_KEYSTORE [+ VERIFIER_KEYSTORE_PASSWORD_FILE]),
API_BASE, NODE_ID, LEANVM_REF, REFERENCE_COMMIT, ETHPLANE_ADDRESS, SEPOLIA_RPC_URL.

Usage: watch.py [--once] [--dry-run] [--interval 30]
"""
import argparse
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

CAST_TIMEOUT_SECONDS = 300
WATCHED_FILE = os.environ.get("WATCHED_FILE", ".watched")
RECORD_MEASUREMENT = (
    "recordMeasurement(bytes32,bytes32,uint256,uint256,uint256,uint256,bool,bytes32)"
)

REQUIRED_VARS = (
    "API_BASE",
    "NODE_ID",
    "LEANVM_REF",
    "REFERENCE_COMMIT",
    "ETHPLANE_ADDRESS",
    "SEPOLIA_RPC_URL",
)


def get_env_vars() -> dict:
    """Required variables, plus the wallet, which may be a key file or a keystore."""
    env = {}
    for var in REQUIRED_VARS:
        if var not in os.environ:
            raise ValueError(f"Missing required environment variable: {var}")
        env[var] = os.environ[var]
    if "VERIFIER_KEY_FILE" not in os.environ and "VERIFIER_KEYSTORE" not in os.environ:
        raise ValueError("Missing required environment variable: VERIFIER_KEY_FILE (or VERIFIER_KEYSTORE)")
    if "VERIFIER_KEY_FILE" in os.environ:
        env["VERIFIER_KEY_FILE"] = os.environ["VERIFIER_KEY_FILE"]
    return env


def wallet_args(role: str = "VERIFIER"):
    """(real_args, printable_args). The printable form never carries key material."""
    keystore = os.environ.get(f"{role}_KEYSTORE")
    if keystore:
        args = ["--keystore", keystore]
        password_file = os.environ.get(f"{role}_KEYSTORE_PASSWORD_FILE")
        if password_file:
            args += ["--password-file", password_file]
        return args, list(args)

    key_file = os.environ.get(f"{role}_KEY_FILE")
    if not key_file:
        raise ValueError(f"Missing required environment variable: {role}_KEY_FILE (or {role}_KEYSTORE)")
    if not os.path.exists(key_file):
        raise ValueError(f"{role}_KEY_FILE does not exist: {key_file}")
    with open(key_file) as f:
        key = f.read().strip()
    if not key:
        raise ValueError(f"{role}_KEY_FILE is empty: {key_file}")
    return ["--private-key", key], ["--private-key", f'"$(cat ${role}_KEY_FILE)"']


def redact(text: str, args) -> str:
    if "--private-key" in args:
        key = args[args.index("--private-key") + 1]
        return text.replace(key, "<private key>")
    return text


def get_json(url: str):
    with urllib.request.urlopen(url, timeout=60) as response:
        return json.loads(response.read().decode())


def node_detail(api_base: str, node_id: str) -> dict:
    return get_json(f"{api_base}/api/nodes/{node_id}")


def pending_submissions(detail: dict, watched: set) -> list:
    """A submission is pending when the chain has no verdict for it. The API has no `status`
    column — it has submissions and verdicts, and PENDING is the absence of the second, which is
    also exactly what `recordMeasurement` will accept."""
    judged = {v.get("artifact_hash") for v in detail.get("verdicts", []) if v.get("artifact_hash")}
    out = []
    for submission in detail.get("submissions", []):
        artifact_hash = submission.get("artifact_hash")
        if not artifact_hash or artifact_hash in judged or artifact_hash in watched:
            continue
        out.append(submission)
    return out


def fetch_artifact(api_base: str, artifact_hash: str) -> str:
    """Fetch to a temporary file and check the bytes hash to the name they were fetched under."""
    url = f"{api_base}/api/artifacts/{artifact_hash}"
    with urllib.request.urlopen(url, timeout=300) as response:
        body = response.read()
    digest = "0x" + hashlib.sha256(body).hexdigest()
    if digest.lower() != artifact_hash.lower():
        raise RuntimeError(f"artifact hash mismatch: asked for {artifact_hash}, got {digest}")
    handle = tempfile.NamedTemporaryFile(mode="wb", suffix=".tar.gz", delete=False)
    handle.write(body)
    handle.close()
    return handle.name


def run_verifier(tarball_path: str) -> dict:
    """run.py always answers with a verdict; a non-zero exit or unparseable output is an outage on
    this host, not a verdict about the submission, and it is raised rather than recorded."""
    env = get_env_vars()
    run_py = os.path.join(os.path.dirname(os.path.abspath(__file__)), "run.py")
    child_env = os.environ.copy()
    child_env["LEANVM_REF"] = env["LEANVM_REF"]
    child_env["LEANVM_COMMIT"] = env["REFERENCE_COMMIT"]
    child_env["REFERENCE_COMMIT"] = env["REFERENCE_COMMIT"]
    result = subprocess.run([sys.executable, run_py, tarball_path],
                            capture_output=True, text=True, env=child_env)
    if result.returncode != 0:
        raise RuntimeError(f"Verifier failed: {result.stderr.strip()[:500]}")
    try:
        return json.loads(result.stdout.strip())
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Failed to parse verdict JSON: {e}; output was {result.stdout[:200]!r}")


def evidence_hash(verdict: dict) -> str:
    return "0x" + hashlib.sha256(json.dumps(verdict, sort_keys=True).encode()).hexdigest()


def measurement_args(node_id: str, artifact_hash: str, verdict: dict) -> list:
    """The call, without the wallet: node, artifact, the four numbers, the flag, the evidence.

    A rejection carries no measurement, so its numbers are zero — and zero cycles with
    verifierAccepted true would be a pass at no cost, so that combination is refused here rather
    than left to the contract's own ordering to make harmless."""
    accepted = bool(verdict.get("verifierAccepted", False))
    cycles = verdict.get("cycles") or 0
    if accepted and cycles <= 0:
        raise RuntimeError("refusing to record an accepted measurement with no cycle count")
    return [
        node_id,
        artifact_hash,
        str(cycles),
        str(verdict.get("provingMicros") or 0),
        str(verdict.get("proofSizeBytes") or 0),
        str(verdict.get("verifyMicros") or 0),
        "true" if accepted else "false",
        evidence_hash(verdict),
    ]


def record_measurement(node_id: str, artifact_hash: str, verdict: dict, dry_run: bool = False):
    """Send the verdict, or print the line that would send it. Returns the transaction hash."""
    env = get_env_vars()
    args, printable = wallet_args("VERIFIER")
    call = [env["ETHPLANE_ADDRESS"], RECORD_MEASUREMENT] + measurement_args(node_id, artifact_hash, verdict)
    rpc = ["--rpc-url", env["SEPOLIA_RPC_URL"]]
    if dry_run:
        print("cast send " + " ".join(call + printable + rpc))
        return None
    result = subprocess.run(["cast", "send"] + call + args + rpc,
                            capture_output=True, text=True, timeout=CAST_TIMEOUT_SECONDS)
    if result.returncode != 0:
        raise RuntimeError(f"cast send failed: {redact(result.stderr.strip(), args)}")
    for line in result.stdout.splitlines():
        if line.lower().startswith("transactionhash"):
            return line.split()[-1]
    return result.stdout.strip()


def read_watched(path: Path) -> set:
    if not path.exists():
        return set()
    with open(path) as f:
        return {line.strip() for line in f if line.strip()}


def append_watched(path: Path, artifact_hash: str) -> None:
    with open(path, "a") as f:
        f.write(f"{artifact_hash}\n")


def process_one(env: dict, submission: dict, watched_file: Path, dry_run: bool) -> bool:
    """One submission, start to finish. Returns True if a verdict was recorded."""
    artifact_hash = submission.get("artifact_hash")
    print(f"verifying {artifact_hash}")
    tarball_path = None
    try:
        tarball_path = fetch_artifact(env["API_BASE"], artifact_hash)
        verdict = run_verifier(tarball_path)
        print(json.dumps(verdict))
        tx = record_measurement(env["NODE_ID"], artifact_hash, verdict, dry_run)
        if not dry_run:
            append_watched(watched_file, artifact_hash)
            print(f"recorded {artifact_hash} in {tx}")
        return True
    except Exception as e:
        print(f"Error processing submission {artifact_hash}: {e}")
        return False
    finally:
        if tarball_path and os.path.exists(tarball_path):
            os.unlink(tarball_path)


def main() -> int:
    parser = argparse.ArgumentParser(description="Verifier watcher for ethplane")
    parser.add_argument("--dry-run", action="store_true", help="Print the cast line instead of sending it")
    parser.add_argument("--once", action="store_true", help="One pass, then exit")
    parser.add_argument("--interval", type=int, default=30, help="Seconds between passes")
    args = parser.parse_args()

    try:
        env = get_env_vars()
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1

    watched_file = Path(WATCHED_FILE)
    while True:
        try:
            detail = node_detail(env["API_BASE"], env["NODE_ID"])
            pending = pending_submissions(detail, read_watched(watched_file))
            print(f"{len(pending)} submission(s) with no verdict")
            for submission in pending:
                process_one(env, submission, watched_file, args.dry_run)
        except KeyboardInterrupt:
            return 0
        except Exception as e:
            print(f"Error in watcher: {e}")
        if args.once:
            return 0
        time.sleep(args.interval)


if __name__ == "__main__":
    sys.exit(main())
