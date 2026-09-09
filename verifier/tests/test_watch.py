import unittest
import os
import sys
import json
from unittest.mock import patch, MagicMock
from pathlib import Path

# Add the verifier directory to the path so we can import watch
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + '/..')

from verifier.watch import get_env_vars, run_verifier, record_measurement

class TestWatch(unittest.TestCase):
    
    def setUp(self):
        # Set up required environment variables
        self.env_vars = {
            'VERIFIER_KEY_FILE': '/tmp/verifier-key.pem',
            'API_BASE': 'https://ethplane.ecofrontiers.xyz',
            'NODE_ID': '0x1234567890123456789012345678901234567890123456789012345678901234',
            'LEANVM_REF': '/tmp/leanvm',
            'REFERENCE_COMMIT': 'a210ef1b',
            'SEPOLIA_RPC_URL': 'https://sepolia.infura.io/v3/1234567890',
            'ETHPLANE_ADDRESS': '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'
        }
        
        # Set environment variables
        for key, value in self.env_vars.items():
            os.environ[key] = value
    
    def tearDown(self):
        # Clean up environment variables
        for key in self.env_vars.keys():
            if key in os.environ:
                del os.environ[key]
    
    def test_get_env_vars(self):
        """Test that environment variables are properly retrieved."""
        env = get_env_vars()
        self.assertEqual(env['NODE_ID'], '0x1234567890123456789012345678901234567890123456789012345678901234')
        self.assertEqual(env['LEANVM_REF'], '/tmp/leanvm')
    
    @patch('subprocess.run')
    def test_run_verifier(self, mock_run):
        """Test verifier execution."""
        # Mock successful verifier run
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout=json.dumps({
                "cycles": 1542812,
                "provingMicros": 1433000,
                "proofSizeBytes": 302592,
                "verifyMicros": 30100,
                "verifierAccepted": True,
                "reason": "",
                "binarySha256": "abc123def456"
            })
        )
        
        # Test with a fake tarball path
        result = run_verifier("/tmp/fake.tar.gz")
        self.assertEqual(result['cycles'], 1542812)
        self.assertEqual(result['verifierAccepted'], True)
    
    @patch('subprocess.run')
    def test_record_measurement(self, mock_run):
        """Test recording measurement."""
        mock_run.return_value = MagicMock(returncode=0, stdout='', stderr='')
        
        # Test with sample verdict
        verdict = {
            "cycles": 1542812,
            "provingMicros": 1433000,
            "proofSizeBytes": 302592,
            "verifyMicros": 30100,
            "verifierAccepted": True,
            "reason": "",
            "binarySha256": "abc123def456"
        }
        
        # Test that it produces correct cast command
        cast_args = record_measurement(
            '0x1234567890123456789012345678901234567890123456789012345678901234',
            '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
            verdict
        )
        
        # Should contain all the expected arguments in the right positions
        # The cast_args should be a list with the format:
        # [ETHPLANE_ADDRESS, function_signature, node_id, artifact_hash, cycles, proving_micros, proof_size_bytes, verify_micros, verifier_accepted, evidence_hash, '--private-key-file', VERIFIER_KEY_FILE, '--rpc-url', SEPOLIA_RPC_URL]
        
        # Check that we have the right number of arguments
        self.assertEqual(len(cast_args), 14)  # 14 arguments in the command
        
        # Check specific elements by position
        self.assertEqual(cast_args[1], "recordMeasurement(bytes32,bytes32,uint256,uint256,uint256,uint256,bool,bytes32)")
        self.assertEqual(cast_args[2], "0x1234567890123456789012345678901234567890123456789012345678901234")  # node_id
        self.assertEqual(cast_args[3], "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890")  # artifact_hash
        self.assertEqual(cast_args[4], "1542812")  # cycles
        self.assertEqual(cast_args[5], "1433000")  # provingMicros
        self.assertEqual(cast_args[6], "302592")   # proofSizeBytes
        self.assertEqual(cast_args[7], "30100")    # verifyMicros
        self.assertEqual(cast_args[8], "true")     # verifierAccepted
        
        # Evidence hash should be present (calculated from verdict)
        evidence_hash_arg = cast_args[9]  # The evidence hash is the 10th element
        self.assertTrue(evidence_hash_arg.startswith('0x'))
        self.assertEqual(len(evidence_hash_arg), 66)  # 64 hex chars + 0x prefix

if __name__ == '__main__':
    unittest.main()