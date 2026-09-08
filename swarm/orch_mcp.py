"""Orchestrator toolset for the Qwen swarm: the ONLY tools the orchestrator session has. Plan, hand off, report, read the board. No shell, no files."""
import subprocess, datetime, pathlib
from mcp.server.mcpserver import MCPServer
BOARD = pathlib.Path("$SWARM_DIR/board.md")
mcp = MCPServer("ethplane-orchestrator")
def _stamp(): return datetime.datetime.now().strftime("%H:%M")
def _append(line: str):
    with BOARD.open("a") as f: f.write(f"{_stamp()} {line}\n")
def _send(session: str, text: str):
    subprocess.run(["tmux", "send-keys", "-t", session, "-l", text], check=False)
    subprocess.run(["sleep", "0.5"]); subprocess.run(["tmux", "send-keys", "-t", session, "Enter"], check=False)
@mcp.tool()
def board_plan(line1: str, line2: str, line3: str) -> str:
    """Write the PLAN to the shared board: what the builder makes, what the critic checks, done-when."""
    _append(f"orchestrator PLAN: {line1} | {line2} | {line3}"); return "PLAN written"
@mcp.tool()
def handoff(role: str, task: str, files: str, done_when: str) -> str:
    """Hand a piece of work to 'builder' or 'critic': it lands on the board and in that role's pane."""
    if role not in ("builder", "critic"): return "role must be builder or critic"
    msg = f"HANDOFF orchestrator -> {role}: {task} | files: {files} | done when: {done_when}"
    _append(msg); _send(f"qwen-{role}", msg); return f"sent to {role}"
@mcp.tool()
def report(text: str) -> str:
    """Tell the human the consolidated result (three lines max); also written to the board."""
    _append(f"orchestrator REPORT: {text}"); return "reported"
@mcp.tool()
def read_board(lines: int = 20) -> str:
    """Read the last N lines of the shared board (peers' READY, REPORT and REVIEW lines appear here)."""
    return "\n".join(BOARD.read_text().splitlines()[-lines:])
if __name__ == "__main__":
    mcp.run()