"""Failing-first tests for the verifier fix pass (critic's verifier-review-2.md items a-h).

Each test names the hole it closes. Run: python3.12 -m pytest verifier/tests -q
"""
import json
import os
import subprocess
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch, MagicMock

sys.path.append(os.path.dirname(os.path.abspath(__file__)) + "/..")
import run  # noqa: E402


class TestReferenceVerifier(unittest.TestCase):
    """(a) A missing reference verifier must FAIL, not pass. The old code defaulted to True."""

    def test_verifier_accepted_false_when_reference_missing(self):
        with tempfile.TemporaryDirectory() as wt:
            accepted, reason = run.run_reference_verifier(wt)
            self.assertFalse(accepted)
            self.assertEqual(reason, "verifier-missing")

    def test_verifier_accepted_follows_exit_code(self):
        with tempfile.TemporaryDirectory() as wt:
            os.makedirs(os.path.join(wt, "python-verifier"))
            open(os.path.join(wt, "python-verifier", "verifier.py"), "w").close()
            with patch.object(run.subprocess, "run", return_value=MagicMock(returncode=0, stdout="", stderr="")):
                self.assertEqual(run.run_reference_verifier(wt), (True, ""))
            with patch.object(run.subprocess, "run", return_value=MagicMock(returncode=1, stdout="", stderr="bad")):
                accepted, reason = run.run_reference_verifier(wt)
                self.assertFalse(accepted)
                self.assertEqual(reason, "verifier-rejected")


class TestNonRegression(unittest.TestCase):
    """(b) Each field has its own bound and its own reason."""

    BASE = {"provingMicros": 1_433_000, "proofSizeBytes": 302_592, "verifyMicros": 30_100}

    def test_proving_time_allows_the_spread_and_no_more(self):
        inside = dict(self.BASE, provingMicros=int(1_433_000 * 1.019))
        self.assertEqual(run.check_non_regression(inside, self.BASE, spread_bps=190), "")
        outside = dict(self.BASE, provingMicros=int(1_433_000 * 1.05))
        self.assertEqual(run.check_non_regression(outside, self.BASE, spread_bps=190), "regression-provingMicros")

    def test_proof_size_has_no_allowance(self):
        self.assertEqual(
            run.check_non_regression(dict(self.BASE, proofSizeBytes=302_593), self.BASE, 190),
            "regression-proofSizeBytes",
        )

    def test_verify_time_allows_five_percent(self):
        self.assertEqual(run.check_non_regression(dict(self.BASE, verifyMicros=31_000), self.BASE, 190), "")
        self.assertEqual(
            run.check_non_regression(dict(self.BASE, verifyMicros=32_000), self.BASE, 190),
            "regression-verifyMicros",
        )


class TestVerdictSchema(unittest.TestCase):
    """(c) One schema on every path: no `status`, and the same keys whatever happened."""

    KEYS = {"cycles", "provingMicros", "proofSizeBytes", "verifyMicros", "verifierAccepted", "reason", "binarySha256"}

    def test_every_verdict_has_the_same_keys_and_no_status(self):
        for v in [
            run.verdict(reason="build"),
            run.verdict(reason="parse"),
            run.verdict(reason="frozen-path"),
            run.verdict(cycles=1, provingMicros=2, proofSizeBytes=3, verifyMicros=4, verifier_accepted=True),
        ]:
            self.assertEqual(set(v.keys()), self.KEYS)
            self.assertNotIn("status", v)


class TestParseFailClosed(unittest.TestCase):
    """(d) A None among the four parsed values is a reason, never an exception."""

    def test_missing_value_is_reason_parse(self):
        self.assertEqual(run.parse_or_reason({"cycles": 1, "provingMicros": None, "proofSizeBytes": 3, "verifyMicros": 4}), "parse")
        self.assertEqual(run.parse_or_reason({"cycles": 1, "provingMicros": 2, "proofSizeBytes": 3, "verifyMicros": 4}), "")

    def test_empty_output_does_not_raise(self):
        self.assertEqual(run.parse_or_reason({}), "parse")


class TestBinaryRun(unittest.TestCase):
    """(e) Build once, then run the BUILT binary under taskset with a 600 s timeout."""

    def test_command_is_the_binary_not_cargo_run(self):
        cmd = run.pinned_command("/tmp/wt")
        self.assertNotIn("cargo", cmd)
        self.assertIn("taskset", cmd)
        self.assertTrue(any(c.endswith("leanvm") for c in cmd), cmd)
        self.assertIn("--xmss", cmd)

    def test_binary_name_is_resolved_not_assumed(self):
        """At the pinned commit the crate is leanvm-b; a hardcoded leanvm path measures nothing."""
        with tempfile.TemporaryDirectory() as wt:
            release = os.path.join(wt, "target", "release")
            os.makedirs(release)
            open(os.path.join(release, "leanvm-b"), "w").close()
            self.assertTrue(run.binary_path(wt).endswith("leanvm-b"))

    def test_timeout_is_ten_minutes(self):
        self.assertEqual(run.RUN_TIMEOUT_SECONDS, 600)


class TestTarballFilter(unittest.TestCase):
    """(f) Extraction uses filter='data', which refuses symlinks and absolute paths itself."""

    def test_symlink_escape_is_refused(self):
        with tempfile.TemporaryDirectory() as d:
            evil = os.path.join(d, "evil.tar.gz")
            link = os.path.join(d, "link")
            os.symlink("/etc/passwd", link)
            with tarfile.open(evil, "w:gz") as tar:
                tar.add(link, arcname="crates/x/link")
            with tempfile.TemporaryDirectory() as dest:
                ok, reason = run.extract_tarball(evil, dest)
                self.assertFalse(ok)
                self.assertEqual(reason, "unsafe-archive")


class TestStatementProbes(unittest.TestCase):
    """(h) Differential probes: the reference must reject a corrupted signature, and so must the
    submission. A submission that accepts what the reference rejects is skipping the check."""

    def test_three_probes_for_a_pass_and_nine_hundred_at_target(self):
        few = run.probe_indices(reaches_target=False, total=900)
        self.assertEqual(len(few), 3)
        self.assertIn(0, few)
        self.assertIn(899, few)
        self.assertEqual(len(run.probe_indices(reaches_target=True, total=900)), 900)

    def test_probe_is_invalid_when_the_reference_accepts_a_corrupt_signature(self):
        with patch.object(run, "run_with_corrupt_index", side_effect=[0, 1]):
            ok, reason = run.statement_probe("/ref", "/sub", 0)
            self.assertFalse(ok)
            self.assertEqual(reason, "probe-invalid")

    def test_submission_that_accepts_a_corrupt_signature_is_skipping_the_check(self):
        with patch.object(run, "run_with_corrupt_index", side_effect=[1, 0]):
            ok, reason = run.statement_probe("/ref", "/sub", 5)
            self.assertFalse(ok)
            self.assertEqual(reason, "statement-skip")

    def test_both_rejecting_is_a_pass(self):
        with patch.object(run, "run_with_corrupt_index", side_effect=[1, 1]):
            self.assertEqual(run.statement_probe("/ref", "/sub", 7), (True, ""))


if __name__ == "__main__":
    unittest.main()
