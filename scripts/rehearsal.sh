#!/usr/bin/env bash
# The Sepolia rehearsal, in the order the film needs it.
#
# Two lineages work the same node. The first starts a session, heartbeats twice, submits, and is
# then killed. Its session lapses, anyone may end it, and the second lineage starts from the first
# one's artifact — so the work survives the worker. The verifier judges both submissions.
#
# It prints every command by default and sends nothing. --broadcast runs them, one at a time, and
# writes each transaction hash to the log for docs/FILM.md.
#
# No key is ever written into this file or into a printed command: every wallet is a path in the
# environment, and swarm/client.py reads it at the moment it needs it.
#
#   scripts/rehearsal.sh                     # print the 13 commands, send nothing
#   scripts/rehearsal.sh --broadcast         # run them, logging tx hashes
#   scripts/rehearsal.sh --broadcast --make-change   # also write the guest-file change first
#
# Environment (see docs/REHEARSAL.md for the full list):
#   ETHPLANE_ADDRESS SEPOLIA_RPC_URL NODE_ID API_BASE
#   QWEN_A_KEY_FILE FAST_B_KEY_FILE OPERATOR_KEY_FILE [FAST_B_OPERATOR_KEY_FILE]
#   OPERATOR_ADDRESS [FAST_B_OPERATOR_ADDRESS] WORKTREE_A WORKTREE_B EDITABLE
#   VERIFIER_KEY_FILE LEANVM_REF REFERENCE_COMMIT
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLIENT="$REPO/swarm/client.py"
WATCH="$REPO/verifier/watch.py"
PY="${PYTHON:-python3}"

BROADCAST=0
MAKE_CHANGE=0
LOG="${REHEARSAL_LOG:-$REPO/rehearsal-$(date +%Y%m%d-%H%M%S).log}"
GUEST_FILE="${GUEST_FILE:-crates/rec_aggregation/guests/aggregate.py}"
HEARTBEAT_EVERY="${HEARTBEAT_EVERY:-120}"
FORFEIT_TRIES="${FORFEIT_TRIES:-10}"

for arg in "$@"; do
  case "$arg" in
    --broadcast) BROADCAST=1 ;;
    --make-change) MAKE_CHANGE=1 ;;
    --dry-run) BROADCAST=0 ;;
    -h|--help) sed -n '2,25p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

DRY_FLAG="--dry-run"
[ "$BROADCAST" = "1" ] && DRY_FLAG=""

TX_COUNT=0
BEAT=0

need() {
  local missing=0
  for var in "$@"; do
    if [ -z "${!var:-}" ]; then echo "missing env: $var" >&2; missing=1; fi
  done
  [ "$missing" = "0" ] || exit 2
}

say() {
  BEAT=$((BEAT + 1))
  echo
  echo "── beat $BEAT: $*"
  [ "$BROADCAST" = "1" ] && echo "── beat $BEAT: $*" >>"$LOG"
  return 0
}

# Run one client/watch command, count it as a transaction, and keep whatever it printed.
send() {
  local label="$1"; shift
  local out
  out="$("$@" 2>&1)"
  local code=$?
  echo "$out"
  if [ "$BROADCAST" = "1" ]; then
    echo "$label: $out" >>"$LOG"
  fi
  if [ $code -ne 0 ]; then
    echo "!! $label failed" >&2
    [ "$BROADCAST" = "1" ] && exit 1
  fi
  TX_COUNT=$((TX_COUNT + 1))
  LAST_OUT="$out"
  return 0
}

# Like send, but a failure is returned rather than fatal: the forfeit is expected to revert with
# LeaseHealthy until the heartbeat window has actually passed.
try_send() {
  local label="$1"; shift
  local out code
  out="$("$@" 2>&1)"; code=$?
  echo "$out"
  [ "$BROADCAST" = "1" ] && echo "$label: $out" >>"$LOG"
  if [ $code -eq 0 ] && ! printf '%s' "$out" | grep -qi "error"; then
    TX_COUNT=$((TX_COUNT + 1)); LAST_OUT="$out"; return 0
  fi
  return 1
}

need ETHPLANE_ADDRESS SEPOLIA_RPC_URL NODE_ID API_BASE \
     QWEN_A_KEY_FILE FAST_B_KEY_FILE OPERATOR_KEY_FILE OPERATOR_ADDRESS \
     WORKTREE_A WORKTREE_B EDITABLE VERIFIER_KEY_FILE LEANVM_REF REFERENCE_COMMIT

export ETHPLANE_ADDRESS SEPOLIA_RPC_URL NODE_ID API_BASE EDITABLE REFERENCE_COMMIT LEANVM_REF

# The second lineage's operator. If it is the same address as the first one's, the contract's own
# cooldown (set on forfeit, keyed by operator) would refuse fast-b's claim for a whole lease
# duration — so the beats are reordered to claim before the forfeit rather than pretending
# otherwise. Two operator addresses give the natural order: die, lapse, recover.
OPERATOR_A_ADDRESS="$OPERATOR_ADDRESS"
OPERATOR_A_KEY_FILE="$OPERATOR_KEY_FILE"
FAST_B_OPERATOR_ADDRESS="${FAST_B_OPERATOR_ADDRESS:-$OPERATOR_A_ADDRESS}"
FAST_B_OPERATOR_KEY_FILE="${FAST_B_OPERATOR_KEY_FILE:-$OPERATOR_A_KEY_FILE}"
SHARED_OPERATOR=0
[ "$FAST_B_OPERATOR_ADDRESS" = "$OPERATOR_A_ADDRESS" ] && SHARED_OPERATOR=1

echo "ethplane rehearsal — node $NODE_ID"
echo "mode: $([ "$BROADCAST" = 1 ] && echo BROADCAST || echo "dry run, nothing is sent")"
if [ "$SHARED_OPERATOR" = "1" ]; then
  echo "one operator address for both lineages: fast-b claims BEFORE the forfeit (cooldown is keyed"
  echo "by operator). Set FAST_B_OPERATOR_ADDRESS and FAST_B_OPERATOR_KEY_FILE for the natural order."
fi
[ "$BROADCAST" = "1" ] && echo "log: $LOG"

# ----------------------------------------------------------------- lineages exist and are accepted

say "qwen-a registers its lineage"
LINEAGE_KEY_FILE="$QWEN_A_KEY_FILE" LINEAGE_NAME="qwen-a" OPERATOR_ADDRESS="$OPERATOR_A_ADDRESS" \
  send "register qwen-a" $PY "$CLIENT" $DRY_FLAG register

say "fast-b registers its lineage"
LINEAGE_KEY_FILE="$FAST_B_KEY_FILE" LINEAGE_NAME="fast-b" OPERATOR_ADDRESS="$FAST_B_OPERATOR_ADDRESS" \
  send "register fast-b" $PY "$CLIENT" $DRY_FLAG register

QWEN_A_ADDRESS="${QWEN_A_ADDRESS:-$(cast wallet address --private-key "$(cat "$QWEN_A_KEY_FILE")" 2>/dev/null || echo '<qwen-a address>')}"
FAST_B_ADDRESS="${FAST_B_ADDRESS:-$(cast wallet address --private-key "$(cat "$FAST_B_KEY_FILE")" 2>/dev/null || echo '<fast-b address>')}"

say "the operator accepts qwen-a"
OPERATOR_KEY_FILE="$OPERATOR_A_KEY_FILE" \
  send "accept qwen-a" $PY "$CLIENT" $DRY_FLAG accept "$QWEN_A_ADDRESS"

say "the operator accepts fast-b"
OPERATOR_KEY_FILE="$FAST_B_OPERATOR_KEY_FILE" \
  send "accept fast-b" $PY "$CLIENT" $DRY_FLAG accept "$FAST_B_ADDRESS"

# ----------------------------------------------------------------------------- qwen-a works

say "qwen-a starts a session on the node, from nothing"
LINEAGE_KEY_FILE="$QWEN_A_KEY_FILE" LINEAGE_NAME="qwen-a" WORKTREE="$WORKTREE_A" \
  send "claim qwen-a" $PY "$CLIENT" $DRY_FLAG claim

for beat in 1 2; do
  say "qwen-a heartbeat $beat of 2"
  LINEAGE_KEY_FILE="$QWEN_A_KEY_FILE" LINEAGE_NAME="qwen-a" \
    send "heartbeat qwen-a $beat" $PY "$CLIENT" $DRY_FLAG heartbeat
done

if [ "$MAKE_CHANGE" = "1" ]; then
  echo "# ethplane rehearsal $(date -u +%Y-%m-%dT%H:%M:%SZ)" >>"$WORKTREE_A/$GUEST_FILE"
  echo "wrote a comment to $WORKTREE_A/$GUEST_FILE"
fi

say "qwen-a submits (the diff touches only $GUEST_FILE)"
LINEAGE_KEY_FILE="$QWEN_A_KEY_FILE" LINEAGE_NAME="qwen-a" WORKTREE="$WORKTREE_A" \
  send "submit qwen-a" $PY "$CLIENT" $DRY_FLAG submit
# The artifact hash is printed before the transaction hash, by the upload in real mode and by the
# X-Artifact-Hash line in a dry run; either way it is the first 32-byte hash in that output.
QWEN_A_ARTIFACT="$(printf '%s' "$LAST_OUT" | grep -oE '0x[0-9a-f]{64}' | head -1)"
[ -n "$QWEN_A_ARTIFACT" ] && echo "qwen-a artifact: $QWEN_A_ARTIFACT"

echo
echo "── qwen-a is killed here. Nothing more is sent from it; the session stops heartbeating."

# --------------------------------------------------------------- the session lapses, fast-b picks up

claim_fast_b() {
  say "fast-b starts a session from qwen-a's artifact"
  local from="${QWEN_A_ARTIFACT:-<qwen-a artifact hash>}"
  LINEAGE_KEY_FILE="$FAST_B_KEY_FILE" LINEAGE_NAME="fast-b" WORKTREE="$WORKTREE_B" \
    send "claim fast-b" $PY "$CLIENT" $DRY_FLAG claim "$from"
}

forfeit_qwen_a() {
  say "anyone ends the lapsed session (after ${HEARTBEAT_EVERY}s of silence)"
  if [ "$BROADCAST" = "1" ]; then
    echo "waiting ${HEARTBEAT_EVERY}s + 15 for the heartbeat window to pass"
    sleep $((HEARTBEAT_EVERY + 15))
  fi
  local try=1
  while : ; do
    OPERATOR_KEY_FILE="$OPERATOR_A_KEY_FILE" \
      try_send "forfeit qwen-a (try $try)" $PY "$CLIENT" $DRY_FLAG forfeit "$QWEN_A_ADDRESS" && break
    try=$((try + 1))
    [ "$try" -gt "$FORFEIT_TRIES" ] && { echo "!! the session never became forfeitable" >&2; exit 1; }
    [ "$BROADCAST" = "1" ] && sleep 30
  done
}

if [ "$SHARED_OPERATOR" = "1" ]; then
  claim_fast_b
  forfeit_qwen_a
else
  forfeit_qwen_a
  claim_fast_b
fi

# The parent is passed rather than left to default: the client would read it from the session it
# recorded at claim time, but attribution is the point of this beat, so it is stated here and the
# printed command shows it.
say "fast-b submits, with qwen-a's artifact as its parent"
LINEAGE_KEY_FILE="$FAST_B_KEY_FILE" LINEAGE_NAME="fast-b" WORKTREE="$WORKTREE_B" \
  send "submit fast-b" $PY "$CLIENT" $DRY_FLAG submit ${QWEN_A_ARTIFACT:-}

# ----------------------------------------------------------------------------- the verifier judges

for pass in 1 2; do
  say "the verifier judges one submission (pass $pass of 2)"
  send "recordMeasurement pass $pass" $PY "$WATCH" $DRY_FLAG --once
done

# ----------------------------------------------------------------------------- what it cost

GAS_PER_TX="${GAS_PER_TX:-150000}"
GWEI="${GAS_PRICE_GWEI:-1.1}"
echo
echo "───────────────────────────────────────────────"
echo "transactions: $TX_COUNT"
echo "at ${GWEI} gwei and ${GAS_PER_TX} gas each: $(awk -v n="$TX_COUNT" -v g="$GAS_PER_TX" -v p="$GWEI" \
  'BEGIN { printf "%.5f ETH", n * g * p / 1000000000 }')"
echo "(an assumption, not a measurement: after a broadcast the receipts in the log are the real cost)"
[ "$BROADCAST" = "1" ] && echo "log: $LOG"
echo "next: put the transaction hashes into docs/FILM.md under Rehearsed facts"
