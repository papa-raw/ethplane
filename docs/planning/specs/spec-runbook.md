<!-- planning artifact: a day-one specification written for the local-model swarm on 2026-09-07/08. Historical; what shipped is described in docs/ and README.md, and differs where the record says so. -->


# Ethplane spec extract for the build swarms · from the private PRD, 2026-09-08 19:04 · private to host A, never commit this file

## 3.10 Scripts, environment and the Day-1 runbook (dependency order; a cold agent runs top to bottom)
`.env.example` (every variable, one line each): `SEPOLIA_RPC_URL`, `SEPOLIA_RPC_URL_FALLBACK` (optional), `DEPLOYER_PRIVATE_KEY`, `DEPLOYER_ADDRESS`, `MAINTAINER_PRIVATE_KEY` (= deployer in v1), `VERIFIER_PRIVATE_KEY`, `RELAY_PRIVATE_KEY`, `LINEAGE_A_PRIVATE_KEY`, `LINEAGE_B_PRIVATE_KEY`, `OPERATOR_ZERO_ADDRESS`, `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `PRIVY_AUTH_KEY`, `PRIVY_TREASURY_WALLET_ID`, `ENS_PARENT_NAME=ethplane.eth`, `ENS_UNIVERSAL_RESOLVER`, `GPU_PROVIDER_API_KEY`, `MODEL_HUB_TOKEN`, `HOST_A_IP`, `HOST_B_IP`, `HOST_KEY_A`, `HOST_KEY_B`, `PEER_BOARD_URL`, `API_BASE=https://ethplane.ecofrontiers.xyz/api`, `NODE_ID=pq-leanxmss-attestations`, `LEANVM_COMMIT`, `HARNESS`. Keys for verifier, relay, lineage A/B are generated on Day 1 with `cast wallet new` and funded with 0.02 Sepolia ETH each from the deployer.

Day 1 (`scripts/day1.sh` is the checklist; each step prints its output and stops on failure):
1. Pat: Sepolia ETH ≥ 0.15 on `0x3D70…b6b8`; Privy app (3 env values); `ethplane.eth` registered on Sepolia ENSv2 by the deployer; DNS A record `ethplane.ecofrontiers.xyz → [host ip redacted]`.
2. hawk: create users `ethplane`, `verifier`; nginx + certbot; Node 22, uv, Rust; clone repo to `/opt/ethplane`; `/opt/ethplane-private/.env`.
3. Privy: `api/src/privy.ts createTreasuryPolicy` then `createWallet` → `PRIVY_TREASURY_WALLET_ID`, treasury address.
4. Contracts: `forge test`; `forge script Deploy.s.sol --broadcast` with treasury address → `deployments/sepolia.json`; `startBlock`.
5. ENS: `ens/install.sh`; subregistry, resolver, set resolver on parent; node subnames (65) and operator/group/guests subnames; records; `grant-roles.ts` calls `authorizeTextRoles` on the shared resolver for the verifier key (3.4).
6. hawk API: `pnpm i && pnpm build && pm2 start`; poller reaches head; `/api/nodes` returns 65.
7. Hosts: launch A and B (one call each; SXM5 us-south-2); `setup-host.sh`; vLLM up on each; `curl :8000/v1/models` → 200; leanVM built; `noise_floor.py` on hawk → published.
8. Define, baseline and fund the node: maintainer `defineNode(nodeId, criterionHash, lane 0, 0x0, 900 s, 120 s, Split{6800,1500,1000,500,200}, targetGainBps 1000, thresholdBps 0)`; verifier `recordBaseline(nodeId, baselineMetricMicros, spreadBps)` from `noise_floor.py`; treasury (Privy) `approve(ETHPLANE, 10_000e18)` then `fundNode(nodeId, 10_000e18)`; node shows open on the map.
9. Swarm A claims, runs one full loop, submits; verifier runs; first verdict lands; attribution rows appear. If not by end of Day 1, §21.4 fallback chain.
Day 2 (`scripts/day2.sh`): web build and deploy to nginx; deck and docs; join flow with a real Privy guest; `film-beat.sh` (opens a fresh node instance for the take, starts both swarms, kills A's builder at 1:00, records timestamps) rehearsed twice; README, ATTRIBUTION.md per file, `docs/DEPLOY.md`; submission form with the ENS and Privy partner prizes; video recorded in real time with Pat's voice, ≤ 4:00, ≥ 720p, no speed-up. `scripts/reset-node.ts` closes and reopens a node between rehearsals (every state transition has a reverse path).



## 3.11 Tests (written by the swarm as part of the build; all run in CI on hawk before any deploy step)
- contracts: forge tests of 3.3.5 (14 tests), coverage ≥ 90 % lines on `src/`.
- api: vitest node env; unit `db.test.ts` (schema, cursor), `poller.test.ts` (decoded log → rows; `removed` deletes; reorg replay), `relay.test.ts` (bad sig rejected, rate limit), `board-ingest.test.ts` (host key, mode/reason parsed); integration with anvil: `beat.test.ts` runs open → claim → heartbeat → forfeit → claim(from) → submit → verdict → release and asserts every table and `/api/nodes/:id` shape; coverage ≥ 70 %.
- verifier: pytest `test_parse.py` (the three regexes against the P10 output verbatim), `test_paths.py` (a tarball touching `src/main.rs` is rejected), `test_threshold.py` (noise floor 1.9 % → threshold 3.8 %; a 3 % gain fails, a 5 % gain passes; proof-size regression fails).
- web: vitest jsdom; `StrawmapGrid.test.tsx` renders 65 tiles from a fixture and all-locked empty state; `LeaseTimeline.test.tsx` renders forfeit and resume marks and the axis-break glyph; `usePoll.test.ts` re-syncs selection.
- swarm: `driver.test.ts` with a fake OpenAI endpoint returning a search/replace block → edit applied, build called, BUILT line written; `board.sh` appends and POSTs.
- system: `film-beat.sh --dry-run` against anvil + a fake host completes the beat under 4:00 wall clock and prints the timeline.
