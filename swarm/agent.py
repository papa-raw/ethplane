#!/usr/bin/env python3
"""Ethplane swarm agent: one role (orchestrator, builder, critic, guest) on a local OpenAI-compatible model.

Standard library only. The pane renders like a Claude Code session: one "●" line per step, tool calls
collapsed to one line with the first lines of their result under "⎿", one reasoning line before each
action. Peers wake each other: handoff/report append to the swarm board and type into the peer's pane.

The honesty rules are TOOL CONTRACTS, not prose. A day of transcripts (2026-09-09, audit.py over six
sessions) says why: 47 reports claiming a result with no number, path or output in them; 43 claims
naming a file the session had never opened; 39 second handoffs to a peer that had not answered the
first; 395 reports from one orchestrator against 289 handoffs — a report loop feeding a throttle. A
STYLE paragraph never held any of it. So `report` and `board` refuse a done-claim without evidence,
`handoff` refuses a second handoff to a peer that owes a report, the file tools refuse a path that is
not there and show the directory instead, and every line is mirrored to journald as it happens with a
hash chain, so `audit.py --journal` reads what the harness recorded rather than what the model says.

Env: OPENAI_BASE (http://127.0.0.1:8000/v1), MODEL, ROLE, SWARM_DIR, SESSION_PREFIX (qwen- | qwen-b-),
WORKDIR (repo the builder/critic act in), LEAN (leanVM checkout), MAX_TURNS (default 300),
SKILLS_DIR (a synced copy of ~/.claude/skills; default $SWARM_DIR/skills), SWARM_NAME (journal tag).
"""
import argparse, datetime, hashlib, json, logging, logging.handlers, os, pathlib, queue, re, select, shutil, subprocess, sys, threading, time, urllib.request

BASE = os.environ.get("OPENAI_BASE", "http://127.0.0.1:8000/v1")
MODEL = os.environ.get("MODEL", "Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8")
ROLE = os.environ.get("ROLE", "builder")
SWARM = pathlib.Path(os.environ.get("SWARM_DIR", os.path.expanduser("~/swarm")))
PREFIX = os.environ.get("SESSION_PREFIX", "qwen-")
WORKDIR = os.environ.get("WORKDIR", str(SWARM / "ethplane"))
LEAN = os.environ.get("LEAN", str(SWARM / "leanVM"))
MAX_TURNS = int(os.environ.get("MAX_TURNS", "300"))
EDITABLE = [e.strip() for e in os.environ.get("EDITABLE", "crates/rec_aggregation/guests/").split(",") if e.strip()]
BASELINE = int(os.environ.get("BASELINE", "1542812"))
MEASURE_CMD = os.environ.get("MEASURE_CMD", "cargo run --release -- aggregate --xmss 900 --log-inv-rate 1 --repeat 3")
LAST = {"cycles": None}; TOK = {"n": 0, "task": 0}
VERBS = ["Thinking", "Working", "Measuring", "Reading", "Building", "Checking", "Composing", "Weighing"]
BOARD = SWARM / "board.md"
LOG = SWARM / ROLE / "transcript.jsonl"
SWARM_NAME = os.environ.get("SWARM_NAME", PREFIX.rstrip("-") or "swarm")
SKILLS_DIR = pathlib.Path(os.environ.get("SKILLS_DIR", str(SWARM / "skills")))
JOURNAL_TAG = f"ethplane-{SWARM_NAME}-{ROLE}"

# ── rendering ───────────────────────────────────────────────────────────────────────────────────
D, B, G, R, Y, X = "\033[2m", "\033[1m", "\033[38;5;71m", "\033[38;5;167m", "\033[38;5;179m", "\033[0m"
import signal
def height():
    try: return shutil.get_terminal_size().lines
    except Exception: return 40
def width():
    try: return min(shutil.get_terminal_size().columns, 120)
    except Exception: return 100
def wrap(text, indent=2):
    w = width() - indent; out = []
    for para in text.splitlines() or [""]:
        line = ""
        for word in para.split(" "):
            if len(line) + len(word) + 1 > w and line: out.append(line); line = word
            else: line = (line + " " + word).strip()
        out.append(line)
    return out
def say(text, color=""):
    """Assistant prose: one ● bullet per paragraph, continuation lines indented."""
    text = re.sub(r"</?tool_call>|\*\*|`|^#+ ", "", text.strip(), flags=re.M)
    for para in [p for p in re.split(r"\n\s*\n", text) if p.strip()]:
        lines = wrap(para.strip())
        print(f"{color}●{X} {lines[0]}"); [print("  " + l) for l in lines[1:]]; print()
def user_line(text):
    """The human's (or a peer's) message, highlighted the way Claude Code shows a prompt in the transcript."""
    w = width(); lines = wrap(text.strip(), 2) or [""]
    sys.stdout.write("\r\033[K")
    for i, l in enumerate(lines[:12]):
        pre = "› " if i == 0 else "  "; sys.stdout.write(f"\033[48;5;236m\033[97m{pre}{l}{' ' * max(0, w - len(pre) - len(l))}\033[0m\n")
    if len(lines) > 12: sys.stdout.write(f"\033[48;5;236m\033[97m  … +{len(lines) - 12} lines{' ' * max(0, w - 14)}\033[0m\n")
    sys.stdout.write("\n"); sys.stdout.flush()
def tool_line(label, ok=True):
    print(f"{G if ok else R}●{X} {label[:width() - 2]}")
def result_lines(text, keep=3, first="⎿ "):
    lines = [l for l in text.rstrip().splitlines()] or ["(no output)"]
    for i, l in enumerate(lines[:keep]):
        print(f"  {D}{first if i == 0 else '  '} {l[:width() - 6]}{X}")
    if len(lines) > keep: print(f"  {D}   … +{len(lines) - keep} lines{X}")
    print()
class Spinner:
    def __init__(self): self.stop = threading.Event(); self.t0 = time.time()
    def __enter__(self):
        def run():
            frames = "✻✼✽✾✿❀"; i = 0; verb = VERBS[int(self.t0) % len(VERBS)]
            while not self.stop.is_set():
                sys.stdout.write(f"\r{D}{frames[i % len(frames)]} {verb}… ({int(time.time() - self.t0)}s · ↓ {TOK['task']:,} tokens){X}\033[K"); sys.stdout.flush()
                i += 1; self.stop.wait(0.25)
            sys.stdout.write("\r\033[K"); sys.stdout.flush()
        self.th = threading.Thread(target=run, daemon=True); self.th.start(); return self
    def __exit__(self, *a): self.stop.set(); self.th.join()
SESSION = f"{ROLE}-{os.environ.get('SWARM_NAME', PREFIX.rstrip('-'))}"
ZONE = 4  # rows pinned at the bottom: rule+chip, prompt, blank, footer
class Transcript:
    """stdout wrapper: keeps the transcript text (not spinner or zone writes) so a resize can redraw it."""
    def __init__(self, raw): self.raw = raw; self.buf = ""
    def write(self, t):
        if t and not t.startswith(("\r", "\0337", "\033[?", "\033[1;", "\033[r")): self.buf = (self.buf + t)[-40000:]
        return self.raw.write(t)
    def flush(self): return self.raw.flush()
    def fileno(self): return self.raw.fileno()
    def isatty(self): return self.raw.isatty()
sys.stdout = Transcript(sys.stdout)
def draw_zone(typed=""):
    """Fixed prompting zone at the bottom of the pane; the transcript scrolls in the region above it."""
    w, h = width() - 1, height(); chip = f" {SESSION} "; left = f"  ▸▸ swarm tools on · {ROLE} · {MODEL.split('/')[-1][:24]}"; right = "/rc"
    rule = "─" * max(1, w - len(chip))
    sys.stdout.write("\0337" + f"\033[{h - 3};1H\033[K{D}{rule}{X}\033[48;5;24m\033[38;5;153m{chip}\033[0m"
                     + f"\033[{h - 2};1H\033[K{B}›{X} {typed[-(w - 5):]}\033[7m \033[0m" + f"\033[{h - 1};1H\033[K"
                     + f"\033[{h};1H\033[K{D}{left}{' ' * max(1, w - len(left) - len(right))}{right}{X}" + "\0338"); sys.stdout.flush()
def set_region(redraw=False):
    h = height(); sys.stdout.write(f"\033[?25l\033[r\033[2J\033[1;{h - ZONE}r\033[{h - ZONE};1H")
    if redraw:
        tail = sys.stdout.buf.split("\n")[-(h - ZONE):]; sys.stdout.raw.write("\n".join(tail))
    sys.stdout.flush(); draw_zone(TYPED["s"])
def prompt_line(): draw_zone()
def footer(t0):
    dur = int(time.time() - t0); done = datetime.datetime.now().strftime("%-I:%M %p")
    verb = ["Worked", "Crunched", "Cooked", "Brewed", "Baked"][int(t0) % 5]
    print(f"{D}✻ {verb} for {dur // 60}m {dur % 60:02d}s · ↓ {TOK['task']:,} tokens · done {done}{X}\n"); TOK["task"] = 0; draw_zone()

# ── swarm plumbing ──────────────────────────────────────────────────────────────────────────────
def stamp(): return datetime.datetime.now().strftime("%H:%M")
def board_append(line):
    with BOARD.open("a") as f: f.write(f"{stamp()} {line}\n")
def send_to(role, text):
    subprocess.run(["tmux", "send-keys", "-t", f"{PREFIX}{role}", "-l", text], check=False)
    time.sleep(0.4); subprocess.run(["tmux", "send-keys", "-t", f"{PREFIX}{role}", "Enter"], check=False)
def run_shell(cmd, timeout=900):
    env = dict(os.environ, PATH=f"{os.path.expanduser('~/.cargo/bin')}:/usr/local/bin:{os.environ.get('PATH', '')}")
    try:
        p = subprocess.run(["bash", "-lc", cmd], cwd=WORKDIR, capture_output=True, text=True, timeout=timeout, env=env)
        out = (p.stdout + p.stderr).strip(); return (out[-6000:] if out else f"(exit {p.returncode}, no output)"), p.returncode == 0
    except subprocess.TimeoutExpired: return f"timed out after {timeout}s", False

# ── tools ───────────────────────────────────────────────────────────────────────────────────────
MUTATING = re.compile(r"sed\s+-i|\btee\b|\brm\b|\bmv\b|\bcp\b|git\s+(checkout|reset|apply|stash|commit|clean)|python3?\s+-c|(?<![0-9&])>(?!&)")
def t_bash(command: str, timeout: int = 900):
    if ROLE == "critic" and MUTATING.search(command.replace("2>&1", "")): return "the critic never edits: re-run and measure only (use measure)", False
    if ROLE == "guest" and MUTATING.search(command.replace("2>&1", "")):
        return "the View seat reads; ask the orchestrator to have the work done (ask_orchestrator)", False
    out, ok = run_shell(command, timeout)
    for p in PATH_RE.findall(command): SEEN_PATHS.add(p)
    return out, ok
def _outside():
    st, _ = run_shell(f"git -C {LEAN} status --short")
    return [l for l in st.splitlines() if l.strip() and not any(e in l for e in EDITABLE)]
def t_measure():
    out_ = _outside()
    if out_: return "changes outside the editable surface (" + ", ".join(EDITABLE) + "); revert them first:\n" + "\n".join(out_), False
    diff, _ = run_shell(f"git -C {LEAN} diff --stat -- " + " ".join(EDITABLE) + " | tail -1")
    if ROLE == "builder" and not diff.strip(): return "refused: nothing is changed inside the editable surface since the reference; make one real change with edit_file first (check the exact old text with read_file)", False
    out, ok = run_shell(f"cd {LEAN} && {MEASURE_CMD} 2>&1 | grep -E 'cycles|proving time|error'", 1500)
    m = re.search(r"cycles \(VM steps\)\s*:\s*([\d,]+)", out); cycles = int(m.group(1).replace(",", "")) if m else None
    LAST["cycles"] = cycles
    if cycles is None: board_append(f"{ROLE} {'MEASURED' if ROLE == 'builder' else 'REVIEW'}: build or run failed"); return "no cycles number; build or run failed:\n" + out[-1500:], False
    verdict = "BELOW baseline" if cycles < BASELINE else "not below baseline"
    board_append(f"{ROLE} {'MEASURED' if ROLE == 'builder' else 'REVIEW'}: cycles={cycles} baseline={BASELINE} {verdict} · {diff.strip() or 'no diff'}")
    return f"cycles={cycles} baseline={BASELINE} {verdict}\nchanged: {diff.strip() or 'nothing'}\n{out}", True
def t_submit():
    if LAST["cycles"] is None or LAST["cycles"] >= BASELINE: return f"refused: last measured cycles {LAST['cycles']} is not strictly below {BASELINE}", False
    if _outside(): return "refused: changes outside the editable surface", False
    (SWARM / "outbox").mkdir(exist_ok=True); (SWARM / "outbox" / "SUBMIT").touch()
    board_append(f"builder SUBMIT: cycles={LAST['cycles']} < {BASELINE}"); return "submission flagged; the submitter loop sends it within a minute", True
def t_revert():
    out, ok = run_shell(f"git -C {LEAN} checkout -- . && git -C {LEAN} status --short | wc -l"); LAST["cycles"] = None
    return f"reverted to the reference; {out.strip()} files still modified", ok
def t_read(path: str, offset: int = 1, limit: int = 200):
    p = pathlib.Path(path if path.startswith("/") else os.path.join(WORKDIR, path))
    if not p.exists():
        # The invented-filename signature: 30 reads of paths that were never there on 2026-09-09,
        # and the model kept going from memory. Show it what IS there instead of only refusing.
        d = p.parent
        near = sorted(x.name for x in d.iterdir())[:40] if d.is_dir() else []
        return (f"{p} does not exist." + (f" {d} holds: " + ", ".join(near) if near else f" {d} is not a directory either.")), False
    try: lines = p.read_text().splitlines()
    except Exception as e: return f"cannot read {p}: {e}", False
    SEEN_PATHS.add(str(p))
    sel = lines[offset - 1: offset - 1 + limit]
    return "\n".join(f"{offset + i:5d}  {l}" for i, l in enumerate(sel)) + f"\n({len(lines)} lines total)", True
def t_write(path: str, content: str = None, **alias):
    content = content if content is not None else alias.get("text", alias.get("file_text", ""))
    p = pathlib.Path(path if path.startswith("/") else os.path.join(WORKDIR, path)); p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content); SEEN_PATHS.add(str(p)); return f"wrote {len(content.splitlines())} lines", True
def t_edit(path: str, old: str = None, new: str = None, **alias):
    old = old if old is not None else alias.get("old_string", alias.get("old_str", alias.get("old_text")))
    new = new if new is not None else alias.get("new_string", alias.get("new_str", alias.get("new_text")))
    if old is None or new is None: return "edit_file needs old and new", False
    p = pathlib.Path(path if path.startswith("/") else os.path.join(WORKDIR, path))
    try: s = p.read_text()
    except Exception as e: return f"cannot read {p}: {e}", False
    n = s.count(old)
    if n != 1: return f"old text found {n} times; it must match exactly once", False
    p.write_text(s.replace(old, new, 1)); SEEN_PATHS.add(str(p)); return f"replaced 1 occurrence (+{len(new.splitlines())} -{len(old.splitlines())} lines)", True
WORK = {"n": 0}
# Evidence is a measured number, a command's own output, or a path with a line — the three things a
# reader can check. "the build passes" is not one of them, and 47 reports on 2026-09-09 said exactly
# that sort of thing (audit.py: unevidenced-report).
EVIDENCE_RE = re.compile(r"\d{3,}|[\w./-]+\.[A-Za-z]{1,5}\b|\b\w+:\d+\b|exit\s+\d+|cycles\s*=")
CLAIM_RE = re.compile(r"\b(done|complete|completed|implemented|finished|works|working|fixed|ready|pass(ed)?)\b", re.I)
PATH_RE = re.compile(r"(?:/[\w.-]+)+/?[\w.-]*\.[A-Za-z]{1,5}|[\w-]+/[\w./-]+\.[A-Za-z]{1,5}")
SEEN_PATHS = set()          # every path this session has actually read, written or listed
TASK = {"reports": 0}       # reports since the last incoming message

def _evidence_missing(text, evidence):
    """The refusal text when a claim arrives without something to check it against."""
    joined = f"{text}\n{evidence or ''}"
    if evidence and EVIDENCE_RE.search(evidence): return ""
    if not CLAIM_RE.search(text): return "" if evidence or not text else ""
    if EVIDENCE_RE.search(joined): return ""
    return ("refused: a claim needs evidence. Put in `evidence` one of: the measured number, the last "
            "lines the command printed, or a path:line. Run the thing and quote it — do not describe it.")

def _unseen_path(text):
    for p in PATH_RE.findall(text or ""):
        if not any(p in seen or seen.endswith(p) for seen in SEEN_PATHS):
            return p
    return None

def t_board(kind: str, text: str, evidence: str = ""):
    if kind.upper() in ("REVIEW", "BUILT", "MEASURED"):
        why = _evidence_missing(text, evidence)
        if why: return why, False
        p = _unseen_path(text + " " + (evidence or ""))
        if p: return f"refused: this session has never read or written {p}; read it first, then say what it holds", False
    line = f"{ROLE} {kind}: {text}" + (f" · {evidence}" if evidence else "")
    board_append(line); return "written to the board", True

def t_report(text: str, evidence: str = ""):
    """One report per incoming task: a report ends the turn, and a second one before the next message
    is the loop that produced 395 reports against 289 handoffs on 2026-09-09."""
    if TASK["reports"] >= 1:
        return ("refused: you have already reported on this task. Wait for the next message (call wait) "
                "instead of reporting again."), False
    why = _evidence_missing(text, evidence)
    if why: return why, False
    p = _unseen_path(text + " " + (evidence or ""))
    if p: return f"refused: this session has never read or written {p}; open it first or name the file you did change", False
    TASK["reports"] += 1
    full = text + (f" · {evidence}" if evidence else "")
    board_append(f"REPORT {ROLE}: {full}")
    if ROLE != "orchestrator": send_to("orchestrator", f"REPORT {ROLE}: {full}")
    return "reported", True
def t_read_board(lines: int = 20): return "\n".join(BOARD.read_text().splitlines()[-lines:]) if BOARD.exists() else "(empty board)", True
def t_plan(builder: str, critic: str, done_when: str):
    board_append(f"orchestrator PLAN: builder: {builder} | critic: {critic} | done when: {done_when}"); return "PLAN written", True
OWED = set()            # peers that have a handoff and have not reported back
def t_handoff(role: str, task: str, files: str, done_when: str):
    if role not in ("builder", "critic"): return "role must be builder or critic", False
    if role in OWED:
        return (f"refused: {role} already has a handoff and has not reported. Call wait until its REPORT "
                f"arrives; one handoff per peer at a time."), False
    if not EVIDENCE_RE.search(done_when):
        return ("refused: done_when has to be checkable — a number, a path, or a command and what it must "
                "print. 'implemented' is not a criterion."), False
    msg = f"HANDOFF orchestrator -> {role}: {task} | files: {files} | done when: {done_when}"
    OWED.add(role); board_append(msg); send_to(role, msg); return f"sent to {role}", True
# The same skills this project's Claude sessions use, synced to the host by deploy.sh and allowed
# per role from dogfood/roles/toolkits — the model can ask what applies and then follow one.
SKILL_ALLOW = {
    "builder": ["debug-protocol", "test", "zero-tech-debt", "refactor-verify", "handoff", "pre-mortem",
                "write-for-ai", "perf-profile", "whatnow"],
    "critic": ["adversarial-review", "attack", "audit", "quick-audit", "factcheck", "sanitycheck",
               "semantic-review", "visual-qa", "debug-protocol", "zero-tech-debt", "handoff"],
    "orchestrator": ["handoff", "diverge", "pre-mortem", "checkpoint", "savecommitpush", "whatnow",
                     "self-harness", "skill-finder", "write-for-ai"],
    "guest": ["whatnow", "handoff"],
}
def _skill_index():
    """name → (trigger line, path). The trigger line is the SKILL.md description, which is what the
    index /skillsearch reads; a skill with no description is listed by name alone."""
    out = {}
    if not SKILLS_DIR.is_dir(): return out
    for d in sorted(SKILLS_DIR.iterdir()):
        f = d / "SKILL.md"
        if not f.is_file(): continue
        desc = ""
        try:
            head = f.read_text(errors="replace")[:1200]
            m = re.search(r"^description:\s*(.+)$", head, re.M) or re.search(r"^#\s+(.+)$", head, re.M)
            desc = (m.group(1).strip() if m else "")[:200]
        except Exception: pass
        out[d.name] = (desc, f)
    return out
def t_skill(name: str = ""):
    allowed = SKILL_ALLOW.get(ROLE, [])
    index = _skill_index()
    if not index:
        return f"no skills on this host ({SKILLS_DIR}); deploy.sh syncs them", False
    if not name:
        rows = [f"{n}: {index[n][0]}" for n in allowed if n in index]
        missing = [n for n in allowed if n not in index]
        return ("\n".join(rows) or "(none of this role's skills are on the host)") + (f"\nnot synced: {', '.join(missing)}" if missing else ""), True
    name = name.strip().lstrip("/")
    if name not in allowed:
        return f"{name} is not one of this role's skills. Yours: {', '.join(allowed)}", False
    if name not in index:
        return f"{name} is allowed but not synced to {SKILLS_DIR}", False
    text = index[name][1].read_text(errors="replace")
    SEEN_PATHS.add(str(index[name][1]))
    return text[:12000] + ("\n…(truncated)" if len(text) > 12000 else ""), True

# ── the View seat (a guest, not a menu) ──────────────────────────────────────────────────────
def t_ask_orchestrator(text: str):
    """Carry the human's words to the orchestrator pane, marked as coming from the seat.

    Verbatim on purpose: a paraphrase from this seat would be the model speaking for the person, and
    the orchestrator answers people, not summaries."""
    msg = f"from the View seat: {text}"
    board_append(f"VIEW asks orchestrator: {text}")
    send_to("orchestrator", msg)
    return "asked the orchestrator; its answer arrives on the board and in its pane", True
def t_status():
    out, ok = run_shell(f"python3 {SWARM}/view.py --once --rows 12 2>/dev/null || true", 60)
    return out or "(no scoreboard yet)", True
def t_watch(what: str = "board", seconds: int = 30):
    cmds = {"board": f"tail -n 40 -f {BOARD}",
            "verifier": "journalctl -t ethplane-verifier -n 40 -f 2>/dev/null || tail -n 40 -f ~/logs/verifier.log",
            "session": f"tail -n 40 -f {SWARM}/{{orchestrator,builder,critic}}/transcript.jsonl",
            "gpu": "nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total --format=csv -l 2"}
    if what not in cmds: return f"watch takes one of: {', '.join(cmds)}", False
    out, _ = run_shell(f"timeout {min(int(seconds), 120)} bash -lc {json.dumps(cmds[what])} 2>&1 | tail -40", min(int(seconds), 120) + 20)
    return out or "(nothing yet)", True
def t_brief():
    f = SWARM / "node.md"
    return (f.read_text()[:6000] if f.exists() else "(no node brief on this host)"), True
def t_page():
    out, _ = run_shell("curl -sS -o /dev/null -w 'ethplane.ecofrontiers.xyz %{http_code} in %{time_total}s' https://ethplane.ecofrontiers.xyz/ || true", 30)
    return out, True
def t_join():
    """Upgrade this seat to builder tools for this pane only."""
    STATE["guest_joined"] = True
    return ("this seat now has the builder's tools (read, edit, measure, submit, revert) for this pane. "
            "Everything you do lands on the board under the guest name."), True
STATE = {"guest_joined": False}


RESOURCES = SWARM / "resources"
def t_resources(query: str = ""):
    """Search the estate's design and writing references synced to this swarm (2_resources); returns matching file paths and a first line."""
    if not RESOURCES.exists(): return "no resources synced", False
    hits = []
    for f in RESOURCES.rglob("*"):
        if f.is_file() and (not query or query.lower() in f.name.lower() or query.lower() in str(f.relative_to(RESOURCES)).lower()):
            hits.append(str(f))
    return "\n".join(hits[:60]) or "no match; try a shorter word", True
def t_wait(seconds: int = 300):
    """Wait for peers; returns early when a message arrives in this pane."""
    for _ in range(min(int(seconds), 900)):
        if not INBOX.empty(): return "a message arrived", True
        time.sleep(1)
    return f"waited {min(int(seconds), 900)}s, nothing arrived; call wait again", True

def spec(name, desc, props, req):
    props = {"why": {"type": "string", "description": "one short line, present tense, under 100 characters: what this step does and why"}, **props}
    return {"type": "function", "function": {"name": name, "description": desc, "parameters": {"type": "object", "properties": props, "required": ["why"] + req}}}
S = lambda d: {"type": "string", "description": d}; I = lambda d: {"type": "integer", "description": d}
TOOLS = {
    "bash": (t_bash, spec("bash", "Run a shell command in the repo (cwd WORKDIR). Long builds allowed.", {"command": S("the command"), "timeout": I("seconds, default 900")}, ["command"])),
    "read_file": (t_read, spec("read_file", "Read a file with line numbers.", {"path": S("path"), "offset": I("first line, 1-based"), "limit": I("lines, default 200")}, ["path"])),
    "write_file": (t_write, spec("write_file", "Write a whole file.", {"path": S("path"), "content": S("full content")}, ["path", "content"])),
    "edit_file": (t_edit, spec("edit_file", "Replace one exact occurrence of old with new in a file.", {"path": S("path"), "old": S("exact text to replace, must occur once"), "new": S("replacement")}, ["path", "old", "new"])),
    "board": (t_board, spec("board", "Append one stamped line to the shared swarm board. MEASURED, REVIEW and BUILT lines need evidence.", {"kind": S("MEASURED | REVIEW | NOTE | CLAIM | BUILT"), "text": S("the line"), "evidence": S("the number, the command's last lines, or path:line — required for MEASURED/REVIEW/BUILT")}, ["kind", "text"])),
    "report": (t_report, spec("report", "Report a result to the orchestrator. One report per task, and a claim without evidence is refused.", {"text": S("one to three lines"), "evidence": S("the measured number, the last lines the command printed, or path:line")}, ["text", "evidence"])),
    "skill": (t_skill, spec("skill", "List the skills this role may use, or load one by name and follow it. Call with no name to see what applies.", {"name": S("skill name, or empty to list")}, [])),
    "read_board": (t_read_board, spec("read_board", "Read the last N lines of the shared board.", {"lines": I("default 20")}, [])),
    "board_plan": (t_plan, spec("board_plan", "Write the PLAN: what the builder makes, what the critic checks, done-when.", {"builder": S("builder's job"), "critic": S("critic's check"), "done_when": S("completion criterion with a number or a path")}, ["builder", "critic", "done_when"])),
    "handoff": (t_handoff, spec("handoff", "Hand work to builder or critic: lands on the board and in that pane.", {"role": S("builder | critic"), "task": S("one sentence"), "files": S("paths"), "done_when": S("verifiable criterion")}, ["role", "task", "files", "done_when"])),
    "skill": (t_skill, spec("skill", "List the skills available to this role (no name) or load one by name: design, design-research, design-tokens, frontend-design, interface-design, visual-qa, baseline-ui, write, humanizer, pptx and more. Load the relevant skill before starting a page or a document and follow it.", {"name": S("skill name, or empty to list")}, [])),
    "resources": (t_resources, spec("resources", "Search the estate's synced design and writing references (component kits, briefs, style guides) by a word in the path; then read_file the hit.", {"query": S("a word from the file or folder name")}, [])),
    "wait": (t_wait, spec("wait", "Wait up to N seconds for a peer's report to arrive in this pane.", {"seconds": I("default 300, max 900")}, [])),
    "measure": (t_measure, spec("measure", "Build and run the node's benchmark in the leanVM checkout; posts MEASURED/REVIEW cycles=<n> to the board and says whether it is strictly below the baseline. Refuses while files outside the editable surface are modified.", {}, [])),
    "submit": (t_submit, spec("submit", "Flag the current tree for submission. Only works when the last measure was strictly below the baseline.", {}, [])),
    "revert": (t_revert, spec("revert", "Restore the leanVM checkout to the reference commit before the next hypothesis.", {}, [])),
    "ask_orchestrator": (t_ask_orchestrator, spec("ask_orchestrator", "Carry the person's words to the orchestrator pane, verbatim, from the View seat.", {"text": S("what to ask, in the person's own words")}, ["text"])),
    "status": (t_status, spec("status", "The scoreboard: what each session is doing, the node, the last measurements.", {}, [])),
    "watch": (t_watch, spec("watch", "Tail one live thing for a few seconds: board | verifier | session | gpu.", {"what": S("board | verifier | session | gpu"), "seconds": I("default 30, max 120")}, ["what"])),
    "brief": (t_brief, spec("brief", "The node brief this swarm is working from.", {}, [])),
    "page": (t_page, spec("page", "Check the public page answers, with its status and timing.", {}, [])),
    "join": (t_join, spec("join", "Take a builder's tools in this pane, to work alongside the swarm.", {}, [])),
}
ROLE_TOOLS = {"orchestrator": ["board_plan", "handoff", "report", "read_board", "wait", "skill"],
              "builder": ["bash", "read_file", "write_file", "edit_file", "measure", "submit", "revert", "report", "read_board", "skill", "resources"],
              "critic": ["bash", "read_file", "measure", "board", "report", "read_board", "skill", "resources"],
              # The View seat: read the tree, see the swarm, ask the orchestrator, and join if you
              # want to work. It never has measure or submit until join() hands them over.
              "guest": ["status", "watch", "brief", "page", "read_file", "read_board", "bash", "ask_orchestrator", "join", "skill"]}
GUEST_AFTER_JOIN = ["write_file", "edit_file", "measure", "submit", "revert"]
LABELS = {"bash": lambda a: f"Bash({a.get('command', '')[:90]})", "read_file": lambda a: f"Read({a.get('path')})",
          "write_file": lambda a: f"Write({a.get('path')})", "edit_file": lambda a: f"Update({a.get('path')})",
          "board": lambda a: f"Board({a.get('kind')} {a.get('text', '')[:70]})", "report": lambda a: f"Report({a.get('text', '')[:80]})",
          "read_board": lambda a: "ReadBoard()", "measure": lambda a: "Measure(cargo run --release -- aggregate)", "submit": lambda a: "Submit()", "revert": lambda a: "Revert(leanVM)", "board_plan": lambda a: f"Plan({a.get('builder', '')[:70]})",
          "handoff": lambda a: f"Handoff({a.get('role')}: {a.get('task', '')[:70]})", "wait": lambda a: f"Wait({a.get('seconds', 60)}s)",
          "skill": lambda a: f"Skill({a.get('name') or 'list'})", "resources": lambda a: f"Resources({a.get('query', '')})", "status": lambda a: "Status(scoreboard)",
          "watch": lambda a: f"Watch({a.get('what')})", "brief": lambda a: "Brief(node)", "page": lambda a: "Page(ethplane.ecofrontiers.xyz)",
          "join": lambda a: "Join(builder tools)", "ask_orchestrator": lambda a: f"Ask(orchestrator: {a.get('text', '')[:70]})"}

# ── prompts ─────────────────────────────────────────────────────────────────────────────────────
COMMON = ("You are the {role} of a swarm working an Ethplane node. Peers: orchestrator, builder, critic, and a person at the View seat; the shared board is {board}. "
          "Every tool call carries a why: one short line, present tense, under 100 characters, what the step does and why. Write no other prose between tool calls. "
          "Never claim a result without the measured number or the command output that shows it — report and board refuse a claim with no evidence, so run the thing and quote it. "
          "If a command fails, say what failed and try a different way; never say you lack access: you have the tools listed. "
          "Before starting an unfamiliar kind of task, call skill with no name to see what applies, and load the one that does; skills are how this project works, not decoration. "
          "The board is append-only: add a line, never rewrite one, and supersede an earlier line by name when it turns out wrong. Say IDLE on the board when your lane is empty rather than inventing work. "
          "No markdown headers, no bold, no summaries of accomplishments. When your piece is finished, call report once with the number or the output; report ends your turn, so do the whole piece before it.")
ROLE_PROMPT = {
    "guest": ("You hold the View seat: a person sits here and types in plain language. Answer them, and use the swarm on their behalf. "
              "What is going on -> status, then ONE short paragraph in your own words. A question about the judge or the board or the GPU -> watch. "
              "A request for work -> ask_orchestrator, carrying their words as they wrote them; never do swarm work from this seat and never say you did. "
              "You may read anything and run read-only commands; join() gives this pane the builder's tools if the person wants to work themselves. "
              "Slash shortcuts mean the same tools: /status /verifier /board /session /brief /page /join, and /help lists them. "
              "You never speak for the orchestrator or the builder: when they answer, their words arrive on the board and you quote them."),
    "orchestrator": "You never do the work yourself. For each task from the human: board_plan, then ONE handoff to the builder (task, files, done_when with a number), then one handoff to the critic (what to re-measure or re-run, done_when), then wait. Never queue several handoffs to one peer: the next handoff goes out only after that peer's report. While no REPORT has arrived, call wait again; never report that you are waiting and never re-send a handoff. When a REPORT arrives: if the critic's REVIEW is PASS with a number, report the result to the human in three lines; if FAIL, one corrected handoff naming what was missing. Read the board only when a report says to.",
    "builder": f"You edit code in the leanVM checkout {LEAN}; the editable surface is {', '.join(EDITABLE)} and nothing else. The loop for every hypothesis: read the file, make ONE real change with edit_file, call measure, then submit if measure says BELOW, otherwise revert and start the next hypothesis. measure is the only way to measure; never run cargo yourself. The baseline is {BASELINE} cycles; only strictly below counts. Comments and renames are not changes. Never conclude that nothing can be improved: the compiler surface (when editable) changed cycles in past runs.",
    "critic": f"You verify, you never edit anything (your shell refuses edits). For each MEASURED line the builder posts, call measure yourself on the same tree and compare: REVIEW PASS when both numbers match, REVIEW FAIL with both numbers when they differ or when files outside {', '.join(EDITABLE)} are modified. A PASS quotes your own re-run — the number you measured, not the number you were told. Then report. Never form or test hypotheses yourself.",
}
INBOX: "queue.Queue[str]" = queue.Queue()

def call_model(messages, tools):
    body = json.dumps({"model": MODEL, "messages": messages, "tools": tools, "tool_choice": "auto", "temperature": 0.2, "max_tokens": 4000}).encode()
    for attempt in range(4):
        try:
            req = urllib.request.Request(f"{BASE}/chat/completions", body, {"Content-Type": "application/json", "Authorization": "Bearer local"})
            with urllib.request.urlopen(req, timeout=600) as r:
                d = json.load(r); u = d.get("usage", {}) or {}; TOK["n"] += int(u.get("total_tokens", 0) or 0); TOK["task"] += int(u.get("completion_tokens", 0) or 0); return d["choices"][0]["message"]
        except Exception as e:
            err = e; time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"model unreachable: {err}")

def trim(messages):
    """Keep the context bounded: elide old tool results once the transcript passes ~240k characters."""
    total = sum(len(json.dumps(m)) for m in messages)
    for m in messages[1:]:
        if total < 240_000: break
        if m.get("role") == "tool" and len(m.get("content", "")) > 200:
            total -= len(m["content"]) - 60; m["content"] = m["content"][:60] + " …[elided]"

CHAIN = {"prev": None}
def _syslog():
    """journald, tagged ethplane-<swarm>-<role>. The agent user can rewrite its own transcript file;
    it cannot rewrite the journal, and journald stamps each entry with the _PID and _COMM that wrote
    it — so audit.py can tell the harness's lines from a `logger -t <tag>` out of the model's shell."""
    try:
        h = logging.handlers.SysLogHandler(address="/dev/log")
    except Exception:
        return None
    h.ident = JOURNAL_TAG + ": "
    lg = logging.getLogger(JOURNAL_TAG); lg.setLevel(logging.INFO); lg.addHandler(h); lg.propagate = False
    return lg
MIRROR = _syslog()

def log(entry):
    """One line to the transcript and the same line to the journal, chained.

    `prev` is the sha256 of the previous entry, so a line cannot be taken out of the middle of either
    copy without breaking the join — and the two copies can be checked against each other."""
    LOG.parent.mkdir(parents=True, exist_ok=True)
    body = {"ts": datetime.datetime.now().isoformat(timespec="seconds"), **entry}
    line = {**body, "prev": CHAIN["prev"]}
    CHAIN["prev"] = hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest()
    text = json.dumps(line)
    with LOG.open("a") as f: f.write(text + "\n")
    if MIRROR:
        try: MIRROR.info(text[:60000])
        except Exception: pass

SLASH = {"/status": ("status", {}), "/verifier": ("watch", {"what": "verifier"}), "/board": ("watch", {"what": "board"}),
         "/session": ("watch", {"what": "session"}), "/brief": ("brief", {}), "/page": ("page", {}), "/join": ("join", {})}
def slash(text):
    """A shortcut runs the same tool the words would have reached, and prints it the same way."""
    word = text.strip().split()[0].lower()
    if word == "/help":
        say("/status the scoreboard · /verifier the judge, live · /board the swarm board · /session what the roles are doing · "
            "/brief this node · /page the public site · /join take builder tools in this pane. Or just say what you want.")
        return True
    if word not in SLASH: return False
    name, args = SLASH[word]
    out, ok = TOOLS[name][0](**args)
    tool_line(LABELS.get(name, lambda a: name)(args), ok); result_lines(out, keep=14)
    log({"role": "tool", "name": name, "ok": ok, "content": out[:2000]})
    return True

def run_task(messages, text, tools):
    t0 = time.time(); TASK["reports"] = 0
    if str(text).startswith("REPORT ") or " REPORT " in str(text)[:40]:
        for r in list(OWED):                       # the peer answered: it may be handed work again
            if r in text: OWED.discard(r)
    messages.append({"role": "user", "content": text}); log({"role": "user", "content": text})
    try: _run(messages, tools)
    finally: footer(t0)
def _run(messages, tools):
    for turn in range(MAX_TURNS):
        trim(messages)
        try:
            with Spinner(): msg = call_model(messages, tools)
        except RuntimeError as e:
            say(str(e), R); return
        content = (msg.get("content") or "").strip(); calls = msg.get("tool_calls") or []
        messages.append({"role": "assistant", "content": content or None, **({"tool_calls": calls} if calls else {})})
        log({"role": "assistant", "content": content, "tool_calls": [c["function"] for c in calls]})
        if content: say(content)
        if not calls: return
        for c in calls:
            name = c["function"]["name"]
            try: args = json.loads(c["function"].get("arguments") or "{}")
            except json.JSONDecodeError: args = {}
            why = str(args.pop("why", "")).strip()
            if why: say(why)
            if name not in tools_names(tools): out, ok = f"unknown tool {name}; you have {', '.join(tools_names(tools))}", False
            else:
                try: out, ok = TOOLS[name][0](**args)
                except TypeError as e: out, ok = f"bad arguments for {name}: {e}", False
                except Exception as e: out, ok = f"{name} failed: {e}", False
            if name == "bash": print(f"  {D}⎿  $ {args.get('command', '')[:width() - 8]}{X}"); result_lines(out, keep=3, first="  ")
            else: tool_line(LABELS.get(name, lambda a: name)(args), ok); result_lines(out)
            messages.append({"role": "tool", "tool_call_id": c.get("id", name), "content": out}); log({"role": "tool", "name": name, "ok": ok, "content": out[:2000]})
            if name == "report" and ok and ROLE != "orchestrator": return
    say(f"stopped after {MAX_TURNS} turns; send a message to continue", Y)
def tools_names(tools): return [t["function"]["name"] for t in tools]

TYPED = {"s": ""}
def stdin_reader():
    """Own the keyboard: no echo, keys drawn in the prompting zone, Enter sends, Backspace edits, escape sequences dropped."""
    fd = sys.stdin.fileno()
    try:
        import termios, tty; tty.setcbreak(fd)
    except Exception:
        for line in sys.stdin:
            if line.strip(): INBOX.put(line.rstrip("\n"))
        return
    buf = b""
    while True:
        ch = os.read(fd, 1)
        if not ch: return
        if ch == b"\x1b":
            while select.select([fd], [], [], 0.02)[0]: os.read(fd, 1)
            continue
        if ch in (b"\r", b"\n"):
            text = TYPED["s"]; TYPED["s"] = ""; draw_zone("")
            if text.strip(): user_line(text); INBOX.put(text)
            continue
        if ch in (b"\x7f", b"\x08"): TYPED["s"] = TYPED["s"][:-1]; draw_zone(TYPED["s"]); continue
        if ch == b"\x15": TYPED["s"] = ""; draw_zone(""); continue
        buf += ch
        try: TYPED["s"] += buf.decode(); buf = b""
        except UnicodeDecodeError: continue
        draw_zone(TYPED["s"])

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--init", help="first message"); ap.add_argument("--init-file"); ap.add_argument("--once", action="store_true", help="run the init message then exit")
    a = ap.parse_args()
    names = ROLE_TOOLS[ROLE]
    if os.environ.get("DESIGN"): names = [n for n in names if n not in ("measure", "submit", "revert")]
    tools = [TOOLS[n][1] for n in names]
    system = COMMON.format(role=ROLE, board=BOARD) + " " + ROLE_PROMPT[ROLE]
    brief = SWARM / "node.md"
    if os.environ.get("DESIGN"):
        system += (f"\n\nTHIS SWARM WORKS ON THE ETHPLANE WEBSITE AND DOCS in {WORKDIR}/web (Next.js static export, shadcn, Tailwind), never on leanVM or the node benchmark. "
                   "The builder edits pages and runs cd web && pnpm build; the critic re-runs the build and reads web/out. Direction and page order come from the human's task. "
                   "Before the first page call skill('design-research') and skill('frontend-design') and follow them; before a document call skill('write'); resources('component') finds the estate's component kits; skill('visual-qa') for the critic's review of a built page.")
    elif brief.exists(): system += "\n\nNODE BRIEF:\n" + brief.read_text()[:6000]
    if ROLE == "guest":
        system += (f"\n\nThe swarm's sessions are {PREFIX}orchestrator, {PREFIX}builder, {PREFIX}critic in tmux on this host; "
                   f"the board is {BOARD}. You are in the pane a person is sitting at.")
    if ROLE == "guest":
        # The seat opens on the same landing masthead the console used, then the scoreboard, and then
        # it is a session like the other three: the person types, the model answers.
        out, _ = run_shell(f"bash {SWARM}/landing.sh masthead VIEW 2>/dev/null || true", 30)
        if out.strip(): print(out)
        board_out, _ = t_status()
        print(board_out)
        say("Ask me anything about this swarm in plain words, or use /help for the shortcuts. "
            "I can show you the board and the judge live, and I can ask the orchestrator for work "
            "on your behalf — I never do the swarm's work from this seat.")
    messages = [{"role": "system", "content": system}]
    log({"role": "session", "pid": os.getpid(), "swarm": SWARM_NAME, "model": MODEL, "tag": JOURNAL_TAG,
         "started": datetime.datetime.now().isoformat(timespec="seconds")})
    board_append(f"{ROLE} READY (agent.py, {MODEL.split('/')[-1]}, pid {os.getpid()}, journal {JOURNAL_TAG})")
    set_region(); signal.signal(signal.SIGWINCH, lambda *_: set_region(redraw=True))
    threading.Thread(target=stdin_reader, daemon=True).start()
    first = a.init or (pathlib.Path(a.init_file).read_text().strip() if a.init_file else None)
    if first:
        user_line(first); run_task(messages, first, tools)
        if a.once: return
    nudge = os.environ.get("IDLE_NUDGE"); idle = int(os.environ.get("IDLE_SECONDS", "240"))
    while True:
        prompt_line()
        try: text = INBOX.get(timeout=idle if nudge else None)
        except queue.Empty: text = nudge
        pass
        if text.strip() in ("/quit", "exit"): return
        if ROLE == "guest" and text.strip().startswith("/") and slash(text): continue
        if ROLE == "guest" and STATE["guest_joined"]:
            tools = [TOOLS[n][1] for n in ROLE_TOOLS["guest"] + GUEST_AFTER_JOIN if n in TOOLS]
        run_task(messages, text, tools)

if __name__ == "__main__":
    try: main()
    except KeyboardInterrupt: print()
    finally: sys.stdout.write("\033[r\033[?25h\033[999;1H\n"); sys.stdout.flush()
