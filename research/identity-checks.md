# Identity and attribution — fact-check for PLAN-technical-v1.md §9

Researcher addendum , per orchestrator handoff. All quotes verbatim with URL. Local estate check: `~/Desktop/2_resources/Crypto/ERC-8004_Agent_Identity_NFTs_on_Base.pdf` exists but is only an NFT-marketplace listing screenshot (24,598 unique "Agent Identity" NFTs on Base, Feb 2026) — it confirms a collection by that name exists but has no ERC-8004 spec content, so it does not answer (1) below; the ENS material in that folder (`ENS_with_IBAN_Resolvers...webloc`) is unrelated to ENSv2 access control. Everything below is externally sourced, and every ENS/ENSv2 page was read by rendering it in a real logged-out Chrome tab rather than trusting a single WebFetch call, per the methodology note already on record in `eth-governance.md` (WebFetch fabricated quotes for one JS-heavy page earlier in this run).

---

## (1) ERC-8004 "Trustless Agents"

Source: https://eips.ethereum.org/EIPS/eip-8004 (rendered in Chrome, 2026-09-08 — confirmed as real page content, this site does render server-side unlike strawmap.org).

**Status:** "⚠️ Draft Standards Track: ERC". Created 2025-08-13. Not Final, not even at Review/Last Call per EIP-1's lifecycle (see `eth-governance.md` (a)).

**Abstract, quoted:** "This protocol proposes to use blockchains to discover, choose, and interact with agents across organizational boundaries without pre-existing trust, thus enabling open-ended agent economies." / "Trust models are pluggable and tiered, with security proportional to value at risk."

**Three registries, quoted:**
- **Identity Registry** — "A minimal on-chain handle based on ERC-721 with URIStorage extension that resolves to an agent's registration file, providing every agent with a portable, censorship-resistant identifier."
- **Reputation Registry** — "A standard interface for posting and fetching feedback signals. Scoring and aggregation occur both on-chain (for composability) and off-chain (for sophisticated algorithms)."
- **Validation Registry** — "Generic hooks for requesting and recording independent validators checks (e.g. stakers re-running the job, zkML verifiers, TEE oracles, trusted judges)."

**agentURI / registration file format, quoted:** "the agentURI MUST resolve to the agent registration file... MAY use any URI scheme such as `ipfs://`, `https://`, or a base64-encoded `data:` URI." The registration file is a JSON object with mandatory `type`, `name`, `description`, `image`, a `services` array (endpoint types: `web`, `A2A`, `MCP`, `OASF`, `ENS`, `DID`, `email`), `x402Support`, `active`, `registrations` (agentId + agentRegistry per chain), and an OPTIONAL `supportedTrust` array (e.g. `["reputation", "crypto-economic", "tee-attestation"]`). Note on terminology: the plan's §9.2 phrase "capability card URI" is not the spec's term — the spec calls this the **agent registration file**, referenced by `agentURI`. Not wrong in substance, just non-canonical naming; recommend the plan adopt "agentURI / agent registration file" to match the spec exactly if this ever needs to interoperate with other ERC-8004 tooling.

**Deployed addresses:** none are canonical or spec-mandated. Quoted: "We expect the registries to be deployed with singletons per chain." The spec itself is a contract standard, not a deployment — there is no single "the ERC-8004 registry on Sepolia" to point at; anyone (including Workplane) deploys their own instance following the interface. This directly affects §9.7's hackathon-scope line (see verdict below).

**ENS integration:** confirmed — `ENS` is one of the seven `services` endpoint types in the registration file, alongside `web`, `A2A`, `MCP`, `OASF`, `DID`, `email`. Example in the spec: `{"name": "ENS", "endpoint": "vitalik.eth", "version": "v1"}`. This is a loose, advertisement-only link (an agent can list an ENS name as a contact identifier); ERC-8004 does not itself use ENS for identity resolution — identity is the ERC-721 `agentId`, not the ENS name.

---

## (2) ENSv2 on Sepolia

Sources: https://docs.ens.domains/ensv2/overview/ and https://docs.ens.domains/ensv2/enhanced-access-control/ (both rendered in Chrome, 2026-09-08).

**Deployment status, quoted:** "ENSv2 is deployed on the Sepolia testnet, where you can already try the new contracts with the ENS Explorer." / "The contracts and interfaces described here are not yet final and may change prior to mainnet deployment." — **CONFIRMED: Sepolia-only, not on mainnet, and the spec itself is explicitly unstable pre-mainnet.** This matters for Workplane §9.7's hackathon scope (Sepolia is correct) and for any claim of production-readiness beyond the hackathon.

**Enhanced Access Control (EAC) — role granularity per record, quoted:** "EAC supports up to 2^256 independent resources (e.g., individual names), 64 roles per resource (32 regular + 32 admin), and up to 15 holders of a role within the context of a single resource." Critically: "**Permissioned Resolver: EAC Integration: 11 roles (8 per-record), fine-grained scoping down to individual keys or coin types**." — **CONFIRMED: yes, a role can be scoped to writing a single record type (e.g. text records only) on a single subname.** This directly answers Workplane §9.3's `[verify: role granularity per record]` — the plan's claim that "Only the registry maintainer's key and the node's verifier key can write these records" is achievable exactly as described, by granting the verifier key a per-record role (not a blanket per-name role) if Workplane wants the verifier limited to writing only the status/criterion-hash records and nothing else on a node's name.

**Non-transferable / revocable subnames, quoted:** "Transfer control: `ROLE_CAN_TRANSFER_ADMIN` (revoke to make non-transferable)" — confirms §9.3's claim "Subnames are non-transferable, so a reputation cannot be sold, and revocable, so an operator can retire a group" is mechanically correct: revoking `ROLE_CAN_TRANSFER_ADMIN` on a subname's resource makes it non-transferable, and because EAC roles are "reversible grant/revoke (while admin role is held)" (vs. ENSv1's one-way fuse burn), the same subname can later be revoked/retired by its admin. **CONFIRMED.**

**Wildcard resolution — partially verified.** No page visited in this pass carries a direct quoted sentence using the words "wildcard resolution" for ENSv2 specifically (ENSIP-20 "Wildcard Writing" at https://docs.ens.domains/ensip/20/ exists but is about offchain domain writing via CCIP-Read, a different mechanism, status "Draft," authors netto.eth/pikonha.eth/nick.eth — not what §9.3 is asking about). What IS confirmed by direct quote, from Universal Resolver V2 (https://docs.ens.domains/ensv2/universal-resolver-v2/): "It resolves names by traversing the hierarchical registry tree, walking from the root registry down through subregistries to locate the correct resolver for any name." This is the mechanism that gives ENSv2 the functional equivalent of wildcard resolution — any node registered anywhere in the registry's subtree resolves through one Universal Resolver entry point without needing per-name resolver configuration — but it was not independently confirmed with the literal words "wildcard resolution" applied to ENSv2's own architecture in the pages checked this pass. **Verdict: CONFIRMED functionally, UNVERIFIED as a literal quoted claim** — recommend a follow-up check on the "Registry Hierarchy" or "Permissioned Registry" contract pages (not fully read this pass) before relying on exact wildcard semantics for the PRD.

---

## (3) Protocol Guild membership weighting

Source: https://protocol-guild.readthedocs.io/en/latest/01-membership.html §1.5 "Member Rights" (rendered in Chrome, 2026-09-08), plus https://www.protocolguild.org/ for scale figures.

**The exact formula, quoted:**
> "Each member's share of the split contract is calculated using member-specific inputs. There are two parts to the calculation:
> Calculate each member's time_weight: **time_weight = SQRT((start_date - months_inactive) * full_or_part_time)**
> Normalize time_weight as a percentage: split_share = (time_weight / total_time_weights) * 100"

**Components, quoted:**
- `start_date`: "the date when a member commenced contributing to Ethereum's L1 R&D. The earlier a contributor's start_date, the higher their overall Split share, rewarding them retroactively for historical contributions."
- `months_inactive`: tracks breaks; "new members must still have contributed continuously for at least 6 months ahead of inclusion... Existing members can take up to 3 months break without triggering a membership change."
- `full_or_part_time`: "full-weight: 1.0x... partial-weight: 0.5x... Full-weight is considered full-time, at least 40 hr/wk. Partial-weight is anything between 20 - 40 hr/wk."
- Why square root, quoted: "The final step of the formula uses a Square Root to compress the weight range. This is done to not overly privilege long-term members over newer contributors."

**Scale (protocolguild.org homepage, quoted):** "Since 2022, we have distributed $39M directly to Ethereum core contributors." / "190 contributors, 47 core repositories, 1 Ethereum protocol." / "Any funds go directly to these individuals after a linear 4 year vest." Funds move via **Splits** contracts (built by the Splits protocol team), updated quarterly, per https://protocol-guild.readthedocs.io/en/latest/02-onchain-architecture.html: "Split contracts... contain all Guild members' addresses and their respective share of vested funds (based on the time-weight formula)... the split contract is mutable, as it needs to be updated quarterly to reflect changes to the membership."

**Verdict on PLAN-technical-v1.md §9.5:** the plan states "membership weight grows with time active, with a square-root time weighting, and funds are split by weight" — **CONFIRMED, precisely and completely.** The plan's own analogy ("a group's weight grows with verified events over time, with a decay so that old work counts less") is directionally consistent with Protocol Guild's model but inverts one detail worth flagging: Protocol Guild's square root **compresses** the gap between old and new contributors (a deliberate anti-oligarchy design — quoted above: "not overly privilege long-term members"), it does not decay old contributions to zero. If Workplane wants old work to eventually count for *less* (true decay/depreciation) rather than merely *not dominating new work as much as linear time would*, that is a different mechanism than Protocol Guild's, and the plan should say so explicitly rather than cite Protocol Guild as the precedent for decay specifically.

---

## (4) Optimism RetroPGF / Retro Funding

Sources: https://raw.githubusercontent.com/ethereum-optimism/community-hub/main/pages/citizens-house/how-retro-funding-works.mdx (fetched directly, static file — reliable) and search-summarized results (flagged as such) on Season 7 mechanics.

**Core mechanism, quoted:** "Retroactive Public Goods Funding (Retro Funding) is based on the idea that it's easier to agree on what was useful in the past than what might be useful in the future... members of the Citizens' House allocate surplus protocol revenue or portions of the Retro Funding token allocation to projects they deem have provided positive impact... This is core to Optimism's value of **impact=profit**: the idea that positive impact to the collective should be rewarded proportionally with profit to the individual."

**Round history, quoted:** "Retro Funding round 1 took place at the end of 2021 and allocated $1 million across 58 projects." / "Retro Funding round 2 took place in Q1 2023 and allocated 10m OP tokens across 195 projects." / "Retro Funding round 3 took place in Q4 2023 and allocated 30m OP tokens across 501 projects."

**Three-part experimentation framework, quoted:** "Retro Funding has three core components... **Impact scoping**: what should the Collective fund?... **Impact scoring**: how does the Citizens' House evaluate impact? What units, process, or tools do we use?... **Impact settlement**: how does voting work?" This maps directly onto Workplane's own three-part shape: node registry (scoping), verifier + criterion (scoring), release/attribution rows (settlement) — a stronger structural parallel than the plan's §9.5 currently draws out.

**Current-round mechanics (Season 7, search-summarized — UNVERIFIED by direct fetch this pass, but consistent across multiple independent search results):** "badgeholders vote on evaluation algorithms—each representing a different philosophy for measuring impact... applied to two distinct Missions: Dev Tooling and Onchain Builders, with each Mission having its own pool of funds and set of algorithms." Impact is measured with "structured onchain metrics developed with Open Source Observer" (transaction counts, gas fees, TVL, user activity for onchain builders), combined with human/badgeholder judgment rather than pure metrics. The program is "transitioning from annual rounds to ongoing impact evaluation and regular rewards throughout the year."

**Verdict on PLAN-technical-v1.md §9.5:** the plan states "funding is retroactive and based on demonstrated impact, judged after the fact" — **CONFIRMED**, and actually understates how close the analogy is: Optimism's own "impact=profit" framing and its scoping/scoring/settlement split are close enough to Workplane's registry/verifier/release split that this is worth citing as a structural precedent in the plan, not just a funding-philosophy one.

---

## (5) Existing onchain attribution standards — fit for Workplane's attribution rows

**Ethereum Attestation Service (EAS) — the strongest fit, with concrete precedent.** Source: https://docs.optimism.io/governance/attestation-schemas (rendered in Chrome, 2026-09-08). Optimism runs its entire Retro Funding attribution/identity layer on EAS. Contract addresses (same on both networks): OP Sepolia and OP Mainnet Attestation contract `0x4200000000000000000000000000000000000021`, Schema Registry `0x4200000000000000000000000000000000000020` (both are predeploys at fixed addresses — a pattern Workplane could copy for its own registry/verifier contracts).

Directly relevant schemas, quoted field-by-field from the docs:
- **"Retro funding rewards"** (schema UID `0x670ad6e6ffb842d37e050ea6d3a5ab308195c6f584cf2121076067e0d8adde18`): fields `refUID` (the funding application), `projectRefUID` (the project), `round`, `OPamount`. This is structurally almost identical to Workplane §9.4's proposed attribution row `(node, group, operator, event type, weight, submission hash, verifier signature, block)` — swap `round`→fork milestone, `OPamount`→weight, `projectRefUID`→group.
- **"MetaGov contribution"** and **"Retro funding governance contribution"**: record an address, a contribution type, and a season/round — the closest EAS precedent to Workplane's event type 4 ("Verification performed").
- **"Retro funding application approval/rejection"**: records a `Reason` code (`1=Duplicate Application, 2=Deceiving Badgeholders, 3=Spam, 4=Not meeting eligibility criteria`) — a pattern Workplane could reuse for recording *why* a submission was rejected by a verifier, not just pass/fail.

**Verdict: Workplane's attribution rows could be emitted as EAS attestations directly**, on Sepolia (EAS is deployed on OP Sepolia; a Workplane instance on plain Ethereum Sepolia would need to confirm EAS is deployed there too — not checked this pass, and EAS's OP-chain predeploy addresses above are OP-Stack-specific, not universal). This is a stronger, more concrete precedent than a bespoke event-log schema, since indexers, the EAS Scan UI, and existing tooling already understand this schema shape.

**Hypercerts** (search-summarized, one line, not independently fetched): a Hypercerts records "a living digital record of impactful work: what was done or is planned, by whom, when, and where" — closer to Workplane's "criterion contributed" event (a durable claim of *what work happened*) than to a payout event; weaker fit for the verified-result/weight rows since Hypercerts doesn't natively carry a numeric payout weight the way EAS's Retro Funding schemas do.

**Drips** (search-summarized, one line, not independently fetched): Drips "uses a Drip List to assign percentage shares of incoming funds to recipients, with accumulated funds split across recipients monthly" — this is a payment-splitting mechanism (closer to Protocol Guild's Splits contract) rather than an attribution/record mechanism; not a good fit for Workplane's attribution rows themselves, but a plausible allocation-interface backend once §9.5's allocation function is built.

---

## §9 [verify] tags — verdicts

| Location | Claim | Verdict |
|---|---|---|
| §9.2 Operator row | "ENS name owned by the operator... [verify: Sepolia-only for ENSv2]" | **CONFIRMED** — see (2): "ENSv2 is deployed on the Sepolia testnet"; not final, not on mainnet. |
| §9.2 Agent group row | "ERC-8004 identity registry entry with a capability card URI [verify: ERC-8004 status and registry addresses on Sepolia]" | **CORRECTED** — ERC-8004 is Draft status (confirmed), but there is no single canonical "the registry" address on Sepolia to point at; the spec expects per-chain singleton deployments by whoever adopts it, so Workplane would deploy its own instance, not reference an existing one. Also: the spec's term is "agent registration file," not "capability card" (cosmetic). |
| §9.2 Agent instance row | "Privy server-wallet or equivalent for key custody [verify]" | **UNVERIFIED this pass** — not independently fetched; no Privy docs were checked. |
| §9.3 first bullet | "ENSv2 Enhanced Access Control roles) [verify: role granularity per record]" | **CONFIRMED** — see (2): Permissioned Resolver has "11 roles (8 per-record), fine-grained scoping down to individual keys." |
| §9.3 fourth bullet | "Wildcard resolution serves every node under the registry from one resolver [verify: ENSv2 wildcard resolution on Sepolia]" | **CONFIRMED functionally, UNVERIFIED as a literal quote** — see (2): Universal Resolver V2 traverses the hierarchical tree from one entry point, which is the functional claim, but no page read this pass used the literal phrase "wildcard resolution" for ENSv2. |
| §9.5 first precedent | "Protocol Guild: membership weight grows with time active, with a square-root time weighting, and funds are split by weight [verify]" | **CONFIRMED, exact formula obtained** — see (3): `time_weight = SQRT((start_date - months_inactive) * full_or_part_time)`. Note: the plan's own "decay so old work counts less" analogy is not quite what Protocol Guild's square root does (compresses privilege gap, doesn't decay); flagged in (3). |
| §9.5 second precedent | "Optimism RetroPGF: funding is retroactive and based on demonstrated impact, judged after the fact [verify]" | **CONFIRMED** — see (4), and the scoping/scoring/settlement three-part framework is an even closer structural match than the plan currently claims. |
| §9.7 | "ERC-8004 registration only if the registry exists on Sepolia and costs under an hour [verify]" | **CORRECTED** — per the (1) finding, there is no pre-existing "the registry" to check for; the condition as written can never be true. Recommend rewording to: "ERC-8004 registration only if Workplane deploys its own minimal Identity Registry (ERC-721 + URIStorage, per the spec) on Sepolia and this costs under an hour" — a materially different (and larger) scope than checking whether something already exists. |

---

## Open items / not done this pass

- Whether EAS is deployed on plain Ethereum Sepolia (not just OP Sepolia/OP Mainnet) was not checked — the predeploy addresses quoted in (5) are OP-Stack-specific. If Workplane's registry ends up on plain Sepolia rather than an OP Stack chain, verify EAS's Sepolia mainnet-L1 deployment address separately before committing to the EAS-attestation design in (5).
- ENSv2's "Registry Hierarchy" and "Permissioned Registry" contract pages were not fully read — recommended before the PRD locks in exact wildcard-resolution and per-node-subname mechanics.
- Privy server-wallet custody model (§9.2, agent instance row) — not checked at all this pass.
