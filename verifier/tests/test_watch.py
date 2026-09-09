"""The watcher's contract with the API, the verifier and the chain.

Run from the repository root: python3.12 verifier/tests/test_watch.py
"""
import hashlib
import io
import json
import os
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + "/..")
import watch  # noqa: E402

KEY = "0x" + "ab" * 32
NODE = "0x" + "12" * 32
ARTIFACT = "0x" + "cd" * 32
VERDICT = {
    "cycles": 1542812, "provingMicros": 1433000, "proofSizeBytes": 302592,
    "verifyMicros": 30100, "verifierAccepted": True, "reason": "", "binarySha256": "abc123",
}


class WatchTestCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.key_file = os.path.join(self.tmp, "verifier.key")
        with open(self.key_file, "w") as f:
            f.write(KEY + "\n")
        self.env = {
            "VERIFIER_KEY_FILE": self.key_file,
            "API_BASE": "https://ethplane.example",
            "NODE_ID": NODE,
            "LEANVM_REF": "/home/ubuntu/leanVM",
            "REFERENCE_COMMIT": "a210ef1b",
            "SEPOLIA_RPC_URL": "https://sepolia.example/rpc",
            "ETHPLANE_ADDRESS": "0x" + "56" * 20,
        }
        self._saved = {k: os.environ.get(k) for k in self.env}
        os.environ.update(self.env)

    def tearDown(self):
        for k, v in self._saved.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
        import shutil
        shutil.rmtree(self.tmp, ignore_errors=True)


class TestEnvironment(WatchTestCase):
    def test_a_missing_variable_is_an_error(self):
        os.environ.pop("LEANVM_REF")
        with self.assertRaises(ValueError) as e:
            watch.get_env_vars()
        self.assertIn("LEANVM_REF", str(e.exception))

    def test_a_wallet_is_required_in_one_form_or_the_other(self):
        os.environ.pop("VERIFIER_KEY_FILE")
        with self.assertRaises(ValueError):
            watch.get_env_vars()
        os.environ["VERIFIER_KEYSTORE"] = "/keys/verifier.json"
        try:
            watch.get_env_vars()
        finally:
            del os.environ["VERIFIER_KEYSTORE"]


class TestPending(WatchTestCase):
    """PENDING is the absence of a verdict — the API has no status column, and inventing one is how
    the first version of this file selected nothing at all."""

    def detail(self):
        return {
            "submissions": [{"artifact_hash": "0xaa"}, {"artifact_hash": "0xbb"}, {"artifact_hash": "0xcc"}],
            "verdicts": [{"artifact_hash": "0xbb"}],
        }

    def test_a_judged_submission_is_not_pending(self):
        pending = watch.pending_submissions(self.detail(), set())
        self.assertEqual([s["artifact_hash"] for s in pending], ["0xaa", "0xcc"])

    def test_the_ledger_keeps_one_out_of_the_next_pass(self):
        pending = watch.pending_submissions(self.detail(), {"0xaa"})
        self.assertEqual([s["artifact_hash"] for s in pending], ["0xcc"])

    def test_a_row_without_an_artifact_hash_is_skipped_rather_than_crashing_the_pass(self):
        self.assertEqual(watch.pending_submissions({"submissions": [{}], "verdicts": []}, set()), [])


class TestFetch(WatchTestCase):
    def test_bytes_that_do_not_hash_to_their_name_are_refused(self):
        body = b"not the artifact you asked for"
        response = MagicMock()
        response.read.return_value = body
        response.__enter__ = lambda s: s
        response.__exit__ = lambda *a: False
        with patch.object(watch.urllib.request, "urlopen", return_value=response):
            with self.assertRaises(RuntimeError) as e:
                watch.fetch_artifact("https://api", ARTIFACT)
        self.assertIn("hash mismatch", str(e.exception))

    def test_matching_bytes_land_in_a_file(self):
        body = b"the artifact"
        digest = "0x" + hashlib.sha256(body).hexdigest()
        response = MagicMock()
        response.read.return_value = body
        response.__enter__ = lambda s: s
        response.__exit__ = lambda *a: False
        with patch.object(watch.urllib.request, "urlopen", return_value=response):
            path = watch.fetch_artifact("https://api", digest)
        try:
            with open(path, "rb") as f:
                self.assertEqual(f.read(), body)
        finally:
            os.unlink(path)


class TestRunVerifier(WatchTestCase):
    def test_the_verdict_is_the_verifiers_stdout(self):
        with patch.object(watch.subprocess, "run",
                          return_value=MagicMock(returncode=0, stdout=json.dumps(VERDICT), stderr="")):
            self.assertEqual(watch.run_verifier("/tmp/a.tar.gz")["cycles"], 1542812)

    def test_the_pinned_commit_reaches_run_py_under_the_name_it_reads(self):
        seen = {}

        def fake(cmd, **kw):
            seen.update(kw.get("env", {}))
            return MagicMock(returncode=0, stdout=json.dumps(VERDICT), stderr="")

        with patch.object(watch.subprocess, "run", side_effect=fake):
            watch.run_verifier("/tmp/a.tar.gz")
        self.assertEqual(seen["LEANVM_COMMIT"], "a210ef1b")
        self.assertEqual(seen["LEANVM_REF"], "/home/ubuntu/leanVM")

    def test_a_crashed_verifier_is_an_outage_here_not_a_verdict_about_the_submission(self):
        with patch.object(watch.subprocess, "run",
                          return_value=MagicMock(returncode=1, stdout="", stderr="boom")):
            with self.assertRaises(RuntimeError):
                watch.run_verifier("/tmp/a.tar.gz")


class TestMeasurementCall(WatchTestCase):
    def test_the_arguments_are_in_the_order_the_contract_declares(self):
        args = watch.measurement_args(NODE, ARTIFACT, VERDICT)
        self.assertEqual(args[:2], [NODE, ARTIFACT])
        self.assertEqual(args[2:8], ["1542812", "1433000", "302592", "30100", "true",
                                     watch.evidence_hash(VERDICT)])
        self.assertEqual(len(args[7]), 66)

    def test_a_rejection_carries_zeroes_and_the_flag_that_makes_them_harmless(self):
        args = watch.measurement_args(NODE, ARTIFACT, {"verifierAccepted": False, "reason": "frozen-path"})
        self.assertEqual(args[2:8][:4], ["0", "0", "0", "0"])
        self.assertEqual(args[6], "false")

    def test_an_accepted_measurement_with_no_cycles_is_refused_here(self):
        with self.assertRaises(RuntimeError):
            watch.measurement_args(NODE, ARTIFACT, {"verifierAccepted": True, "cycles": None})

    def test_the_evidence_hash_changes_with_the_verdict(self):
        other = dict(VERDICT, cycles=1000)
        self.assertNotEqual(watch.evidence_hash(VERDICT), watch.evidence_hash(other))

    def test_the_printed_line_carries_no_key(self):
        buf = io.StringIO()
        with redirect_stdout(buf):
            watch.record_measurement(NODE, ARTIFACT, VERDICT, dry_run=True)
        out = buf.getvalue()
        self.assertIn("recordMeasurement(", out)
        self.assertNotIn(KEY, out)
        self.assertIn("$VERIFIER_KEY_FILE", out)

    def test_real_mode_sends_and_returns_the_transaction_hash(self):
        with patch.object(watch.subprocess, "run",
                          return_value=MagicMock(returncode=0, stdout="transactionHash 0xfeed", stderr="")) as sp:
            tx = watch.record_measurement(NODE, ARTIFACT, VERDICT, dry_run=False)
        self.assertEqual(tx, "0xfeed")
        self.assertEqual(sp.call_args[0][0][:2], ["cast", "send"])


class TestLedger(WatchTestCase):
    def submission(self):
        return {"artifact_hash": ARTIFACT}

    def test_the_hash_is_written_only_after_the_verdict_is_recorded(self):
        ledger = Path(os.path.join(self.tmp, ".watched"))
        with patch.object(watch, "fetch_artifact", return_value=os.path.join(self.tmp, "a.tar.gz")), \
             patch.object(watch, "run_verifier", return_value=VERDICT), \
             patch.object(watch, "record_measurement", side_effect=RuntimeError("rpc down")), \
             redirect_stdout(io.StringIO()):
            self.assertFalse(watch.process_one(watch.get_env_vars(), self.submission(), ledger, False))
        self.assertEqual(watch.read_watched(ledger), set())

        with patch.object(watch, "fetch_artifact", return_value=os.path.join(self.tmp, "a.tar.gz")), \
             patch.object(watch, "run_verifier", return_value=VERDICT), \
             patch.object(watch, "record_measurement", return_value="0xtx"), \
             redirect_stdout(io.StringIO()):
            self.assertTrue(watch.process_one(watch.get_env_vars(), self.submission(), ledger, False))
        self.assertEqual(watch.read_watched(ledger), {ARTIFACT})

    def test_a_dry_run_leaves_the_ledger_alone_so_the_real_pass_still_has_work(self):
        ledger = Path(os.path.join(self.tmp, ".watched"))
        with patch.object(watch, "fetch_artifact", return_value=os.path.join(self.tmp, "a.tar.gz")), \
             patch.object(watch, "run_verifier", return_value=VERDICT), \
             patch.object(watch, "record_measurement", return_value=None), \
             redirect_stdout(io.StringIO()):
            watch.process_one(watch.get_env_vars(), self.submission(), ledger, True)
        self.assertEqual(watch.read_watched(ledger), set())

    def test_one_failing_submission_does_not_stop_the_pass(self):
        ledger = Path(os.path.join(self.tmp, ".watched"))
        with patch.object(watch, "fetch_artifact", side_effect=RuntimeError("404")), \
             redirect_stdout(io.StringIO()) as buf:
            self.assertFalse(watch.process_one(watch.get_env_vars(), self.submission(), ledger, False))
        self.assertIn("Error processing submission", buf.getvalue())


class TestOncePass(WatchTestCase):
    def test_once_makes_exactly_one_pass_over_the_pending_list(self):
        detail = {"submissions": [{"artifact_hash": ARTIFACT}], "verdicts": []}
        calls = []
        with patch.object(watch, "node_detail", return_value=detail), \
             patch.object(watch, "process_one", side_effect=lambda *a: calls.append(a) or True), \
             patch.object(sys, "argv", ["watch.py", "--once"]), \
             patch.object(watch.time, "sleep", side_effect=AssertionError("--once must not sleep")), \
             redirect_stdout(io.StringIO()):
            self.assertEqual(watch.main(), 0)
        self.assertEqual(len(calls), 1)

    def test_an_api_outage_does_not_crash_the_watcher(self):
        with patch.object(watch, "node_detail", side_effect=RuntimeError("api down")), \
             patch.object(sys, "argv", ["watch.py", "--once"]), \
             redirect_stdout(io.StringIO()) as buf:
            self.assertEqual(watch.main(), 0)
        self.assertIn("Error in watcher", buf.getvalue())


class TestRootRefusal(WatchTestCase):
    """Running as root over the verifier user's checkout is what made git refuse the worktree, and
    that refusal was recorded on chain as two submissions' FAIL."""

    def test_root_is_refused_before_anything_is_read_or_sent(self):
        with patch.object(watch.os, "geteuid", return_value=0, create=True), \
             patch.object(watch, "node_detail", side_effect=AssertionError("must not poll")), \
             patch.object(sys, "argv", ["watch.py", "--once"]), \
             patch.object(sys, "stderr", io.StringIO()) as err:
            self.assertEqual(watch.main(), 1)
        self.assertIn("Refusing to run as root", err.getvalue())

    def test_an_ordinary_user_runs(self):
        with patch.object(watch.os, "geteuid", return_value=1000, create=True):
            self.assertFalse(watch.refuse_root())


class TestHostReasons(WatchTestCase):
    """A verdict that describes this host must not become a submission's permanent FAIL: the
    contract will not accept a second measurement for the same artifact."""

    def submission(self):
        return {"artifact_hash": ARTIFACT}

    def host_verdict(self, reason):
        return {"cycles": None, "provingMicros": None, "proofSizeBytes": None, "verifyMicros": None,
                "verifierAccepted": False, "reason": reason, "binarySha256": None}

    def test_a_host_reason_records_nothing_and_leaves_the_submission_pending(self):
        ledger = Path(os.path.join(self.tmp, ".watched"))
        for reason in ("worktree", "host-config", "reference-build"):
            with patch.object(watch, "fetch_artifact", return_value=os.path.join(self.tmp, "a.tar.gz")), \
                 patch.object(watch, "run_verifier", return_value=self.host_verdict(reason)), \
                 patch.object(watch, "record_measurement",
                              side_effect=AssertionError(f"{reason} must not be recorded")), \
                 redirect_stdout(io.StringIO()) as buf:
                self.assertFalse(watch.process_one(watch.get_env_vars(), self.submission(), ledger, False))
            self.assertIn("describes this host", buf.getvalue())
            self.assertEqual(watch.read_watched(ledger), set())

    def test_a_verdict_about_the_submission_is_still_recorded(self):
        ledger = Path(os.path.join(self.tmp, ".watched"))
        for reason in ("frozen-path", "regression-provingMicros", "statement-skip", "probe-timeout", ""):
            with patch.object(watch, "fetch_artifact", return_value=os.path.join(self.tmp, "a.tar.gz")), \
                 patch.object(watch, "run_verifier", return_value=dict(VERDICT, reason=reason)), \
                 patch.object(watch, "record_measurement", return_value="0xtx"), \
                 redirect_stdout(io.StringIO()):
                self.assertTrue(watch.process_one(watch.get_env_vars(), self.submission(), ledger, False))
            os.remove(ledger)


if __name__ == "__main__":
    unittest.main(verbosity=2)
