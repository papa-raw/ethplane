"""Sharing a worktree with the build user, and calling cargo as it.

The build user cannot read the verifier's key — that is the whole point — which also means it cannot
traverse a temp directory the verifier user created (0700) or use the verifier's toolchain. So two
things have to be true before a build as that user can work at all: the worktree carries a group
both users are in, with setgid and group write, and cargo is invoked with a CARGO_HOME and
RUSTUP_HOME the build user can read. Neither is a preference; getting either wrong turns into a
permission error that would read as `build`, a verdict against a submission for something the host
did.

Run from the repository root: python3.12 verifier/tests/test_build_user.py
"""
import grp
import io
import json
import os
import stat
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch

sys.path.append(os.path.dirname(os.path.abspath(__file__)) + "/..")
import run  # noqa: E402

OWN_GROUP = grp.getgrgid(os.getgid()).gr_name


class BuildUserTestCase(unittest.TestCase):
    def setUp(self):
        self._saved = {k: os.environ.get(k) for k in
                       ("BUILD_USER", "BUILD_GROUP", "BUILD_CARGO_HOME", "BUILD_RUSTUP_HOME", "EDITABLE")}
        for k in self._saved:
            os.environ.pop(k, None)
        self.tmp = tempfile.mkdtemp()

    def tearDown(self):
        for k, v in self._saved.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
        import shutil
        shutil.rmtree(self.tmp, ignore_errors=True)

    def mode(self, path):
        return stat.S_IMODE(os.stat(path).st_mode)


class TestSharing(BuildUserTestCase):
    def test_without_a_build_user_the_directory_is_left_alone(self):
        before = self.mode(self.tmp)
        self.assertEqual(run.share_with_build_user(self.tmp), (True, ""))
        self.assertEqual(self.mode(self.tmp), before)

    def test_with_a_build_user_the_directory_becomes_setgid_and_group_writable(self):
        os.environ.update({"BUILD_USER": "lean-build", "BUILD_GROUP": OWN_GROUP})
        self.assertEqual(run.share_with_build_user(self.tmp), (True, ""))
        self.assertEqual(self.mode(self.tmp), 0o2770)
        self.assertTrue(self.mode(self.tmp) & stat.S_ISGID, "setgid carries the group down to target/")
        self.assertTrue(self.mode(self.tmp) & stat.S_IWGRP, "cargo has to create target/ in here")

    def test_a_directory_shared_this_way_is_still_closed_to_everyone_else(self):
        os.environ.update({"BUILD_USER": "lean-build", "BUILD_GROUP": OWN_GROUP})
        run.share_with_build_user(self.tmp)
        self.assertEqual(self.mode(self.tmp) & 0o007, 0, "no access for anyone outside the group")

    def test_a_group_that_does_not_exist_is_host_config_not_an_exception(self):
        os.environ.update({"BUILD_USER": "lean-build", "BUILD_GROUP": "no-such-group-here"})
        self.assertEqual(run.share_with_build_user(self.tmp), (False, "host-config"))

    def test_a_directory_that_is_not_ours_is_host_config_too(self):
        os.environ.update({"BUILD_USER": "lean-build", "BUILD_GROUP": OWN_GROUP})
        self.assertEqual(run.share_with_build_user("/usr/bin"), (False, "host-config"))

    def test_the_group_defaults_to_the_build_users_own_name(self):
        os.environ["BUILD_USER"] = "lean-build"
        self.assertEqual(run.build_group(), "lean-build")
        os.environ["BUILD_GROUP"] = "shared"
        self.assertEqual(run.build_group(), "shared")


class TestCargoInvocation(BuildUserTestCase):
    def test_no_build_user_means_no_sudo(self):
        self.assertEqual(run.cargo_prefix(), [])

    def test_a_build_user_alone_is_a_bare_sudo(self):
        os.environ["BUILD_USER"] = "lean-build"
        self.assertEqual(run.cargo_prefix(), ["sudo", "-n", "-u", "lean-build"])

    def test_the_toolchain_paths_are_passed_because_sudo_clears_the_environment(self):
        os.environ.update({"BUILD_USER": "lean-build", "BUILD_CARGO_HOME": "/var/cache/lean-cargo",
                           "BUILD_RUSTUP_HOME": "/var/lib/lean-rustup"})
        prefix = run.cargo_prefix()
        self.assertEqual(prefix[:5], ["sudo", "-n", "-u", "lean-build", "env"])
        self.assertIn("CARGO_HOME=/var/cache/lean-cargo", prefix)
        self.assertIn("RUSTUP_HOME=/var/lib/lean-rustup", prefix)
        self.assertIn("PATH=/var/cache/lean-cargo/bin:/usr/local/bin:/usr/bin:/bin", prefix)

    def test_the_whole_build_command_is_what_the_host_script_verified(self):
        os.environ.update({"BUILD_USER": "lean-build", "BUILD_CARGO_HOME": "/var/cache/lean-cargo",
                           "BUILD_RUSTUP_HOME": "/var/lib/lean-rustup",
                           "EDITABLE": "crates/rec_aggregation/guests/,crates/lean_compiler/"})
        command = run.cargo_prefix() + ["cargo", "build", "--release"] + run.cargo_flags()
        self.assertEqual(command[:4], ["sudo", "-n", "-u", "lean-build"])
        self.assertEqual(command[-5:], ["cargo", "build", "--release", "--offline", "--locked"])

    def test_the_measurement_runs_as_the_build_user_too(self):
        """This assertion used to say the opposite, and it was wrong: building as another user
        closes compile-time execution and leaves run time open, and the binary the submitter's
        compiler produced is still their program."""
        os.environ["BUILD_USER"] = "lean-build"
        self.assertEqual(run.pinned_command("/tmp/wt")[:4], ["sudo", "-n", "-u", "lean-build"])


class TestRunningTheBinary(BuildUserTestCase):
    """Half a door is not a door. `cargo build` as lean-build stops build.rs and proc macros; the
    binary it produces is still a program the submitter wrote, and running it as the key holder is
    the same compromise a few seconds later."""

    def test_no_build_user_leaves_the_command_exactly_as_it_was(self):
        cmd = run.pinned_command("/tmp/wt")
        self.assertNotIn("sudo", cmd)
        self.assertTrue(cmd[0].endswith("leanvm") or cmd[0].endswith("leanvm-b"), cmd)

    def test_the_measurement_command_carries_the_prefix(self):
        os.environ["BUILD_USER"] = "lean-build"
        cmd = run.pinned_command("/tmp/wt")
        self.assertEqual(cmd[:4], ["sudo", "-n", "-u", "lean-build"])
        self.assertIn("--xmss", cmd)

    def test_the_probe_command_carries_it_and_the_corrupt_index_with_it(self):
        os.environ["BUILD_USER"] = "lean-build"
        with patch.object(run.subprocess, "run") as sp:
            sp.return_value.returncode = 1
            run.run_with_corrupt_index("/tmp/wt", 42)
        cmd = sp.call_args[0][0]
        self.assertEqual(cmd[:4], ["sudo", "-n", "-u", "lean-build"])
        self.assertIn("env", cmd)
        self.assertIn("ETHPLANE_CORRUPT_INDEX=42", cmd)

    def test_without_a_build_user_the_probe_passes_the_index_the_ordinary_way(self):
        with patch.object(run.subprocess, "run") as sp:
            sp.return_value.returncode = 1
            run.run_with_corrupt_index("/tmp/wt", 7)
        self.assertNotIn("sudo", sp.call_args[0][0])
        self.assertEqual(sp.call_args[1]["env"]["ETHPLANE_CORRUPT_INDEX"], "7")

    def test_the_index_survives_sudo_because_sudo_discards_the_environment(self):
        """Without `env ETHPLANE_CORRUPT_INDEX=i` in the command line the probe binary would run
        clean, the reference leg would not fail, and every probe would come back probe-invalid."""
        os.environ["BUILD_USER"] = "lean-build"
        cmd = run.pinned_command("/tmp/wt", {"ETHPLANE_CORRUPT_INDEX": "899"})
        self.assertEqual(cmd[4], "env")
        self.assertEqual(cmd[5], "ETHPLANE_CORRUPT_INDEX=899")

    def test_sudo_and_taskset_compose_in_that_order(self):
        os.environ.update({"BUILD_USER": "lean-build", "VERIFIER_CORES": "0-7"})
        try:
            cmd = run.pinned_command("/tmp/wt")
            self.assertEqual(cmd[:4], ["sudo", "-n", "-u", "lean-build"])
            self.assertEqual(cmd[4:7], ["taskset", "-c", "0-7"])
        finally:
            os.environ.pop("VERIFIER_CORES", None)

    def test_reading_the_binary_stays_this_users_job(self):
        """Reading a file is safe; executing it is not. get_binary_hash is the verifier's own read,
        and the stale-binary comparison depends on it being the same process that built nothing."""
        import inspect
        source = inspect.getsource(run.get_binary_hash)
        self.assertNotIn("sudo", source)
        self.assertNotIn("run_prefix", source)


class TestVerdictWhenSharingFails(BuildUserTestCase):
    def test_a_worktree_that_cannot_be_shared_is_the_hosts_fault(self):
        os.environ.update({"BUILD_USER": "lean-build", "BUILD_GROUP": "no-such-group-here"})
        buf = io.StringIO()
        with patch.object(sys, "argv", ["run.py", "a.tar.gz"]), \
             patch.object(run, "extract_tarball", side_effect=AssertionError("must not extract")), \
             patch.object(sys, "stderr", io.StringIO()), redirect_stdout(buf):
            run.main()
        v = json.loads(buf.getvalue())
        self.assertEqual(v["reason"], "host-config")
        self.assertFalse(v["verifierAccepted"])

    def test_the_baseline_says_the_same_thing(self):
        os.environ.update({"BUILD_USER": "lean-build", "BUILD_GROUP": "no-such-group-here"})
        buf = io.StringIO()
        with patch.object(run, "make_worktree", side_effect=AssertionError("must not touch git")), \
             redirect_stdout(buf):
            self.assertEqual(run.run_baseline(self.tmp), 1)
        self.assertEqual(json.loads(buf.getvalue())["error"], "host-config")


if __name__ == "__main__":
    unittest.main(verbosity=2)
