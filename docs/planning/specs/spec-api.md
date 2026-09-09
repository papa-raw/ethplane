<!-- planning artifact: a day-one specification written for the local-model swarm on 2026-09-07/08. Historical; what shipped is described in docs/ and README.md, and differs where the record says so. -->


# Ethplane spec extract for the build swarms · from the private PRD, 2026-09-08 19:04 · private to host A, never commit this file

## 3.6 API, poller and database (hawk, user `ethplane`, Node 22, PM2; nginx at ethplane.ecofrontiers.xyz → web static + `/api/*` → :4100)
- DB: SQLite file `/opt/ethplane-private/ethplane.db` via `better-sqlite3`. Tables (exact):
```sql
CREATE TABLE nodes(node_id TEXT PRIMARY KEY, label TEXT, layer TEXT, track TEXT, fork TEXT, tag TEXT, ef_tier TEXT, criterion_type TEXT, criterion TEXT, routing_mode TEXT, state TEXT, bounty TEXT, criterion_hash TEXT, ens_name TEXT, opened_block INTEGER);
CREATE TABLE leases(node_id TEXT, lineage TEXT, operator TEXT, lease_seq INTEGER, start INTEGER, expiry INTEGER, last_heartbeat INTEGER, from_hash TEXT, active INTEGER, PRIMARY KEY(node_id, lineage, lease_seq));
CREATE TABLE lease_events(id INTEGER PRIMARY KEY, node_id TEXT, lineage TEXT, lease_seq INTEGER, kind TEXT, block INTEGER, ts INTEGER, tx TEXT, log_index INTEGER, removed INTEGER DEFAULT 0);
CREATE TABLE submissions(artifact_hash TEXT PRIMARY KEY, node_id TEXT, lineage TEXT, operator TEXT, guest_name TEXT, lease_seq INTEGER, parents TEXT, block INTEGER, ts INTEGER, tx TEXT);
CREATE TABLE verdicts(id INTEGER PRIMARY KEY, node_id TEXT, artifact_hash TEXT, lease_seq INTEGER, passed INTEGER, metric TEXT, metric_hash TEXT, spread TEXT, block INTEGER, ts INTEGER, tx TEXT);
CREATE TABLE attribution(id INTEGER PRIMARY KEY, node_id TEXT, operator TEXT, lineage TEXT, kind INTEGER, weight TEXT, artifact_hash TEXT, block INTEGER, ts INTEGER, tx TEXT);
CREATE TABLE releases(id INTEGER PRIMARY KEY, node_id TEXT, to_addr TEXT, amount TEXT, lease_seq INTEGER, block INTEGER, ts INTEGER, tx TEXT);
CREATE TABLE heads(node_id TEXT PRIMARY KEY, head TEXT, block INTEGER, ts INTEGER);
CREATE TABLE board_lines(id INTEGER PRIMARY KEY, host TEXT, ts INTEGER, role TEXT, kind TEXT, text TEXT, mode TEXT, reason TEXT);
CREATE TABLE hosts(host TEXT PRIMARY KEY, lineage TEXT, model TEXT, last_seen INTEGER, status TEXT);
CREATE TABLE artifacts(artifact_hash TEXT PRIMARY KEY, path TEXT, size INTEGER, ts INTEGER);
CREATE TABLE cursor(k TEXT PRIMARY KEY, v INTEGER);
CREATE INDEX idx_events_node ON lease_events(node_id, block); CREATE INDEX idx_attr_op ON attribution(operator);
```
- Poller (`poller.ts`, viem 2.56.3, P7 numbers): `getLogs({address: [ETHPLANE, HEAD], fromBlock: cursor+1, toBlock: head, events: [...all ABI events]})` every **8 s**; on `removed: true` delete the row by `(tx, log_index)`; `blockTimestamp` is on the log, no `getBlock`. Public `SEPOLIA_RPC_URL` (publicnode) is enough; `SEPOLIA_RPC_URL_FALLBACK` optional. Startup: if `cursor` empty, start at `deployments.sepolia.json.startBlock`.
- Board ingest (`board-ingest.ts`): `POST /api/board {host, lines:[{ts, role, kind, text, mode?, reason?}]}` authenticated by `X-Host-Key` (per-host shared secret in `.env` on both sides); appends; hosts push every time their `board.sh` appends (no polling anywhere).
- Relay (`relay.ts`): `POST /api/relay/claim` and `/submit` with `{nodeId, guestName, guestWallet, artifactHash?, parents?, fromHash?, sig}`; verifies the Privy access token, verifies `sig` recovers to `guestWallet` over the same hash the contract checks, calls `claimFor/submitFor` with `RELAY_PRIVATE_KEY`; rate limit 6/min per guest.
- Artifacts (`artifacts.ts`): `POST /api/artifacts` body = tar.gz of the submitted diff set (max 5 MB); stores at `/opt/ethplane-private/artifacts/<sha256>.tgz`; returns `{artifactHash}` = `0x`+sha256; the same hash is what `submit` records. `GET /api/artifacts/:hash` public.
- Read routes (all GET, JSON, cache 5 s): `/api/nodes` (all 65, joined with heads and active lease count), `/api/nodes/:id` (node + leases + lease_events + submissions + verdicts + attribution + releases + head + freshness `{lastBlock, lastTs}`), `/api/hosts/:host` (host row + last 200 board lines + current handoff), `/api/operators/:addr` (attribution totals by kind), `/api/freshness`.
- Response shapes are snake_case as stored; `web/lib/api.ts` maps to camelCase in one function `toCamel()` and nowhere else.
