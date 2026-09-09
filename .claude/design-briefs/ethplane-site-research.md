# Design Research: the Ethplane site and deck (2026-09-09)

## 1. Domain analysis

**Target user:** a hackathon judge with ten seconds. Technical, reads Ethereum daily, has seen forty
submissions today and half of them were a landing page with a gradient and three feature cards. They
are asking one question: *is any of this real?* Second reader: an Ethereum researcher who knows the
roadmap by name and will notice if we get it wrong.

**Their daily tools:** Etherscan, GitHub, ethereum.org/roadmap, forkcast.org, Linear or Notion, a
terminal.

**Domain category:** developer/protocol tooling with a marketplace underneath. Not consumer, not
enterprise SaaS. The nearest shipped siblings are block explorers and roadmap trackers.

**Aesthetic expectation:** dense, factual, unglossy. Numbers and hashes on the page. A judge trusts a
page that looks like the tools they already trust, and discounts one that looks like a pitch.

## 2. References

Three fetched, and what each was actually good for. Two are first-party images in the estate's own
library, which I looked at rather than described from memory; the third is the domain's own page.

1. **globe-ascii luxury landing** — `~/Desktop/2_resources/Design/globe-ascii-luxury-landing-basit-designs-apr2026.png`
   (Basit A. Khan, Apr 2026, filed by Pat). Luxury + minimalism + ASCII art on a landing page.
2. **Interface Craft** — `~/Desktop/2_resources/Design/interface-craft-josh-puckett-design-library-site.jpg`.
   A working library "for those committed to designing with uncommon care".
3. **ethereum.org/roadmap** — fetched 2026-09-09. The official presentation of the same subject
   matter our home page presents.
4. **forkcast.org** — fetched 2026-09-09, and **it is JavaScript-rendered: the layout was not
   readable and I am not going to describe what I expect it to look like.** What survived the fetch
   was its navigation vocabulary, which is still evidence: EIPs, Calls, Decisions, Networks,
   Schedule, Rank — and the fork names Glamsterdam and Hegotá, the same fork columns our map draws.

## 3. Pattern analysis

### globe-ascii landing
- **Layout:** a visible modular grid. Hairline rules divide the page into cells and the grid itself
  is the graphic; content sits in some cells and the rest are deliberately empty.
- **Typography:** one two-line statement, first line light grey, second line black. Weight and
  colour carry the hierarchy, not size. Cell labels are tiny (~10px), body copy smaller still.
- **Colour:** white, hairline grey, black text, and exactly one saturated blue field.
- **Density:** sparse at the top, dense in the cells. Calm because the grid is doing the organising.
- **Hero:** a dot-matrix globe — technical texture standing in for an image. No photography.

### Interface Craft
- **Layout:** white card floating on a halftone field; content centred and narrow.
- **Typography:** serif display for the title on white, small grey sans for the one-line subtitle.
- **Colour:** flat saturated cards (orange, blue, green, black) each carrying a fine line or dot
  pattern. No gradients, no shadows doing the work.
- **Credibility:** the line-pattern texture reads as printed matter, not as a template.

### ethereum.org/roadmap
- **Layout:** sequential cards per upgrade, each with a hero image, a title, a date, and a bulleted
  "Main features" list; a carousel underneath.
- **Typography:** system sans, bold headings, moderate body.
- **Density:** moderate; one upgrade at a time.
- **Weakness for us:** you cannot see the whole roadmap at once. Ours can, and that is the argument.

### Common patterns
- **Dot-matrix / halftone texture as the technical signature** — in both first-party references, and
  the thing that makes them read as crafted rather than templated (globe, card patterns).
- **Hairline structure over boxes** — cells and rules, not cards with shadows.
- **One saturated colour against white and grey**, used as a field or a mark, never as decoration on
  every element.
- **Weight and colour for hierarchy, not size** — two type sizes doing the work of five.

## 4. What this means for our page, before any variant

Our hero is already a grid: fork targets are columns, layers and tracks are bands, and each node is a
cell in it. `web/lib/layout.ts` computes exactly that. So the strongest reference in the library —
the modular grid where the grid is the graphic — is not a style to apply to our page, it is a
description of what our page already is. The work is to stop the map looking like a table by
accident and let it look like a diagram on purpose.

The domain reference gives the vocabulary: fork names, EIPs, decisions, schedule. The official page
gives the thing to beat: one upgrade at a time, no way to see the whole.

## 5. Icon language

Almost none, deliberately, and no icon library added. The page's vocabulary is: a **chip** (a node),
a **line** (a throughline), a **column** (a fork), a **band** (a layer/track), and a **dot** (state).
State is carried by the chip's own fill and stroke — see the tokens — not by a badge or an icon
beside it. The only glyphs are the arrow in "← all 65 nodes" and the external-link mark. This is a
refusal, not an omission: an icon set on a page whose subject is 65 labelled cells adds a second
visual language competing with the first.
