<!-- planning artifact: a day-one specification written for the local-model swarm on 2026-09-07/08. Historical; what shipped is described in docs/ and README.md, and differs where the record says so. -->


# Ethplane spec extract for the build swarms · from the private PRD, 2026-09-08 19:04 · private to host A, never commit this file

## 3.1 Repository layout (public: github.com/papa-raw/ethplane; no file outside this tree is created)
```
ethplane/
  README.md  ATTRIBUTION.md  LICENSE  .gitignore  .env.example
  docs/SPEC.md  docs/JOIN.md  docs/CRITERION-pq-leanxmss.md  docs/DEPLOY.md
  research/  (as today)
  design/DESIGN.md  design/tokens.css  design/tokens.json  design/references/  (5-6 images)
  contracts/           Foundry project
    foundry.toml  src/Ethplane.sol  src/PlaneToken.sol
    script/Deploy.s.sol  test/Ethplane.t.sol  test/PlaneToken.t.sol
  api/                 Node 22 + TypeScript, runs on hawk under PM2 as user `ethplane`
    package.json  tsconfig.json  src/index.ts  src/db.ts  src/poller.ts  src/routes/*.ts
    src/relay.ts  src/board-ingest.ts  src/privy.ts  src/artifacts.ts  src/types.ts  test/*.test.ts  vitest.config.ts
  verifier/            Python 3.12 (uv) + the leanVM checkout, runs on hawk as user `verifier`
    pyproject.toml  verifier/run.py  verifier/noise_floor.py  verifier/parse.py  verifier/sign.ts (viem, node)  tests/
  swarm/               runs on each the rented GPU host
    setup-host.sh  vllm.service  roles/orchestrator.md  roles/builder.md  roles/critic.md
    board.sh  heartbeat.sh  submit.ts  loop/driver.ts  loop/edit-format.md  harness/<HARNESS>.md
  ens/                 name and record operations (ens-cli calldata + our signer + EAC call)
    install.sh  deploy-subregistry.ts  create-subnames.ts  set-records.ts  grant-roles.ts  abi/PermissionedResolver.json
  web/                 Next.js 15, static export, shadcn/ui + Aceternity, served by nginx on hawk
    package.json  next.config.ts  tailwind.config.ts  app/(pages)  components/  lib/api.ts  lib/ens.ts  lib/privy.tsx
  scripts/day1.sh  scripts/day2.sh  scripts/reset-node.ts  scripts/film-beat.sh
```
