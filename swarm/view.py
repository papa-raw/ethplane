#!/usr/bin/env python3
"""The VIEW pane: a live, guest-readable dashboard of one Ethplane node, refreshed every 10 s.

Reads the public API (node, sessions, submissions, verdicts) and the swarm's board tail. Standard
library only. Env: NODE_ID, NODE_NAME (ENS name), API_BASE, SWARM_DIR (board.md), BASELINE, LINEAGES
("qwen-a=0x…,fast-b=0x…"), JOIN_URL.
"""
import datetime, json, os, pathlib, select, shutil, sys, threading, time, urllib.request

NODE = os.environ.get("NODE_ID", ""); NAME = os.environ.get("NODE_NAME", "node"); API = os.environ.get("API_BASE", "https://ethplane.ecofrontiers.xyz")
BOARD = pathlib.Path(os.environ.get("SWARM_DIR", os.path.expanduser("~/swarm"))) / "board.md"
BASELINE = int(os.environ.get("BASELINE", "1542812")); JOIN = os.environ.get("JOIN_URL", "https://ethplane.ecofrontiers.xyz/join")
NAMES = dict(kv.split("=", 1) for kv in os.environ.get("LINEAGES", "").split(",") if "=" in kv)
NAMES = {v.lower(): k for k, v in NAMES.items()}
D, B, X, HL, AC, OK, BAD = "\033[2m", "\033[1m", "\033[0m", "\033[48;5;24m\033[38;5;153m", "\033[38;5;153m", "\033[38;5;71m", "\033[38;5;167m"

def width():
    try: return min(shutil.get_terminal_size().columns, 100)
    except Exception: return 84
def short(a): return (a[:6] + "…" + a[-4:]) if a and len(a) > 12 else (a or "")
def who(addr): return NAMES.get((addr or "").lower(), short(addr))
def ago(ts):
    if not ts: return "never"
    s = int(time.time()) - int(ts)
    return f"{s} s ago" if s < 90 else (f"{s // 60} min ago" if s < 5400 else f"{s // 3600} h ago")
def hhmm(ts): return datetime.datetime.fromtimestamp(int(ts)).strftime("%H:%M") if ts else "?"
def fetch():
    try:
        with urllib.request.urlopen(f"{API}/api/nodes/{NODE}", timeout=8) as r: return json.load(r), None
    except Exception as e: return None, str(e)[:60]
def pick(d, *keys):
    for k in keys:
        if d.get(k) not in (None, "", 0, "0"): return d[k]
    return None
def num(v):
    try: return f"{int(str(v)):,}"
    except Exception: return str(v)
def bar(left, right):
    w = width(); pad = max(1, w - len(left) - len(right) - 2); return f"{HL} {left}{' ' * pad}{right} {X}"
def row(cols, widths):
    return "  " + "  ".join(str(c)[:w].ljust(w) for c, w in zip(cols, widths))

OFF = {"n": 0, "dirty": True}
def height():
    try: return shutil.get_terminal_size().lines
    except Exception: return 40
def keys():
    """Arrow keys, j/k, PageUp/PageDown, g/G scroll the view; q quits."""
    fd = sys.stdin.fileno()
    try:
        import tty; tty.setcbreak(fd)
    except Exception: return
    while True:
        ch = os.read(fd, 1)
        if ch == b"\x1b":
            seq = b""
            while select.select([fd], [], [], 0.02)[0]: seq += os.read(fd, 1)
            ch = {b"[A": b"k", b"[B": b"j", b"[5~": b"K", b"[6~": b"J"}.get(seq, b"")
        step = {b"k": -1, b"j": 1, b"K": -10, b"J": 10}.get(ch)
        if step is not None: OFF["n"] = max(0, OFF["n"] + step); OFF["dirty"] = True
        elif ch == b"g": OFF["n"] = 0; OFF["dirty"] = True
        elif ch == b"G": OFF["n"] = 10**6; OFF["dirty"] = True
        elif ch == b"q": os.kill(os.getpid(), 2)
def render():
    data, err = fetch(); w = width(); out = []
    n = (data or {}).get("node", {}) or {}
    state = n.get("state", "?"); bounty = pick(n, "bounty")
    bounty_s = f"{int(bounty) // 10**18:,} PLANE" if bounty and str(bounty).isdigit() else "unfunded"
    out.append(bar(f"ETHPLANE · {NAME}", f"{state} · {bounty_s}"))
    out.append(f"  {D}criterion{X}  cycles < {B}{BASELINE:,}{X} at leanVM a210ef1b · verifier-measured")
    base = pick(n, "original_metric", "baseline_metric", "originalMetric") or BASELINE; best = pick(n, "best_metric", "bestMetric") or base
    passed = int(str(best)) < int(str(base)) if str(best).isdigit() and str(base).isdigit() else False
    out.append(f"  {D}baseline{X}   {num(base)} cycles      {D}best{X}   {OK if passed else ''}{num(best)}{X} {D}{'(passed)' if passed else '(no pass yet)'}{X}")
    out.append("")
    leases = [l for l in (data or {}).get("leases", []) if l.get("active")]
    out.append(f"  {B}SESSIONS{X} {D}({len(leases)} active · working on this node, from head H){X}")
    out.append(D + row(["worker", "operator", "since", "heartbeat", "from"], [8, 12, 6, 11, 10]) + X)
    for l in leases[:6]:
        fh = l.get("from_hash", ""); frm = "head" if not fh or set(fh[2:]) == {"0"} else short(fh)
        out.append(row([who(l.get("lineage")), short(l.get("operator")), hhmm(l.get("start")), ago(l.get("last_heartbeat")), frm], [8, 12, 6, 11, 10]))
    if not leases: out.append(f"  {D}none{X}")
    out.append("")
    subs = (data or {}).get("submissions", []) or []; verdicts = {v.get("artifact_hash") or v.get("artifact"): v for v in (data or {}).get("verdicts", []) or []}
    out.append(f"  {B}SUBMISSIONS{X} {D}({len(subs)} · verdicts by the verifier, on Sepolia){X}")
    out.append(D + row(["artifact", "by", "cycles", "verdict", "reason"], [12, 8, 10, 7, 20]) + X)
    for s in sorted(subs, key=lambda s: s.get("ts") or s.get("block") or 0, reverse=True)[:20]:
        h = s.get("artifact_hash") or s.get("artifact") or ""; v = verdicts.get(h, {})
        cyc = pick(v, "cycles", "metric") or pick(s, "cycles", "metric"); status = v.get("status") or ("PASS" if v.get("verifier_accepted") else ("FAIL" if v else "pending"))
        col = OK if str(status).upper() == "PASS" else (BAD if str(status).upper() == "FAIL" else D)
        out.append(row([short(h), who(s.get("lineage")), num(cyc) if cyc else "", "", v.get("reason") or ""], [12, 8, 10, 7, 20]).replace("  " + " " * 7 + "  " + (v.get("reason") or "")[:20].ljust(20), f"  {col}{str(status)[:7].ljust(7)}{X}  " + (v.get("reason") or "")[:20].ljust(20)))
    if not subs: out.append(f"  {D}none yet{X}")
    out.append("")
    out.append(f"  {B}SWARM{X} {D}(the workers' own board, last lines){X}")
    try: lines = BOARD.read_text().splitlines()[-30:]
    except Exception: lines = []
    for l in lines: out.append(f"  {D}{l[:w - 4]}{X}")
    out.append("")
    stamp = datetime.datetime.now().strftime("%H:%M:%S")
    foot = f"  {D}join {X}{AC}{JOIN}{X}{D}  ·  {stamp}{'  ·  api: ' + err if err else ''}{X}"
    return out, foot
def draw(out, foot):
    h = height(); body = max(3, h - 3); OFF["n"] = max(0, min(OFF["n"], max(0, len(out) - body)))
    win = out[OFF["n"]:OFF["n"] + body]; more = len(out) - OFF["n"] - len(win)
    hint = f"{D}  ↑/↓ or j/k scroll · {OFF['n']}/{len(out)} lines{'  · ' + str(more) + ' more below' if more > 0 else ''}{X}"
    sys.stdout.write("\033[H" + "\n".join(l + "\033[K" for l in win) + "\033[K\n" * max(0, body - len(win)) + f"\033[{h - 1};1H\033[K{hint}\033[{h};1H\033[K{foot}"); sys.stdout.flush()

if __name__ == "__main__":
    print("\033[?25l\033[2J", end=""); threading.Thread(target=keys, daemon=True).start()
    try:
        out, foot = render(); last = time.time()
        while True:
            if time.time() - last >= 10: out, foot = render(); last = time.time(); OFF["dirty"] = True
            if OFF["dirty"]: draw(out, foot); OFF["dirty"] = False
            time.sleep(0.1)
    except KeyboardInterrupt: pass
    finally: print("\033[?25h", end="")
