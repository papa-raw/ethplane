#!/usr/bin/env bash
#
# One command puts a swarm on a host, or updates the one that is there.
#
#   swarm/deploy.sh ubuntu@10.0.0.1 ~/swarm --node cl-pq-leanxmss-attestations.ethplane.eth \
#       --lineage qwen-a --model Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8
#   swarm/deploy.sh ubuntu@10.0.0.1 ~/swarm-b --lineage fast-b --model … --design
#
# Everything host-specific is an argument. The version this replaces was two scripts on the box with
# node ids, contract addresses and absolute paths typed into them, which is why a second swarm meant
# copying start.sh and editing it — and why swarm B's `bin/board` still appended to swarm A's board
# for an afternoon (FRICTION 2026-09-09 14:24).
#
# Idempotent: run it as often as you like. It copies the harness, syncs the skills and resources,
# writes a per-swarm env file, creates the tmux sessions that are missing and leaves the ones that
# are running alone. --restart replaces the role sessions; nothing else ever kills a session, because
# a swarm mid-measurement is not something a deploy should end.
#
# It prints, at the end, the four `quad-slot.sh <n> remote --cmd …` lines that put this swarm in the
# Coharness grid on the Mac.
set -euo pipefail

TARGET="${1:-}"; DIR="${2:-}"
[ -n "$TARGET" ] && [ -n "$DIR" ] || { sed -n '2,20p' "$0"; exit 2; }
shift 2

NODE="" LINEAGE="" MODEL="Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8" DESIGN=0 RESTART=0
BASE="http://127.0.0.1:8000/v1" API="https://ethplane.ecofrontiers.xyz" BASELINE=1542812
EDITABLE="crates/rec_aggregation/guests/" SKILLS_SRC="$HOME/.claude/skills" RESOURCES_SRC=""
SKILLS="baseline-ui design design-research design-tokens distribution fixing-metadata frontend-design humanizer interaction-design interface-design patterns pptx recursive-improvement skillsearch visual-qa write"
while [ $# -gt 0 ]; do
  case "$1" in
    --node) NODE="$2"; shift 2 ;;
    --lineage) LINEAGE="$2"; shift 2 ;;
    --model) MODEL="$2"; shift 2 ;;
    --openai-base) BASE="$2"; shift 2 ;;
    --api) API="$2"; shift 2 ;;
    --baseline) BASELINE="$2"; shift 2 ;;
    --editable) EDITABLE="$2"; shift 2 ;;
    --skills) SKILLS="$2"; shift 2 ;;
    --skills-src) SKILLS_SRC="$2"; shift 2 ;;
    --resources-src) RESOURCES_SRC="$2"; shift 2 ;;
    --design) DESIGN=1; shift ;;
    --restart) RESTART=1; shift ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
[ -n "$LINEAGE" ] || { echo "--lineage is required: it names the sessions and the board" >&2; exit 2; }

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSH=(ssh -o ConnectTimeout=10 "$TARGET")
[ -n "${SSH_KEY:-}" ] && SSH=(ssh -i "$SSH_KEY" -o ConnectTimeout=10 "$TARGET")
SCP_KEY=(); [ -n "${SSH_KEY:-}" ] && SCP_KEY=(-i "$SSH_KEY")
NAME="$(basename "$DIR")"                       # swarm | swarm-b … the journal and session prefix
PREFIX="${SESSION_PREFIX:-${LINEAGE}-}"
case "$DIR" in *[[:space:]\'\"]*) echo "the swarm directory must not contain spaces or quotes: $DIR" >&2; exit 2 ;; esac

say() { printf '\n== %s\n' "$*"; }
ok()  { printf '   ok: %s\n' "$*"; }

# Resolve the directory ON THE HOST, once. `deploy.sh host '~/swarm'` used to create a directory
# literally called `~` for every heredoc while scp expanded the tilde itself, so the harness landed in
# two places and every session died at once with "start.sh: No such file or directory".
REMOTE_DIR="$("${SSH[@]}" "mkdir -p $DIR && cd $DIR && pwd")"
[ -n "$REMOTE_DIR" ] || { echo "could not create or resolve $DIR on $TARGET" >&2; exit 1; }

say "harness → $TARGET:$REMOTE_DIR"
"${SSH[@]}" "mkdir -p '$REMOTE_DIR'/{orchestrator,builder,critic,guest,outbox,artifacts}"
scp -q "${SCP_KEY[@]}" "$HERE/agent.py" "$HERE/view.py" "$HERE/console.sh" "$HERE/audit.py" "$HERE/client.py" "$TARGET:$REMOTE_DIR/"
"${SSH[@]}" "chmod +x '$REMOTE_DIR'/*.py '$REMOTE_DIR'/*.sh 2>/dev/null || true"
ok "agent.py view.py console.sh audit.py client.py"

say "skills → $REMOTE_DIR/skills"
if [ -d "$SKILLS_SRC" ]; then
  TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
  for s in $SKILLS; do
    [ -f "$SKILLS_SRC/$s/SKILL.md" ] && mkdir -p "$TMP/$s" && cp -a "$SKILLS_SRC/$s/." "$TMP/$s/" || true
  done
  # Never a secret, never a client: the sync is an allowlist of skill names, and these two guards are
  # the belt on top of it.
  find "$TMP" -type d \( -name 'clients' -o -name 'secret*' -o -name '.git' \) -prune -exec rm -rf {} + 2>/dev/null || true
  find "$TMP" -type f \( -name '*.env' -o -name '*.key' -o -name '*.pem' -o -name 'credentials*' \) -delete 2>/dev/null || true
  # --delete only into a directory this swarm owns. On host A skills/ is a symlink to a copy both
  # swarms share, and deleting "extras" there would take them from the other swarm's session too.
  DEL="--delete"
  if "${SSH[@]}" "test -L '$REMOTE_DIR/skills'"; then DEL=""; fi
  rsync -a $DEL -e "ssh ${SSH_KEY:+-i $SSH_KEY}" "$TMP/" "$TARGET:$REMOTE_DIR/skills/"
  ok "$(echo $SKILLS | wc -w) skills$([ -z "$DEL" ] && echo ' (shared copy: added, never pruned)'), no client folders, no key material"
else
  ok "no local skills at $SKILLS_SRC; leaving whatever is on the host"
fi
if [ -n "$RESOURCES_SRC" ] && [ -d "$RESOURCES_SRC" ]; then
  rsync -a --delete --exclude '.git' --exclude 'clients' -e "ssh ${SSH_KEY:+-i $SSH_KEY}" "$RESOURCES_SRC/" "$TARGET:$REMOTE_DIR/resources/"
  ok "resources synced from $RESOURCES_SRC"
fi

say "environment → $REMOTE_DIR/env.sh"
"${SSH[@]}" "cat > '$REMOTE_DIR/env.sh'" <<EOF
# written by swarm/deploy.sh — every value came from an argument, nothing is typed into a script
export SWARM_DIR="$REMOTE_DIR"
export SWARM_NAME="$NAME"
export SESSION_PREFIX="$PREFIX"
export OPENAI_BASE="$BASE"
export MODEL="$MODEL"
export API_BASE="$API"
export NODE_NAME="$NODE"
export LINEAGE="$LINEAGE"
export BASELINE="$BASELINE"
export EDITABLE="$EDITABLE"
export SKILLS_DIR="$REMOTE_DIR/skills"
export WORKDIR="$REMOTE_DIR/ethplane"
export LEAN="$REMOTE_DIR/leanVM"
$([ "$DESIGN" = 1 ] && echo 'export DESIGN=1')
EOF
ok "swarm $NAME · lineage $LINEAGE · model ${MODEL##*/} · $([ "$DESIGN" = 1 ] && echo 'design mode' || echo "node ${NODE:-unset}")"

say "start.sh and view.sh → $REMOTE_DIR"
"${SSH[@]}" "cat > '$REMOTE_DIR/start.sh'" <<'EOF'
#!/usr/bin/env bash
# start.sh <role> [--init "first message"]: one role of this swarm, in this swarm's environment.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; . "$HERE/env.sh"
ROLE="${1:?role: orchestrator | builder | critic | guest}"; shift || true
export ROLE
exec python3 "$HERE/agent.py" "$@"
EOF
"${SSH[@]}" "cat > '$REMOTE_DIR/view.sh'" <<'EOF'
#!/usr/bin/env bash
# view.sh: the View seat — a guest session in the same shape as the three role panes.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; . "$HERE/env.sh"
export ROLE=guest
exec python3 "$HERE/agent.py" "$@"
EOF
"${SSH[@]}" "chmod +x '$REMOTE_DIR/start.sh' '$REMOTE_DIR/view.sh'"
ok "start.sh <role> · view.sh"

if [ -n "$NODE" ]; then
  say "node brief → $REMOTE_DIR/node.md"
  "${SSH[@]}" "test -s '$REMOTE_DIR/node.md'" 2>/dev/null && ok "already there, left as it is" || {
    "${SSH[@]}" "cat > '$REMOTE_DIR/node.md'" <<EOF
# $NODE

Lineage $LINEAGE. Baseline $BASELINE cycles. Editable surface: $EDITABLE.
A submission counts only when the measured cycle count is strictly below the baseline, measured by
the \`measure\` tool and re-measured by the critic. The node page and the criterion are at
$API/node — read them before the first hypothesis.
EOF
    ok "written (deploy.sh never overwrites one that exists)"
  }
fi

say "sessions"
for r in orchestrator builder critic; do
  S="${PREFIX}${r}"
  if "${SSH[@]}" "tmux has-session -t '$S' 2>/dev/null"; then
    if [ "$RESTART" = 1 ]; then
      "${SSH[@]}" "tmux kill-session -t '$S'; tmux new-session -d -s '$S' \"bash $REMOTE_DIR/start.sh $r\""
      ok "$S restarted"
    else
      ok "$S already running (--restart to replace it)"
    fi
  else
    "${SSH[@]}" "tmux new-session -d -s '$S' \"bash $REMOTE_DIR/start.sh $r\""
    sleep 1
    if "${SSH[@]}" "tmux has-session -t '$S' 2>/dev/null"; then ok "$S created"
    else echo "   FAILED: $S exited immediately — run: ssh $TARGET bash $REMOTE_DIR/start.sh $r" >&2; exit 1; fi
  fi
done
S="${PREFIX}view"
if "${SSH[@]}" "tmux has-session -t '$S' 2>/dev/null"; then
  [ "$RESTART" = 1 ] && { "${SSH[@]}" "tmux kill-session -t '$S'; tmux new-session -d -s '$S' \"bash $REMOTE_DIR/view.sh\""; ok "$S restarted"; } || ok "$S already running"
else
  "${SSH[@]}" "tmux new-session -d -s '$S' \"bash $REMOTE_DIR/view.sh\""
  sleep 1
  if "${SSH[@]}" "tmux has-session -t '$S' 2>/dev/null"; then ok "$S created"
  else echo "   FAILED: $S exited immediately — run: ssh $TARGET bash $REMOTE_DIR/view.sh" >&2; exit 1; fi
fi

say "put it in the grid on the Mac"
ATTACH="$HOME/Desktop/1_projects/coharness/dogfood/remote-attach.sh"
n=2
echo "  dogfood/quad-slot.sh 1 remote --cmd \"$ATTACH $TARGET tmux attach -t ${PREFIX}orchestrator\" --model $LINEAGE --label orchestrator"
for r in builder critic view; do
  echo "  dogfood/quad-slot.sh $n remote --cmd \"$ATTACH $TARGET tmux attach -t ${PREFIX}${r}\" --model $LINEAGE --label $r"
  n=$((n + 1))
done
echo
echo "  audit: ssh $TARGET python3 $REMOTE_DIR/audit.py --journal ethplane-${NAME}-builder"
