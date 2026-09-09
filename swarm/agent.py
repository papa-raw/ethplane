#!/usr/bin/env python3
"""Ethplane swarm agent: one role (orchestrator, builder, critic) on a local OpenAI-compatible model.

Standard library only. The pane renders like a Claude Code session: one "●" line per step, tool calls
collapsed to one line with the first lines of their result under "⎿", one reasoning line before each
action. Peers wake each other: handoff/report append to the swarm board and type into the peer's pane.

Env: OPENAI_BASE (http://127.0.0.1:8000/v1), MODEL, ROLE, SWARM_DIR, SESSION_PREFIX (qwen- | qwen-b-),
WORKDIR (repo the builder/critic act in), LEAN (leanVM checkout), MAX_TURNS (default 300).
"""
import argparse, datetime, json, os, pathlib, queue, re, shutil, subprocess, sys, threading, time, urllib.request

BASE = os.environ.get("OPENAI_BASE", "http://127.0.0.1:8000/v1")
MODEL = os.environ.get("MODEL", "Qwen/Qwen3-Coder-30B-A3B-Instruct-FP8")
ROLE = os.environ.get("ROLE", "builder")
SWARM = pathlib.Path(os.environ.get("SWARM_DIR", os.path.expanduser("~/swarm")))
PREFIX = os.environ.get("SESSION_PREFIX", "qwen-")
WORKDIR = os.environ.get("WORKDIR", str(SWARM / "ethplane"))
LEAN = os.environ.get("LEAN", str(SWARM / "leanVM"))
MAX_TURNS = int(os.environ.get("MAX_TURNS", "300"))
BOARD = SWARM / "board.md"
LOG = SWARM / ROLE / "transcript.jsonl"

# ── rendering ───────────────────────────────────────────────────────────────────────────────────
D, B, G, R, Y, X = "\033[2m", "\033[1m", "\033[32m", "\033[31m", "\033[33m", "\033[0m"
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
    text = re.sub(r"\*\*|`|^#+ ", "", text.strip(), flags=re.M)
    for para in [p for p in re.split(r"\n\s*\n", text) if p.strip()]:
        lines = wrap(para.strip())
        print(f"{color}●{X} {lines[0]}"); [print("  " + l) for l in lines[1:]]
def tool_line(label, ok=True):
    print(f"{G if ok else R}●{X} {label[:width() - 2]}")
def result_lines(text, keep=3):
    lines = [l for l in text.rstrip().splitlines()] or ["(no output)"]
    for i, l in enumerate(lines[:keep]):
        print(f"  {D}{'⎿ ' if i == 0 else '  '} {l[:width() - 6]}{X}")
    if len(lines) > keep: print(f"  {D}   … +{len(lines) - keep} lines{X}")
class Spinner:
    def __init__(self): self.stop = threading.Event(); self.t0 = time.time()
    def __enter__(self):
        def run():
            frames = "✻✼✽✾✿❀"; i = 0
            while not self.stop.is_set():
                sys.stdout.write(f"\r{D}{frames[i % len(frames)]} Thinking… ({int(time.time() - self.t0)}s){X}\033[K"); sys.stdout.flush()
                i += 1; self.stop.wait(0.25)
            sys.stdout.write("\r\033[K"); sys.stdout.flush()
        self.th = threading.Thread(target=run, daemon=True); self.th.start(); return self
    def __exit__(self, *a): self.stop.set(); self.th.join()
def prompt_line(): print(f"{D}{'─' * width()}{X}\n{B}>{X} ", end="", flush=True)

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
def t_bash(command: str, timeout: int = 900): return run_shell(command, timeout)
def t_read(path: str, offset: int = 1, limit: int = 200):
    p = pathlib.Path(path if path.startswith("/") else os.path.join(WORKDIR, path))
    try: lines = p.read_text().splitlines()
    except Exception as e: return f"cannot read {p}: {e}", False
    sel = lines[offset - 1: offset - 1 + limit]
    return "\n".join(f"{offset + i:5d}  {l}" for i, l in enumerate(sel)) + f"\n({len(lines)} lines total)", True
def t_write(path: str, content: str):
    p = pathlib.Path(path if path.startswith("/") else os.path.join(WORKDIR, path)); p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content); return f"wrote {len(content.splitlines())} lines", True
def t_edit(path: str, old: str, new: str):
    p = pathlib.Path(path if path.startswith("/") else os.path.join(WORKDIR, path))
    try: s = p.read_text()
    except Exception as e: return f"cannot read {p}: {e}", False
    n = s.count(old)
    if n != 1: return f"old text found {n} times; it must match exactly once", False
    p.write_text(s.replace(old, new, 1)); return f"replaced 1 occurrence (+{len(new.splitlines())} -{len(old.splitlines())} lines)", True
def t_board(kind: str, text: str): board_append(f"{ROLE} {kind}: {text}"); return "written to the board", True
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
def t_wait(seconds: int = 60):
    """Wait for peers; returns early when a message arrives in this pane."""
    for _ in range(min(int(seconds), 300)):
        if not INBOX.empty(): return "a message arrived", True
        time.sleep(1)
    return f"waited {min(int(seconds), 300)}s, nothing arrived", True

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
    "wait": (t_wait, spec("wait", "Wait up to N seconds for a peer's report to arrive in this pane.", {"seconds": I("default 60, max 300")}, [])),
}
ROLE_TOOLS = {"orchestrator": ["board_plan", "handoff", "report", "read_board", "wait"],
              "builder": ["bash", "read_file", "write_file", "edit_file", "board", "report", "read_board"],
              "critic": ["bash", "read_file", "board", "report", "read_board"]}
LABELS = {"bash": lambda a: f"Bash({a.get('command', '')[:90]})", "read_file": lambda a: f"Read({a.get('path')})",
          "write_file": lambda a: f"Write({a.get('path')})", "edit_file": lambda a: f"Update({a.get('path')})",
          "board": lambda a: f"Board({a.get('kind')} {a.get('text', '')[:70]})", "report": lambda a: f"Report({a.get('text', '')[:80]})",
          "read_board": lambda a: "ReadBoard()", "board_plan": lambda a: f"Plan({a.get('builder', '')[:70]})",
          "handoff": lambda a: f"Handoff({a.get('role')}: {a.get('task', '')[:70]})", "wait": lambda a: f"Wait({a.get('seconds', 60)}s)"}

# ── prompts ─────────────────────────────────────────────────────────────────────────────────────
COMMON = ("You are the {role} of a three-model swarm working an Ethplane node. Peers: orchestrator, builder, critic; the shared board is {board}. "
          "Every tool call carries a why: one short line, present tense, under 100 characters, what the step does and why. Write no other prose between tool calls. "
          "Never claim a result without the measured number or the command output that shows it. If a command fails, say what failed and try a different way; "
          "never say you lack access: you have the tools listed. No markdown headers, no bold, no summaries of accomplishments. When your piece is finished, call report once with the number or the output, then stop.")
ROLE_PROMPT = {
    "orchestrator": "You never do the work yourself. For each task from the human: board_plan, then handoff to builder (task, files, done_when with a number), then handoff to critic (what to re-measure or re-run, done_when), then wait. When a REPORT arrives: if the critic's REVIEW is PASS with a number, report the result to the human in three lines; if FAIL, one corrected handoff naming what was missing. Read the board only when a report says to.",
    "builder": f"You edit and run code in {WORKDIR}; leanVM is at {LEAN} and only crates/rec_aggregation/guests/ there may change. Measure with: cd {LEAN} && cargo run --release -- aggregate --xmss 900 --log-inv-rate 1 --repeat 3 2>&1 | grep -E 'cycles|proving time'. Every measurement goes to the board as MEASURED cycles=<n>. A submission is only for cycles STRICTLY BELOW the baseline; equal is not below. A comment is not a change. Before each measurement run git -C {LEAN} status --short and revert anything outside crates/rec_aggregation/guests/ with git checkout -- <path>; a change outside guests/ is never measured or submitted.",
    "critic": f"You verify, you never edit deliverables. Re-run the builder's command yourself in {WORKDIR} or {LEAN} and compare numbers; a REVIEW PASS quotes your own measured number or test count, a REVIEW FAIL names the path or number that is wrong. Post REVIEW lines with board and then report.",
}
INBOX: "queue.Queue[str]" = queue.Queue()

def call_model(messages, tools):
    body = json.dumps({"model": MODEL, "messages": messages, "tools": tools, "tool_choice": "auto", "temperature": 0.2, "max_tokens": 4000}).encode()
    for attempt in range(4):
        try:
            req = urllib.request.Request(f"{BASE}/chat/completions", body, {"Content-Type": "application/json", "Authorization": "Bearer local"})
            with urllib.request.urlopen(req, timeout=600) as r: return json.load(r)["choices"][0]["message"]
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
    messages.append({"role": "user", "content": text}); log({"role": "user", "content": text})
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
            tool_line(LABELS.get(name, lambda a: name)(args), ok); result_lines(out)
            messages.append({"role": "tool", "tool_call_id": c.get("id", name), "content": out}); log({"role": "tool", "name": name, "ok": ok, "content": out[:2000]})
    say(f"stopped after {MAX_TURNS} turns; send a message to continue", Y)
def tools_names(tools): return [t["function"]["name"] for t in tools]

def stdin_reader():
    for line in sys.stdin:
        if line.strip(): INBOX.put(line.rstrip("\n"))

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--init", help="first message"); ap.add_argument("--init-file"); ap.add_argument("--once", action="store_true", help="run the init message then exit")
    a = ap.parse_args()
    tools = [TOOLS[n][1] for n in ROLE_TOOLS[ROLE]]
    system = COMMON.format(role=ROLE, board=BOARD) + " " + ROLE_PROMPT[ROLE]
    brief = SWARM / "node.md"
    if brief.exists(): system += "\n\nNODE BRIEF:\n" + brief.read_text()[:6000]
    messages = [{"role": "system", "content": system}]
    board_append(f"{ROLE} READY (agent.py, {MODEL.split('/')[-1]})")
    threading.Thread(target=stdin_reader, daemon=True).start()
    first = a.init or (pathlib.Path(a.init_file).read_text().strip() if a.init_file else None)
    if first:
        print(f"{D}> {first[:width() - 2]}{X}"); run_task(messages, first, tools)
        if a.once: return
    while True:
        prompt_line(); text = INBOX.get(); print(text if len(text) < 2 * width() else text[: 2 * width()] + " …")
        if text.strip() in ("/quit", "exit"): return
        run_task(messages, text, tools)

if __name__ == "__main__":
    try: main()
    except KeyboardInterrupt: print()
