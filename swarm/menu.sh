#!/usr/bin/env bash
# Ethplane node menu v2: the entry point of the orchestrator quadrant. Fits an 84-column pane; boxed header; two-line presets.
export PATH=$HOME/.local/bin:$HOME/.cargo/bin:$PATH
NODE=cl-pq-leanxmss-attestations; HOST=qwen-a; LEAN=$SWARM_DIR/leanVM
B=$'\e[1m'; D=$'\e[2m'; C=$'\e[38;5;80m'; Y=$'\e[38;5;221m'; G=$'\e[38;5;114m'; M=$'\e[38;5;141m'; R=$'\e[0m'
cd $SWARM_DIR
state() {
  best=$(grep -h '"best_cycles"' ~/overnight/*.jsonl 2>/dev/null | python3 -c 'import sys,json
v=[json.loads(l).get("best_cycles") for l in sys.stdin if "best_cycles" in l]
print(f"{min(v):,}" if v else "none")' 2>/dev/null)
  attempts=$(cat ~/overnight/*.jsonl 2>/dev/null | grep -c '"attempt"')
  loops=""; pgrep -f "overnight.py solo" >/dev/null && loops="solo"; pgrep -f "overnight.py routed" >/dev/null && loops="${loops:+$loops+}routed"
  peers=0; for r in builder critic; do tmux has-session -t qwen-$r 2>/dev/null && peers=$((peers+1)); done
  gpu=$(nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits 2>/dev/null | head -1)
  tok=$(tail -n 80 ~/logs/vllm-8000.log 2>/dev/null | grep -o "generation throughput: [0-9.]*" | tail -1 | awk '{printf "%.0f", $3}')
}
row() { printf "  ${B}%s${R}  ${G}%-22s${R} ${D}%s${R}\n      %s\n" "$1" "$2" "$3" "$4"; }
header() {
  state; bash $SWARM_DIR/landing.sh full "ORCHESTRATOR"
  echo
  echo "  ${B}Presets${R} ${D}· one topology per task shape${R}"
  printf "  ${B}%s${R}  ${G}%-20s${R} %-38s ${D}%s${R}\n" 1 "SOLO autoresearch"   "one model, hypothesis→edit→build→measure" "C1"
  printf "  ${B}%s${R}  ${G}%-20s${R} %-38s ${D}%s${R}\n" 2 "HUB-SPOKE swarm"     "orchestrator + builder + critic, board"   "C3"
  printf "  ${B}%s${R}  ${G}%-20s${R} %-38s ${D}%s${R}\n" 3 "ROUTED autoresearch" "the loop with the routing table, A/B vs 1" "C2"
  printf "  ${B}%s${R}  ${G}%-20s${R} %-38s ${D}%s${R}\n" 4 "VERIFY"              "build, measure baseline, run verifier"    "check"
  printf "  ${B}%s${R}  ${G}%-20s${R} %-38s ${D}%s${R}\n" 5 "BRIEF"               "node.md: roadmap item, criterion, state"  "read"
  printf "  ${B}%s${R}  ${G}%-20s${R} %-38s ${D}%s${R}\n" 6 "STATUS"              "board tail · arms · GPU"                  "read"
  printf "  ${B}%s${R}  ${G}%-20s${R} %-38s ${D}%s${R}\n" t "TASK"                "type a task; plan → handoffs → report"    "C3"
  echo "  ${D}q  shell${R}"
  echo
}
ensure_peers() { for r in builder critic; do tmux has-session -t qwen-$r 2>/dev/null || tmux new-session -d -s qwen-$r -x 200 -y 50 "bash $SWARM_DIR/start.sh $r"; done; }
task_orchestrator() { # the human's own task becomes the init prompt
  read -rp "  task › " task; [ -z "$task" ] && return
  cd $SWARM_DIR/orchestrator; $SWARM_DIR/node-brief.sh
  printf '%s' "Node cl-pq-leanxmss-attestations.ethplane.eth. TASK FROM THE HUMAN: $task  Do now, one tool per turn: (1) board_plan with three short lines; (2) handoff to builder with task, files and done_when; (3) handoff to critic with what to verify and how; (4) write: waiting for reports." > task-init.txt
  export OPENAI_HOST=http://127.0.0.1:8000 OPENAI_BASE_PATH=v1/chat/completions OPENAI_API_KEY=local
  ensure_peers
  ( for i in $(seq 1 60); do sleep 2; if tmux capture-pane -t qwen-orchestrator -p 2>/dev/null | grep -q "Enter to send"; then sleep 2; tmux send-keys -t qwen-orchestrator -l "$(tr '\n' ' ' < task-init.txt)"; sleep 1; tmux send-keys -t qwen-orchestrator Enter; break; fi; done ) &
  GOOSE_TELEMETRY_ENABLED=false XDG_CONFIG_HOME=$SWARM_DIR/orch-config goose session --provider openai --model Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8 --with-extension "$SWARM_DIR/venv/bin/python $SWARM_DIR/orch_mcp.py" -n "swarm-task-$(date +%m%d-%H%M)" --max-turns 40 --system "$(cat system.txt)"
  cd $SWARM_DIR
}
run_orchestrator() {
  cd $SWARM_DIR/orchestrator; $SWARM_DIR/node-brief.sh
  export OPENAI_HOST=http://127.0.0.1:8000 OPENAI_BASE_PATH=v1/chat/completions OPENAI_API_KEY=local
  ( for i in $(seq 1 60); do sleep 2; if tmux capture-pane -t qwen-orchestrator -p 2>/dev/null | grep -q "Enter to send"; then sleep 2; tmux send-keys -t qwen-orchestrator -l "$(tr '\n' ' ' < init.txt)"; sleep 1; tmux send-keys -t qwen-orchestrator Enter; break; fi; done ) &
  GOOSE_TELEMETRY_ENABLED=false XDG_CONFIG_HOME=$SWARM_DIR/orch-config goose session --provider openai --model Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8 --with-extension "$SWARM_DIR/venv/bin/python $SWARM_DIR/orch_mcp.py" -n "swarm-orchestrator-$(date +%m%d-%H%M)" --max-turns 60 --system "$(cat system.txt)"
  cd $SWARM_DIR
}
arm() { # arm name
  if pgrep -f "overnight.py $1" >/dev/null; then echo "${D}$1 arm already running; its log follows (q returns to the menu)${R}"; sleep 1
  else read -rp "attempts [250]: " n; n=${n:-250}; nohup $SWARM_DIR/venv/bin/python $SWARM_DIR/overnight.py "$1" $SWARM_DIR/arm-$1 $SWARM_DIR/overnight/$1-menu-$(date +%H%M).jsonl "$n" 9 > $SWARM_DIR/overnight/$1-menu.out 2>&1 & sleep 2; fi
  less +F "$(ls -t $SWARM_DIR/overnight/$1*.jsonl | head -1)"
}
while true; do
  header; read -rp "  preset › " c
  case "$c" in
    1) arm solo ;;
    2) ensure_peers; echo "  ${D}builder and critic are up in panes 2 and 3; the orchestrator starts with the node brief.${R}"; sleep 1; run_orchestrator ;;
    3) arm routed ;;
    4) echo "  building and measuring at $(git -C $LEAN rev-parse --short HEAD) …"; (cd $LEAN && cargo run --release -- aggregate --xmss 900 --log-inv-rate 1 --repeat 3 2>&1 | grep -E "cycles|proving time|proof size|verifying"); read -rp "  enter to return " _ ;;
    5) less $SWARM_DIR/node.md ;;
    6) { echo "== board"; tail -n 20 $SWARM_DIR/board.md; echo; echo "== arms"; for f in $(ls -t $SWARM_DIR/overnight/*.jsonl | head -3); do echo "$f: $(grep -c '"attempt"' "$f") attempts"; done; echo; nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total --format=csv; } | less ;;
    t) task_orchestrator ;;
    q) exec bash -l ;;
    *) ;;
  esac
done