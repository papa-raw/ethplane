#!/usr/bin/env bash
# check-voice.sh — the visible strings of the site, against Pat's voice rules.
#
# Pat, 2026-09-08: "all writing on the site should be standard technical english
# with no claudisms". voice_check.py is essay-calibrated and catches roughly one
# of these rules on site copy, so this script adds the taxonomy greps and runs
# voice_check.py as one check among several.
#
# Exit code = number of failing checks. Each failure prints the offending lines.
# Run from the repository root.

cd "$(dirname "$0")/../.." || exit 2
SRC=(web/app web/components web/lib)
FAILURES=0
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# Comment lines are excluded from the visible-string checks. grep -rn prefixes each
# line with "file:line:", so the comment marker is matched after that prefix and not
# at the start of the line — the first draft anchored at ^ and excluded nothing.
strip_comments() { grep -vE '^[^:]+:[0-9]+:[[:space:]]*(//|\*|/\*)'; }

report() { # name, expected, matches-file
  local name="$1" n
  n=$(wc -l < "$3" | tr -d ' ')
  if [ "$n" -eq 0 ]; then
    printf 'PASS  %-46s 0 found\n' "$name"
  else
    printf 'FAIL  %-46s %s found\n' "$name" "$n"
    sed 's/^/        /' "$3"
    FAILURES=$((FAILURES + 1))
  fi
}

echo "== visible strings =="

# V1 — M1 spaced em/en dash in prose. Kept deliberately, and excluded here:
#   the '—' empty-value placeholder in a table cell (no surrounding spaces),
#   the "Ethplane — <page>" title delimiter, and "${label} — ${state}" in an
#   SVG <title>. Those are delimiters, not sentence punctuation.
grep -rn ' [—–] ' "${SRC[@]}" 2>/dev/null | strip_comments \
  | grep -vE "title: 'Ethplane [—–] " \
  | grep -vE '\}\s[—–]\s\$\{' > "$TMP/v1"
report "V1 spaced em dash in prose (M1)" 0 "$TMP/v1"

# V2 — words that carry no information in technical English.
grep -rniE '\b(genuinely|honestly|actually|simply|seamless|seamlessly|powerful|effortless|blazing|delightful)\b' \
  "${SRC[@]}" 2>/dev/null | strip_comments > "$TMP/v2"
report "V2 empty intensifiers" 0 "$TMP/v2"

# V3 — T1 trailing significance clause.
grep -rniE ', which (means|is why|is where|is how|lets|makes|gives|turns)' \
  "${SRC[@]}" 2>/dev/null | strip_comments > "$TMP/v3"
report "V3 trailing significance clause (T1)" 0 "$TMP/v3"

# V4 — the rhetorical reveal.
grep -rniE "(isn't|is not|not) just\b|more than just\b|not [a-z]+, but\b" \
  "${SRC[@]}" 2>/dev/null | strip_comments > "$TMP/v4"
report "V4 rhetorical reveal (not X but Y)" 0 "$TMP/v4"

# V5 — chat register in a status line.
grep -rniE "welcome back|you're all set|oops|all done!|let's get|nice work|great!" \
  "${SRC[@]}" 2>/dev/null | strip_comments > "$TMP/v5"
report "V5 chat register in status strings" 0 "$TMP/v5"

# V6 — voice_check.py on the prose the site renders, extracted as plain text.
# JSX text and string literals over 30 characters; short labels are judged from
# the screenshots, not here (see NOT COVERED).
VC=~/.claude/skills/pat-voice/scripts/voice_check.py
if [ -f "$VC" ]; then
  grep -rhoE '"[^"]{30,}"|'"'"'[^'"'"']{30,}'"'"'|>[^<>{}]{30,}<' "${SRC[@]}" 2>/dev/null \
    | sed -E 's/^[">'"'"']//; s/["<'"'"']$//' > "$TMP/prose.md"
  if python3 "$VC" "$TMP/prose.md" --quiet > "$TMP/v6" 2>&1; then
    printf 'PASS  %-46s exit 0\n' "V6 voice_check.py on extracted prose"
  else
    printf 'FAIL  %-46s exit 1\n' "V6 voice_check.py on extracted prose"
    sed 's/^/        /' "$TMP/v6"
    FAILURES=$((FAILURES + 1))
  fi
else
  printf 'FAIL  %-46s checker not found at %s\n' "V6 voice_check.py on extracted prose" "$VC"
  FAILURES=$((FAILURES + 1))
fi

# Informational: the same tics in code comments. A judge can read the source of a
# public repository, but these are not visible strings, so they do not fail the run.
COMMENTS=$(grep -rnE '^\s*(//|\*|/\*).* [—–] |^\s*(//|\*|/\*).*\b(genuinely|honestly|actually)\b' \
  "${SRC[@]}" 2>/dev/null | wc -l | tr -d ' ')
echo
echo "INFO  $COMMENTS comment lines carry the same shapes (not counted; not visible to a reader)"

cat <<'NOTE'

NOT COVERED by this script, and judged from the rendered pages instead:
  - Rule of three (T5). A list of three is a fail only when it is decoration;
    "fork target, layer and track" names the map's three axes and is correct.
    The distinction needs a reader.
  - Prose in docs/*.md and docs/DECK.md, rendered by the docs and deck pages.
    That text passed the checker already and is out of scope by instruction.
  - Strings assembled at runtime from templates or returned by the API.
  - Button labels, table headers and status words under 30 characters, which
    V6 does not extract.
NOTE

echo
echo "$FAILURES check(s) failed"
exit "$FAILURES"
