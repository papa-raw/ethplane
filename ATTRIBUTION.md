# AI attribution

ETHGlobal requires that submissions document which code, files or assets were generated or assisted by AI. This file is the record and is updated with every commit.

| Path | Origin |
|---|---|
| contracts/, script/, test/, api/, web/ | Written by a Claude Code session (Anthropic Claude) from the private spec, reviewed by a second Claude session (critic), deployed by the orchestrator session. |
| verifier/, swarm/ | Written by local Qwen3-Coder-30B sessions in a builder role from the spec, verified by a Qwen critic session, then reviewed by a Claude critic (eleven fixes applied by the Qwen builder). The harness those sessions run in is `swarm/agent.py`, written for this project after the off-the-shelf one stopped at an action cap and rendered tool calls as parameter blocks; the roles, their tools and the honesty contracts are described in `swarm/README.md`. |
| docs/DECK.md, FILM.md, JOIN.md, ROLES.md, scripts/check-submission.sh | Written by the Qwen3-Coder-30B builder from the spec. |
| docs/ENS-PROBES.md, REHEARSAL.md | Written by a Claude builder session; every line in ENS-PROBES is a command and what it returned. |
| docs/SPEC.md, CRITERION-pq-leanxmss.md, DEPLOYMENTS.md, README.md | Written by the Claude orchestrator with Pat. |
| research/ | Research sessions (Claude), quotes verified in a browser. |
| Direction and every decision | Pat (Ecofrontiers). The private spec the sessions built from is not in this repository; the public design is docs/SPEC.md. |