#!/usr/bin/env bash
# landing.sh masthead <ROLE> | full  — the shared top of every Qwen pane (3 lines), or the full title screen (pane 1).
MODE="${1:-full}"; ROLE_LABEL="${2:-}"
C=$'\e[38;5;80m'; A=$'\e[38;5;221m'; D=$'\e[2m'; B=$'\e[1m'; R=$'\e[0m'; INV=$'\e[7m'
W=$( [ -n "$TMUX" ] && tmux display -p "#{pane_width}" 2>/dev/null || tput cols 2>/dev/null || echo 69 ); [ "$W" -gt 100 ] && W=100
best=$(grep -h '"best_cycles"' ~/overnight/*.jsonl 2>/dev/null | python3 -c 'import sys,json
v=[json.loads(l).get("best_cycles") for l in sys.stdin if "best_cycles" in l]
print(f"{min(v):,}" if v else "none")' 2>/dev/null)
attempts=$(cat ~/overnight/*.jsonl 2>/dev/null | grep -c '"attempt"')
gpu=$(nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits 2>/dev/null | head -1)
rule() { printf "${C}%s${R}\n" "$(printf '─%.0s' $(seq 1 "$W"))"; }
masthead() {
  local left=" ETHPLANE · cl-pq-leanxmss-attestations.ethplane.eth" right="${ROLE_LABEL:+$ROLE_LABEL · }qwen-a "
  local pad=$(( W - 1 - ${#left} - ${#right} )); [ $pad -lt 1 ] && pad=1
  printf "${C}${INV}%s%*s%s${R}\n" "$left" "$pad" "" "$right"
  if [ "$W" -ge 78 ]; then printf " ${D}cycles < ${R}${A}1,542,812${R}${D} @ a210ef1b  ·  best ${R}${B}%s${R}${D}  ·  %s attempts  ·  gpu %s%%${R}\n" "$best" "$attempts" "${gpu:-?}"
  else printf " ${D}cycles < ${R}${A}1,542,812${R}${D} · best ${R}${B}%s${R}${D} · %s attempts · gpu %s%%${R}\n" "$best" "$attempts" "${gpu:-?}"; fi
  rule
}
clear
masthead
[ "$MODE" = masthead ] && exit 0
cat <<EOF
${C}
   ┌──┐
   │h4│  ${B}█████ █████ █   █ ████  █     ███   █   █ █████${R}${C}
   ├──┤  ${B}█       █   █   █ █   █ █    █   █  ██  █ █    ${R}${C}
   │h3│  ${B}████    █   █████ ████  █    █████  █ █ █ ████ ${R}${C}
   ├──┤  ${B}█       █   █   █ █     █    █   █  █  ██ █    ${R}${C}
   │h2│  ${B}█████   █   █   █ █     █████ █   █  █   █ █████${R}${C}
   ├──┤
   │h1│  ${D}post-quantum hash-based attestations (leanXMSS), aggregated${R}${C}
   ├──┤  ${D}into one proof by leanVM · CL · cryptography · quantum · fork L${R}${C}
   │h0│  ${D}editable: guests/aggregate.py · lean_compiler/ · all else frozen${R}${C}
   └──┘
${R}
EOF