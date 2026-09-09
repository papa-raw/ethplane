---
version: alpha
name: Ethplane
description: The Ethereum roadmap as a work plane. Tokens for the site and the deck; three directions share every token except colour.
colors:
  primary: "#2E5BFF"
  secondary: "#6B7280"
  tertiary: "#0B7A5A"
  neutral: "#FFFFFF"
  surface: "#FFFFFF"
  on-surface: "#111111"
  border: "#E5E7EB"
  error: "#B4471F"
  state-seeded: "#9CA3AF"
  state-defined: "#2E5BFF"
  state-open: "#0B7A5A"
  state-claimed: "#B45309"
  state-passed: "#065F46"
  state-unknown: "#D4D4D8"
typography:
  headline-display:
    fontFamily: system-sans
    fontSize: 32px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: system-sans
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.25
  headline-md:
    fontFamily: system-sans
    fontSize: 18px
    fontWeight: 500
    lineHeight: 1.35
  body-md:
    fontFamily: system-sans
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
  body-sm:
    fontFamily: system-sans
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
  label-sm:
    fontFamily: system-sans
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1.2
  mono-sm:
    fontFamily: system-mono
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
  chip-label:
    fontFamily: system-sans
    fontSize: 11px
    fontWeight: 500
    lineHeight: 1
  chip-label-live:
    fontFamily: system-sans
    fontSize: 11px
    fontWeight: 700
    lineHeight: 1
rounded:
  none: 0px
  sm: 4px
  md: 8px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  xxl: 32px
  xxxl: 48px
components:
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.chip-label}"
    rounded: "{rounded.sm}"
    height: 22px
  chip-live:
    backgroundColor: "{colors.state-open}"
    textColor: "#FFFFFF"
    typography: "{typography.chip-label-live}"
    rounded: "{rounded.sm}"
    height: 22px
  chip-unknown:
    backgroundColor: "{colors.state-unknown}"
    textColor: "#3F3F46"
    typography: "{typography.chip-label}"
    rounded: "{rounded.sm}"
    height: 22px
  chip-seeded:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.secondary}"
    typography: "{typography.chip-label}"
    rounded: "{rounded.sm}"
    height: 22px
  chip-defined:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.state-defined}"
    typography: "{typography.chip-label}"
    rounded: "{rounded.sm}"
    height: 22px
  chip-claimed:
    backgroundColor: "{colors.state-claimed}"
    textColor: "#FFFFFF"
    typography: "{typography.chip-label-live}"
    rounded: "{rounded.sm}"
    height: 22px
  chip-passed:
    backgroundColor: "{colors.state-passed}"
    textColor: "#FFFFFF"
    typography: "{typography.chip-label-live}"
    rounded: "{rounded.sm}"
    height: 22px
  rule:
    backgroundColor: "{colors.border}"
    height: 1px
  legend-dot-seeded:
    backgroundColor: "{colors.state-seeded}"
    rounded: "{rounded.full}"
    size: 10px
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.md}"
    padding: 16px
  table-header:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.secondary}"
    typography: "{typography.label-sm}"
    padding: 8px
  code:
    backgroundColor: "#F5F5F7"
    textColor: "{colors.on-surface}"
    typography: "{typography.mono-sm}"
    rounded: "{rounded.sm}"
    padding: 4px
---

## Overview

Ethplane shows the Ethereum roadmap as a plane of work: 65 nodes, two of them live with escrow, and a
verifier that has recorded seven measurements and accepted none. The audience is a hackathon judge on
their fortieth submission, and the only question that matters is whether any of it is real. So the
system is built for evidence rather than persuasion: numbers on the page come from the API or the
chain, the map is the live one, and nothing glows.

Every token here is shared by the three directions in `BRIEF.md` **except colour**. Type, spacing,
radius and the component shapes are fixed, so three variants are comparable as arguments about colour
and composition rather than as three unrelated pages. The palette above is Blueprint's; Ledger and
Terminal override `colors` only, and their values are in the brief.

## Colors

`primary` `#2E5BFF` is the one saturated colour on a white ground: links, the active chip, the
throughlines. It is used as a *field* or a *mark*, never as decoration on every element — from the
globe-ascii reference, where a single blue field carries a page of hairlines.

`state-*` are the node states as the contract knows them, and they are the only place colour carries
meaning: seeded grey, defined blue, open green, claimed amber, passed dark green. `state-unknown`
exists for the case the API is unreachable, and it is deliberately a *different* grey from
`state-seeded`: a map that cannot read state must not render as a map full of seeded nodes, which is
the defect this project already shipped once.

`error` `#B4471F` marks a recorded FAIL. It is used on the node page and never on the map: a red chip
among 65 would read as an alert rather than as a record.

## Typography

System stack only — `ui-sans-serif, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial,
sans-serif` — with no `@font-face` and no network request. A webfont that fails on a judge's laptop
falls back to a serif and the page reads as broken; the fastest way to never show that is to have no
webfont.

Six sizes: 32, 24, 18, 16, 13, 11. Three weights: 400, 500, 700. No 600 anywhere, because the
difference between 500 and 600 is invisible at 13px and produces uniform-weight pages where hierarchy
then has to come from boxes.

Mono is `ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace` and appears **only** on hashes,
addresses, cycle counts and command output. Mono is how this page says "this value came from
somewhere you can check", so using it for anything else spends the signal.

## Layout

1240px content column, centred, 24px gutters. Spacing is an 8px rhythm: 4, 8, 12, 16, 24, 32, 48, and
nothing between. The map is the exception that proves it — its geometry comes from `web/lib/layout.ts`
(132px columns, 22px chips, 4px gaps) because the diagram's spacing is data, not decoration.

The page has no sidebar. Home, node, docs and deck share the same column so nothing jumps between
routes.

## Elevation & Depth

None. No shadows, no gradients, no blur. Depth is a 1px border in `{colors.border}` and, where two
surfaces must separate, a change of ground. A shadow on a card is the cheapest way to make a page look
like a template, and this page cannot afford to look like one.

## Shapes

4px on chips and code, 8px on panels, square on rules and tables. Nothing is fully round except a
state dot in the legend (`legend-dot-seeded` and its siblings), which is round so it reads as a swatch
rather than a badge. `state-seeded` lives there rather than in a chip label: the swatch is where that
grey has to be exactly the map's grey, and a chip's label has to be readable first.

## Components

**chip** — one node in the map. Border 1px, label 11px/500, height 22px, radius 4px. It is a cell in
a diagram, not a card: no shadow, no icon, no second line.

**chip-live** — a node the API returns as `open`. Filled, white label at 700. Two of these exist
today, and they are the only filled chips on the map, which is what makes "two of these are live"
legible in ten seconds.

**chip-unknown** — used for every chip when the API is unreachable, with the state counts suppressed
entirely. The map still draws, because the shape is still the roadmap; it just stops claiming to know
anything about state.

**panel** — the four bordered containers allowed on the home page. 16px padding, 8px radius, 1px
border. The map is not one of them.

**table-header** — sticky, 11px/500 in `{colors.secondary}`, zebra rows beneath at 2% ink. Sessions,
submissions and verdicts are tables because they are records, and a record wants rows.

## Do's and Don'ts

- **Do** let colour mean state and nothing else. If an element's colour does not encode a fact from
  the API or the chain, it should be ink, muted or border.
- **Do** put mono on values a reader could verify, and only there.
- **Don't** render a count from a fallback. With no data, show no count and say so in a sentence.
- **Don't** add a sixth type size or a fourth weight. If something needs emphasis, it takes weight or
  colour, not a new size.
- **Don't** put a card around a diagram, a heading, or a paragraph. Four panels on home, maximum.
- **Don't** introduce an icon set. The visual language is chips, lines, columns and bands.
- **Contrast, linted not asserted** (`npx @google/design.md lint web/design/design.md`: 0 errors, 0
  warnings). Two component pairs failed the first pass and were changed rather than excused: a seeded
  chip's label was `state-seeded` on white at 2.54:1 and is now `secondary` at 4.8:1, and an unknown
  chip's label was `secondary` on `state-unknown` at 3.27:1 and is now `#3F3F46` at 7.4:1. What
  separates a seeded chip from a live one is **fill** — outline against filled — not a label too
  faint to read.
- **Contrast:** ink on surface is 17.9:1; `secondary` on surface is 4.8:1; `primary` on surface is
  5.1:1 — all above WCAG AA for body text. Chip labels at 11px are 500 weight on a filled ground for
  the live state (white on `#0B7A5A`, 4.9:1) and ink on white otherwise.
