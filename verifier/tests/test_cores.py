"""Measurement procedure: which cores, and the baseline the verifier measures for itself.

The rehearsal of 2026-09-09 is the reason this file exists. A correct submission came back
`regression-provingMicros` at 3,737,000 µs against a 1,433,000 µs bound because run.py pinned
`taskset -c 0-7` while the node's recorded baseline had been measured on all 26 cores. Nothing was
wrong with the submission, the contract or the bound — the two numbers were made on different
machines, in effect.

Run from the repository root: python3.12 verifier/tests/test_cores.py
"""
import io
import json
import os
import sys
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch

sys.path.append(os.path.dirname(os.path.abspath(__file__)) + "/..")
import run  # noqa: E402


def measurement(proving, cycles=1542812, proof=302592, verify=30100):
    return {"cycles": cycles, "provingMicros": proving, "proofSizeBytes": proof,
            "verifyMicros": verify}


class TestCores(unittest.TestCase):
    def setUp(self):
        for var in ("VERIFIER_CORES", "VERIFIER_CPUS"):
            os.environ.pop(var, None)

    tearDown = setUp

    def test_nothing_is_pinned_unless_the_host_asks(self):
        cmd = run.pinned_command("/tmp/wt")
        self.assertNotIn("taskset", cmd)
        self.assertTrue(cmd[0].endswith("leanvm") or cmd[0].endswith("leanvm-b"), cmd)

    def test_verifier_cores_pins_exactly_what_it_says(self):
        os.environ["VERIFIER_CORES"] = "0-7"
        cmd = run.pinned_command("/tmp/wt")
        self.assertEqual(cmd[:3], ["taskset", "-c", "0-7"])

    def test_the_old_name_still_works_when_it_is_set_on_purpose(self):
        os.environ["VERIFIER_CPUS"] = "2-3"
        self.assertEqual(run.pinned_command("/tmp/wt")[:3], ["taskset", "-c", "2-3"])

    def test_the_new_name_wins_over_the_old_one(self):
        os.environ["VERIFIER_CPUS"] = "2-3"
        os.environ["VERIFIER_CORES"] = "0-25"
        self.assertEqual(run.pinned_command("/tmp/wt")[2], "0-25")

    def test_whitespace_is_not_a_core_list(self):
        os.environ["VERIFIER_CORES"] = "   "
        self.assertNotIn("taskset", run.pinned_command("/tmp/wt"))

    def test_the_measurement_and_the_probe_run_on_the_same_cores(self):
        """A probe that is pinned differently from the measurement would compare two machines."""
        os.environ["VERIFIER_CORES"] = "0-7"
        with patch.object(run.subprocess, "run") as sp:
            sp.return_value.returncode = 1
            run.run_with_corrupt_index("/tmp/wt", 0)
        self.assertEqual(sp.call_args[0][0][:3], ["taskset", "-c", "0-7"])


class TestBaselineSummary(unittest.TestCase):
    def test_the_spread_is_the_range_of_the_runs_over_their_mean(self):
        summary, reason = run.summarise_baseline(
            [measurement(1000000), measurement(1100000), measurement(1050000)]
        )
        self.assertEqual(reason, "")
        self.assertEqual(summary["provingMicros"], 1050000)
        # range 100000 over mean 1050000 = 952.4 bps, rounded up
        self.assertEqual(summary["spreadBps"], 953)
        self.assertEqual(summary["runs"], 3)

    def test_three_identical_runs_have_no_spread(self):
        summary, _ = run.summarise_baseline([measurement(1000000)] * 3)
        self.assertEqual(summary["spreadBps"], 0)

    def test_cycles_that_disagree_are_a_reason_not_an_average(self):
        summary, reason = run.summarise_baseline([measurement(1000000), measurement(1000000, cycles=7)])
        self.assertIsNone(summary)
        self.assertEqual(reason, "nondeterministic-cycles")

    def test_the_bound_it_produces_admits_the_slowest_run_it_saw(self):
        runs = [measurement(1000000), measurement(1100000), measurement(1050000)]
        summary, _ = run.summarise_baseline(runs)
        allowed = summary["provingMicros"] * (10000 + summary["spreadBps"]) // 10000
        self.assertGreaterEqual(allowed, max(m["provingMicros"] for m in runs))

    def test_proof_size_takes_the_largest_because_it_has_no_allowance(self):
        summary, _ = run.summarise_baseline([measurement(1000000, proof=300000),
                                             measurement(1000000, proof=302592)])
        self.assertEqual(summary["proofSizeBytes"], 302592)

    def test_no_runs_is_a_reason_rather_than_a_division(self):
        self.assertEqual(run.summarise_baseline([])[1], "parse")


class TestBaselineCommand(unittest.TestCase):
    def test_it_prints_the_contract_call_with_the_key_left_in_the_environment(self):
        os.environ["ETHPLANE_ADDRESS"] = "0xcontract"
        os.environ["NODE_ID"] = "0xnode"
        try:
            line = run.record_baseline_command(
                {"cycles": 1, "provingMicros": 2, "proofSizeBytes": 3, "verifyMicros": 4, "spreadBps": 5}
            )
        finally:
            del os.environ["ETHPLANE_ADDRESS"], os.environ["NODE_ID"]
        self.assertIn("recordBaseline(bytes32,uint256,uint256,uint256,uint256,uint16)", line)
        self.assertIn("cast send 0xcontract", line)
        self.assertIn("0xnode 1 2 3 4 5", line)
        self.assertIn('"$(cat $VERIFIER_KEY_FILE)"', line)

    def test_it_falls_back_to_the_variable_names_so_the_line_is_still_runnable(self):
        for var in ("ETHPLANE_ADDRESS", "NODE_ID", "SEPOLIA_RPC_URL"):
            os.environ.pop(var, None)
        line = run.record_baseline_command(
            {"cycles": 1, "provingMicros": 2, "proofSizeBytes": 3, "verifyMicros": 4, "spreadBps": 5}
        )
        self.assertIn("$ETHPLANE_ADDRESS", line)
        self.assertIn("$NODE_ID", line)


class TestMissingReference(unittest.TestCase):
    """LEANVM_REF pointing at nothing is the host's problem, and it must arrive as a reason."""

    def test_a_missing_checkout_is_host_config_not_an_exception(self):
        self.assertEqual(run.make_worktree("/nowhere/at/all", "/tmp/wt"), (False, "host-config"))

    def test_the_baseline_says_so_and_exits(self):
        buf = io.StringIO()
        with redirect_stdout(buf):
            self.assertEqual(run.run_baseline("/nowhere/at/all"), 1)
        answer = json.loads(buf.getvalue())
        self.assertEqual(answer["error"], "host-config")
        self.assertIn("LEANVM_REF", answer["detail"])


class TestRootGuard(unittest.TestCase):
    """Running as root over another user's checkout is what produced `worktree` verdicts on two
    innocent artifacts. run.py answers with a verdict about the HOST instead."""

    def test_a_run_as_root_is_host_config_and_measures_nothing(self):
        buf = io.StringIO()
        with patch.object(run.os, "geteuid", return_value=0, create=True), \
             patch.object(sys, "argv", ["run.py", "a.tar.gz"]), \
             patch.object(run, "extract_tarball", side_effect=AssertionError("must not extract")), \
             redirect_stdout(buf):
            run.main()
        v = json.loads(buf.getvalue())
        self.assertEqual(v["reason"], "host-config")
        self.assertFalse(v["verifierAccepted"])

    def test_the_baseline_refuses_root_too(self):
        buf = io.StringIO()
        with patch.object(run.os, "geteuid", return_value=0, create=True), \
             patch.object(run, "make_worktree", side_effect=AssertionError("must not touch git")), \
             redirect_stdout(buf):
            self.assertEqual(run.run_baseline("/home/ubuntu/leanVM"), 1)
        self.assertEqual(json.loads(buf.getvalue())["error"], "host-config")

    def test_an_ordinary_user_is_not_refused(self):
        with patch.object(run.os, "geteuid", return_value=1000, create=True):
            self.assertFalse(run.running_as_root())


if __name__ == "__main__":
    unittest.main(verbosity=2)
