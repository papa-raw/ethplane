"""One test per critic finding, named after the finding.

These were closed on 2026-09-09 (branch verifier-r16, merged) and re-reported afterwards from an
older tree. This file exists so the next round is answerable in one command instead of a re-reading:
each test asserts the property the finding stated, at the level it stated it, and names where the
behaviour lives. Some assertions overlap test_r16.py — that is the point; a finding closed twice
should be provable twice.

Run from the repository root: python3.12 verifier/tests/test_critic_findings.py
"""
import io
import json
import os

import subprocess
import sys
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.append(HERE + "/..")
import run  # noqa: E402

CRITERION = os.path.join(HERE, "..", "..", "docs", "CRITERION-pq-leanxmss.md")


class TestR1TimeoutIsNeverEvidence(unittest.TestCase):
    """R1: a submission that hangs on corrupted input must not score as having refused it.
    Closed at run.py run_with_corrupt_index (returns None, not 124) and statement_probe."""

    def test_a_timed_out_run_has_no_exit_code(self):
        with patch.object(run.subprocess, "run", side_effect=subprocess.TimeoutExpired("cmd", 600)):
            self.assertIsNone(run.run_with_corrupt_index("/wt", 0))

    def test_either_leg_timing_out_is_probe_timeout(self):
        for legs in ([None, 1], [1, None]):
            with patch.object(run, "run_with_corrupt_index", side_effect=legs):
                self.assertEqual(run.statement_probe("/ref", "/sub", 0), (False, "probe-timeout"))

    def test_a_hang_never_reaches_an_accepted_verdict(self):
        v = run.verdict(cycles=1, provingMicros=1, proofSizeBytes=1, verifyMicros=1,
                        verifier_accepted=False, reason="probe-timeout")
        self.assertFalse(v["verifierAccepted"])
        self.assertEqual(v["reason"], "probe-timeout")

    def test_124_is_now_an_ordinary_exit_code_again(self):
        """The old timeout value is also an exit code a process can return by itself. Now that a
        timeout is None, a real 124 from the binary means what any non-zero means: it refused."""
        with patch.object(run.subprocess, "run") as sp:
            sp.return_value.returncode = 124
            self.assertEqual(run.run_with_corrupt_index("/wt", 0), 124)
        with patch.object(run, "run_with_corrupt_index", side_effect=[124, 124]):
            self.assertEqual(run.statement_probe("/ref", "/sub", 0), (True, ""))


class TestR4ProbeBudget(unittest.TestCase):
    """R4: the budget is 3 or 900 — and the criterion must describe that, not a tier the code
    does not have. Closed at probe_indices and releases_full_target."""

    def test_the_budget_is_two_tiers_and_they_are_the_documented_sizes(self):
        self.assertEqual(len(run.probe_indices(False, total=900)), 3)
        self.assertEqual(len(run.probe_indices(True, total=900)), 900)

    def test_the_three_are_first_last_and_one_that_cannot_be_predicted(self):
        few = run.probe_indices(False, total=900)
        self.assertIn(0, few)
        self.assertIn(899, few)
        self.assertEqual(len({tuple(run.probe_indices(False, total=900)) for _ in range(20)}) > 1, True)

    def test_the_criterion_describes_the_budget_the_code_implements(self):
        doc = open(CRITERION).read()
        self.assertIn("three probes", doc)
        self.assertIn("all 900 indices", doc)
        for absent in ("graduated", "middle tier", "3 + 900"):
            self.assertNotIn(absent, doc, f"the criterion promises {absent!r}, which probe_indices does not do")

    def test_the_criterion_states_the_timeout_rule_too(self):
        doc = open(CRITERION).read()
        self.assertRegex(doc, r"times out on either leg.*never as evidence")


class TestBudgetIsNotCallerSupplied(unittest.TestCase):
    """Medium: the strength of the check must not depend on the orchestration layer remembering a
    flag. Closed by deriving it in run.py from the measurement."""

    def test_the_flag_is_gone(self):
        with patch.object(sys, "argv", ["run.py", "--reaches-target", "a.tar.gz"]), \
             redirect_stdout(io.StringIO()), patch.object(sys, "stderr", io.StringIO()):
            with self.assertRaises(SystemExit):
                run.main()

    def test_it_is_computed_from_the_measurement_and_the_contracts_own_arithmetic(self):
        self.assertTrue(run.releases_full_target(1388530, 1542812, 1000, 0))     # 10% gain, 10% target
        self.assertFalse(run.releases_full_target(1465671, 1542812, 1000, 0))    # 5%: pays, not the last of it
        self.assertFalse(run.releases_full_target(1542812, 1542812, 1000, 0))    # no gain
        self.assertFalse(run.releases_full_target(1388530, 1542812, 1000, 1000))  # already paid to target

    def test_parameters_it_cannot_price_are_swept(self):
        self.assertTrue(run.releases_full_target(1000, 0, 1000, 0))
        self.assertTrue(run.releases_full_target(1000, 1542812, 0, 0))


class TestHostConfigNotVerifierRejected(unittest.TestCase):
    """Medium: a missing python3.12 is the host's configuration, not the submission's fault."""

    def test_no_interpreter_is_host_config_and_the_harness_does_not_run(self):
        with patch.object(run.shutil, "which", return_value=None), \
             patch.object(run.os.path, "exists", return_value=True), \
             patch.object(run.subprocess, "run") as sp:
            accepted, reason = run.run_reference_verifier("/wt")
        self.assertEqual((accepted, reason), (False, "host-config"))
        sp.assert_not_called()

    def test_a_missing_verifier_file_is_still_the_submissions_problem(self):
        with patch.object(run.os.path, "exists", return_value=False):
            self.assertEqual(run.run_reference_verifier("/wt"), (False, "verifier-missing"))


class TestReferenceBuildFailureStopsTheRun(unittest.TestCase):
    """Medium: the stale-binary check exists to catch a build that did not take, so a build that did
    not take must never be what switches it off."""

    def verdict_from_main(self, **stubs):
        base = {
            "extract_tarball": lambda *a, **k: (True, ""),
            "make_worktree": lambda *a, **k: (True, ""),
            "build": lambda *a, **k: (True, ""),
            "get_binary_hash": lambda wt: "sub" if wt.endswith("submission") else "ref",
            "measure": lambda *a, **k: ({"cycles": 1, "provingMicros": 1, "proofSizeBytes": 1,
                                         "verifyMicros": 1}, ""),
            "run_reference_verifier": lambda *a, **k: (True, ""),
            "apply_corrupt_patch": lambda *a, **k: (True, ""),
            "statement_probe": lambda *a, **k: (True, ""),
        }
        base.update(stubs)
        buf = io.StringIO()
        with patch.multiple(run, **base), patch.object(sys, "argv", ["run.py", "a.tar.gz"]), \
             patch.object(run.subprocess, "run", return_value=subprocess.CompletedProcess([], 0)), \
             redirect_stdout(buf):
            run.main()
        return json.loads(buf.getvalue())

    def test_a_failed_reference_build_ends_the_run(self):
        v = self.verdict_from_main(
            build=lambda wt: (False, "build") if wt.endswith("reference") else (True, ""),
            measure=lambda *a, **k: self.fail("measured after a failed reference build"))
        self.assertEqual(v["reason"], "reference-build")

    def test_an_identical_binary_is_still_caught(self):
        self.assertEqual(self.verdict_from_main(get_binary_hash=lambda wt: "same")["reason"], "stale-binary")


if __name__ == "__main__":
    unittest.main(verbosity=2)
