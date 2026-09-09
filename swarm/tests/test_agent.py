"""The honesty rules are tool contracts, so they are tested as contracts.

Every case here is a shape the transcripts of 2026-09-09 actually contain (audit.py over six
sessions): 47 reports claiming a result with nothing to check, 43 claims naming a file the session
never opened, 39 second handoffs to a peer that owed a report, 395 reports against 289 handoffs.

Run from the repository root: python3.12 swarm/tests/test_agent.py
"""
import importlib.util
import json
import os
import pathlib
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[2]
SWARM_TMP = tempfile.mkdtemp(prefix="swarm-test-")


def load_agent(role="builder", **env):
    """Import agent.py fresh with the environment a role would have."""
    os.environ.update({"ROLE": role, "SWARM_DIR": SWARM_TMP, "SESSION_PREFIX": "test-",
                       "WORKDIR": SWARM_TMP, "LEAN": SWARM_TMP, "SKILLS_DIR": os.path.join(SWARM_TMP, "skills"),
                       **env})
    spec = importlib.util.spec_from_file_location(f"agent_{role}", ROOT / "swarm" / "agent.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class AgentTestCase(unittest.TestCase):
    role = "builder"

    def setUp(self):
        self.agent = load_agent(self.role)
        self.agent.BOARD = pathlib.Path(SWARM_TMP) / f"board-{self.role}.md"
        self.agent.BOARD.write_text("")
        self.agent.TASK["reports"] = 0
        self.agent.OWED.clear()
        self.agent.SEEN_PATHS.clear()
        self.sent = []
        patcher = patch.object(self.agent, "send_to", lambda role, text: self.sent.append((role, text)))
        patcher.start(); self.addCleanup(patcher.stop)

    def board(self):
        return self.agent.BOARD.read_text()


class TestEvidence(AgentTestCase):
    def test_a_done_claim_with_nothing_to_check_is_refused(self):
        out, ok = self.agent.t_report("Builder completed web app build with design tokens. Successfully compiled.")
        self.assertFalse(ok)
        self.assertIn("evidence", out)
        self.assertEqual(self.board(), "", "a refused report must not reach the board")

    def test_the_same_claim_with_a_number_goes_through(self):
        out, ok = self.agent.t_report("guest loop unrolled", evidence="cycles=1498231 baseline=1542812")
        self.assertTrue(ok, out)
        self.assertIn("cycles=1498231", self.board())

    def test_a_command_s_own_output_counts_as_evidence(self):
        _, ok = self.agent.t_report("the build passes now", evidence="tsc --noEmit exit 0")
        self.assertTrue(ok)

    def test_a_path_and_line_counts_as_evidence(self):
        self.agent.SEEN_PATHS.add("web/app/page.tsx")
        _, ok = self.agent.t_report("fixed the import", evidence="web/app/page.tsx:42")
        self.assertTrue(ok)

    def test_a_review_line_needs_it_too_and_a_note_does_not(self):
        _, ok = self.agent.t_board("REVIEW", "PASS, the build is fine")
        self.assertFalse(ok)
        _, ok = self.agent.t_board("NOTE", "starting on the second hypothesis")
        self.assertTrue(ok)

    def test_a_pass_that_quotes_its_own_number_is_accepted(self):
        _, ok = self.agent.t_board("REVIEW", "PASS, re-measured the builder's tree", evidence="cycles=1498231")
        self.assertTrue(ok)


class TestUnreadClaims(AgentTestCase):
    def test_naming_a_file_the_session_never_opened_is_refused(self):
        out, ok = self.agent.t_report("implemented the layout", evidence="components/layout/Layout.tsx:1")
        self.assertFalse(ok)
        self.assertIn("never read or written", out)

    def test_after_reading_it_the_same_claim_is_fine(self):
        f = pathlib.Path(SWARM_TMP) / "Layout.tsx"; f.write_text("x\n")
        self.agent.t_read(str(f))
        _, ok = self.agent.t_report("implemented the layout", evidence=f"{f}:1")
        self.assertTrue(ok)

    def test_reading_a_path_that_is_not_there_shows_what_is(self):
        (pathlib.Path(SWARM_TMP) / "real.py").write_text("x\n")
        out, ok = self.agent.t_read(os.path.join(SWARM_TMP, "invented.rs"))
        self.assertFalse(ok)
        self.assertIn("does not exist", out)
        self.assertIn("real.py", out, "the model needs to see what IS there, or it invents again")


class TestReportThrottle(AgentTestCase):
    def test_one_report_per_task(self):
        _, ok = self.agent.t_report("first", evidence="cycles=1500000")
        self.assertTrue(ok)
        out, ok = self.agent.t_report("second", evidence="cycles=1500001")
        self.assertFalse(ok)
        self.assertIn("already reported", out)

    def test_the_next_incoming_message_opens_it_again(self):
        self.agent.t_report("first", evidence="cycles=1500000")
        self.agent.TASK["reports"] = 0                      # what run_task does on a new message
        _, ok = self.agent.t_report("second task", evidence="cycles=1499000")
        self.assertTrue(ok)


class TestHandoffGate(AgentTestCase):
    role = "orchestrator"

    def test_a_second_handoff_to_a_silent_peer_is_refused(self):
        _, ok = self.agent.t_handoff("builder", "unroll the loop", "aggregate.py", "MEASURED cycles=<n> below 1542812")
        self.assertTrue(ok)
        out, ok = self.agent.t_handoff("builder", "and also try CSE", "aggregate.py", "cycles=<n>")
        self.assertFalse(ok)
        self.assertIn("has not reported", out)

    def test_the_peer_s_report_clears_the_debt(self):
        self.agent.t_handoff("builder", "unroll", "aggregate.py", "cycles=<n> below 1542812")
        self.agent.OWED.discard("builder")                  # what run_task does when REPORT arrives
        _, ok = self.agent.t_handoff("builder", "next hypothesis", "aggregate.py", "cycles=<n>")
        self.assertTrue(ok)

    def test_a_criterion_a_command_cannot_decide_is_refused(self):
        out, ok = self.agent.t_handoff("critic", "check it", "aggregate.py", "implemented and looks right")
        self.assertFalse(ok)
        self.assertIn("checkable", out)

    def test_the_other_peer_is_not_blocked_by_the_first(self):
        self.agent.t_handoff("builder", "unroll", "aggregate.py", "cycles=<n>")
        _, ok = self.agent.t_handoff("critic", "re-measure", "aggregate.py", "cycles=<n> matches")
        self.assertTrue(ok)


class TestSkills(AgentTestCase):
    def setUp(self):
        super().setUp()
        skills = pathlib.Path(SWARM_TMP) / "skills"
        for name, desc in (("debug-protocol", "reproduce before fixing"), ("adversarial-review", "attack the work")):
            d = skills / name; d.mkdir(parents=True, exist_ok=True)
            (d / "SKILL.md").write_text(f"---\nname: {name}\ndescription: {desc}\n---\n\nbody of {name}\n")

    def test_the_list_is_this_role_s_skills_with_their_trigger_lines(self):
        out, ok = self.agent.t_skill()
        self.assertTrue(ok)
        self.assertIn("debug-protocol: reproduce before fixing", out)
        self.assertNotIn("adversarial-review", out, "that one belongs to the critic")

    def test_loading_one_returns_the_skill_itself(self):
        out, ok = self.agent.t_skill("debug-protocol")
        self.assertTrue(ok)
        self.assertIn("body of debug-protocol", out)

    def test_a_skill_outside_the_role_s_set_is_refused_with_the_set(self):
        out, ok = self.agent.t_skill("adversarial-review")
        self.assertFalse(ok)
        self.assertIn("debug-protocol", out)


class TestGuestSeat(AgentTestCase):
    role = "guest"

    def test_the_seat_reads_but_does_not_write(self):
        out, ok = self.agent.t_bash("rm -rf /home/ubuntu/swarm")
        self.assertFalse(ok)
        self.assertIn("ask the orchestrator", out)

    def test_it_carries_the_person_s_words_verbatim(self):
        _, ok = self.agent.t_ask_orchestrator("ask the builder to widen the CSE candidate set")
        self.assertTrue(ok)
        self.assertEqual(self.sent[0][0], "orchestrator")
        self.assertIn("from the View seat: ask the builder to widen the CSE candidate set", self.sent[0][1])
        self.assertIn("VIEW asks orchestrator", self.board())

    def test_join_hands_this_pane_the_builder_s_tools(self):
        self.assertFalse(self.agent.STATE["guest_joined"])
        _, ok = self.agent.t_join()
        self.assertTrue(ok and self.agent.STATE["guest_joined"])
        self.assertIn("measure", self.agent.GUEST_AFTER_JOIN)

    def test_the_seat_has_no_measure_or_submit_before_that(self):
        for tool in ("measure", "submit", "revert", "edit_file"):
            self.assertNotIn(tool, self.agent.ROLE_TOOLS["guest"])

    def test_every_shortcut_maps_to_a_tool_the_seat_has(self):
        for word, (name, _) in self.agent.SLASH.items():
            self.assertIn(name, self.agent.ROLE_TOOLS["guest"], word)


class TestChainedLog(AgentTestCase):
    def test_each_line_carries_the_hash_of_the_one_before(self):
        self.agent.LOG = pathlib.Path(SWARM_TMP) / "chain.jsonl"
        self.agent.LOG.write_text("")
        self.agent.CHAIN["prev"] = None
        for i in range(3):
            self.agent.log({"role": "assistant", "content": f"turn {i}"})
        lines = [json.loads(l) for l in self.agent.LOG.read_text().splitlines()]
        self.assertIsNone(lines[0]["prev"])
        self.assertTrue(all(l["prev"] for l in lines[1:]))

        sys.path.insert(0, str(ROOT / "swarm"))
        import audit
        entries = [(i, d) for i, d in enumerate(lines, 1)]
        self.assertEqual(audit.chain_breaks(entries), [], "an untouched chain has no breaks")
        cut = entries[:1] + entries[2:]                    # a line taken out of the middle
        self.assertTrue(audit.chain_breaks(cut), "a removed line must break the chain")


if __name__ == "__main__":
    unittest.main(verbosity=2)
