#!/usr/bin/env python3
"""Read a swarm transcript and say what it actually did.

The swarm's own reports are not evidence about the swarm: on 2026-09-09 a builder reported "all
pages implemented and committed" with no branch and a TypeScript error in the tree, and a critic
passed it on shape. This reads the record instead and counts the shapes that made those reports
possible.

Two sources, and the second is the one to trust:

  audit.py <path/to/transcript.jsonl>          the agent user's own file — it can be edited
  audit.py --journal ethplane-swarm-builder    journald, mirrored by the harness as it happened

Under --journal every entry carries journald's own trusted metadata. Only entries whose _PID is the
harness process that opened the log (announced in its first line) and whose _COMM is python3 are
counted; anything else under the same tag is an INJECTION line in the report, never a data point,
because the model's bash tool can run `logger -t <tag>` like any other program. The harness also
chains its lines (each carries the sha256 of the previous one), so the file and the journal can be
checked against each other and a line cannot be removed from the middle of either without breaking
the chain.

Checks, each one a failure that happened today:

  unevidenced-report   a report or REVIEW line with no number, path or command output in it
  edit-without-build   a file changed and neither measured nor built before the next report
  unread-claim         a report naming a file the session never read or wrote
  handoff-spam         two handoffs to the same peer with no report in between
  silent-stop          a model turn with no tool call and no prose: the pane looks frozen
  critic-mutation      a critic's shell attempting an edit (the tool refuses; the attempt counts)
  read-failure         a read of a path that is not there — the invented-filename signature
  broken-chain         a line whose prev hash does not match the line before it
"""
import argparse
import collections
import hashlib
import json
import os
import re
import subprocess
import sys

# A number of three digits or more, a path with an extension, a path:line, or an exit status: the
# shapes a claim can be checked against. "the build passes" is not one of them.
EVIDENCE = re.compile(r"\d{3,}|[\w./-]+\.[A-Za-z]{1,5}\b|\b\w+:\d+\b|exit\s+\d+|cycles\s*=|passed|failed \d")
PATHISH = re.compile(r"(?:/[\w.-]+)+/?[\w.-]*\.[A-Za-z]{1,5}|[\w-]+/[\w./-]+\.[A-Za-z]{1,5}")
BUILDISH = re.compile(r"\bcargo\b|\bpnpm\b|\bnpm\b|\btsc\b|\bnext build\b|\bpytest\b|\bforge\b|\bmake\b|\bvitest\b")
MUTATING = re.compile(r"sed\s+-i|\btee\b|\brm\b|\bmv\b|\bcp\b|git\s+(checkout|reset|apply|stash|commit|clean)|python3?\s+-c|(?<![0-9&])>(?!&)")
DONE_WORDS = re.compile(r"\b(done|complete|completed|implemented|finished|works|working|fixed|all pages|ready)\b", re.I)


def load_file(path):
    """Every JSON line of a transcript, in order."""
    out = []
    with open(path) as f:
        for n, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                out.append((n, json.loads(line)))
            except json.JSONDecodeError:
                out.append((n, {"role": "unparseable", "content": line[:200]}))
    return out


def load_journal(tag):
    """journald entries for one tag, with the metadata the harness cannot forge.

    Returns (entries, injections): entries are the harness's own lines; injections are everything
    else that carried the tag — a `logger -t <tag>` from the model's shell lands here and is
    reported, never counted."""
    raw = subprocess.run(["journalctl", "-t", tag, "-o", "json", "--no-pager"],
                         capture_output=True, text=True)
    if raw.returncode != 0:
        raise SystemExit(f"journalctl -t {tag} failed: {raw.stderr.strip()[:200]}")
    entries, injections, harness_pids = [], [], set()
    for n, line in enumerate(raw.stdout.splitlines(), 1):
        try:
            j = json.loads(line)
            payload = json.loads(j.get("MESSAGE", ""))
        except json.JSONDecodeError:
            continue
        pid, comm = j.get("_PID"), j.get("_COMM")
        # The harness announces itself in its first line; every later line must come from that pid.
        if payload.get("role") == "session" and comm == "python3":
            harness_pids.add(str(payload.get("pid", pid)))
        if str(pid) not in harness_pids or comm != "python3":
            injections.append({"line": n, "pid": pid, "comm": comm, "message": j.get("MESSAGE", "")[:160]})
            continue
        entries.append((n, payload))
    return entries, injections


def chain_breaks(entries):
    """Each line carries the sha256 of the one before it. A line removed from the middle of the file
    (or of the journal) breaks the chain at the join, which is the point of it."""
    breaks, prev = [], None
    for n, d in entries:
        if "prev" not in d:
            continue
        if prev is not None and d["prev"] != prev:
            breaks.append({"line": n, "expected": prev[:12], "found": str(d["prev"])[:12]})
        prev = hashlib.sha256(json.dumps({k: v for k, v in d.items() if k != "prev"},
                                         sort_keys=True).encode()).hexdigest()
    return breaks


def calls_of(entry):
    """The tool calls of an assistant turn, with arguments already parsed."""
    out = []
    for c in entry.get("tool_calls") or []:
        fn = c.get("function", c)
        try:
            args = json.loads(fn.get("arguments") or "{}")
        except (json.JSONDecodeError, TypeError):
            args = {}
        out.append((fn.get("name"), args))
    return out


def audit(entries):
    findings = collections.defaultdict(list)
    counts = collections.Counter()
    read_paths, seen_text = set(), []
    pending_edit = None          # (line, path) waiting for a build or a measure
    last_handoff = None          # (line, role) waiting for that peer's report

    for n, d in entries:
        role = d.get("role")
        if role == "assistant":
            calls = calls_of(d)
            counts["assistant_turns"] += 1
            if not calls and not (d.get("content") or "").strip():
                counts["silent-stop"] += 1
                findings["silent-stop"].append({"line": n, "why": "no tool call and no prose: the pane looks frozen"})
            for name, args in calls:
                counts[f"tool:{name}"] += 1
                text = " ".join(str(v) for k, v in args.items() if k != "why")

                if name in ("report", "board"):
                    body = args.get("text", "")
                    if DONE_WORDS.search(body) and not EVIDENCE.search(body):
                        counts["unevidenced-report"] += 1
                        findings["unevidenced-report"].append({"line": n, "text": body[:160]})
                    for p in PATHISH.findall(body):
                        if p not in read_paths and not any(p in t for t in seen_text):
                            counts["unread-claim"] += 1
                            findings["unread-claim"].append({"line": n, "path": p, "text": body[:120]})
                            break

                if name == "handoff":
                    to = args.get("role")
                    if last_handoff and last_handoff[1] == to:
                        counts["handoff-spam"] += 1
                        findings["handoff-spam"].append({"line": n, "role": to, "since": last_handoff[0]})
                    last_handoff = (n, to)

                if name in ("edit_file", "write_file"):
                    pending_edit = (n, args.get("path", "?"))
                    read_paths.add(str(args.get("path", "")))
                if name == "read_file":
                    read_paths.add(str(args.get("path", "")))
                if name == "measure" or (name == "bash" and BUILDISH.search(args.get("command", ""))):
                    pending_edit = None
                if name == "bash":
                    for p in PATHISH.findall(args.get("command", "")):
                        read_paths.add(p)
                if name == "report" and pending_edit:
                    counts["edit-without-build"] += 1
                    findings["edit-without-build"].append({"line": n, "edited_at": pending_edit[0], "path": pending_edit[1]})
                    pending_edit = None
                if name == "bash" and MUTATING.search(args.get("command", "").replace("2>&1", "")):
                    counts["mutating-shell"] += 1
                    findings["mutating-shell"].append({"line": n, "command": args.get("command", "")[:120]})

        elif role == "tool":
            counts["tool_results"] += 1
            content = d.get("content") or ""
            seen_text.append(content[:4000])
            if not d.get("ok", True):
                counts["tool_failures"] += 1
                if d.get("name") == "read_file" and "cannot read" in content:
                    counts["read-failure"] += 1
                    findings["read-failure"].append({"line": n, "text": content[:120]})
                if d.get("name") == "bash" and "the critic never edits" in content:
                    counts["critic-mutation"] += 1
                    findings["critic-mutation"].append({"line": n, "text": content[:120]})
            if d.get("name") == "report":
                last_handoff = None
        elif role == "user":
            counts["messages_in"] += 1
            if str(d.get("content", "")).startswith("REPORT"):
                last_handoff = None
    return counts, findings


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("transcript", nargs="?", help="path to transcript.jsonl")
    ap.add_argument("--journal", help="read journald under this tag instead (the trusted source)")
    ap.add_argument("--json", action="store_true", help="machine-readable")
    ap.add_argument("--show", type=int, default=3, help="examples per finding (default 3)")
    a = ap.parse_args()

    injections = []
    if a.journal:
        entries, injections = load_journal(a.journal)
        source = f"journal:{a.journal}"
    elif a.transcript:
        entries = load_file(a.transcript)
        source = a.transcript
    else:
        ap.error("give a transcript path or --journal <tag>")

    counts, findings = audit(entries)
    breaks = chain_breaks(entries)
    counts["broken-chain"] = len(breaks)
    counts["injection"] = len(injections)
    counts["lines"] = len(entries)

    if a.json:
        print(json.dumps({"source": source, "counts": dict(counts),
                          "findings": {k: v[:a.show] for k, v in findings.items()},
                          "chain_breaks": breaks[:a.show], "injections": injections[:a.show]}, indent=2))
        return 0

    print(f"{source}: {counts['lines']} lines · {counts['assistant_turns']} model turns · "
          f"{counts['tool_results']} tool results ({counts['tool_failures']} failed)")
    tools = sorted(((k.split(":", 1)[1], v) for k, v in counts.items() if k.startswith("tool:")),
                   key=lambda kv: -kv[1])
    print("  tools: " + ", ".join(f"{k} {v}" for k, v in tools))
    for check in ("unevidenced-report", "edit-without-build", "unread-claim", "handoff-spam",
                  "silent-stop", "critic-mutation", "mutating-shell", "read-failure",
                  "broken-chain", "injection"):
        n = counts.get(check, 0)
        mark = "  " if n == 0 else "!!"
        print(f"{mark} {check:<20} {n}")
        for f in (findings.get(check) or [])[:a.show if n else 0]:
            print(f"       line {f.get('line')}: " + str({k: v for k, v in f.items() if k != 'line'})[:150])
    for b in breaks[:a.show]:
        print(f"       chain break at line {b['line']}: expected {b['expected']}… found {b['found']}…")
    for i in injections[:a.show]:
        print(f"       INJECTION line {i['line']}: pid {i['pid']} comm {i['comm']}: {i['message'][:80]}")
    return 1 if any(counts.get(c, 0) for c in ("broken-chain", "injection")) else 0


if __name__ == "__main__":
    sys.exit(main())
