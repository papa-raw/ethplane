# Ethplane — art direction

Research: `.claude/design-briefs/ethplane-site-research.md` (three references fetched, patterns
extracted; two are first-party images in the estate's library, looked at rather than recalled).

Everything below is written to be *checked*, not admired. A reviewer should be able to hold a
screenshot beside this file and say yes or no to each line. Where a rule cannot be checked from a
PNG, it names the command that checks it — and every one of those commands is in
**`web/design/check-brief.sh`**, which runs them together and prints PASS or FAIL with the number it
found. A check that cannot run prints NOT RUN and fails the script, because three of these were
wrong in exactly that way before they were executed: one depended on the reviewer's shell, one
counted a substring in one file, and one read an empty result from a directory that did not exist.
Run the script; do not read the table and assume.

## 1. Who reads it, and what they must get in ten seconds

A hackathon judge, technical, on their fortieth submission. They ask one question: **is any of this
real?** Everything else is second.

In the first ten seconds, above the fold at 1440×900, they must be able to say:

1. **This is the Ethereum roadmap, all of it.** The map is the hero — 65 chips, fork columns
   labelled across the top, EL/DL/CL bands labelled down the left. Not a screenshot of a roadmap: the
   live one, drawn from `research/strawmap-nodes.json`.
2. **Two of these are live and have money on them.** Two chips are visibly different from the other
   63, and one line of text says so with numbers: two nodes open, 10,000 PLANE each.
3. **Work happens here and it is judged.** One strip of three numbers — nodes open, sessions, verdicts
   recorded — from the API.

If a judge has to scroll to learn any of those three, the page has failed regardless of how it looks.

**Measurable:** at 1440×900, the map's top edge is within 220px of the viewport top; the three-number
strip's baseline is above 900px; and **the grouped list** — the secondary view under the map, headed
"The same 65 nodes, as a list", rendered by `web/components/dashboard/NodeMap.tsx` — starts below
900px, so nothing competes with the map above the fold.

## 2. The refusals, each named and each checkable

These are the tells this project has already paid for. A variant that shows one is rejected on that
alone.

| # | Refused | Why it is refused here | How a reviewer checks it |
|---|---|---|---|
| 1 | **Coloured left-border card with a tinted icon chip** | "Default Claude UI": it is what a model reaches for when it has no direction, and it has appeared in three of Pat's projects | `grep -rn "border-l-\|borderLeft" web/app web/components web/lib` returns **nothing**. Baseline today: 0 hits, so any hit is the variant's. (`web/**/*.tsx` was the earlier check and it fails open — bash without globstar reads 9 files, zsh 26.) |
| 2 | **Badge soup** | Pills of every colour turn state into decoration and make the two live nodes invisible among 63 | No more than **one** pill-shaped element per row and **at most three** distinct pill colours on the whole page |
| 3 | **Uniform weight** | Everything at 500 reads as a wireframe; hierarchy then has to come from boxes | Exactly **three** weights in the built CSS: 400, 500, 700. No 600 |
| 4 | **A card on everything** | Cards are for things you can act on; a roadmap is a diagram, not fourteen cards | At most **four** bordered containers on the home page, and the map is not one of them |
| 5 | **A sidebar whose width follows its content** | Content-driven width makes the page jump between routes | No sidebar on the site at all. Node, docs and deck use the same 1240px content column |
| 6 | **A font the page has to fetch, and the serif it falls back to** | A webfont that fails on a judge's laptop leaves a serif, and the page reads as broken | Nothing fetches a font at runtime: **`[ -d web/out ] || echo "NOT RUN: build first"`**, then `grep -rl "fonts.gstatic\|fonts.googleapis" web/out` empty and `find web/out -name "*.woff2" \| wc -l` non-zero. An empty grep over a directory that does not exist is not a pass — the critic hit exactly that after a failed build. Every stack ends in `sans-serif` or `monospace`: `grep -rhoE "font-family:[^;]+" web/app web/components web/lib \| grep -vE "(sans-serif\|monospace) *;?$"` prints nothing. **Geist and Geist Mono stay** — `next/font/google` self-hosts them into the export (11 woff2 files, no runtime request), and they are already installed, so they are not a new font from the network. A count is not a verdict, and one file is not the page |

Two more, from this project's own record:

| 7 | **A number rendered from a fallback** | The legend printed "seeded 65" from its own fallback and a reviewer read it as measured (`Strawmap.tsx:49-50`) | With the API unreachable the page shows **no state counts at all**, and says why in a full sentence, not a grey parenthetical |
| 8 | **Highlighting a node that is not live** | The current build marks four chips and two nodes exist | The highlighted chips are exactly those whose `node_id` the API returns as `open` — identity, not a name match |

## 3. Fixed for every direction

Not up for variant choice. These come from the constraints and from the research.

- **Type:** the fonts already installed and self-hosted — **Geist** and **Geist Mono** via
  `next/font/google`, which writes the files into the export and makes no runtime request. Each stack
  ends in `sans-serif` / `monospace` so a failure lands on a sans, never a serif. Mono is for hashes,
  addresses, cycle counts and command output **only**. No font is added, and none is fetched.
- **Sizes:** 32 / 24 / 18 / 16 / 13 / 11. Body 16px at 1.6. Nothing between, nothing below 11.
- **Weights:** 400, 500, 700. Three, and the 700 is for h1 and for a chip's label when it is live.
- **Grid:** 1240px content column, 8px base spacing (4 8 12 16 24 32 48), radius 8px, 1px borders.
- **Vocabulary:** session, active session, started, lapses, cooldown. **Never "lease"** in any text a
  person reads. The check reads the *rendered* pages, because the source legitimately calls the API's
  field `lease_events` and a variable `leases` — those are identifiers, not prose, and a check that
  fails on them can never go green:
  the check strips `<script>` before searching, because the embedded page data legitimately carries
  the API's `lease_events` field names — a raw grep over the built HTML finds **142** and a grep over
  the rendered text finds **0**, and only the second is a statement about what a person reads.
  `web/design/check-brief.sh` runs it.
- **Copy discipline:** no client names, no budgets, no compute costs, no IP addresses, no private
  paths, no email addresses — including in placeholder text and lorem. Numbers on the page are read
  from the API or from the chain, never typed.
- **No dark mode** unless the picked direction is dark, in which case dark only.
- **The map is restyled, never rebuilt.** `web/lib/layout.ts` computes the geometry and
  `web/components/dashboard/Strawmap.tsx` renders it. A variant that recomputes chip positions is
  rejected: a fabricated map is what failed the last gate.

## 4. Three directions

Each is a different answer to "what does the map look like when it is the hero". Same content, same
tokens where they are fixed above, different visual argument. One will be picked from screenshots.

### A — Blueprint

*The grid is the graphic.* From the globe-ascii reference: hairline rules divide the page into cells,
the map's own columns and bands **are** those rules extended to the page edge, and the empty cells
stay empty. White ground, near-black ink, one blue.

- **Palette:** ground `#FFFFFF`, ink `#111111`, muted `#6B7280`, rule `#E5E7EB`, accent `#2E5BFF`.
- **Chips:** 1px rule, no fill, label in ink at 11px/500. A live node is filled `#2E5BFF` with white
  label at 700. Seeded nodes never carry colour — the two live ones are the only colour in the map.
- **Hero composition:** map full-bleed to the 1240px column, fork labels at 11px/500 in muted sitting
  *on* the top rule; band labels rotated in a 22px left strip; throughlines 1px `#C7D2FE`.
- **Mood:** a drawing in a technical manual. Nothing glows.

### B — Ledger

*The page as a printed record.* From Interface Craft: flat fields, fine line texture, one serif-free
display line, and a halftone dot field behind the masthead only.

- **Palette:** ground `#FAFAF8`, ink `#141414`, muted `#6E6E6E`, rule `#DCDCD6`, accent `#0B7A5A`
  (green, reading as verified rather than as "brand"), alert `#B4471F` for a recorded FAIL.
- **Chips:** filled `#FFFFFF` with a 1px rule. **Only a live node carries the 3px left edge tick**, in
  `#0B7A5A`; the other 63 carry none. Every chip having one would put colour on all 65 and make the
  two live ones invisible, which is what §1.2 and refusal 2 forbid — the tick is the direction's way
  of marking the two, not a texture for the map. (It is not refusal 1: that tell is a coloured border
  **plus** a tinted icon chip **on a card**, and this direction has no icons and no cards in the map.)
- **Hero composition:** a 96px masthead band carrying a 3px dot-matrix texture at 8% opacity, the map
  immediately under it, the three numbers set as a printed table with rules above and below. Every measurement in this
  direction is 3px or 1px; there is no 4px mark anywhere.
- **Mood:** an audit report you would sign.

### C — Terminal

*The page as the tool.* Mono-forward, dense, dark. The one direction that assumes the judge is a
developer and rewards them for it.

- **Palette:** ground `#0D1117`, panel `#161B22`, ink `#E6EDF3`, muted `#8B949E`, rule `#30363D`,
  accent `#58A6FF`, live `#3FB950`.
- **Chips:** mono 11px labels, 1px rule `#30363D`, live nodes `#3FB950` rule and label with a filled
  dot; everything else stays grey. Dark only, no light variant.
- **Hero composition:** the map on `#0D1117` with the rules at `#21262D`, a single line of mono above
  it reading the node count and the escrow, and the three numbers as `label=value` pairs in mono.
- **Mood:** `etherscan` and a terminal. The risk it takes is that dark reads as "crypto template";
  the mitigation is that nothing is neon and there is exactly one accent.

## 5. What every variant must ship

- Home, node and deck pages, building with `cd web && pnpm build` and **72 pages**.
- The map drawn from the real 65 with the two live nodes visibly distinct and clickable by id.
- Screenshots at 1440px via **`swarm/shoot.cjs`** (verified present; there is no `scratchpad/shoot.cjs`), copied to the run dir root as
  `variant-<a|b|c>-<home|node|deck>.png`.
- No change under `api/`, `contracts/`, `verifier/`, `swarm/`.

## 6. The deck

One screen per section of `docs/DECK.md`, section titles as the slide titles. It is what Pat presents,
so it is judged as a deck and not as a page: one idea per screen, the largest thing on the screen is
the point being made, and no screen carries more than **40 words** of body text. The map appears on
exactly one screen, full width, with nothing else on it.
