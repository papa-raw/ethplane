# Swarm Roles

## Orchestrator
The orchestrator has four tools: board_plan, handoff, report, read_board. The orchestrator has no shell access.

## Builder
The builder has shell access and editor access to editable paths only. The builder must read a file before editing and never uses git add -A.

## Critic
The critic measures and quotes numbers. The critic never edits files.

## Board Line Grammar

**READY** - Indicates work is ready for assignment

**PLAN** - Outlines work to be done with files and done when conditions

**HANDOFF** - Transfers work from one agent to another: task | files | done when

**REPORT** - Reports on completed work or progress

**REVIEW** - Evaluates work with PASS or FAIL outcomes
