# AI attribution

ETHGlobal requires that submissions document which code, files or assets were generated or assisted by AI. This file is the record and is updated with every commit.

| Path | Origin |
|---|---|
| README.md | AI-assisted draft; human-edited. |
| docs/SPEC.md | AI-assisted; derived from the internal plan; human-reviewed. |
| research/strawmap-nodes.json, coverage.json, coverage-table-v2.md | AI-assisted extraction from the EF strawmap image and public sources; human-corrected. |
| research/eth-governance.md, identity-checks.md | AI-assisted research; every quote carries its URL. |
| research/eth-roadmap-*.md, ethereum-org-roadmap-2026-09-07.md | AI-assisted summaries of public posts; node lists quoted from the sources. |
| LICENSE | MIT template. |
| contracts/*.sol, test/*.sol, script/Deploy.s.sol | AI-written (Claude Opus) against the internal spec; every function and test traced to a spec clause; compiled, tested and reviewed by a human before merge. |
| contracts/EthplaneSubregistry.sol, contracts/interfaces/IRegistry.sol, script/DeployEns.s.sol, test/EthplaneSubregistry.t.sol, test/EnsFork.t.sol | AI-written (Claude Opus) against the internal spec; the fork test resolves a real record through ENS's Universal Resolver on Sepolia. |
