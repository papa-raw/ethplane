#!/usr/bin/env bash
#
# The worktree-mode code path, end to end, under the interpreter host A runs.
#
# Two things: the unit tests, and then the real thing — a real directory, shared by the real
# function, inspected with the real stat. A mode asserted only inside the process that set it is a
# test of a variable; this one asks the filesystem.
#
#   verifier/tests/build-user-test.sh
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PY="${PYTHON:-python3.12}"
command -v "$PY" >/dev/null || { echo "no $PY on PATH (host A runs python3.12)"; exit 2; }

echo "== unit tests"
PYTHONPATH="$REPO" "$PY" "$REPO/verifier/tests/test_build_user.py" 2>&1 | tail -3

echo
echo "== a real directory, shared for real"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
OWN_GROUP="$("$PY" -c 'import grp, os; print(grp.getgrgid(os.getgid()).gr_name)')"

BEFORE="$("$PY" -c "import os, stat; print(oct(stat.S_IMODE(os.stat('$WORK').st_mode)))")"
PYTHONPATH="$REPO/verifier" BUILD_USER=lean-build BUILD_GROUP="$OWN_GROUP" "$PY" - "$WORK" <<'PYEOF'
import sys
import run
ok, reason = run.share_with_build_user(sys.argv[1])
if not ok:
    raise SystemExit(f"share_with_build_user refused: {reason}")
PYEOF
AFTER="$("$PY" -c "import os, stat; print(oct(stat.S_IMODE(os.stat('$WORK').st_mode)))")"

echo "   mode before: $BEFORE"
echo "   mode after:  $AFTER"
[ "$AFTER" = "0o2770" ] || { echo "FAILED: expected 0o2770 (setgid, group write, nothing for others)"; exit 1; }

# and the same call must leave a directory alone when no build user is configured
OTHER="$(mktemp -d)"
trap 'rm -rf "$WORK" "$OTHER"' EXIT
UNTOUCHED_BEFORE="$("$PY" -c "import os, stat; print(oct(stat.S_IMODE(os.stat('$OTHER').st_mode)))")"
PYTHONPATH="$REPO/verifier" "$PY" - "$OTHER" <<'PYEOF'
import sys
import run
ok, reason = run.share_with_build_user(sys.argv[1])
if not ok:
    raise SystemExit(f"share_with_build_user refused with no BUILD_USER set: {reason}")
PYEOF
UNTOUCHED_AFTER="$("$PY" -c "import os, stat; print(oct(stat.S_IMODE(os.stat('$OTHER').st_mode)))")"
[ "$UNTOUCHED_BEFORE" = "$UNTOUCHED_AFTER" ] || { echo "FAILED: a directory changed with no BUILD_USER set"; exit 1; }
echo "   with no BUILD_USER: $UNTOUCHED_AFTER, unchanged"

echo
echo "PASS"
