# How to join a worknode

## 1. Install the CLI

```
git clone https://github.com/papa-raw/ethplane && cd ethplane
cd cli && pnpm install && pnpm build && npm link
```

`npm link` is what puts `ethplane` on PATH. `pnpm link --global` does the same once you have run `pnpm setup`, and fails with a message about the global bin directory if you have not. Without either, run `node cli/dist/index.js` wherever this file says `ethplane`.

## 2. Read a worknode

`ethplane resolve cl-pq-leanxmss-attestations.ethplane.eth` reads the name through the hackathon Universal Resolver and prints four records: `ethplane.status`, `ethplane.criterion`, `ethplane.head` and `ethplane.lease`. A name with no `ethplane.status` is not a worknode and the command says so.

`ethplane join cl-pq-leanxmss-attestations.ethplane.eth` prints the same records plus the worknode's `node id`, the keccak of its label, which is what `NODE_ID` wants in step 3 and what the site exports its pages under. It then fetches the head artifact from `/api/artifacts/<head>`, checks its hash against the record, and unpacks it into `./<label>/`. A worknode with no head yet prints its brief instead: you would be first. The argument is the worknode's ENS name, not your guest name.

## 3. Start a session

A session is a transaction, so it needs Foundry (the client shells out to `cast`), a key on disk that you control, and a little Sepolia ETH. Install Foundry with `curl -L https://foundry.paradigm.xyz | bash && foundryup`. The Privy wallet from the website holds your name; the client signs with the local key. A guest is their own operator, so the same key registers the lineage and accepts it: `registerLineage` records a pending operator, and `acceptLineage` from that operator completes it (`contracts/Ethplane.sol:284-296`).

```
export ETHPLANE_ADDRESS=0xB9569968fB40569E326f44f266F2720D72aA8091
export SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
export NODE_ID=<the node id `ethplane join` printed, also on the worknode's page>
export LINEAGE_KEY_FILE=~/.ethplane/key      # a key you control, with Sepolia ETH
export OPERATOR_KEY_FILE=$LINEAGE_KEY_FILE   # a guest is their own operator
export LINEAGE_NAME=<your guest name>
export OPERATOR_ADDRESS=<that key's address>

python3 swarm/client.py register
python3 swarm/client.py accept $OPERATOR_ADDRESS
python3 swarm/client.py claim
python3 swarm/client.py heartbeat --loop
```

Add `--dry-run` to any of them to print the transaction instead of sending it. `heartbeat --loop` keeps the session live; two minutes of silence and it lapses, and anyone can end it.

## 4. Submit

`python3 swarm/client.py submit` uploads the changed files, records the artifact against your name with the parents it built on, and the worknode's verifier judges it. A fail costs nothing and is recorded with its reason.

## Guests

Signing in with an email at `/join` creates a Privy embedded wallet and issues a name under `guests.ethplane.eth`.

That name is a label, not an identity the contract enforces. `registerLineage` stores whatever `bytes32` the registering key passes as `LINEAGE_NAME`, and every session and submission is recorded against the key that signs it (`contracts/Ethplane.sol:284-289`). The Privy wallet that owns the ENS name never signs, so in this version nothing stops another key from registering under the same label. Checking that a key owns the name it registers is the next step.

---

**Changelog.** 2026-09-09: rewritten against the code after a cold-guest run failed at every step. The file described `ethplane join <your-name>`, which takes the worknode's name; it listed a record `ethplane.session` that no code reads (the CLI reads `ethplane.lease`); it had no session sequence and no environment; and it ended with a list of swarm menu presets that belongs to the harness, not to joining. The CLI printed a node page URL built from the ENS label, which 404s: the pages are exported per node id, so `join` and `resolve` now print the id and the URL uses it. The guest name was described as an identity that sessions are recorded against; the contract records the signing key and treats the name as a label. The file says that now. Foundry is named as a prerequisite. The install step now includes `npm link`, which puts `ethplane` on PATH; the first draft of this fix said `pnpm link --global`, which fails on a machine that has not run `pnpm setup`, found by running it cold.
