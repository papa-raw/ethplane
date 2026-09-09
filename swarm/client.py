#!/usr/bin/env python3
"""Swarm-to-chain client: how a worker starts a session, keeps it alive, and submits.

Real mode runs the same commands dry-run prints. Three rules shape the code:

  * a secret is read, never printed and never composed into a printed line. --dry-run emits
    `--private-key "$(cat $LINEAGE_KEY_FILE)"` as literal text, so the transcript of a rehearsal can
    go in the film and the repository without a redaction pass. If LINEAGE_KEYSTORE is set the
    commands use --keystore/--password-file and no key material touches the argument list at all;
    with a raw key file, cast's only option is --private-key, and the value is then visible in
    `ps` for the life of the call — stated here because host A has more than one user.
  * the artifact is what the verifier accepts. verifier/run.py walks every file in the tarball and
    rejects the submission if any path is outside crates/rec_aggregation/guests/ — so the tarball
    carries the changed guest files at their repository-relative paths and nothing else. A
    manifest.json in there would be a frozen-path rejection; the lineage, the node and the parents
    are on chain, which is where a verifier can trust them.
  * nothing is guessed. keccak comes from `cast keccak`, not from a hash that happens to be
    available; the parents of a submission default to the head the session actually started from,
    recorded at claim time; and a heartbeat loop stops when the chain says the session is over.

Environment (per command; a missing one is an error, never a default):
  every command   ETHPLANE_ADDRESS, SEPOLIA_RPC_URL, NODE_ID
  register/claim/heartbeat/submit   LINEAGE_KEY_FILE (or LINEAGE_KEYSTORE [+
                                    LINEAGE_KEYSTORE_PASSWORD_FILE])
  register        LINEAGE_NAME, OPERATOR_ADDRESS
  accept/forfeit  OPERATOR_KEY_FILE (or OPERATOR_KEYSTORE [+ OPERATOR_KEYSTORE_PASSWORD_FILE])
  submit          WORKTREE, EDITABLE, API_BASE
  status          API_BASE
  heartbeat --loop  HEARTBEAT_SECONDS (how often; the node's heartbeatEvery / 2 is the right value)

Usage:
  client.py register                    client.py claim [fromHash]
  client.py accept <lineage-address>    client.py heartbeat [--loop]
  client.py submit [parent ...]         client.py forfeit <lineage-address>
  client.py status
Add --dry-run to any of them to print the commands instead of running them.
"""
import argparse
import hashlib
import json
import os
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.error
import urllib.request

ZERO_HASH = "0x" + "00" * 32
SESSION_STATE_DIR = os.environ.get("SESSION_STATE_DIR", os.path.expanduser("~/.ethplane"))
CAST_TIMEOUT_SECONDS = 300

COMMON_VARS = ("ETHPLANE_ADDRESS", "SEPOLIA_RPC_URL", "NODE_ID")
COMMAND_VARS = {
    "register": COMMON_VARS + ("LINEAGE_NAME", "OPERATOR_ADDRESS"),
    "accept": COMMON_VARS,
    "forfeit": COMMON_VARS,
    "claim": COMMON_VARS,
    "heartbeat": COMMON_VARS,
    "submit": COMMON_VARS + ("WORKTREE", "EDITABLE", "API_BASE"),
    "status": COMMON_VARS + ("API_BASE",),
}


def get_env_vars(command: str = None) -> dict:
    """The variables this command needs, and only those.

    `status` asking for a private key was how the dry run first failed on a host that had no key
    for that role — a command that reads should not require the ability to write."""
    required = COMMAND_VARS.get(command, tuple(sorted(set(sum(COMMAND_VARS.values(), ())))))
    env = {}
    for var in required:
        if var not in os.environ:
            raise ValueError(f"Missing required environment variable: {var}")
        env[var] = os.environ[var]
    # Optional, and read straight from the environment so a caller can override per invocation.
    for var in ("LINEAGE_NAME", "OPERATOR_ADDRESS", "API_BASE", "WORKTREE", "EDITABLE",
                "REFERENCE_COMMIT", "HEARTBEAT_SECONDS"):
        if var in os.environ:
            env.setdefault(var, os.environ[var])
    return env


# ----------------------------------------------------------------------------- wallet


def wallet_args(role: str = "LINEAGE"):
    """(real_args, printable_args) for whichever wallet this role has.

    The printable form never contains key material: with a keystore the two are identical, and with
    a key file the printable form keeps the `$(cat ...)` so the line stays runnable by a human who
    has the file, and useless to anyone who does not."""
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


def keccak(text: str) -> str:
    """`cast keccak`, because there is no keccak in the standard library and the wrong hash here is
    a lineage registered under a group name nobody can reproduce. The version this replaces fell
    back to sha256 when hashlib had no keccak_256 — which is always, on CPython."""
    r = subprocess.run(["cast", "keccak", text], capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"cast keccak failed: {r.stderr.strip()}")
    return r.stdout.strip()


# ----------------------------------------------------------------------------- cast


def shell_quote(arg: str) -> str:
    return arg if arg.startswith('"') or arg.replace("-", "").replace("_", "").replace(".", "").replace("/", "").isalnum() else f"'{arg}'"


def cast_send(args, printable_args, dry_run: bool = False):
    """Run `cast send`, or print it. Returns the transaction hash in real mode."""
    if dry_run:
        print("cast send " + " ".join(shell_quote(a) for a in printable_args))
        return None
    r = subprocess.run(["cast", "send"] + args, capture_output=True, text=True,
                       timeout=CAST_TIMEOUT_SECONDS)
    if r.returncode != 0:
        raise RuntimeError(f"cast send failed: {redact(r.stderr.strip(), args)}")
    tx = transaction_hash(r.stdout)
    print(tx or r.stdout.strip())
    return tx


def cast_call(args):
    r = subprocess.run(["cast", "call"] + args, capture_output=True, text=True,
                       timeout=CAST_TIMEOUT_SECONDS)
    if r.returncode != 0:
        raise RuntimeError(f"cast call failed: {r.stderr.strip()}")
    return r.stdout.strip()


def redact(text: str, args) -> str:
    """cast echoes its arguments in some errors. A key that reached the message is removed from it
    rather than trusted not to be there."""
    if "--private-key" in args:
        key = args[args.index("--private-key") + 1]
        return text.replace(key, "<private key>")
    return text


def transaction_hash(output: str):
    for line in output.splitlines():
        if line.lower().startswith("transactionhash"):
            return line.split()[-1]
    return None


def rpc_args(env: dict):
    return ["--rpc-url", env["SEPOLIA_RPC_URL"]]


# ----------------------------------------------------------------------------- session state


def state_path(node_id: str) -> str:
    os.makedirs(SESSION_STATE_DIR, exist_ok=True)
    name = os.environ.get("LINEAGE_NAME", "lineage")
    return os.path.join(SESSION_STATE_DIR, f"session-{name}-{node_id[:10]}.json")


def write_session(node_id: str, from_hash: str) -> None:
    with open(state_path(node_id), "w") as f:
        json.dump({"node": node_id, "fromHash": from_hash, "startedAt": int(time.time())}, f)


def read_session(node_id: str) -> dict:
    try:
        with open(state_path(node_id)) as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


# ----------------------------------------------------------------------------- commands


def register_subcommand(dry_run: bool = False):
    env = get_env_vars("register")
    args, printable = wallet_args("LINEAGE")
    call = [env["ETHPLANE_ADDRESS"], "registerLineage(address,bytes32)",
            env["OPERATOR_ADDRESS"], keccak(env["LINEAGE_NAME"])]
    return cast_send(call + args + rpc_args(env), call + printable + rpc_args(env), dry_run)


def accept_subcommand(lineage: str, dry_run: bool = False):
    """The operator's side of registration. It is here rather than in a shell line so that key
    handling has one implementation."""
    env = get_env_vars("accept")
    if not lineage:
        raise ValueError("accept needs the lineage address to accept")
    args, printable = wallet_args("OPERATOR")
    call = [env["ETHPLANE_ADDRESS"], "acceptLineage(address)", lineage]
    return cast_send(call + args + rpc_args(env), call + printable + rpc_args(env), dry_run)


def forfeit_subcommand(lineage: str, dry_run: bool = False):
    """End a session that stopped heartbeating. Anyone may call it — that is the point: a worker
    who dies does not hold the node, and nobody has to ask the maintainer to release it. Sent from
    the operator wallet here only because that is a key the rehearsal already has."""
    env = get_env_vars("forfeit")
    if not lineage:
        raise ValueError("forfeit needs the lineage address whose session lapsed")
    args, printable = wallet_args("OPERATOR")
    call = [env["ETHPLANE_ADDRESS"], "forfeit(bytes32,address)", env["NODE_ID"], lineage]
    return cast_send(call + args + rpc_args(env), call + printable + rpc_args(env), dry_run)


def claim_subcommand(from_hash: str = None, dry_run: bool = False):
    """Start a session on the node, from a head or from nothing."""
    env = get_env_vars("claim")
    from_hash = from_hash or ZERO_HASH
    args, printable = wallet_args("LINEAGE")
    call = [env["ETHPLANE_ADDRESS"], "claim(bytes32,bytes32)", env["NODE_ID"], from_hash]
    tx = cast_send(call + args + rpc_args(env), call + printable + rpc_args(env), dry_run)
    if not dry_run:
        write_session(env["NODE_ID"], from_hash)
    return tx


def heartbeat_subcommand(dry_run: bool = False, loop: bool = False):
    """One heartbeat, or one every HEARTBEAT_SECONDS until the session is over.

    The loop's stop condition is the chain's, not a timer's: it reads the lease and exits when the
    contract no longer calls it active. A worker that is killed simply stops sending them, which is
    the case the rehearsal films."""
    env = get_env_vars("heartbeat")
    args, printable = wallet_args("LINEAGE")
    call = [env["ETHPLANE_ADDRESS"], "heartbeat(bytes32)", env["NODE_ID"]]
    if not loop:
        return cast_send(call + args + rpc_args(env), call + printable + rpc_args(env), dry_run)

    every = int(env.get("HEARTBEAT_SECONDS", "30"))
    if dry_run:
        print(f"# every {every}s until the session lapses:")
        cast_send(call + args + rpc_args(env), call + printable + rpc_args(env), True)
        return None
    while True:
        try:
            cast_send(call + args + rpc_args(env), call + printable + rpc_args(env), False)
        except RuntimeError as e:
            print(f"heartbeat refused, the session is over: {e}")
            return None
        time.sleep(every)
        if not session_is_active(env):
            print("the session is no longer active on chain")
            return None


def session_is_active(env: dict) -> bool:
    """`leases(leaseKey)` last field is the active flag. Any failure to read it returns True: a
    watcher that cannot reach the RPC must not conclude that the session ended."""
    try:
        lineage = lineage_address()
        key = cast_call([env["ETHPLANE_ADDRESS"], "leaseKey(bytes32,address)(bytes32)",
                         env["NODE_ID"], lineage] + rpc_args(env)).split()[0]
        out = cast_call([env["ETHPLANE_ADDRESS"],
                         "leases(bytes32)(address,address,uint64,uint64,uint64,bytes32,uint256,bool)",
                         key] + rpc_args(env))
        return out.strip().splitlines()[-1].strip().lower() == "true"
    except Exception:
        return True


def lineage_address() -> str:
    args, _ = wallet_args("LINEAGE")
    r = subprocess.run(["cast", "wallet", "address"] + args, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"cast wallet address failed: {redact(r.stderr.strip(), args)}")
    return r.stdout.strip()


def editable_paths(env: dict) -> list:
    """EDITABLE is a list of repository-relative paths. It arrives comma-separated in the deployed
    env files and whitespace-separated in some of the notes, so both are accepted — the version this
    replaces split on whitespace only, which turned `a,b` into the single path `a,b` and diffed
    nothing."""
    raw = env["EDITABLE"].replace(",", " ").split()
    return [p for p in raw if p]


def changed_files(env: dict) -> list:
    """The files the worker actually changed, relative to the pinned commit when the worktree has
    it and to HEAD otherwise."""
    base = env.get("REFERENCE_COMMIT", "HEAD")
    if base != "HEAD":
        known = subprocess.run(["git", "-C", env["WORKTREE"], "cat-file", "-e", f"{base}^{{commit}}"],
                               capture_output=True, text=True)
        if known.returncode != 0:
            base = "HEAD"
    r = subprocess.run(["git", "-C", env["WORKTREE"], "diff", "--name-only", base, "--"]
                       + editable_paths(env), capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"git diff failed: {r.stderr.strip()}")
    return [line.strip() for line in r.stdout.splitlines() if line.strip()]


def build_artifact(env: dict, dest_dir: str):
    """Tar the changed editable files at their repository-relative paths. Returns (path, hash)."""
    files = changed_files(env)
    if not files:
        raise RuntimeError(
            "nothing to submit: no changes under " + ", ".join(editable_paths(env))
        )
    tarball_path = os.path.join(dest_dir, "artifact.tar.gz")
    with tarfile.open(tarball_path, "w:gz") as tar:
        for rel in files:
            tar.add(os.path.join(env["WORKTREE"], rel), arcname=rel)
    with open(tarball_path, "rb") as f:
        digest = hashlib.sha256(f.read()).hexdigest()
    return tarball_path, "0x" + digest


def post_artifact(api_base: str, tarball_path: str, artifact_hash: str) -> None:
    """The store is content-addressed and checks the claimed hash against the bytes, so a 409 here
    means the two disagree and the submission must not go on chain."""
    with open(tarball_path, "rb") as f:
        body = f.read()
    request = urllib.request.Request(
        f"{api_base}/api/artifacts", data=body, method="POST",
        headers={"content-type": "application/gzip", "x-artifact-hash": artifact_hash},
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            print(f"artifact stored: {response.read().decode()}")
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"artifact upload refused ({e.code}): {e.read().decode()[:200]}")


def submit_subcommand(parents=None, dry_run: bool = False):
    """Upload the artifact, then record it on chain with its parents.

    Parents default to the head this session started from: that is what `claim(node, fromHash)`
    declared, and re-deriving it from anywhere else would let the attribution disagree with the
    session."""
    env = get_env_vars("submit")
    parents = list(parents or [])
    if not parents:
        started_from = read_session(env["NODE_ID"]).get("fromHash", ZERO_HASH)
        if started_from and started_from != ZERO_HASH:
            parents = [started_from]

    temp_dir = tempfile.mkdtemp()
    try:
        tarball_path, artifact_hash = build_artifact(env, temp_dir)
        args, printable = wallet_args("LINEAGE")
        call = [env["ETHPLANE_ADDRESS"], "submit(bytes32,bytes32,bytes32[])",
                env["NODE_ID"], artifact_hash, "[" + ",".join(parents) + "]"]
        if dry_run:
            print(f"POST {env['API_BASE']}/api/artifacts")
            print("Content-Type: application/gzip")
            print(f"X-Artifact-Hash: {artifact_hash}")
            print(f"# {len(changed_files(env))} file(s), "
                  f"{os.path.getsize(tarball_path)} bytes, parents {parents or '[]'}")
            return cast_send(call + args + rpc_args(env), call + printable + rpc_args(env), True)
        post_artifact(env["API_BASE"], tarball_path, artifact_hash)
        return cast_send(call + args + rpc_args(env), call + printable + rpc_args(env), False)
    finally:
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)


def get_json(url: str):
    with urllib.request.urlopen(url, timeout=60) as response:
        return json.loads(response.read().decode())


def status_subcommand(dry_run: bool = False):
    """What the node looks like from outside: state, head, sessions, submissions."""
    env = get_env_vars("status")
    url = f"{env['API_BASE']}/api/nodes/{env['NODE_ID']}"
    if dry_run:
        print(f"GET {url}")
        return None
    detail = get_json(url)
    node = detail.get("node") or {}
    active = [l for l in detail.get("leases", []) if l.get("active")]
    print(json.dumps({
        "node": node.get("label") or env["NODE_ID"],
        "state": node.get("state"),
        "head": detail.get("head") or node.get("head"),
        "activeSessions": len(active),
        "submissions": len(detail.get("submissions", [])),
        "verdicts": len(detail.get("verdicts", [])),
    }, indent=2))
    return detail


def resume_subcommand(dry_run: bool = False):
    """Resume a session by attempting to heartbeat, and if that fails, forfeit and reclaim."""
    try:
        heartbeat_subcommand(dry_run)
        print("session alive")
        return
    except Exception as e:
        print(f"heartbeat failed: {e}; forfeiting and reclaiming")
        # Get the lineage address for forfeit using the wallet
        addr = lineage_address()
        forfeit_subcommand(addr, dry_run)
        claim_subcommand(None, dry_run)


def main() -> int:
    parser = argparse.ArgumentParser(description="Swarm-to-chain client")
    parser.add_argument("--dry-run", action="store_true", help="Print commands instead of running them")
    parser.add_argument("--loop", action="store_true", help="heartbeat: keep sending until the session ends")
    parser.add_argument("command", choices=["register", "accept", "claim", "heartbeat", "submit", "forfeit", "status", "resume"])
    parser.add_argument("args", nargs="*")
    args = parser.parse_args()

    try:
        if args.command == "register":
            register_subcommand(args.dry_run)
        elif args.command == "accept":
            accept_subcommand(args.args[0] if args.args else None, args.dry_run)
        elif args.command == "forfeit":
            forfeit_subcommand(args.args[0] if args.args else None, args.dry_run)
        elif args.command == "claim":
            claim_subcommand(args.args[0] if args.args else None, args.dry_run)
        elif args.command == "heartbeat":
            heartbeat_subcommand(args.dry_run, args.loop)
        elif args.command == "submit":
            submit_subcommand(args.args, args.dry_run)
        elif args.command == "status":
            status_subcommand(args.dry_run)
        elif args.command == "resume":
            resume_subcommand(args.dry_run)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
