#!/usr/bin/env python3
"""Ethplane swarm agent: one role (orchestrator, builder, critic) on a local OpenAI-compatible model.

Standard library only. The pane renders like a Claude Code session: one "●" line per step, tool calls
collapsed to one line with the first lines of their result under "⎿", one reasoning line before each
action. Peers wake each other: handoff/report append to the swarm board and type into the peer's pane.

Env: OPENAI_BASE (http://127.0.0.1:8000/v1), MODEL, ROLE, SWARM_DIR, SESSION_PREFIX (qwen- | qwen-b-),
WORKDIR (repo the builder/critic act in), LEAN (leanVM checkout), MAX_TURNS (default 300).
"""
import argparse, datetime, json, os, pathlib, queue, re, select, shutil, subprocess, sys, threading, time, urllib.request

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
    return run_shell(command, timeout)
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
    try: lines = p.read_text().splitlines()
    except Exception as e: return f"cannot read {p}: {e}", False
    sel = lines[offset - 1: offset - 1 + limit]
    return "\n".join(f"{offset + i:5d}  {l}" for i, l in enumerate(sel)) + f"\n({len(lines)} lines total)", True
def t_write(path: str, content: str = None, **alias):
    content = content if content is not None else alias.get("text", alias.get("file_text", ""))
    p = pathlib.Path(path if path.startswith("/") else os.path.join(WORKDIR, path)); p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content); return f"wrote {len(content.splitlines())} lines", True
def t_edit(path: str, old: str = None, new: str = None, **alias):
    old = old if old is not None else alias.get("old_string", alias.get("old_str", alias.get("old_text")))
    new = new if new is not None else alias.get("new_string", alias.get("new_str", alias.get("new_text")))
    if old is None or new is None: return "edit_file needs old and new", False
    p = pathlib.Path(path if path.startswith("/") else os.path.join(WORKDIR, path))
    try: s = p.read_text()
    except Exception as e: return f"cannot read {p}: {e}", False
    n = s.count(old)
    if n != 1: return f"old text found {n} times; it must match exactly once", False
    p.write_text(s.replace(old, new, 1)); return f"replaced 1 occurrence (+{len(new.splitlines())} -{len(old.splitlines())} lines)", True
WORK = {"n": 0}
def t_board(kind: str, text: str):
    board_append(f"{ROLE} {kind}: {text}"); return "written to the board", True
def t_report(text: str):
    board_append(f"REPORT {ROLE}: {text}")
    if ROLE != "orchestrator": send_to("orchestrator", f"REPORT {ROLE}: {text}")
    return "reported", True
def t_read_board(lines: int = 20): return "\n".join(BOARD.read_text().splitlines()[-lines:]) if BOARD.exists() else "(empty board)", True
def t_plan(builder: str, critic: str, done_when: str):
    board_append(f"orchestrator PLAN: builder: {builder} | critic: {critic} | done when: {done_when}"); return "PLAN written", True
def t_handoff(role: str, task: str, files: str, done_when: str):
    if role not in ("builder", "critic"): return "role must be builder or critic", False
    msg = f"HANDOFF orchestrator -> {role}: {task} | files: {files} | done when: {done_when}"
    board_append(msg); send_to(role, msg); return f"sent to {role}", True
SKILLS = SWARM / "skills"; RESOURCES = SWARM / "resources"
def _skill_index():
    rows = []
    for d in sorted(SKILLS.glob("*/SKILL.md")):
        desc = ""
        for line in d.read_text(errors="ignore").splitlines()[:12]:
            if line.startswith("description:"): desc = line.split(":", 1)[1].strip()[:110]; break
        rows.append(f"{d.parent.name}: {desc}")
    return rows
def t_skill(name: str = ""):
    """Same skills the human's Claude sessions use, synced to this swarm. skill() lists them; skill(name) loads one."""
    if not SKILLS.exists(): return "no skills synced to this swarm", False
    if not name: return "\n".join(_skill_index()) or "(none)", True
    f = SKILLS / name / "SKILL.md"
    if not f.exists(): return f"no skill {name}; skill() lists them", False
    return f.read_text(errors="ignore")[:12000], True
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
    "board": (t_board, spec("board", "Append one stamped line to the shared swarm board (MEASURED cycles=…, REVIEW PASS/FAIL …, NOTE …).", {"kind": S("MEASURED | REVIEW | NOTE | CLAIM | BUILT"), "text": S("the line")}, ["kind", "text"])),
    "report": (t_report, spec("report", "Report a result to the orchestrator (one to three lines, with the measured number or command output).", {"text": S("the report")}, ["text"])),
    "read_board": (t_read_board, spec("read_board", "Read the last N lines of the shared board.", {"lines": I("default 20")}, [])),
    "board_plan": (t_plan, spec("board_plan", "Write the PLAN: what the builder makes, what the critic checks, done-when.", {"builder": S("builder's job"), "critic": S("critic's check"), "done_when": S("completion criterion with a number or a path")}, ["builder", "critic", "done_when"])),
    "handoff": (t_handoff, spec("handoff", "Hand work to builder or critic: lands on the board and in that pane.", {"role": S("builder | critic"), "task": S("one sentence"), "files": S("paths"), "done_when": S("verifiable criterion")}, ["role", "task", "files", "done_when"])),
    "skill": (t_skill, spec("skill", "List the skills available to this role (no name) or load one by name: design, design-research, design-tokens, frontend-design, interface-design, visual-qa, baseline-ui, write, humanizer, pptx and more. Load the relevant skill before starting a page or a document and follow it.", {"name": S("skill name, or empty to list")}, [])),
    "resources": (t_resources, spec("resources", "Search the estate's synced design and writing references (component kits, briefs, style guides) by a word in the path; then read_file the hit.", {"query": S("a word from the file or folder name")}, [])),
    "wait": (t_wait, spec("wait", "Wait up to N seconds for a peer's report to arrive in this pane.", {"seconds": I("default 300, max 900")}, [])),
    "measure": (t_measure, spec("measure", "Build and run the node's benchmark in the leanVM checkout; posts MEASURED/REVIEW cycles=<n> to the board and says whether it is strictly below the baseline. Refuses while files outside the editable surface are modified.", {}, [])),
    "submit": (t_submit, spec("submit", "Flag the current tree for submission. Only works when the last measure was strictly below the baseline.", {}, [])),
    "revert": (t_revert, spec("revert", "Restore the leanVM checkout to the reference commit before the next hypothesis.", {}, [])),
}
ROLE_TOOLS = {"orchestrator": ["board_plan", "handoff", "report", "read_board", "wait"],
              "builder": ["bash", "read_file", "write_file", "edit_file", "measure", "submit", "revert", "skill", "resources", "report", "read_board"],
              "critic": ["bash", "read_file", "measure", "skill", "resources", "board", "report", "read_board"]}
LABELS = {"bash": lambda a: f"Bash({a.get('command', '')[:90]})", "read_file": lambda a: f"Read({a.get('path')})",
          "write_file": lambda a: f"Write({a.get('path')})", "edit_file": lambda a: f"Update({a.get('path')})",
          "board": lambda a: f"Board({a.get('kind')} {a.get('text', '')[:70]})", "report": lambda a: f"Report({a.get('text', '')[:80]})",
          "read_board": lambda a: "ReadBoard()", "skill": lambda a: f"Skill({a.get('name') or 'list'})", "resources": lambda a: f"Resources({a.get('query', '')})", "measure": lambda a: "Measure(cargo run --release -- aggregate)", "submit": lambda a: "Submit()", "revert": lambda a: "Revert(leanVM)", "board_plan": lambda a: f"Plan({a.get('builder', '')[:70]})",
          "handoff": lambda a: f"Handoff({a.get('role')}: {a.get('task', '')[:70]})", "wait": lambda a: f"Wait({a.get('seconds', 60)}s)"}

# ── prompts ─────────────────────────────────────────────────────────────────────────────────────
COMMON = ("You are the {role} of a three-model swarm working an Ethplane node. Peers: orchestrator, builder, critic; the shared board is {board}. "
          "Every tool call carries a why: one short line, present tense, under 100 characters, what the step does and why. Write no other prose between tool calls. "
          "Never claim a result without the measured number or the command output that shows it. If a command fails, say what failed and try a different way; "
          "never say you lack access: you have the tools listed. No markdown headers, no bold, no summaries of accomplishments. When your piece is finished, call report once with the number or the output; report ends your turn, so do the whole piece before it.")
ROLE_PROMPT = {
    "orchestrator": "You never do the work yourself. For each task from the human: board_plan, then ONE handoff to the builder (task, files, done_when with a number), then one handoff to the critic (what to re-measure or re-run, done_when), then wait. Never queue several handoffs to one peer: the next handoff goes out only after that peer's report. While no REPORT has arrived, call wait again; never report that you are waiting and never re-send a handoff. When a REPORT arrives: if the critic's REVIEW is PASS with a number, report the result to the human in three lines; if FAIL, one corrected handoff naming what was missing. Read the board only when a report says to.",
    "builder": f"You edit code in the leanVM checkout {LEAN}; the editable surface is {', '.join(EDITABLE)} and nothing else. The loop for every hypothesis: read the file, make ONE real change with edit_file, call measure, then submit if measure says BELOW, otherwise revert and start the next hypothesis. measure is the only way to measure; never run cargo yourself. The baseline is {BASELINE} cycles; only strictly below counts. Comments and renames are not changes. Never conclude that nothing can be improved: the compiler surface (when editable) changed cycles in past runs.",
    "critic": f"You verify, you never edit anything (your shell refuses edits). For each MEASURED line the builder posts, call measure yourself on the same tree and compare: REVIEW PASS when both numbers match, REVIEW FAIL with both numbers when they differ or when files outside {', '.join(EDITABLE)} are modified. Then report. Never form or test hypotheses yourself.",
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

def log(entry):
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open("a") as f: f.write(json.dumps({"ts": datetime.datetime.now().isoformat(timespec="seconds"), **entry}) + "\n")

def run_task(messages, text, tools):
    t0 = time.time(); messages.append({"role": "user", "content": text}); log({"role": "user", "content": text})
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
    messages = [{"role": "system", "content": system}]
    board_append(f"{ROLE} READY (agent.py, {MODEL.split('/')[-1]})")
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
        run_task(messages, text, tools)

if __name__ == "__main__":
    try: main()
    except KeyboardInterrupt: print()
    finally: sys.stdout.write("\033[r\033[?25h\033[999;1H\n"); sys.stdout.flush()
