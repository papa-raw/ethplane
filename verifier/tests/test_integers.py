"""Every number that reaches the chain is a whole number.

2026-09-09: a submission was measured, judged and then not recorded, because "1.5 s" had become
1500000.0 microseconds and cast answered `parser error: 1500000.0 expected at most 0 decimals`.
recordMeasurement takes uint256; a float is not a rounding question, it is a verdict that cannot be
told. These tests hold the property at all three places it can be lost: the parser, the verdict, and
the argument list.

Run from the repository root: python3.12 verifier/tests/test_integers.py
"""
import os
import sys
import unittest

sys.path.append(os.path.dirname(os.path.abspath(__file__)) + "/..")
import run  # noqa: E402
import watch  # noqa: E402
from parse import parse_output  # noqa: E402

OUTPUT = """
Benchmarking aggregate (XMSS):
  cycles (VM steps): 1,542,812
  proving time: 1.5 s ± 1.9%
  proof size: 295.1 KiB
  verifying: 0.0435 s
"""


class TestParser(unittest.TestCase):
    def test_every_field_is_an_int(self):
        parsed = parse_output(OUTPUT)
        for key, value in parsed.items():
            self.assertIsInstance(value, int, f"{key} = {value!r}")
            self.assertNotIn(".", str(value))

    def test_the_numbers_are_the_rehearsals_own(self):
        parsed = parse_output(OUTPUT)
        self.assertEqual(parsed["cycles"], 1542812)
        self.assertEqual(parsed["provingMicros"], 1500000)
        self.assertEqual(parsed["verifyMicros"], 43500)

    def test_a_fractional_microsecond_rounds_rather_than_truncates(self):
        # 0.6 µs is a microsecond, not zero; int() would have thrown it away. (An exact .5 goes to
        # even, which is Python's round and is nobody's problem at this scale.)
        parsed = parse_output("  proving time: 0.0000006 s ± 0.1%\n  verifying: 0.0000004 s\n")
        self.assertEqual(parsed["provingMicros"], 1)
        self.assertEqual(parsed["verifyMicros"], 0)

    def test_missing_fields_are_still_none_not_zero(self):
        parsed = parse_output("nothing here")
        self.assertEqual(set(parsed.values()), {None})


class TestVerdict(unittest.TestCase):
    def test_a_float_that_reaches_the_verdict_is_made_whole(self):
        v = run.verdict(cycles=1542812, provingMicros=1500000.0, proofSizeBytes=302182.0,
                        verifyMicros=43500.0, verifier_accepted=False, reason="regression-provingMicros")
        for key in ("cycles", "provingMicros", "proofSizeBytes", "verifyMicros"):
            self.assertIsInstance(v[key], int, key)
        self.assertNotIn(".", json_numbers(v))

    def test_an_empty_verdict_keeps_its_nulls(self):
        v = run.verdict(reason="frozen-path")
        self.assertIsNone(v["cycles"])
        self.assertIsNone(v["provingMicros"])


def json_numbers(verdict) -> str:
    import json
    return json.dumps({k: verdict[k] for k in ("cycles", "provingMicros", "proofSizeBytes", "verifyMicros")})


class TestMeasurementArguments(unittest.TestCase):
    """The list cast actually parses."""

    def args(self, **over):
        verdict = {"cycles": 1542812, "provingMicros": 1500000.0, "proofSizeBytes": 302182,
                   "verifyMicros": 43500.0, "verifierAccepted": False, "reason": "x"}
        verdict.update(over)
        return watch.measurement_args("0x" + "12" * 32, "0x" + "cd" * 32, verdict)

    def test_no_argument_contains_a_decimal_point(self):
        for arg in self.args():
            self.assertNotIn(".", arg, f"cast refuses this: {arg}")

    def test_the_floats_are_the_same_numbers_afterwards(self):
        args = self.args()
        self.assertEqual(args[3], "1500000")
        self.assertEqual(args[5], "43500")

    def test_a_verdict_with_no_measurement_sends_zeroes_not_none(self):
        args = self.args(cycles=None, provingMicros=None, proofSizeBytes=None, verifyMicros=None)
        self.assertEqual(args[2:6], ["0", "0", "0", "0"])
        for arg in args:
            self.assertNotIn(".", arg)

    def test_a_string_number_from_a_hand_edited_verdict_is_still_whole(self):
        args = self.args(provingMicros="1500000.0")
        self.assertEqual(args[3], "1500000")


class TestLedgerPath(unittest.TestCase):
    def test_the_ledger_lives_in_the_users_home_not_the_working_directory(self):
        self.assertTrue(watch.WATCHED_FILE.startswith(os.path.expanduser("~")), watch.WATCHED_FILE)
        self.assertEqual(os.path.basename(watch.WATCHED_FILE), ".ethplane-watched")

    def test_watched_file_overrides_it(self):
        import importlib
        os.environ["WATCHED_FILE"] = "/tmp/somewhere-else"
        try:
            importlib.reload(watch)
            self.assertEqual(watch.WATCHED_FILE, "/tmp/somewhere-else")
        finally:
            del os.environ["WATCHED_FILE"]
            importlib.reload(watch)


if __name__ == "__main__":
    unittest.main(verbosity=2)
