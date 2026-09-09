#!/usr/bin/env bash
# Every check in BRIEF.md, as one command, so a gate is run rather than read.
#
# Each check prints PASS or FAIL with the number it found. A check that cannot run says NOT RUN and
# fails the script — an empty grep over a directory that does not exist is not a pass, which is the
# way two of these were wrong before they were tested.
#
#   web/design/check-brief.sh            # from the repository root, after `cd web && pnpm build`
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.." || exit 2
fails=0
say() { printf '%-28s %s\n' "$1" "$2"; }
bad() { fails=$((fails+1)); }

# 1 — coloured left-border card. Baseline is 0, so any hit belongs to the variant.
n=$(grep -rn "border-l-\|borderLeft" web/app web/components web/lib 2>/dev/null | wc -l | tr -d ' ')
[ "$n" = 0 ] && say "left-border card" "PASS (0)" || { say "left-border card" "FAIL ($n)"; bad; }

# 3 — three weights, no 600.
# Every stylesheet, not the first: one chunk today, but a route-level stylesheet would take the
# coverage away silently. Third instance in this file's own history of "one file is not the page".
css=$(find web/out -name "*.css" 2>/dev/null)
if [ -z "$css" ]; then say "type weights" "NOT RUN (build first)"; bad; else
  n=$(grep -ho "font-weight:6[0-9][0-9]" $css | wc -l | tr -d ' ')
  [ "$n" = 0 ] && say "type weights" "PASS (no 600)" || { say "type weights" "FAIL ($n × 600)"; bad; }
fi

# 6 — nothing fetches a font at runtime, and the fonts are actually in the export.
if [ ! -d web/out ]; then say "fonts self-hosted" "NOT RUN (build first)"; bad; else
  n=$(grep -rl "fonts.gstatic\|fonts.googleapis" web/out 2>/dev/null | wc -l | tr -d ' ')
  w=$(find web/out -name "*.woff2" | wc -l | tr -d ' ')
  { [ "$n" = 0 ] && [ "$w" -gt 0 ]; } && say "fonts self-hosted" "PASS (0 remote, $w woff2)" || { say "fonts self-hosted" "FAIL ($n remote, $w woff2)"; bad; }
fi

# 6 — every stack ends in sans-serif or monospace, so a failure lands on a sans, never a serif.
n=$(grep -rhoE "font-family:[^;}]+" web/app web/components web/lib 2>/dev/null | grep -vcE "(sans-serif|monospace)[^a-z]*$" || true)
[ "${n:-0}" = 0 ] && say "no serif fallback" "PASS" || { say "no serif fallback" "FAIL ($n)"; bad; }

# vocabulary — what a person READS, not what the code calls its variables. Embedded JSON carries the
# API's own lease_events field names; stripping <script> is what separates prose from data.
if [ ! -d web/out ]; then say "session vocabulary" "NOT RUN (build first)"; bad; else
  n=$(python3 - <<'PY'
import re, pathlib
t = 0
for f in pathlib.Path("web/out").rglob("*.html"):
    h = f.read_text(errors="replace")
    b = re.sub(r"<script[^>]*>.*?</script>", " ", h, flags=re.S | re.I)
    t += len(re.findall(r"\blease[sd]?\b", re.sub(r"<[^>]+>", " ", b), re.I))
print(t)
PY
)
  [ "$n" = 0 ] && say "session vocabulary" "PASS (0 in rendered text)" || { say "session vocabulary" "FAIL ($n)"; bad; }
fi

# do-not-say — shapes, not a list. Two exclusions that were wrong and are gone: `grep -v
# check-brief.sh` filtered by CONTENT, so any file could exempt itself by naming the scanner (proved:
# a component containing "see check-brief.sh — /Users/pat/secret" passed); and `=>` dropped every
# arrow-function line, 68 of them, which in a React codebase is where a hardcoded value actually
# lives. The scanner now excludes itself by PATH and excludes no code shape at all. The authoritative list names clients and partners, and a grep
# enumerating them inside a public repository would be the leak it is meant to prevent; so this
# matches the SHAPES (private paths, any host IP, keys, currency, mail) across everything that can
# reach a page, and the named list is checked by a human against the private evidence pack.
DNS_SURFACE="web/app web/components web/lib web/public web/design"
[ -d web/data ] && DNS_SURFACE="$DNS_SURFACE web/data"
n=$(grep -rniE --exclude=check-brief.sh "workplane-private|/Users/|/home/(ubuntu|verifier)/|\b([0-9]{1,3}\.){3}[0-9]{1,3}\b|PRIVATE_KEY|BEGIN [A-Z ]*PRIVATE KEY|[a-z0-9._%-]+@[a-z0-9.-]+\.[a-z]{2,}|\$[0-9][0-9,.]*|hetzner|lambda ?labs|slabclaw" \
  $DNS_SURFACE 2>/dev/null \
  | grep -viE "ethplane\.ecofrontiers\.xyz|0\.0\.0\.0|127\.0\.0\.1" \
  | grep -viE "@[a-z0-9]+\.(md|ts|tsx|json|html|css|svg|png)\b" | wc -l | tr -d ' ')
[ "$n" = 0 ] && say "do-not-say (shapes)" "PASS (0 over $(echo $DNS_SURFACE | wc -w | tr -d ' ') dirs)" || { say "do-not-say (shapes)" "FAIL ($n)"; bad; }

# pages — the export must carry all 65 node pages plus the rest.
if [ ! -d web/out ]; then say "pages built" "NOT RUN (build first)"; bad; else
  n=$(find web/out -name "*.html" | wc -l | tr -d ' ')
  [ "$n" -ge 71 ] && say "pages built" "PASS ($n html)" || { say "pages built" "FAIL ($n html)"; bad; }
fi

echo
[ "$fails" = 0 ] && echo "brief checks: all PASS" || echo "brief checks: $fails FAILED"
cat <<'NOTE'

NOT COVERED BY THIS SCRIPT — judge these from the PNGs and the diff:
  refusal 2  badge soup                          a DOM count could cover it; not written yet
  refusal 4  a card on everything                 a DOM count could cover it; not written yet
  refusal 5  no sidebar                           a DOM count could cover it; not written yet
  refusal 7  a number rendered from a fallback   needs the API UNREACHABLE at capture; a static
                                                 export cannot show it. Shoot once with the proxy
                                                 pointed at a dead host and read the legend.
  refusal 8  a chip highlighted that is not live  needs the API REACHABLE and compared against it:
                                                 the highlighted chips must be exactly those whose
                                                 node_id it returns as open — identity, not a count.
A PASS above is a statement about refusals **1, 3 and 6** and the vocabulary, the do-not-say shapes
and the page count — and nothing else. Naming what you do not cover and getting the list wrong is
worse than saying nothing, because it converts an absence into a specific false assurance.
NOTE
exit "$fails"
