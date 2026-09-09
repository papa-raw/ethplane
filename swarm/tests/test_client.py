"""What the client must get right, in the terms the chain and the verifier will judge it by.

Run from the repository root: python3.12 swarm/tests/test_client.py
"""
import hashlib
import io
import json
import os
import subprocess
import sys
import tarfile
import tempfile
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch, MagicMock

ROOT = os.path.dirname(os.path.abspath(__file__)) + "/../.."
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "verifier"))

from swarm import client  # noqa: E402
from run import validate_paths  # noqa: E402  (the verifier's own frozen-path rule)

KEY = "0x" + "ab" * 32
NODE = "0x" + "12" * 32
HEAD = "0x" + "cd" * 32


class ClientTestCase(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.key_file = os.path.join(self.tmp, "lineage.key")
        with open(self.key_file, "w") as f:
            f.write(KEY + "\n")
        self.env = {
            "LINEAGE_KEY_FILE": self.key_file,
            "LINEAGE_NAME": "qwen-a",
            "OPERATOR_ADDRESS": "0x" + "34" * 20,
            "ETHPLANE_ADDRESS": "0x" + "56" * 20,
            "SEPOLIA_RPC_URL": "https://sepolia.example/rpc",
            "API_BASE": "https://ethplane.example",
            "NODE_ID": NODE,
            "WORKTREE": self.tmp,
            "EDITABLE": "crates/rec_aggregation/guests/",
            "SESSION_STATE_DIR": os.path.join(self.tmp, "state"),
        }
        self._saved = {k: os.environ.get(k) for k in self.env}
        os.environ.update(self.env)
        client.SESSION_STATE_DIR = self.env["SESSION_STATE_DIR"]

    def tearDown(self):
        for k, v in self._saved.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
        import shutil
        shutil.rmtree(self.tmp, ignore_errors=True)


class TestEnvironment(ClientTestCase):
    def test_each_command_asks_only_for_what_it_needs(self):
        os.environ.pop("LINEAGE_KEY_FILE")
        os.environ.pop("WORKTREE")
        client.get_env_vars("status")  # a read does not need a key or a worktree
        with self.assertRaises(ValueError):
            client.get_env_vars("submit")

    def test_a_missing_variable_is_an_error_not_a_default(self):
        os.environ.pop("ETHPLANE_ADDRESS")
        with self.assertRaises(ValueError) as e:
            client.get_env_vars("claim")
        self.assertIn("ETHPLANE_ADDRESS", str(e.exception))


class TestWallet(ClientTestCase):
    def test_the_key_is_read_for_the_command_and_never_for_the_transcript(self):
        args, printable = client.wallet_args("LINEAGE")
        self.assertEqual(args, ["--private-key", KEY])
        self.assertNotIn(KEY, " ".join(printable))
        self.assertIn("$LINEAGE_KEY_FILE", " ".join(printable))

    def test_a_keystore_keeps_key_material_out_of_the_argument_list_entirely(self):
        os.environ["LINEAGE_KEYSTORE"] = "/keys/qwen-a.json"
        os.environ["LINEAGE_KEYSTORE_PASSWORD_FILE"] = "/keys/qwen-a.pw"
        try:
            args, printable = client.wallet_args("LINEAGE")
            self.assertEqual(args, ["--keystore", "/keys/qwen-a.json", "--password-file", "/keys/qwen-a.pw"])
            self.assertEqual(args, printable)
        finally:
            del os.environ["LINEAGE_KEYSTORE"], os.environ["LINEAGE_KEYSTORE_PASSWORD_FILE"]

    def test_an_empty_or_missing_key_file_stops_the_command(self):
        open(self.key_file, "w").close()
        with self.assertRaises(ValueError):
            client.wallet_args("LINEAGE")
        os.environ["LINEAGE_KEY_FILE"] = "/nowhere/at/all"
        with self.assertRaises(ValueError):
            client.wallet_args("LINEAGE")

    def test_an_error_from_cast_cannot_carry_the_key_back_out(self):
        self.assertEqual(client.redact(f"bad key {KEY}", ["--private-key", KEY]), "bad key <private key>")


class TestKeccak(ClientTestCase):
    def test_the_group_name_comes_from_cast_not_from_whatever_hash_is_available(self):
        with patch.object(client.subprocess, "run",
                          return_value=MagicMock(returncode=0, stdout="0xdead\n", stderr="")) as sp:
            self.assertEqual(client.keccak("qwen-a"), "0xdead")
        self.assertEqual(sp.call_args[0][0], ["cast", "keccak", "qwen-a"])

    def test_it_is_not_sha256(self):
        with patch.object(client.subprocess, "run",
                          return_value=MagicMock(returncode=0, stdout="0xdead\n", stderr="")):
            self.assertNotEqual(client.keccak("qwen-a"), "0x" + hashlib.sha256(b"qwen-a").hexdigest())


class TestDryRunLines(ClientTestCase):
    def line(self, fn, *a, **kw):
        buf = io.StringIO()
        with redirect_stdout(buf):
            fn(*a, **kw)
        return buf.getvalue()

    def test_register_prints_the_call_with_the_keccak_group_name(self):
        with patch.object(client, "keccak", return_value="0xgroup"):
            out = self.line(client.register_subcommand, dry_run=True)
        self.assertIn("registerLineage(address,bytes32)", out)
        self.assertIn("0xgroup", out)
        self.assertNotIn(KEY, out)

    def test_claim_defaults_to_the_zero_head(self):
        out = self.line(client.claim_subcommand, None, dry_run=True)
        self.assertIn("claim(bytes32,bytes32)", out)
        self.assertIn(client.ZERO_HASH, out)
        self.assertNotIn(KEY, out)

    def test_heartbeat_loop_says_how_often_without_sending_anything(self):
        os.environ["HEARTBEAT_SECONDS"] = "45"
        with patch.object(client.subprocess, "run", side_effect=AssertionError("dry run must not send")):
            out = self.line(client.heartbeat_subcommand, dry_run=True, loop=True)
        self.assertIn("every 45s", out)
        self.assertIn("heartbeat(bytes32)", out)

    def test_no_printed_line_ever_contains_key_material(self):
        with patch.object(client, "keccak", return_value="0xgroup"):
            printed = "".join([
                self.line(client.register_subcommand, dry_run=True),
                self.line(client.claim_subcommand, HEAD, dry_run=True),
                self.line(client.heartbeat_subcommand, dry_run=True),
            ])
        self.assertNotIn(KEY, printed)
        self.assertEqual(printed.count("$LINEAGE_KEY_FILE"), 3)


class TestForfeit(ClientTestCase):
    def test_it_names_the_lineage_whose_session_lapsed(self):
        os.environ["OPERATOR_KEY_FILE"] = self.key_file
        buf = io.StringIO()
        with redirect_stdout(buf):
            client.forfeit_subcommand("0x" + "78" * 20, dry_run=True)
        out = buf.getvalue()
        self.assertIn("forfeit(bytes32,address)", out)
        self.assertIn("0x" + "78" * 20, out)
        self.assertNotIn(KEY, out)

    def test_it_refuses_to_guess_which_session(self):
        os.environ["OPERATOR_KEY_FILE"] = self.key_file
        with self.assertRaises(ValueError):
            client.forfeit_subcommand(None, dry_run=True)


class TestSessionState(ClientTestCase):
    def test_claim_records_the_head_it_started_from(self):
        with patch.object(client, "cast_send", return_value="0xtx"):
            client.claim_subcommand(HEAD, dry_run=False)
        self.assertEqual(client.read_session(NODE)["fromHash"], HEAD)

    def test_submit_defaults_its_parents_to_that_head(self):
        with patch.object(client, "cast_send", return_value="0xtx"):
            client.claim_subcommand(HEAD, dry_run=False)
        seen = {}
        with patch.object(client, "build_artifact", return_value=("/tmp/a.tar.gz", "0xhash")), \
             patch.object(client, "post_artifact"), \
             patch.object(client, "cast_send", side_effect=lambda a, p, d: seen.setdefault("call", a)):
            client.submit_subcommand(None, dry_run=False)
        self.assertIn(f"[{HEAD}]", seen["call"])

    def test_a_session_started_from_nothing_submits_no_parents(self):
        with patch.object(client, "cast_send", return_value="0xtx"):
            client.claim_subcommand(None, dry_run=False)
        seen = {}
        with patch.object(client, "build_artifact", return_value=("/tmp/a.tar.gz", "0xhash")), \
             patch.object(client, "post_artifact"), \
             patch.object(client, "cast_send", side_effect=lambda a, p, d: seen.setdefault("call", a)):
            client.submit_subcommand(None, dry_run=False)
        self.assertIn("[]", seen["call"])

    def test_parents_given_on_the_command_line_win(self):
        seen = {}
        with patch.object(client, "build_artifact", return_value=("/tmp/a.tar.gz", "0xhash")), \
             patch.object(client, "post_artifact"), \
             patch.object(client, "cast_send", side_effect=lambda a, p, d: seen.setdefault("call", a)):
            client.submit_subcommand([HEAD], dry_run=False)
        self.assertIn(f"[{HEAD}]", seen["call"])


class TestEditablePaths(ClientTestCase):
    def test_a_comma_separated_list_is_a_list(self):
        os.environ["EDITABLE"] = "crates/rec_aggregation/guests/,crates/other/"
        self.assertEqual(
            client.editable_paths(client.get_env_vars("submit")),
            ["crates/rec_aggregation/guests/", "crates/other/"],
        )

    def test_whitespace_still_works(self):
        os.environ["EDITABLE"] = "crates/rec_aggregation/guests/ crates/other/"
        self.assertEqual(len(client.editable_paths(client.get_env_vars("submit"))), 2)


class TestArtifact(ClientTestCase):
    """The tarball is the interface between the swarm and the verifier: it must contain the changed
    guest files at their repository-relative paths, and nothing the verifier will reject."""

    def setUp(self):
        super().setUp()
        self.repo = os.path.join(self.tmp, "repo")
        guests = os.path.join(self.repo, "crates", "rec_aggregation", "guests")
        os.makedirs(guests)
        os.makedirs(os.path.join(self.repo, "crates", "lean_compiler", "src"))
        with open(os.path.join(guests, "aggregate.py"), "w") as f:
            f.write("# baseline\n")
        with open(os.path.join(self.repo, "crates", "lean_compiler", "src", "lib.rs"), "w") as f:
            f.write("// frozen\n")
        for cmd in (["init", "-q"], ["add", "-A"], ["-c", "user.email=t@e", "-c", "user.name=t",
                                                    "commit", "-qm", "baseline"]):
            subprocess.run(["git", "-C", self.repo] + cmd, check=True, capture_output=True)
        os.environ["WORKTREE"] = self.repo

    def change(self, rel, text):
        with open(os.path.join(self.repo, rel), "a") as f:
            f.write(text)

    def test_it_carries_the_changed_guest_file_and_nothing_else(self):
        self.change("crates/rec_aggregation/guests/aggregate.py", "# a comment\n")
        self.change("crates/lean_compiler/src/lib.rs", "// touched too\n")
        path, digest = client.build_artifact(client.get_env_vars("submit"), self.tmp)
        with tarfile.open(path) as tar:
            names = tar.getnames()
        self.assertEqual(names, ["crates/rec_aggregation/guests/aggregate.py"])
        self.assertEqual(validate_paths(names), (True, ""))

    def test_every_member_passes_the_verifiers_own_frozen_path_rule(self):
        self.change("crates/rec_aggregation/guests/aggregate.py", "# a comment\n")
        path, _ = client.build_artifact(client.get_env_vars("submit"), self.tmp)
        with tarfile.open(path) as tar:
            self.assertEqual(validate_paths(tar.getnames()), (True, ""))
            self.assertNotIn("manifest.json", tar.getnames())

    def test_the_hash_is_the_sha256_of_the_bytes_the_store_will_receive(self):
        self.change("crates/rec_aggregation/guests/aggregate.py", "# a comment\n")
        path, digest = client.build_artifact(client.get_env_vars("submit"), self.tmp)
        with open(path, "rb") as f:
            self.assertEqual(digest, "0x" + hashlib.sha256(f.read()).hexdigest())

    def test_submitting_nothing_is_an_error_rather_than_an_empty_tarball(self):
        with self.assertRaises(RuntimeError) as e:
            client.build_artifact(client.get_env_vars("submit"), self.tmp)
        self.assertIn("nothing to submit", str(e.exception))


class TestUpload(ClientTestCase):
    def test_a_hash_mismatch_from_the_store_stops_the_submission(self):
        path = os.path.join(self.tmp, "a.tar.gz")
        with open(path, "wb") as f:
            f.write(b"bytes")

        class Refused(client.urllib.error.HTTPError):
            def __init__(self):
                super().__init__("u", 409, "conflict", {}, io.BytesIO(b'{"error":"hash mismatch"}'))

        with patch.object(client.urllib.request, "urlopen", side_effect=Refused()):
            with self.assertRaises(RuntimeError) as e:
                client.post_artifact("https://api", path, "0xnope")
        self.assertIn("409", str(e.exception))


if __name__ == "__main__":
    unittest.main(verbosity=2)
