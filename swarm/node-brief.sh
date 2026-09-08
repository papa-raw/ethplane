#!/usr/bin/env bash
# Assemble the node brief the swarm initialises from: roadmap record + criterion + live state. Re-run on every join.
cd $SWARM_DIR
best=$(grep -h '"best_cycles"' ~/overnight/*.jsonl 2>/dev/null | python3 -c 'import sys,json
v=[json.loads(l).get("best_cycles") for l in sys.stdin if "best_cycles" in l]
print(min(v) if v else "none recorded")' 2>/dev/null)
attempts=$(cat ~/overnight/*.jsonl 2>/dev/null | grep -c '"attempt"')
{
  echo "# NODE BRIEF: cl-pq-leanxmss-attestations.ethplane.eth   (generated $(date '+%Y-%m-%d %H:%M') by node-brief.sh)"
  echo
  echo "## 1. The roadmap item (what the Ethereum roadmap says this node is)"
  cat node-record.md
  echo
  echo "Plain words: the consensus layer moves to post-quantum, hash-based signatures (leanXMSS). Attesting validators sign every slot, so aggregating many XMSS signatures into one succinct proof must be cheap. leanEthereum/leanVM is the EF zkVM built for exactly this, and its aggregate benchmark is the public test the roadmap item points at. Making that aggregation cheaper, measured in VM cycles, is a real contribution to this roadmap item."
  echo
  echo "## 2. The criterion attached to the node (docs/CRITERION-pq-leanxmss.md in the public repo)"
  cat CRITERION-pq-leanxmss.md
  echo
  echo "## 3. Live state"
  echo "- Repo on this host: $SWARM_DIR/leanVM at commit $(git -C $SWARM_DIR/leanVM rev-parse --short HEAD) (pinned a210ef1b). Baseline 1,542,812 cycles."
  echo "- Best so far on this host: $best"
  echo "- Attempts by the autoresearch arms so far: $attempts (most fail at the edit step: search text not found in the file; read the file before editing)."
  echo "- Board: $SWARM_DIR/board.md. Roles: qwen-orchestrator (the human types here), qwen-builder, qwen-critic."
} > node.md