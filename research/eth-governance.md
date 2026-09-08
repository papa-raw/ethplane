# Ethereum protocol governance — ingestion for Workplane

Research deliverable. All quotes verbatim with URL. UNVERIFIED where a claim could not be sourced within budget. `~/Desktop/2_resources/` was searched first (Blockchain/, Crypto/, Cryptoeconomics.../) — no primary EIP-1 / PFI-CFI-SFI / ACD-structure / strawmap documents found there (it holds an ERC-8004 PDF and ENS material relevant to the identity-checks addendum, not to this deliverable). Everything below is externally sourced.

**Methodology note on WebFetch reliability:** WebFetch on `strawmap.org` (a client-rendered SPA — `curl` confirmed the raw HTML body is empty) returned two mutually contradictory "verbatim quotes" for the same sentence across two calls, one of which flatly denied text existed that the other had just quoted. Both were fabrications by WebFetch's summarizer model, not page content — `curl` proved the raw HTML has no body text for it to have read. All strawmap.org quotes below were instead obtained by rendering the page in a real (logged-out) Chrome tab and reading the rendered DOM text directly (`get_page_text`), which is what deliverable 1's node reading also relied on for the image itself. Treat any single-call WebFetch quote against a JS-heavy page as unverified until cross-checked this way.

---

## (a) EIP-1 lifecycle statuses and transition rules

Source: https://eips.ethereum.org/EIPS/eip-1

**Status stages, in order:** Idea → Draft → Review → Last Call → Final, with two off-ramps (Stagnant, Withdrawn) and a special status for living documents.

- "Idea - An idea that is pre-draft. This is not tracked within the EIP Repository."
- "**Draft** - The first formally tracked stage of an EIP in development."
- "**Living** - A special status for EIPs that are designed to be continually updated and not reach a state of finality." (e.g. EIP-1 itself)

**Transitions:**
- Draft → Review: "An EIP Author marks an EIP as ready for and requesting Peer Review."
- Review → Last Call: "An EIP enters `Last Call` when the specification is stable and the author opens a PR with a review end date (`last-call-deadline`), typically 14 days later."
- Last Call → Review (revert): "If this period results in necessary normative changes it will revert the EIP to `Review`."
- Last Call → Final: "A PR moving an EIP from Last Call to Final SHOULD contain no changes other than the status update."
- Any of Draft/Review/Last Call → Stagnant: "Any EIP in `Draft` or `Review` or `Last Call` if inactive for a period of 6 months or greater is moved to `Stagnant`."

**Editor scope (process, not merit):** "The editors don't pass judgment on EIPs. We merely do the administrative & editorial part." Editors check "language (spelling, grammar, sentence structure, etc.), markup (GitHub flavored Markdown), code style."

**EIP types:**
- Standards Track: "describes any change that affects most or all Ethereum implementations," subcategories:
  - Core: "improvements requiring a consensus fork"
  - Networking: devp2p and protocol improvements
  - Interface: "language-level standards like method names"
  - ERC: "application-level standards and conventions, including contract standards such as token standards"
- Meta: "describes a process surrounding Ethereum or proposes a change to (or an event in) a process."
- Informational: "describes an Ethereum design issue, or provides general guidelines or information to the Ethereum community, but does not propose a new feature."

**Mapping to Workplane §5 (PLAN-technical-v1.md):** the plan's "claimed → submitted → verified → released" submission lifecycle is a Workplane-internal state machine, not a copy of EIP-1's Idea→Final chain — see (e) below, row 2, marked CORRECTED.

---

## (b) Fork inclusion process: PFI / CFI / SFI

Primary source: EIP-7723 (Meta EIP formalizing the process; Meta EIP), https://eips.ethereum.org/EIPS/eip-7723. Context confirms authorship/date via search: "In June 2024, Tim Beiko formalized a new process for scoping Ethereum upgrades through Meta EIP-7723" (https://christinedkim.substack.com/p/ethereum-governance-101).

**Definitions, quoted:**
- **Proposed for Inclusion (PFI):** "To propose an EIP for inclusion, someone MUST open a pull request to add it to the `Proposed for Inclusion`" section of the Upgrade Meta EIP.
- **Considered for Inclusion (CFI):** "`Considered for Inclusion` signals that client developers intend to attempt to include the EIP in devnets."
- **Scheduled for Inclusion (SFI):** "`Scheduled for Inclusion` signals that the EIP is on track for inclusion barring unforeseen issues." Requires devnet testing, stable specs, adequate test coverage.
- **Declined for Inclusion (DFI):** "`Declined for Inclusion` signals that client developers wish to exclude the EIP from the current network upgrade." (DFI'd EIPs may be reconsidered in a future upgrade.)

**Who decides each transition** (from EIP-7723 as summarized by WebFetch — this page appeared to render server-side content correctly and is internally consistent with the PFI/CFI/SFI text quoted above, but treat the decision-authority attributions below as INFERRED/paraphrased rather than verbatim quotes; they were not independently cross-checked in a rendered browser the way strawmap.org was):
- PFI → CFI: client developers, after review.
- CFI → SFI: Core Devs Testing (ACDT) calls review maturity; ACDE (execution) or ACDC (consensus) ratifies.
- Any stage → DFI: client teams, at any time.
- SFI → CFI or DFI (reversion): client teams, based on circumstances.

**Mapping to Workplane §5 row 3:** PLAN-technical-v1.md's "Node priority and bounty weight follow the strawmap tag: SFI nodes are funded first, CFI next, others by operator choice" is CONFIRMED as a reasonable analogy — SFI is objectively later-stage and more likely to ship than CFI, per the definitions above — but note the strawmap's own tags (visible on the image) are a snapshot as of 2026-08-04 and do not update live; a node's real PFI/CFI/SFI/DFI status can move between that date and now (see (f) and the JSON `notes` fields).

---

## (c) All Core Devs (ACD) call structure and cadence; headliner process

Primary source: https://github.com/ethereum/pm (rendered and read directly, 2026-09-08).

**Cadence and split:** "AllCoreDevs is a weekly meeting held by the Ethereum development community to discuss technical issues and coordinate work on the Ethereum protocol." / "On one week, the focus of the call is on Ethereum's consensus layer (i.e. proof-of-stake, the Beacon Chain, etc.) and on alternate weeks, the focus of the call is on Ethereum's execution layer (i.e. the EVM, gas schedules, etc.)." This is ACDC (Consensus) and ACDE (Execution), alternating — i.e. each track individually runs roughly bi-weekly even though "AllCoreDevs" as a whole is weekly. A third series, ACDT (Core Devs Testing), runs on its own cadence for devnet/testing coordination — e.g. "07 Sep 2026 ACDT 96", "03 Sep 2026 ACDC 186", "27 Aug 2026 ACDE 244" in the repo's own meeting log, confirming ACDT sits between ACDC/ACDE calls roughly weekly.

**Agenda rules:** "Anyone is welcome to add an item to the agenda as long as it follows these guidelines: The topic is technical in nature. The topic involves the Ethereum protocol at a low-level... The topic should not be philosophical... There are exceptions to this, but generally these topics distract from more productive technical discussions."

**Who attends / facilitates:** "Protocol developers, researchers and EIP authors are invited to attend." Current facilitators listed by name and role: Execution co-leads (Ansgar Dietrichs from Oct '25, Nixo from Apr '26), Consensus (Parithosh Jayanthi interim from May '26, Alex Stokes from Sep '24 currently out of office), Testing (EF EthPandaOps + EF STEEL teams). "Breakout Rooms are usually chaired by the expert/champion for the topic at hand." "This repo is managed by the Ethereum Foundation's Protocol Support team and ACD call facilitators."

**Headliner process, quoted from strawmap.org FAQ** (rendered in Chrome, 2026-09-08): "Headliners are particularly prominent and ambitious upgrades. To maintain a fast fork cadence, the modern ACD process limits itself to one consensus and one execution headliner per fork. For example, in Glamsterdam, these are ePBS and BALs, respectively." / "(L* is an exceptional fork, displaying two headliners tied to the bigger lean consensus fork. Lean consensus landing in L* would be a fateful coincidence.)"

Search corroboration on the same point (not independently verified by direct fetch): "There is a separate review process and proposal template for headliner EIPs... the current system leaves too much room for interpretation and pushes developers to compare unrelated proposals against each other" — and for Hegotá specifically, "ACDC #175 saw... the formal selection of FOCIL as Hegotá's Consensus Layer headliner... despite extensive discussions and breakout sessions, no clear headliner has been selected so far for the execution layer as of late March 2026" (https://christinedkim.substack.com/p/acdc-175, https://etherworld.co/highlights-from-the-all-core-developers-consensus-acdc-call-175/). This is UNVERIFIED against the primary substack/etherworld pages (search-summarized only) but is consistent with the image, where H (Hegotá) shows FOCIL [SFI] as the sole headliner box and no second headliner box in that column.

**Mapping to Workplane §5 row 5:** "Operator review cadence decides funding changes; independent agent groups implement; the verifier's held-out tests are the devnet" — CONFIRMED as a structurally sound analogy (ACD = periodic review/ratification; client teams/agent groups = independent implementers; devnets = the held-out multi-party test environment before mainnet), but the analogy elides that ACD calls are open to "anyone" per the agenda rule quoted above, whereas Workplane's "operator" is a single party. Flagged as a real asymmetry, not just wording.

---

## (d) The strawmap's own disclaimers and ownership

Primary source: https://strawmap.org/ (rendered in logged-out Chrome, 2026-09-08) and the image's own footer text (`sources/ethereum-strawmap-2026-08-04.png`, read directly).

**Ownership/contact (live page, quoted):** "strawmap.org by EF protocol / maintained by EF Architecture / Justin, Thomas, Toni, Vitalik." / "The strawmap is maintained by the EF Architecture team: Justin, Thomas, Toni, Vitalik. General inquiries can be sent to strawmap@ethereum.org." Matches the image footer: `strawmap@ethereum.org`.

**"Strawman" qualifier (live page, quoted):** "'Strawmap' is a portmanteau of 'strawman' and 'roadmap'. The strawman qualifier is deliberate for two reasons: It acknowledges the limits of drafting a roadmap in a highly decentralized ecosystem. An 'official' roadmap reflecting all Ethereum stakeholders is effectively impossible. Rough consensus is fundamentally an emergent, continuous, and inherent uncertain process. It underscores the document's status as a work-in-progress. Although it originated within the EF Protocol cluster, there are competing views held among its 100 members, not to mention a rich diversity of non-EFer views." / "The strawmap is not a prediction. It is an accelerationist coordination tool, sketching one reasonably coherent path among millions of possible outcomes." This matches the image footer's compressed version: "strawman: work-in-progress rough consensus" / "EF takes: not authoritative or representative."

**Origin (live page, quoted):** "The strawman roadmap originated as a discussion starter at an EF workshop in Jan 2026, with the aim of helping integrate lean Ethereum with shorter-term initiatives... The strawman is now shared publicly in a spirit of proactive transparency and accelerationism."

**Versioning (live page, quoted):** "Yes, the strawmap is a living and malleable document. It will evolve alongside community feedback, R&D advancements, and governance. Expect at least quarterly updates, with the latest revision date noted on the document." The image is dated "updated Aug 4, 2026"; today is 2026-09-08, well inside one quarterly cycle, so the image should still be current, but see the arrows discrepancy immediately below — a live-page wording difference already exists within that window.

**Arrows — a real, sourced disagreement between the live page and the image, not a WebFetch artefact (confirmed via two independent reads: `get_page_text` on the rendered DOM, and the image's own footer read directly with the Read tool):**
- Live page (strawmap.org FAQ, 2026-09-08): "Arrows signal hard technical dependencies or natural upgrade progressions."
- Image footer (`ethereum-strawmap-2026-08-04.png`, 2026-08-04 snapshot): "arrows: represent throughlines, not hard dependencies."

These say close to opposite things about whether an arrow is a hard dependency. **This directly bears on PLAN-technical-v1.md Rule 4.5**, which currently reads "A node's dependencies are the strawmap's own throughlines where they are hard dependencies [verify: the strawmap states arrows are throughlines, not hard dependencies; the researcher separates the two]." Verdict: **CORRECTED, with an unresolved source conflict** — the image Workplane is actually ingesting (dated 2026-08-04) says arrows are explicitly NOT hard dependencies ("throughlines"); the live FAQ page, current as of this ingestion, says the opposite. Recommendation: treat the image's own wording as authoritative for the diagram Workplane is built from (arrows = throughlines/suggested progressions, not hard blocking dependencies), and flag to Pat that the live site's wording has drifted from the image's own disclaimer — worth a direct check with strawmap@ethereum.org or a re-export of the current diagram if Workplane needs to encode real hard dependencies later.

**Additional disclaimers, quoted from the image footer directly:**
- "→ strawman: work-in-progress rough consensus"
- "→ EF takes: not authoritative or representative"
- "→ 🥺 emoji: uncertainty about ever shipping upgrade"
- "→ arrows: represent throughlines, not hard dependencies"

**Colors/headliners (live page, quoted):** "Upgrades are grouped into three color-coded horizontal layers: consensus (CL), data (DL), execution (EL)... Dark boxes denote headliners..., grey boxes indicate offchain upgrades, and black boxes represent north stars." / "Underlined text in boxes links to relevant EIPs and write-ups." This confirms the `strawmap-nodes.json` `tag`/`color_class`/underline reading method used for deliverable 1.

**Fork naming (live page, quoted):** "Consensus layer forks follow a star-based naming scheme with incrementing first letters: Altair, Bellatrix, Capella, Deneb, Electra, Fulu, etc. Upcoming forks such as Glamsterdam and Hegotá have finalized names. Other forks, like I* and J*, have placeholder names (with I* pronounced 'I star')."

**Time horizon (live page, quoted):** "The strawmap focuses on forks extending through the end of the decade. It outlines seven forks by 2029 based on a rough cadence of one fork every six months... The current draft assumes human-first development, and AI-accelerated R&D could significantly compress schedules."

**Audience note (live page, quoted, relevant if Workplane cites the strawmap publicly):** "The document, available at strawmap.org, is intended for advanced readers... Visit ethereum.org/roadmap for more introductory material."

---

## (e) PLAN-technical-v1.md §5 mapping table — verified row by row

Original table (PLAN-technical-v1.md:50-58):

| # | Ethereum | Workplane | Verdict | Source line |
|---|---|---|---|---|
| 1 | Roadmap node on the strawmap (EF Protocol, strawmap@ethereum.org) | Node in the registry | **CONFIRMED** | strawmap.org live page, ownership block, quoted in (d) above; footer `strawmap@ethereum.org` matches the image. |
| 2 | EIP lifecycle: Idea → Draft → Review → Last Call → Final (EIP-1) | Submission lifecycle: claimed → submitted → verified → released; a specification node also tracks the EIP status of its subject | **CORRECTED (partial)** | eips.ethereum.org/EIPS/eip-1, quoted in (a). The five-stage EIP-1 list is confirmed accurate as written. But the analogy itself is loose: EIP-1's stages track *specification maturity of an idea*, while Workplane's claimed→submitted→verified→released stages track *custody of a bounty for one piece of work*. They are not isomorphic — a single EIP node could be "Final" (spec done) while its Workplane task is still "claimed" (nobody has submitted verified work against it) indefinitely, or vice versa a node's spec could still be "Draft" while a claimant has already submitted and been verified on a partial/exploratory contribution. Recommend the plan state explicitly that these are two independent status axes tracked per node, not one lifecycle mapped onto the other, which the "a specification node also tracks the EIP status of its subject" clause already gestures at correctly. |
| 3 | Fork inclusion: PFI → CFI → SFI → shipped | Node priority and bounty weight follow the strawmap tag: SFI funded first, CFI next, others by operator choice | **CONFIRMED**, with one addition | EIP-7723, quoted in (b). Missing from the Ethereum column: **DFI (Declined for Inclusion)** is a real fourth status ("client teams wish to exclude the EIP from the current network upgrade"). Recommend Workplane's registry also record DFI explicitly (e.g. deprioritize but do not delete — an EIP can be DFI'd from one fork and reconsidered later, so a Workplane node tagged from a DFI'd EIP should not be treated as permanently dead). |
| 4 | Fork = named milestone (Glamsterdam, Hegotá, I…L) | Milestone grouping in the registry; progress reports per fork | **CONFIRMED** | strawmap.org live page, fork-naming FAQ, quoted in (d): CL forks use a star-based Greek/celestial naming scheme (Altair, Bellatrix, ... Glamsterdam, Hegotá finalized; I*, J* placeholders). |
| 5 | All Core Devs calls (ACDE, ACDC) decide inclusion; client teams implement independently; devnets and testnets verify | Operator review cadence decides funding changes; independent agent groups implement; the verifier's held-out tests are the devnet | **CONFIRMED**, with a caveat | github.com/ethereum/pm, quoted in (c). Real asymmetry: ACD agenda access is "anyone... following these guidelines" (open, permissionless technical proposal), while Workplane's "operator" as currently specced (PLAN-technical-v1.md §3, §4.2) is a single controlling party setting the verifier's code/data/key. The analogy holds for the *review/verify* structure but not for the *openness* of who can propose changes to the process itself — worth naming as a deliberate design choice (Workplane centralizes verifier trust; Ethereum keeps it federated across client teams) rather than leaving it implied. |
| 6 | EIP editors check format and process, not merit | Registry maintainers check that a node has a computable criterion, not whether the work is good | **CONFIRMED** | eips.ethereum.org/EIPS/eip-1, quoted in (a): "The editors don't pass judgment on EIPs. We merely do the administrative & editorial part." Directly parallel to the Workplane clause as written — both a real, close analogy. |
| 7 | Ethereum Magicians and EIP repository as the public record | The onchain record plus the public repository | **UNVERIFIED (not checked this pass)** | Not independently fetched — ethereum-magicians.org and github.com/ethereum/EIPs were not visited in this research pass (budget). The mapping is plausible on its face (both are the durable public discussion + spec record) but carries no direct quote. Flagging rather than silently confirming, per the researcher's own instructions. |

**New row recommended, not in the original table:** the **arrows/dependencies** question (see (d) above) is load-bearing for PLAN-technical-v1.md Rule 4.5 and deserves its own row: *Ethereum: "arrows... throughlines, not hard dependencies" (image) vs. "hard technical dependencies or natural upgrade progressions" (live site) — Workplane: "a node's dependencies are the strawmap's own throughlines where they are hard dependencies."* Verdict: **CORRECTED / SOURCE CONFLICT** — see (d). Recommend Workplane not encode strawmap arrows as hard blocking dependencies in the registry without a human decision, since the strawmap's own primary source (the image being ingested) explicitly disclaims that reading.

---

## (f) Strawmap nodes with existing public test vectors, spec tests, or benchmarks

Two generic, load-bearing repositories exist and cover any EIP-tagged node as it progresses through CFI/SFI:
- **ethereum/execution-spec-tests** — "A Python framework and collection of test cases to generate test vectors for Ethereum execution clients" (https://github.com/ethereum/execution-spec-tests).
- **ethereum/consensus-spec-tests** — "Common tests for the Ethereum proof-of-stake consensus layer" (https://github.com/ethereum/consensus-spec-tests).

**Confirmed, specific (multi-client devnet-tested, i.e. verifiably running code today, not just a spec):**
- **`cl-epbs`** (ePBS, EIP-7732) — Glamsterdam CL headliner. Search-sourced, UNVERIFIED by direct fetch: "The Ethereum Foundation's DevOps team has successfully tested EIP-7732 and EIP-7928 implementations from multiple client teams (Geth, Nethermind, Besu, Erigon on execution; Lighthouse, Prysm, Teku, Nimbus on consensus) on the devnet environment."
- **`el-bals`** (BALs, EIP-7928) — Glamsterdam EL headliner. Same devnet-testing claim as above (BALs and ePBS were tested together on the same Glamsterdam devnet).
- **`cl-focil`** (FOCIL, EIP-7805) — Hegotá CL headliner, formally selected per ACDC #175 coverage; devnet work described as in-progress rather than confirmed multi-client-tested as of the search snippet (UNVERIFIED, not independently fetched).

**Candidates by inference (any EIP-tagged node, once it reaches CFI/SFI, is expected to get vectors in the two repos above as a matter of Ethereum's own process — not independently confirmed per-node within this pass's budget):** `cl-quick-slots`, `el-optional-2of3-proofs`, `el-glamsterdam-repricing`, `el-data-repricing`, `el-multidimensional-pricing`, `el-leanda-block-sampling`, `el-native-rollups`, `el-partitioned-binary-tree`, `el-evmify-long-tail-precompiles`, `el-pureth-purges`, `el-pq-leansphincs-transactions`, `el-leansphincs-mempool`, `el-encrypted-mempool`, `el-keyed-nonces-recent-roots`. Mark these `has_public_tests_or_benchmark: "unknown"` in the JSON (already done) rather than "yes" — inference is not verification.

**Everything else in `strawmap-nodes.json`** (offchain/process nodes with no tag — e.g. `cl-fast-confirmation`, `cl-51pct-attack-auto-recovery`, `dl-local-blob-reconstruction` — and untagged onchain nodes further out on the timeline) has no known public test harness and is a stronger candidate for PLAN-technical-v1.md's "specification only" flag (§2) than for a computable criterion at launch.

---

## Open items / what wasn't done this pass

- Row 7 of the §5 table (Ethereum Magicians / EIP repository as public record) is UNVERIFIED — not fetched.
- Per-node EIP number lookup was done for the 3 confirmed headliners only (ePBS=EIP-7732, FOCIL=EIP-7805, BALs=EIP-7928); the other ~14 EIP-tagged nodes listed in (f) were not individually resolved to EIP numbers within this pass's budget. `strawmap-nodes.json`'s `eip_numbers` field is empty for those — this is the single largest remaining gap for "computable criteria" work at the PRD stage.
- forkcast.org (named in the handoff as a likely source for current per-node PFI/CFI/SFI status and headliner detail) was not fetched directly this pass — github.com/ethereum/pm's own README already links to it as the live status board; worth a direct visit before the PRD stage locks in which nodes get computable criteria first.
