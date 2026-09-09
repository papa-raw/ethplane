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

    def test_the_measurement_itself_is_never_run_as_the_build_user(self):
        os.environ["BUILD_USER"] = "lean-build"
        self.assertNotIn("sudo", run.pinned_command("/tmp/wt"))


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
