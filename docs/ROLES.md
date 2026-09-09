# Roles in a swarm

A swarm is four panes on one host: an orchestrator, a designer, a builder and a critic. Each pane is
the same program, `swarm/agent.py`, started with a different role. A role is defined by the tools it
holds rather than by the instructions it is given, so this file lists the tools. Every name below is
an entry of `ROLE_TOOLS` in that file.

## Orchestrator

Five tools: `board_plan`, `handoff`, `report`, `read_board`, `wait`. No shell, no file tools. The
orchestrator cannot read a file, run a command or measure anything, so the only way it can move work
is to hand it to a peer.

`handoff` takes a role, a task, the files and a `done_when`. The role must be `builder`, `critic` or
`designer`. `wait` is the tool for the time between a handoff and a report.

## Designer

Ten tools: `skill`, `resources`, `read_file`, `write_file`, `edit_file`, `bash`, `screenshot`,
`board`, `report`, `read_board`. No `measure` and no `submit`: the designer works on the site, not on
the benchmark.

A user-interface request reaches the builder from the designer as a brief, a picked variant and
tokens, rather than as prose from the orchestrator. `report` enforces that order: it refuses unless
`web/design/variants/` holds at least three variant files and the swarm's `shots/` folder holds at
least three PNGs. A designer cannot report a direction it has not built and photographed three ways.

## Builder

Eleven tools: `bash`, `read_file`, `write_file`, `edit_file`, `measure`, `submit`, `revert`, `skill`,
`resources`, `report`, `read_board`.

The builder edits a checkout of leanVM, and the editable surface is a fixed list of paths. `measure`
refuses to run when anything outside that surface is modified, and refuses when nothing inside it has
changed since the reference. It runs the benchmark, parses the cycle count and the proof size, and
appends the result to the board as `MEASURED: cycles=<n> baseline=<n>` with the diffstat, whether the
number is good or not.

`submit` refuses on three conditions: the last measured cycle count is not strictly below the
baseline; the proof size is over `PROOF_MAX`, which the verifier would reject; or something outside
the editable surface has changed. It does not send a transaction. It writes a flag into the swarm's
outbox and a separate submitter loop sends it. No tool in this list reads a key.

When the swarm runs with `DESIGN` set, the builder works on the website instead of the benchmark:
`measure`, `submit` and `revert` are removed, and `build` and `screenshot` are added. `build` runs
`cd web && pnpm build`, counts the pages in `web/out`, and fails the build when fewer than `MIN_PAGES`
are generated, because a build that silently loses the node routes still exits zero. In this mode
`report` refuses without a passing build since the last report, and refuses when the accent colour is
found in no built file: tokens that are not applied are not a design.

## Critic

Eight tools: `bash`, `read_file`, `measure`, `skill`, `resources`, `board`, `report`, `read_board`.

The critic has a shell, because verifying a number means running the thing again. It has no file
tools, and its shell refuses any command that mutates: `sed -i`, `tee`, `rm`, `mv`, `cp`, `git
checkout`, `git reset`, `git apply`, `git stash`, `git commit`, `git clean`, `python -c`, and output
redirection. A critic that cannot edit cannot fix the thing it is judging.

The critic re-runs `measure` on the same tree and compares its own number with the builder's. A PASS
quotes the number the critic measured. A FAIL quotes both numbers.

## What every role shares

Every tool call carries a `why`: one line, present tense, under 100 characters, rendered in the pane
so a person watching can read what the model is doing.

`report` ends the turn, so a role does its whole piece before calling it, and every report is written
to the board and sent to the orchestrator's pane.

The board is append-only: `board_append` opens the file for appending and writes one stamped line. A
line is superseded by name, never rewritten.

## Board lines

| line | meaning |
|---|---|
| `PLAN` | the orchestrator's decomposition: builder task, critic task, done when |
| `HANDOFF` | work passed to a peer: task, files, done when |
| `MEASURED` | the builder's benchmark result, with the baseline, the proof size and the diffstat |
| `BUILD` | the site built, with the page count and whether the accent reached the output |
| `REVIEW` | the critic's re-run: PASS or FAIL, with the number it measured |
| `SUBMIT` | the builder flagged a submission; the submitter loop sends it |
| `REPORT` | a result returned to the orchestrator |
