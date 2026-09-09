# The Sepolia rehearsal

Thirteen transactions that put the whole protocol on chain in the order the film needs: two
lineages register and are accepted, the first starts a session and works, the first is killed, its
session lapses and anyone ends it, the second starts from the first one's artifact, and the verifier
judges both submissions.

Run it from the repository root on the host that holds the keys:

```
scripts/rehearsal.sh                             # print all thirteen commands, send nothing
scripts/rehearsal.sh --broadcast                 # run them, one at a time, logging tx hashes
scripts/rehearsal.sh --broadcast --make-change   # also write the guest-file comment first
```

Nothing in this repository holds a key. Every wallet is a path in the environment, read by
`swarm/client.py` and `verifier/watch.py` at the moment they need it, and the printed commands carry
`--private-key "$(cat $LINEAGE_KEY_FILE)"` as literal text — so a transcript of the rehearsal can go
straight into the film and the repository with no redaction pass. If the host has encrypted
keystores instead, set `<ROLE>_KEYSTORE` (and optionally `<ROLE>_KEYSTORE_PASSWORD_FILE`) and no key
material touches an argument list at all.

## Environment

| variable | what it is |
|---|---|
| `ETHPLANE_ADDRESS` | the Ethplane contract (see DEPLOYMENTS.md) |
| `SEPOLIA_RPC_URL` | the RPC every command uses |
| `NODE_ID` | `keccak256("cl-pq-leanxmss-attestations")`, the node being worked |
| `API_BASE` | where the artifact store and the read API live |
| `QWEN_A_KEY_FILE`, `FAST_B_KEY_FILE` | the two lineage wallets, one file each |
| `OPERATOR_KEY_FILE`, `OPERATOR_ADDRESS` | the operator that accepts qwen-a and pays for the forfeit |
| `FAST_B_OPERATOR_KEY_FILE`, `FAST_B_OPERATOR_ADDRESS` | optional; a second operator for fast-b (see below) |
| `WORKTREE_A`, `WORKTREE_B` | each worker's checkout of leanVM at the pinned commit |
| `EDITABLE` | `crates/rec_aggregation/guests/` — the only path a submission may touch |
| `VERIFIER_KEY_FILE`, `LEANVM_REF`, `REFERENCE_COMMIT` | the verifier's wallet and reference checkout |
| `HEARTBEAT_EVERY` | the node's heartbeat window in seconds (default 120); the script waits it out before the forfeit |

## The beats

| # | who | command | what it proves |
|---|---|---|---|
| 1 | qwen-a | `client.py register` | a lineage names its operator; `groupName` is `cast keccak` of the name |
| 2 | fast-b | `client.py register` | the same, for the second worker |
| 3 | operator | `client.py accept <qwen-a>` | registration is two-sided: the operator has to agree |
| 4 | operator | `client.py accept <fast-b>` | |
| 5 | qwen-a | `client.py claim` | a session starts from nothing — no head yet on this node |
| 6-7 | qwen-a | `client.py heartbeat` ×2 | a session is kept alive by saying so, not by holding a lock |
| 8 | qwen-a | `client.py submit` | the artifact is uploaded content-addressed, then recorded on chain |
| — | — | *the worker is killed* | no transaction: the beat is the silence |
| 9 | fast-b | `client.py claim <qwen-a artifact>` | the next worker starts from what the last one left |
| 10 | anyone | `client.py forfeit <qwen-a>` | a lapsed session is ended by anyone, not by a maintainer |
| 11 | fast-b | `client.py submit <qwen-a artifact>` | attribution: the parent is on chain, not in a README |
| 12-13 | verifier | `watch.py --once` ×2 | each submission is fetched, verified and judged, one at a time |

Beats 9 and 10 swap when both lineages share one operator address, and the script says so when it
does: `forfeit` sets a cooldown keyed by **operator**, so ending qwen-a's session would lock that
operator out of the node for a whole lease duration and fast-b's claim would revert with
`InCooldown`. Two operator addresses give the natural order — die, lapse, recover — and that is what
`FAST_B_OPERATOR_ADDRESS` is for.

## What comes out of it

Each broadcast writes `rehearsal-<timestamp>.log` next to the repository, one line per beat with the
transaction hash. Those hashes are what `docs/FILM.md` needs under **Rehearsed facts**: the two
claims, the forfeit, the two submissions and the two measurements are the shots.

The verdict on beat 12 is whatever the verifier finds. A comment change to the guest program does
not reduce cycles, so the honest outcome is `FAIL` with the measurement recorded — which is the
outcome the criterion, the deck and the film already say is legitimate. The payout path is shown by
the contract's own `test_cumulativePayoutEqualsOneShot`, and by the attribution events if a real
improvement lands.

## What it costs

Thirteen transactions. At 1.1 gwei and an assumed 150,000 gas each that is about **0.00215 ETH** —
an assumption, not a measurement; after a broadcast the receipts in the log are the real number. The
deployer held 0.024 ETH at the time of writing, so the rehearsal can be run several times over.
