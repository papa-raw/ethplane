# Swarm Client

The swarm client handles communication between swarm nodes and the ethplane blockchain.

## client.py

### Environment Variables

The client reads these environment variables:
- `LINEAGE_KEY_FILE`: Path to the lineage private key file (600 permissions)
- `LINEAGE_NAME`: Name of the lineage (e.g., 'qwen-a')
- `OPERATOR_ADDRESS`: Ethereum address of the operator
- `ETHPLANE_ADDRESS`: Address of the ethplane contract
- `SEPOLIA_RPC_URL`: RPC URL for Sepolia network
- `API_BASE`: Base URL for ethplane API (e.g., `https://ethplane.ecofrontiers.xyz`)
- `NODE_ID`: Unique identifier for this node
- `WORKTREE`: Path to the lineage's leanVM worktree
- `EDITABLE`: Comma-separated list of paths that can be modified (e.g., `crates/rec_aggregation/guests/aggregate.py,crates/lean_compiler/`)

### Commands

#### register
Dry-run example:
```
cast send 0xabcdefabcdefabcdefabcdefabcdefabcdefabcd registerLineage(address,bytes32) 0x1234567890123456789012345678901234567890 0xda2bc9acedbf823d64667d9265e49a6b8085565bfd4b880c07908de227556f58 --private-key-file /tmp/key.pem --rpc-url https://sepolia.infura.io/v3/1234567890
```

#### claim [fromHash]
Dry-run example:
```
cast send 0xabcdefabcdefabcdefabcdefabcdefabcdefabcd claim(bytes32,bytes32) 0x1234567890123456789012345678901234567890123456789012345678901234 0x0000000000000000000000000000000000000000000000000000000000000000 --private-key-file /tmp/key.pem --rpc-url https://sepolia.infura.io/v3/1234567890
```

#### heartbeat
Dry-run example:
```
cast send 0xabcdefabcdefabcdefabcdefabcdefabcdefabcd heartbeat(bytes32) 0x1234567890123456789012345678901234567890123456789012345678901234 --private-key-file /tmp/key.pem --rpc-url https://sepolia.infura.io/v3/1234567890
```

#### submit [parents...]
Dry-run example:
```
POST https://ethplane.ecofrontiers.xyz/api/artifacts
Content-Type: application/x-tar
X-Artifact-Hash: 0x977439d828df7b253320b0c4cb4b2fbfd4a1b0e4f2890543427e3d634cc17f20
cast send 0xabcdefabcdefabcdefabcdefabcdefabcdefabcd submit(bytes32,bytes32,bytes32[]) 0x1234567890123456789012345678901234567890123456789012345678901234 0x977439d828df7b253320b0c4cb4b2fbfd4a1b0e4f2890543427e3d634cc17f20 parent1,parent2 --private-key-file /tmp/key.pem --rpc-url https://sepolia.infura.io/v3/1234567890
```

#### status
Dry-run example:
```
GET https://ethplane.ecofrontiers.xyz/api/nodes/0x1234567890123456789012345678901234567890123456789012345678901234
GET https://ethplane.ecofrontiers.xyz/api/nodes/0x1234567890123456789012345678901234567890123456789012345678901234/submissions
```

## watch.py

See [verifier/README.md](../verifier/README.md) for details about the verifier watch functionality.
## What the day said, and what changed because of it

`audit.py` reads a transcript and counts the shapes a report can hide in. Run over the six sessions
of 2026-09-09 (two swarms × orchestrator, builder, critic), before any of the changes below:

| session | turns | unevidenced report | unread claim | handoff spam | edit without build | read failure | critic edit refused |
|---|---:|---:|---:|---:|---:|---:|---:|
| A orchestrator | 1401 | 33 | 6 | 12 | – | 0 | – |
| A builder | 1173 | 7 | 5 | – | 6 | 9 | – |
| A critic | 820 | 2 | 1 | – | 0 | 0 | 19 |
| B orchestrator | 555 | 2 | 0 | 27 | – | 0 | – |
| B builder | 712 | 0 | 0 | – | 0 | 16 | – |
| B critic | 798 | 3 | 31 | – | 0 | 5 | 26 |
| **total** | **5459** | **47** | **43** | **39** | **6** | **30** | **45** |

Read the columns as sentences. Forty-seven times a session said a thing was done with no number, no
path and no command output in the line — one of them a critic's PASS. Forty-three times a claim named
a file that session had never opened; thirty reads went to paths that were not there at all, which is
the same failure seen from the other side. Thirty-nine times an orchestrator handed a peer a second
task while the first was unanswered — swarm A's sent 395 reports against 289 handoffs, a loop feeding
a throttle. Forty-five times a critic's shell tried to edit the tree it was judging and was refused by
the tool, which is the one number here that is a system working rather than failing.

Prose did not hold any of it: every one of these sessions ran under a system prompt that said not to.
So the rules are tool contracts now.

  * `report` and `board` refuse a done-claim whose `evidence` is not a number, a command's output or a
    `path:line`, and refuse any claim naming a path this session never read or wrote.
  * `report` is once per incoming task. A second one is refused until the next message arrives.
  * `handoff` refuses a second handoff to a peer that owes a report, and refuses a `done_when` that no
    command could decide.
  * `read_file` on a path that is not there answers with what the directory *does* hold, so the model
    corrects instead of continuing from memory.
  * the critic's shell still refuses to mutate, and a PASS must quote the critic's own re-run.
  * `skill()` lists this role's skills with their trigger lines and loads one; the allowlists mirror
    `dogfood/roles/toolkits` on the Claude side.

`swarm/tests/test_agent.py` holds one case per contract, each named after the shape it refuses.

## Reading the record rather than the report

The transcript under `<swarm>/<role>/transcript.jsonl` belongs to the user the agent runs as, so an
audit of it is an audit of a self-report. Every line is therefore mirrored to journald as it is
written, tagged `ethplane-<swarm>-<role>`, and chained: each line carries the sha256 of the one before
it, so a line cannot be removed from the middle of either copy without breaking the join, and the two
copies can be checked against each other.

```
audit.py <transcript.jsonl>                     # the file, which the agent user can rewrite
audit.py --journal ethplane-swarm-a-builder     # the journal, which it cannot
```

The model's shell can call `logger -t <tag>` like any other program, so the journal reader trusts
journald's own metadata rather than the message: the harness announces its pid in its first line, and
only entries whose `_PID` matches it and whose `_COMM` is `python3` are counted. Anything else under
the tag is reported as an INJECTION and counted nowhere. That is what makes a clean verdict mean *the
swarm behaved*, rather than *the swarm reported that it behaved*.

## Putting a swarm somewhere

```
swarm/deploy.sh <ssh-target> <swarm-dir> --lineage <name> --model <vllm-model> \
    [--node <ens-name>] [--design] [--restart]
```

Idempotent, and everything host-specific is an argument: the harness, the skills copy, the per-swarm
`env.sh`, `start.sh`, `view.sh`, the node brief, the tmux sessions, and the four
`quad-slot.sh <n> remote --cmd …` lines that put the swarm in the Coharness grid. It never overwrites
a node brief that exists and never restarts a running session without `--restart` — a swarm in the
middle of a measurement is not something a deploy should end.

## The View seat

The fourth pane is a session like the other three: `ROLE=guest`, the same prompt zone and rendering,
opening on the landing masthead and the scoreboard. A person types in plain words. `status` is the
scoreboard, `watch` tails the board, the judge, the sessions or the GPU, `brief` and `page` answer
"what is this node", and `ask_orchestrator` carries the person's words to the orchestrator's pane
verbatim, prefixed "from the View seat" — the seat never does swarm work and never says it did.
`join()` hands this pane the builder's tools if the person wants to work. `/status /verifier /board
/session /brief /page /join` reach the same tools, and `/help` lists them.
