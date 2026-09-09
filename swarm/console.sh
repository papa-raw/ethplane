#!/usr/bin/env bash
# console.sh: the VIEW pane. Title, scoreboard, and a menu of what a person can watch or do on this node.
# Env (set by view.sh): NODE_ID NODE_NAME SWARM_DIR API_BASE LINEAGES LINEAGE VERIFIER_LOG SUBMITTER_LOG JOIN_URL
SW="${SWARM_DIR:-$HOME/swarm}"; export SWARM_DIR="$SW"
B=$'\e[1m'; D=$'\e[2m'; G=$'\e[38;5;71m'; A=$'\e[38;5;153m'; R=$'\e[0m'
W=$(tput cols 2>/dev/null || echo 80); [ "$W" -gt 100 ] && W=100
H=$(tput lines 2>/dev/null || echo 40)

title() {
  clear
  bash "$SW/landing.sh" masthead "VIEW" 2>/dev/null
  echo
}
scoreboard() { python3 "$SW/view.py" --once --rows "$1"; }
menu() {
  echo
  printf "  ${B}%s${R}  ${G}%-9s${R} ${D}%s${R}\n" 1 verifier "watch the judge build, measure and record verdicts (live)"
  printf "  ${B}%s${R}  ${G}%-9s${R} ${D}%s${R}\n" 2 board    "the workers' board, live"
  printf "  ${B}%s${R}  ${G}%-9s${R} ${D}%s${R}\n" 3 session  "this lineage's heartbeats and submissions (live)"
  printf "  ${B}%s${R}  ${G}%-9s${R} ${D}%s${R}\n" 4 brief    "the node: roadmap item, criterion, editable surface"
  printf "  ${B}%s${R}  ${G}%-9s${R} ${D}%s${R}\n" 5 page     "node page and join link"
  printf "  ${B}%s${R}  ${G}%-9s${R} ${D}%s${R}\n" j join     "work this node from this pane (a builder session)"
  printf "  ${B}%s${R}  ${G}%-9s${R} ${D}%s${R}\n" v view     "the full dashboard, scrollable"
  printf "  ${D}r refresh · q shell${R}\n"
}
follow() { # follow <title> <file>: live tail until q
  clear; printf "${A}${B}%s${R}  ${D}(q returns to the menu)${R}\n\n" "$1"
  if [ ! -r "$2" ]; then echo "  ${D}not readable here: $2${R}"; read -rsn1 -t 60 _; return; fi
  tail -n $((H - 4)) -f "$2" &
  local tp=$!
  while read -rsn1 k; do [ "$k" = q ] && break; done
  kill $tp 2>/dev/null; wait $tp 2>/dev/null
}
page() {
  clear; printf "${A}${B}%s${R}\n\n" "$NODE_NAME"
  echo "  node page   ${A}${API_BASE}/node/${NODE_ID}${R}"
  echo "  join        ${A}${JOIN_URL:-$API_BASE/join}${R}"
  echo "  docs        ${A}${API_BASE}/docs${R}"
  echo
  echo "  ${D}A session is a declaration: working on this node, from head H. Heartbeats keep it live; it"
  echo "  lapses when they stop. Anyone may start one; many run on one node at once. Submissions"
  echo "  are judged by the node's verifier and recorded on Sepolia.${R}"
  echo; echo "  ${D}any key returns${R}"; read -rsn1 _
}
join() {
  clear; echo "  ${B}Joining ${NODE_NAME} as a builder from this pane.${R}"
  echo "  ${D}You get the builder's tools (read, edit, measure, submit, revert). Type a task at the prompt;"
  echo "  the orchestrator's handoffs go to the swarm's own builder, not to you. Ctrl-C returns.${R}"; sleep 2
  ROLE=builder SESSION_PREFIX="${SESSION_PREFIX:-qwen-}" SWARM_NAME="${SWARM_NAME:-guest}" python3 "$SW/agent.py"
}
while true; do
  title; scoreboard $(( H - 22 > 6 ? H - 22 : 6 )); menu
  read -rsn1 c
  case "$c" in
    1) follow "VERIFIER · $NODE_NAME" "$VERIFIER_LOG" ;;
    2) follow "BOARD · $SW" "$SW/board.md" ;;
    3) follow "SESSION · ${LINEAGE:-lineage}" "$SUBMITTER_LOG" ;;
    4) clear; less -R "$SW/node.md" 2>/dev/null || { echo "no node.md"; sleep 1; } ;;
    5) page ;;
    j) join ;;
    v) python3 "$SW/view.py" ;;
    q) clear; exec bash -l ;;
    *) ;;
  esac
done
