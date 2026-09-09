"""The editable surface is per node, and admitting Rust changes what the host must be.

Node 1 (pq-leanxmss) admits crates/rec_aggregation/guests/ only: zkDSL compiled by the frozen
compiler, so nothing the submitter writes is compiled as Rust. Node 2 (dl-leanvm) admits
crates/lean_compiler/ as well, because sixteen guest-only measurements on 2026-09-09 all returned
exactly 1,542,812 cycles while the arms that edited the compiler moved it.

The second surface is not a preference. `cargo build` and the reference harness's `cargo test` both
run build.rs and proc macros as the invoking user, and on hawk that user holds the verifier key —
so these tests also hold the conditions that make compiling a submitter's Rust something other than
handing them the key.

Run from the repository root: python3.12 verifier/tests/test_surface.py
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

GUESTS = "crates/rec_aggregation/guests/"
COMPILER = "crates/lean_compiler/"
GUEST_DIFF = ["crates/rec_aggregation/guests/aggregate.py"]
COMPILER_DIFF = ["crates/lean_compiler/src/cse.rs"]


class SurfaceTestCase(unittest.TestCase):
    def setUp(self):
        self._saved = {k: os.environ.get(k) for k in
                       ("EDITABLE", "BUILD_USER", "ALLOW_UNSANDBOXED_BUILD", "VERIFIER_KEY_FILE")}
        for k in self._saved:
            os.environ.pop(k, None)

    def tearDown(self):
        for k, v in self._saved.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v


class TestPerNodeSurface(SurfaceTestCase):
    def test_a_compiler_diff_is_accepted_when_editable_includes_the_compiler(self):
        os.environ["EDITABLE"] = f"{GUESTS},{COMPILER}"
        self.assertEqual(run.validate_paths(COMPILER_DIFF), (True, ""))
        self.assertEqual(run.validate_paths(GUEST_DIFF), (True, ""))

    def test_a_compiler_diff_is_rejected_when_it_does_not(self):
        os.environ["EDITABLE"] = GUESTS
        self.assertEqual(run.validate_paths(COMPILER_DIFF), (False, "frozen-path"))
        self.assertEqual(run.validate_paths(GUEST_DIFF), (True, ""))

    def test_the_default_is_node_ones_surface(self):
        self.assertEqual(run.editable_prefixes(), (GUESTS,))
        self.assertEqual(run.validate_paths(COMPILER_DIFF), (False, "frozen-path"))

    def test_the_list_takes_commas_or_spaces_and_ignores_the_gaps(self):
        os.environ["EDITABLE"] = f" {GUESTS} , {COMPILER} ,"
        self.assertEqual(run.editable_prefixes(), (GUESTS, COMPILER))

    def test_an_empty_value_falls_back_to_the_default_rather_than_to_everything(self):
        os.environ["EDITABLE"] = "   "
        self.assertEqual(run.editable_prefixes(), (GUESTS,))
        self.assertEqual(run.validate_paths(["Cargo.toml"]), (False, "frozen-path"))

    def test_nothing_outside_the_named_surface_gets_in_either_way(self):
        os.environ["EDITABLE"] = f"{GUESTS},{COMPILER}"
        for outside in ("crates/lean_vm/src/lib.rs", "python-verifier/verifier.py", "Cargo.lock",
                        "crates/rec_aggregation/build.rs"):
            self.assertEqual(run.validate_paths([outside]), (False, "frozen-path"), outside)

    def test_the_hint_names_this_nodes_surface(self):
        os.environ["EDITABLE"] = f"{GUESTS},{COMPILER}"
        self.assertIn("lean_compiler", run.frozen_hint())


class TestSurfaceAdmitsRust(SurfaceTestCase):
    def test_the_guest_directory_alone_admits_none(self):
        self.assertFalse(run.surface_admits_rust((GUESTS,)))

    def test_anything_else_is_treated_as_compilable(self):
        for prefix in (COMPILER, "crates/", "", "crates/rec_aggregation/"):
            self.assertTrue(run.surface_admits_rust((prefix,)), prefix)


class TestBuildCommand(SurfaceTestCase):
    def test_a_guest_only_build_is_left_exactly_as_it_was(self):
        os.environ["EDITABLE"] = GUESTS
        self.assertEqual(run.cargo_flags(), [])
        self.assertEqual(run.cargo_prefix(), [])

    def test_a_compiler_build_is_offline_and_locked(self):
        os.environ["EDITABLE"] = f"{GUESTS},{COMPILER}"
        self.assertEqual(run.cargo_flags(), ["--offline", "--locked"])

    def test_a_build_user_runs_cargo_as_that_user(self):
        os.environ["BUILD_USER"] = "builder"
        self.assertEqual(run.cargo_prefix(), ["sudo", "-n", "-u", "builder"])

    def test_the_measurement_runs_as_the_build_user_as_well(self):
        """Compiling as another user and then executing the result as this one closes half the
        door. The numbers are unaffected: every one of them is parsed from the binary's own printed
        report, not from a clock wrapped around the subprocess."""
        os.environ["BUILD_USER"] = "builder"
        self.assertEqual(run.pinned_command("/tmp/wt")[:4], ["sudo", "-n", "-u", "builder"])


class TestBuildIsolation(SurfaceTestCase):
    """Compiling a submitter's Rust as the user holding VERIFIER_PRIVATE_KEY hands them the key.
    The check is of the system, not of a flag: can the user that will run cargo read the key?"""

    def test_a_guest_only_surface_needs_no_isolation(self):
        os.environ["EDITABLE"] = GUESTS
        self.assertEqual(run.build_isolation_reason(), "")

    def test_a_compiler_surface_with_no_build_user_is_refused(self):
        os.environ["EDITABLE"] = f"{GUESTS},{COMPILER}"
        self.assertEqual(run.build_isolation_reason(), "host-config")

    def test_a_build_user_that_can_read_the_key_is_not_isolation(self):
        os.environ.update({"EDITABLE": f"{GUESTS},{COMPILER}", "BUILD_USER": "builder",
                           "VERIFIER_KEY_FILE": "/home/verifier/.key"})
        with patch.object(run.subprocess, "run") as sp:      # `sudo -n -u builder test -r <key>`
            sp.return_value.returncode = 0                    # ... succeeds: it can read it
            self.assertEqual(run.build_isolation_reason(), "host-config")

    def test_a_build_user_that_cannot_read_the_key_is(self):
        os.environ.update({"EDITABLE": f"{GUESTS},{COMPILER}", "BUILD_USER": "builder",
                           "VERIFIER_KEY_FILE": "/home/verifier/.key"})
        with patch.object(run.subprocess, "run") as sp:
            sp.return_value.returncode = 1                    # cannot read it
            self.assertEqual(run.build_isolation_reason(), "")
        self.assertEqual(sp.call_args[0][0][:4], ["sudo", "-n", "-u", "builder"])

    def test_with_no_key_path_to_check_nothing_is_established_so_it_is_refused(self):
        os.environ.update({"EDITABLE": f"{GUESTS},{COMPILER}", "BUILD_USER": "builder"})
        self.assertEqual(run.build_isolation_reason(), "host-config")

    def test_the_risk_can_be_accepted_but_only_by_saying_so(self):
        os.environ.update({"EDITABLE": f"{GUESTS},{COMPILER}", "ALLOW_UNSANDBOXED_BUILD": "1"})
        with patch.object(sys, "stderr", io.StringIO()) as err:
            self.assertEqual(run.build_isolation_reason(), "")
        self.assertIn("build.rs", err.getvalue())

    def test_a_refused_host_measures_nothing_and_blames_nobody(self):
        os.environ["EDITABLE"] = f"{GUESTS},{COMPILER}"
        buf = io.StringIO()
        with patch.object(sys, "argv", ["run.py", "a.tar.gz"]), \
             patch.object(run, "extract_tarball", side_effect=AssertionError("must not extract")), \
             patch.object(sys, "stderr", io.StringIO()), redirect_stdout(buf):
            run.main()
        v = json.loads(buf.getvalue())
        self.assertEqual(v["reason"], "host-config")
        self.assertFalse(v["verifierAccepted"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
