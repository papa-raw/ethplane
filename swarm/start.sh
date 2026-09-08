#!/usr/bin/env bash
# one goose session per role in its own tmux session ($SWARM_PREFIX<role>); the node brief is regenerated and the role's init prompt typed once goose is ready
export GOOSE_MAX_TOKENS=16000 OPENAI_MAX_TOKENS=16000 PATH=$HOME/.local/bin:$PATH OPENAI_HOST=http://127.0.0.1:8000 OPENAI_BASE_PATH=v1/chat/completions OPENAI_API_KEY=local
role="$1"; cd ~/swarm/$role; SYS=$(cat system.txt); cd ~/swarm/ethplane
bash ~/swarm/landing.sh masthead "$(echo $role | tr a-z A-Z)"
ROLE=$role PATH=$HOME/swarm/bin:$PATH board READY >/dev/null
~/swarm/node-brief.sh
while true; do
  goose session --provider openai --model Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8 -n "swarm-a-$role-$(date +%m%d-%H%M)" --with-builtin developer --max-turns 400 --system "$SYS"
  echo "[swarm] $role session ended; restarting in 5 s (Ctrl-C to stop)"; sleep 5
done