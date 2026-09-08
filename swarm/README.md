# Swarm Tooling

This directory contains portable swarm tooling that can be used on any host. The swarm consists of three roles: orchestrator, builder, and critic, working together to accomplish tasks.

## Role Descriptions

- **Orchestrator**: Manages the workflow using four tools: `board_plan`, `handoff`, `report`, and `read_board`. Plans tasks, hands off work to builder/critic, and consolidates results.
- **Builder**: Implements the actual work requested in handoffs. Edits files under `$SWARM_DIR/leanVM` in specific locations only (guests/aggregate.py and lean_compiler/). 
- **Critic**: Verifies the builder's work by running measurements and checking diffs against the base.

## Menu Presets

The menu system provides several presets for different workflows:
1. **SOLO autoresearch** - One model working through hypothesis→edit→build→measure
2. **HUB-SPOKE swarm** - Orchestrator + builder + critic working together with shared board
3. **ROUTED autoresearch** - Loop with routing table for A/B testing
4. **VERIFY** - Build, measure baseline, and run verifier
5. **BRIEF** - Show node brief (roadmap item, criterion, state)
6. **STATUS** - View board, arms, and GPU status

## Configuration

To point at a vLLM host, set the `OPENAI_HOST` environment variable:
```bash
export OPENAI_HOST=http://your-vllm-host:port
```

## Joining a Node

To join an existing node, run:
```bash
bash $SWARM_DIR/node-brief.sh
```

This reads the documentation from `docs/CRITERION-<node>.md` to understand the specific task requirements.

## Lessons

1. **Local Model Orchestrator Gets Four Tools and No Shell**: The orchestrator role is restricted to just four specific tools for workflow management, with no direct shell access.

2. **The Critic Must Quote Measured Numbers**: When reviewing work, the critic must quote the actual measured numbers from their verification runs.