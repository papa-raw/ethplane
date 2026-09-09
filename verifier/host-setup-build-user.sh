#!/usr/bin/env bash
#
# Give the verifier a build user that cannot read its key. Run as root on host A, more than once if
# you like: every step checks before it acts.
#
#   sudo verifier/host-setup-build-user.sh              # set it up and prove it works
#   sudo verifier/host-setup-build-user.sh --skip-build-check   # skip the ~minutes-long real build
#
# Why this exists. `cargo build` and the reference harness's `cargo test` run build.rs and
# procedural macros AT COMPILE TIME as the invoking user. Node 2 (dl-leanvm) admits
# crates/lean_compiler/, so a submitter writes Rust that this host compiles — and the user that runs
# the verifier holds VERIFIER_PRIVATE_KEY. Compiling as a second user who cannot read that key is
# what makes the wider surface something other than handing the key away. --offline --locked (which
# run.py adds on that surface) stops dependency fetching; it does not stop code execution.
#
# Copied toolchain, not a fresh rustup — the header question, answered.
#   The build user needs a rustc it can execute and a registry it can read while --offline. A fresh
#   `rustup install` for lean-build gives it a toolchain but an empty registry, so the registry would
#   have to be seeded from the verifier's anyway; and it would be a *different* rustc unless the
#   version were pinned by hand. That matters here more than usual: run.py compares the reference and
#   submission binaries by sha256 (the stale-binary check), and both must be produced by the same
#   compiler for that comparison and for the cycle counts to mean anything. Copying
#   /home/verifier/.cargo and /home/verifier/.rustup into world-readable locations gives one
#   toolchain, one registry, already warm with exactly the crates this workspace's lockfile pins, and
#   no network at setup time. The copies are read-only to lean-build's group in the sense that
#   matters: nothing in them is the verifier's key, and $CARGO_HOME must stay writable because cargo
#   writes locks and caches there.
#
# What it makes:
#   group  lean-build          verifier and lean-build both in it; the shared worktree group
#   user   lean-build          system user, no login shell, no home of its own
#   sudo   /etc/sudoers.d/lean-build   verifier may run commands AS lean-build with -n
#   dir    /var/cache/lean-cargo  CARGO_HOME for the build (copied from the verifier's)
#   dir    /var/lib/lean-rustup   RUSTUP_HOME for the build (copied from the verifier's)
#
# It changes nothing about the verifier's own home, key or toolchain.
set -euo pipefail

VERIFIER_USER="${VERIFIER_USER:-verifier}"
BUILD_USER="${BUILD_USER:-lean-build}"
SHARED_GROUP="${SHARED_GROUP:-lean-build}"
VERIFIER_HOME="${VERIFIER_HOME:-/home/${VERIFIER_USER}}"
VERIFIER_KEY_FILE="${VERIFIER_KEY_FILE:-${VERIFIER_HOME}/secret/verifier.key}"
LEANVM_REF="${LEANVM_REF:-${VERIFIER_HOME}/leanVM}"
REFERENCE_COMMIT="${REFERENCE_COMMIT:-a210ef1b}"
BUILD_CARGO_HOME="${BUILD_CARGO_HOME:-/var/cache/lean-cargo}"
BUILD_RUSTUP_HOME="${BUILD_RUSTUP_HOME:-/var/lib/lean-rustup}"
SUDOERS_FILE="/etc/sudoers.d/lean-build"

SKIP_BUILD_CHECK=0
for arg in "$@"; do
  case "$arg" in
    --skip-build-check) SKIP_BUILD_CHECK=1 ;;
    -h|--help) sed -n '2,40p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

say()  { printf '\n== %s\n' "$*"; }
ok()   { printf '   ok: %s\n' "$*"; }
fail() { printf '   FAILED: %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" = "0" ] || fail "run as root: sudo $0"
id "$VERIFIER_USER" >/dev/null 2>&1 || fail "no such user: $VERIFIER_USER"
[ -r "$VERIFIER_KEY_FILE" ] || echo "   note: $VERIFIER_KEY_FILE not readable here; the key check below still runs"

say "group $SHARED_GROUP"
if getent group "$SHARED_GROUP" >/dev/null; then ok "exists"; else groupadd --system "$SHARED_GROUP"; ok "created"; fi

say "user $BUILD_USER"
if id "$BUILD_USER" >/dev/null 2>&1; then
  ok "exists"
else
  useradd --system --no-create-home --shell /usr/sbin/nologin --gid "$SHARED_GROUP" "$BUILD_USER"
  ok "created (system, no login shell, no home)"
fi
if id -nG "$VERIFIER_USER" | tr ' ' '\n' | grep -qx "$SHARED_GROUP"; then
  ok "$VERIFIER_USER already in $SHARED_GROUP"
else
  usermod -aG "$SHARED_GROUP" "$VERIFIER_USER"
  ok "$VERIFIER_USER added to $SHARED_GROUP (its running processes need a new login to see it)"
fi

say "sudoers $SUDOERS_FILE"
# This grants the verifier the ability to act as a LESS privileged user. It is not an escalation
# path: lean-build has no login, no home and no read on the key.
TMP_SUDOERS="$(mktemp)"
printf '%s ALL=(%s) NOPASSWD: ALL\n' "$VERIFIER_USER" "$BUILD_USER" > "$TMP_SUDOERS"
if visudo -cf "$TMP_SUDOERS" >/dev/null; then
  if [ -f "$SUDOERS_FILE" ] && cmp -s "$TMP_SUDOERS" "$SUDOERS_FILE"; then
    ok "already correct"
    rm -f "$TMP_SUDOERS"
  else
    install -m 0440 -o root -g root "$TMP_SUDOERS" "$SUDOERS_FILE"
    rm -f "$TMP_SUDOERS"
    ok "installed"
  fi
else
  rm -f "$TMP_SUDOERS"
  fail "the sudoers line did not validate"
fi

say "toolchain for $BUILD_USER"
copy_tree() {  # source, destination, what
  local src="$1" dst="$2" what="$3"
  [ -d "$src" ] || fail "$what not found at $src"
  if [ -d "$dst" ] && [ -n "$(ls -A "$dst" 2>/dev/null)" ]; then
    ok "$what already at $dst (left as it is; delete it to re-seed)"
    return
  fi
  install -d -m 2775 -o "$BUILD_USER" -g "$SHARED_GROUP" "$dst"
  cp -a "$src/." "$dst/"
  chown -R "$BUILD_USER:$SHARED_GROUP" "$dst"
  chmod -R u+rwX,g+rwX,o+rX "$dst"
  ok "$what copied to $dst"
}
copy_tree "${VERIFIER_HOME}/.cargo"  "$BUILD_CARGO_HOME"  "cargo home (bin + registry)"
copy_tree "${VERIFIER_HOME}/.rustup" "$BUILD_RUSTUP_HOME" "rustup toolchains"

say "checks"
BUILD_ENV=(env "CARGO_HOME=$BUILD_CARGO_HOME" "RUSTUP_HOME=$BUILD_RUSTUP_HOME"
           "PATH=$BUILD_CARGO_HOME/bin:/usr/local/bin:/usr/bin:/bin")

if sudo -n -u "$BUILD_USER" test -r "$VERIFIER_KEY_FILE" 2>/dev/null; then
  fail "$BUILD_USER CAN read $VERIFIER_KEY_FILE — that is not isolation, it is a second name for the same privilege"
fi
ok "$BUILD_USER cannot read $VERIFIER_KEY_FILE"

if sudo -n -u "$BUILD_USER" "${BUILD_ENV[@]}" cargo --version >/dev/null 2>&1; then
  ok "$BUILD_USER can run cargo: $(sudo -n -u "$BUILD_USER" "${BUILD_ENV[@]}" cargo --version)"
else
  fail "$BUILD_USER cannot run cargo with CARGO_HOME=$BUILD_CARGO_HOME RUSTUP_HOME=$BUILD_RUSTUP_HOME"
fi

if [ "$SKIP_BUILD_CHECK" = "0" ]; then
  say "a real build, as $BUILD_USER, in a worktree shared the way run.py shares it"
  WORK="$(mktemp -d)"
  chgrp "$SHARED_GROUP" "$WORK"
  chmod 2770 "$WORK"
  if ! sudo -n -u "$VERIFIER_USER" git -C "$LEANVM_REF" worktree add --detach "$WORK/reference" "$REFERENCE_COMMIT" >/dev/null 2>&1; then
    rm -rf "$WORK"; fail "could not create a worktree of $LEANVM_REF at $REFERENCE_COMMIT as $VERIFIER_USER"
  fi
  chgrp -R "$SHARED_GROUP" "$WORK/reference"
  chmod 2770 "$WORK/reference"
  # shellcheck disable=SC2024  # the log is root's on purpose: this script runs as root, and the
  # build user has no business writing anywhere outside the worktree.
  if sudo -n -u "$BUILD_USER" "${BUILD_ENV[@]}" cargo build --release --offline --locked \
       --manifest-path "$WORK/reference/Cargo.toml" >/tmp/lean-build-check.log 2>&1; then
    ok "the reference builds offline as $BUILD_USER"
    # Building it is half the proof. run.py executes the produced binary as this user too — a
    # binary the submitter's compiler produced is still their program — so the check has to cover
    # the exec, not only the compile. Any exit code will do except the two the shell uses for
    # "cannot execute" (126) and "not found" (127): the binary's own CLI is not this script's
    # business, and it takes minutes to run the criterion properly.
    BIN=""
    for candidate in "$WORK/reference/target/release/leanvm" "$WORK/reference/target/release/leanvm-b"; do
      [ -x "$candidate" ] && BIN="$candidate"
    done
    if [ -z "$BIN" ]; then
      fail "the build produced no leanvm binary in $WORK/reference/target/release"
    fi
    set +e
    sudo -n -u "$BUILD_USER" "${BUILD_ENV[@]}" "$BIN" --version >/dev/null 2>&1
    EXEC_RC=$?
    set -e
    if [ "$EXEC_RC" = "126" ] || [ "$EXEC_RC" = "127" ]; then
      fail "$BUILD_USER cannot EXECUTE $BIN (exit $EXEC_RC) — run.py runs the measurement as this user"
    fi
    ok "$BUILD_USER can execute the built binary (exit $EXEC_RC from --version, which is not 126/127)"
  else
    echo "   last lines of /tmp/lean-build-check.log:" >&2
    tail -5 /tmp/lean-build-check.log >&2 || true
    echo "   if it stopped on git metadata, the worktree's .git points into ${VERIFIER_HOME};" >&2
    echo "   allow traversal only, no read:  setfacl -m u:${BUILD_USER}:x ${VERIFIER_HOME}" >&2
    sudo -n -u "$VERIFIER_USER" git -C "$LEANVM_REF" worktree remove --force "$WORK/reference" >/dev/null 2>&1 || true
    rm -rf "$WORK"
    fail "the build check did not pass — fix it before the watcher relies on it"
  fi
  sudo -n -u "$VERIFIER_USER" git -C "$LEANVM_REF" worktree remove --force "$WORK/reference" >/dev/null 2>&1 || true
  rm -rf "$WORK"
else
  echo "   (build check skipped)"
fi

cat <<EOF

Done. The watcher for node 2 wants these four, on top of what it already has:

  export EDITABLE="crates/rec_aggregation/guests/,crates/lean_compiler/"
  export BUILD_USER=$BUILD_USER
  export BUILD_CARGO_HOME=$BUILD_CARGO_HOME
  export BUILD_RUSTUP_HOME=$BUILD_RUSTUP_HOME

BUILD_GROUP defaults to the build user's name; set it only if the shared group is not $SHARED_GROUP.
ALLOW_UNSANDBOXED_BUILD is no longer needed on that node and should be removed from its environment
— with BUILD_USER set, run.py checks the isolation itself and refuses if it ever stops holding.
Node 1's watcher keeps its own environment: no EDITABLE, no BUILD_USER, nothing to isolate.

$VERIFIER_USER's login sessions pick up the new group at their next login; a watcher already running
under an old session should be restarted.
EOF
