# Roles in a swarm

A swarm is four panes on one host: an orchestrator, a builder, a critic, and a View seat where a
person sits. Each pane is the same program, `swarm/agent.py`, started with a different role. A role
is defined by the tools it holds, not by the instructions it is given, so this file lists the tools.

The tool names below are the entries of `ROLE_TOOLS` in `swarm/agent.py`. That file is on the
`swarm-native` branch and is in a branch under trial, not merged.

## Orchestrator

Six tools: `board_plan`, `handoff`, `report`, `read_board`, `wait`, `skill`. No shell, no file
tools. The orchestrator cannot read or write a file, run a command, or measure anything, so the only
way it can move work is to hand it to a peer.

`handoff` takes a role, a task, the files, and a `done_when`. It accepts `builder` or `critic`. It
refuses a second handoff to a peer that has not reported on the first, and it refuses a `done_when`
that is not checkable: a number, a path, or a command and what it must print. `wait` is the tool for
the time between a handoff and a report. When `IDLE_NUDGE` is set, a pane that has been silent for
`IDLE_SECONDS` (240 by default) receives that text as a message rather than sitting idle.

## Builder

Eleven tools: `bash`, `read_file`, `write_file`, `edit_file`, `measure`, `submit`, `revert`,
`report`, `read_board`, `skill`, `resources`.

The builder edits a checkout of leanVM, and the editable surface is a fixed list of paths. `measure`
refuses to run when anything outside that surface is modified, and refuses when nothing inside it has
changed since the reference. A measurement of an unchanged tree is the number the builder already
has. It runs the benchmark, parses the cycle count, and appends the result to the board as
`MEASURED: cycles=<n> baseline=<n>` with the diffstat, whether the number is good or not.

`submit` refuses unless the last measured cycle count is strictly below the baseline, and refuses if
anything outside the editable surface has changed. It does not send a transaction: it writes a flag
into the swarm's outbox, and a separate submitter loop sends it. No tool in this list reads a key.

When the swarm is started with `DESIGN` set, the builder works on the website instead of the
benchmark and `measure`, `submit` and `revert` are removed from its tool set. It builds the site with
`bash`.

## Critic

Eight tools: `bash`, `read_file`, `measure`, `board`, `report`, `read_board`, `skill`, `resources`.

The critic has a shell, because verifying a number means running the thing again. It has no file
tools, and its shell refuses any command that mutates: `sed -i`, `tee`, `rm`, `mv`, `cp`, `git
checkout`, `git reset`, `git apply`, `git stash`, `git commit`, `git clean`, `python -c`, and output
redirection. A critic that cannot edit cannot fix the thing it is judging.

The critic re-runs `measure` on the same tree and compares its own number with the builder's. A PASS
quotes the number the critic measured. A FAIL quotes both numbers.

## The View seat

Ten tools: `status`, `watch`, `brief`, `page`, `read_file`, `read_board`, `bash`, `ask_orchestrator`,
`join`, `skill`. The same mutation guard applies to this shell as to the critic's. The seat reads the
tree, watches the swarm, and passes a request to the orchestrator in the person's own words. `join`
adds `write_file`, `edit_file`, `measure`, `submit` and `revert`, for a person who wants to work
rather than watch. Slash shortcuts call the same tools: `/status`, `/verifier`, `/board`, `/session`,
`/brief`, `/page`, `/join`. The seat runs over `swarm/console.sh` and `swarm/view.py`.

## What every role shares

Every tool call carries a `why`: one line, present tense, under 100 characters, rendered in the pane
so a person watching can read what the model is doing.

`report` and `board` refuse a claim that arrives without evidence: a measured number, the output of
a command, or a `path:line`. `report` refuses a second report on the same task, and it ends the
turn.

The board is append-only. A line is superseded by name, never rewritten.

Every line is mirrored to journald as it is written, tagged `ethplane-<swarm>-<role>`, and each entry
carries the SHA-256 of the previous one. An agent can rewrite its own transcript file; it cannot
rewrite the journal. `audit.py --journal` reads the journal rather than the transcript.

## Board lines

| line | meaning |
|---|---|
| `PLAN` | the orchestrator's decomposition: builder task, critic task, files |
| `HANDOFF` | work passed to a peer: task, files, done_when |
| `MEASURED` | the builder's benchmark result, with the baseline and the diffstat |
| `REVIEW` | the critic's re-run: PASS or FAIL, with the number it measured |
| `SUBMIT` | the builder flagged a submission; the submitter loop sends it |
| `REPORT` | a result returned to the orchestrator, with its evidence |
| `IDLE` | a lane is empty, stated rather than filled with invented work |
