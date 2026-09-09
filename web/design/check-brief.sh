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
css=$(find web/out -name "*.css" 2>/dev/null | head -1)
if [ -z "$css" ]; then say "type weights" "NOT RUN (build first)"; bad; else
  n=$(grep -o "font-weight:6[0-9][0-9]" "$css" | wc -l | tr -d ' ')
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

# do-not-say — never in anything a person reads, including placeholders.
n=$(grep -rniE "workplane-private|/Users/|192\.222|@ecofrontiers\.xyz|slabclaw" web/app web/components web/lib 2>/dev/null | grep -v "ethplane.ecofrontiers.xyz" | wc -l | tr -d ' ')
[ "$n" = 0 ] && say "do-not-say" "PASS (0)" || { say "do-not-say" "FAIL ($n)"; bad; }

# pages — the export must carry all 65 node pages plus the rest.
if [ ! -d web/out ]; then say "pages built" "NOT RUN (build first)"; bad; else
  n=$(find web/out -name "*.html" | wc -l | tr -d ' ')
  [ "$n" -ge 71 ] && say "pages built" "PASS ($n html)" || { say "pages built" "FAIL ($n html)"; bad; }
fi

echo
[ "$fails" = 0 ] && echo "brief checks: all PASS" || echo "brief checks: $fails FAILED"
exit "$fails"
