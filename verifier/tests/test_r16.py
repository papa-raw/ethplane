"""The critic's round-3 items, one test each (R6, R1, R2, R3, R4).

Each test names the hole it closes and asserts the *direction* of the failure, not only its text:
a verifier that cannot establish something must say so and stop, never continue on the assumption
that it was fine. Run from the repo root: python3.12 verifier/tests/test_r16.py
"""
import io
import json
import os
import subprocess
import sys
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch

sys.path.append(os.path.dirname(os.path.abspath(__file__)) + "/..")
import run  # noqa: E402

MEASURED = {"cycles": 1400000, "provingMicros": 1400000, "proofSizeBytes": 300000, "verifyMicros": 30000}


def main_verdict(argv, **overrides):
    """Run main() with the outside world stubbed and return the verdict it printed.

    Defaults are the happy path; a test overrides the one function whose failure it is about, so a
    verdict other than the expected one means the code took a path the test did not ask for."""
    stubs = {
        "extract_tarball": lambda *a, **k: (True, ""),
        "make_worktree": lambda *a, **k: (True, ""),
        "build": lambda *a, **k: (True, ""),
        "get_binary_hash": lambda wt: "sub" if wt.endswith("submission") else "ref",
        "measure": lambda *a, **k: (dict(MEASURED), ""),
        "run_reference_verifier": lambda *a, **k: (True, ""),
        "apply_corrupt_patch": lambda *a, **k: (True, ""),
        "statement_probe": lambda *a, **k: (True, ""),
    }
    stubs.update(overrides)
    buf = io.StringIO()
    with patch.multiple(run, **{k: (v if callable(v) else v) for k, v in stubs.items()}), \
         patch.object(sys, "argv", ["run.py"] + argv), \
         patch.object(run.subprocess, "run", return_value=subprocess.CompletedProcess([], 0)):
        with redirect_stdout(buf):
            run.main()
    return json.loads(buf.getvalue())


class TestR6EditableSurface(unittest.TestCase):
    """R6: cargo build runs the submitter's crate as the verifier user, so no Rust is editable."""

    def test_the_guest_program_is_the_whole_editable_surface(self):
        os.environ.pop("EDITABLE", None)
        self.assertEqual(run.validate_paths(["crates/rec_aggregation/guests/aggregate.py"]), (True, ""))
        for frozen in (
            "crates/lean_compiler/src/lib.rs",
            "crates/rec_aggregation/build.rs",
            "crates/rec_aggregation/src/main.rs",
            "build.rs",
        ):
            self.assertEqual(run.validate_paths([frozen]), (False, "frozen-path"), frozen)

    def test_no_rust_crate_is_editable_by_default(self):
        """The surface is per node now (test_surface.py), but the DEFAULT is still R6's answer: a
        host that sets nothing compiles no Rust of the submitter's."""
        os.environ.pop("EDITABLE", None)
        self.assertEqual(run.editable_prefixes(), ("crates/rec_aggregation/guests/",))
        self.assertEqual(run.DEFAULT_EDITABLE_PREFIXES, ("crates/rec_aggregation/guests/",))
        self.assertNotIn("lean_compiler", run.frozen_hint())


class TestR1ProbeTimeout(unittest.TestCase):
    """R1: a run that did not finish established nothing, and must not read as a rejection."""

    def test_a_timed_out_run_returns_no_exit_code_at_all(self):
        with patch.object(run.subprocess, "run", side_effect=subprocess.TimeoutExpired("cmd", 600)):
            self.assertIsNone(run.run_with_corrupt_index("/wt", 0))

    def test_a_reference_timeout_is_probe_timeout_not_a_valid_probe(self):
        with patch.object(run, "run_with_corrupt_index", side_effect=[None, 1]) as probe:
            self.assertEqual(run.statement_probe("/ref", "/sub", 0), (False, "probe-timeout"))
            self.assertEqual(probe.call_count, 1, "the submission leg must not run on a broken probe")

    def test_a_submission_timeout_is_probe_timeout_not_statement_skip(self):
        with patch.object(run, "run_with_corrupt_index", side_effect=[1, None]):
            ok, reason = run.statement_probe("/ref", "/sub", 5)
        self.assertFalse(ok)
        self.assertEqual(reason, "probe-timeout")
        self.assertNotEqual(reason, "statement-skip", "a slow submission is not a cheating one")

    def test_a_hanging_submission_never_reaches_an_accepted_verdict(self):
        v = main_verdict(["a.tar.gz"], statement_probe=lambda *a, **k: (False, "probe-timeout"))
        self.assertFalse(v["verifierAccepted"])
        self.assertEqual(v["reason"], "probe-timeout")


class TestR2HostConfig(unittest.TestCase):
    """R2: the host's missing interpreter is not the submission's fault."""

    def test_missing_python312_is_host_config_and_the_harness_never_runs(self):
        with patch.object(run.shutil, "which", return_value=None), \
             patch.object(run.os.path, "exists", return_value=True), \
             patch.object(run.subprocess, "run") as sp:
            accepted, reason = run.run_reference_verifier("/wt")
        self.assertFalse(accepted)
        self.assertEqual(reason, "host-config")
        self.assertNotEqual(reason, "verifier-rejected")
        sp.assert_not_called()

    def test_a_default_python_that_is_already_312_needs_no_path_prefix(self):
        with patch.object(run.shutil, "which", side_effect=lambda n: None if n == "python3.12" else "/usr/bin/python3"), \
             patch.object(run.subprocess, "run",
                          return_value=subprocess.CompletedProcess([], 0, stdout="True\n", stderr="")):
            self.assertEqual(run.python312_prefix(), (True, ""))

    def test_an_old_default_python_with_no_312_is_host_config(self):
        with patch.object(run.shutil, "which", side_effect=lambda n: None if n == "python3.12" else "/usr/bin/python3"), \
             patch.object(run.subprocess, "run",
                          return_value=subprocess.CompletedProcess([], 0, stdout="False\n", stderr="")):
            self.assertEqual(run.python312_prefix(), (False, ""))

    def test_a_missing_verifier_file_is_still_the_submissions_problem(self):
        with patch.object(run.os.path, "exists", return_value=False):
            self.assertEqual(run.run_reference_verifier("/wt"), (False, "verifier-missing"))


class TestR3ReferenceBuild(unittest.TestCase):
    """R3: the stale-binary guard exists to catch a build that did not take; a build that did not
    take must never be what switches it off."""

    def test_a_failed_reference_build_aborts_instead_of_disabling_the_guard(self):
        def build(wt):
            return (False, "build") if wt.endswith("reference") else (True, "")
        v = main_verdict(["a.tar.gz"], build=build,
                         measure=lambda *a, **k: self.fail("measured after a failed reference build"))
        self.assertEqual(v["reason"], "reference-build")
        self.assertFalse(v["verifierAccepted"])

    def test_a_reference_build_that_leaves_no_binary_is_also_reference_build(self):
        v = main_verdict(["a.tar.gz"],
                         get_binary_hash=lambda wt: None if wt.endswith("reference") else "sub")
        self.assertEqual(v["reason"], "reference-build")

    def test_an_identical_binary_is_stale_even_when_the_artifact_carried_no_files(self):
        v = main_verdict(["a.tar.gz"], get_binary_hash=lambda wt: "same")
        self.assertEqual(v["reason"], "stale-binary")
        self.assertEqual(v["binarySha256"], "same")

    def test_a_submission_build_that_leaves_no_binary_does_not_slip_past_the_comparison(self):
        v = main_verdict(["a.tar.gz"],
                         get_binary_hash=lambda wt: None if wt.endswith("submission") else "ref")
        self.assertEqual(v["reason"], "binary-missing")


class TestR4ProbeBudget(unittest.TestCase):
    """R4: the budget follows the money and is computed from the measurement, not handed in."""

    def test_no_gain_releases_nothing(self):
        self.assertFalse(run.releases_full_target(1542812, 1542812, 1000, 0))
        self.assertFalse(run.releases_full_target(1600000, 1542812, 1000, 0))

    def test_a_partial_gain_gets_the_three_probes(self):
        # 5 % against a 10 % target: it pays, but it does not release the last of the escrow
        self.assertFalse(run.releases_full_target(1465671, 1542812, 1000, 0))

    def test_a_submission_reaching_the_target_gain_is_swept(self):
        self.assertTrue(run.releases_full_target(1388530, 1542812, 1000, 0))

    def test_a_target_already_paid_out_is_not_swept_again(self):
        self.assertFalse(run.releases_full_target(1388530, 1542812, 1000, 1000))

    def test_unpriceable_parameters_are_swept_because_that_is_the_safe_direction(self):
        self.assertTrue(run.releases_full_target(1000, 0, 1000, 0))
        self.assertTrue(run.releases_full_target(1000, 1542812, 0, 0))

    def test_main_derives_the_sweep_from_the_measurement(self):
        seen = []
        with patch.object(run, "probe_indices", side_effect=lambda t, total=900: seen.append(t) or []):
            main_verdict(["a.tar.gz"], measure=lambda *a, **k: ({**MEASURED, "cycles": 1388530}, ""))
            main_verdict(["a.tar.gz"], measure=lambda *a, **k: ({**MEASURED, "cycles": 1540000}, ""))
        self.assertEqual(seen, [True, False])

    def test_the_caller_can_no_longer_choose_the_budget(self):
        with patch.object(sys, "argv", ["run.py", "--reaches-target", "a.tar.gz"]), \
             redirect_stdout(io.StringIO()), patch.object(sys, "stderr", io.StringIO()):
            with self.assertRaises(SystemExit):
                run.main()

    def test_three_probes_are_first_last_and_one_the_submitter_cannot_predict(self):
        few = run.probe_indices(False, total=900)
        self.assertEqual(len(few), 3)
        self.assertIn(0, few)
        self.assertIn(899, few)
        self.assertEqual(len(run.probe_indices(True, total=900)), 900)


if __name__ == "__main__":
    unittest.main(verbosity=2)
