# AI attribution

ETHGlobal requires that submissions document which code, files or assets were generated or assisted by AI. This file is the record and is updated at each review round.

| Path | Origin |
|---|---|
| contracts/, script/, test/ | Claude builder sessions (Opus) with the Qwen swarm on day 1 for scaffolding. |
| api/ | Qwen builder day 1; Claude builder for the indexer dedupe, join route, live-node metadata and tests. |
| web/ | Qwen builder day 1 and day 3 token work; Claude builder for Strawmap.tsx, layout.ts, Panel.tsx and the redesign. |
| cli/ | Qwen builder day 1; Claude builder for the real resolve and join. |
| verifier/ | Claude builder (run.py, watch.py, build user, probes, tests). |
| swarm/agent.py, console.sh, view.py, shoot.cjs and the start scripts | the Claude orchestrator session, replacing goose on day 3; swarm/client.py: Claude builder, resume subcommand by Qwen swarm B. |
| docs/FILM.md, docs/SUBMISSION.md, docs/DECK.md | the Claude orchestrator session from the record, voice-checked, for Pat to record. |
| docs/JUDGES.md, ENS-PROBES.md, REHEARSAL.md, DEPLOYMENTS.md, CRITERION | Claude builder, reviewed by the Claude critic. |
| docs/SPEC.md | Claude builder day 1 (as-built sections after each review round); Qwen swarm for the first draft. |
| docs/JOIN.md, docs/ROLES.md | Qwen builder day 1; Claude builder for the session vocabulary and the join flow as shipped. |
| scripts/ | check-submission.sh and rehearsal.sh: Claude builder. |
| docs/planning/ | the redacted private PRD and the day-one specs: the Claude orchestrator session; the boards: the two Qwen swarms' own sessions. |
| research/ | Claude researcher and builder sessions. |
| Direction and every decision | Pat. |