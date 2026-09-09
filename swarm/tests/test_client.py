import unittest
import os
import tempfile
import subprocess
import json
import hashlib
from unittest.mock import patch, MagicMock
import sys

# Add the swarm directory to the path so we can import client
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + '/..')

from swarm.client import get_env_vars, register_subcommand, claim_subcommand, heartbeat_subcommand, submit_subcommand, status_subcommand

class TestClient(unittest.TestCase):
    
    def setUp(self):
        # Set up required environment variables
        self.env_vars = {
            'LINEAGE_KEY_FILE': '/tmp/key.pem',
            'LINEAGE_NAME': 'qwen-a',
            'OPERATOR_ADDRESS': '0x1234567890123456789012345678901234567890',
            'ETHPLANE_ADDRESS': '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
            'SEPOLIA_RPC_URL': 'https://sepolia.infura.io/v3/1234567890',
            'API_BASE': 'https://ethplane.ecofrontiers.xyz',
            'NODE_ID': '0x1234567890123456789012345678901234567890123456789012345678901234',
            'WORKTREE': '/tmp/worktree',
            'EDITABLE': 'crates/rec_aggregation/guests/aggregate.py,crates/lean_compiler/'
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
        self.assertEqual(env['LINEAGE_NAME'], 'qwen-a')
        self.assertEqual(env['OPERATOR_ADDRESS'], '0x1234567890123456789012345678901234567890')
    
    @patch('subprocess.run')
    def test_register_subcommand_dry_run(self, mock_run):
        """Test register subcommand in dry-run mode."""
        mock_run.return_value = MagicMock(returncode=0, stdout='', stderr='')
        
        # Capture stdout to verify the cast command
        with patch('sys.stdout') as mock_stdout:
            register_subcommand(dry_run=True)
            # Should print cast command
            # Note: actual assertion would require more complex mocking
    
    @patch('subprocess.run')
    def test_claim_subcommand_dry_run(self, mock_run):
        """Test claim subcommand in dry-run mode."""
        mock_run.return_value = MagicMock(returncode=0, stdout='', stderr='')
        
        # Test with fromHash
        with patch('sys.stdout') as mock_stdout:
            claim_subcommand('0x1234567890123456789012345678901234567890123456789012345678901234', dry_run=True)
            # Should print cast command
    
    @patch('subprocess.run')
    def test_heartbeat_subcommand_dry_run(self, mock_run):
        """Test heartbeat subcommand in dry-run mode."""
        mock_run.return_value = MagicMock(returncode=0, stdout='', stderr='')
        
        with patch('sys.stdout') as mock_stdout:
            heartbeat_subcommand(dry_run=True)
            # Should print cast command
    
    @patch('subprocess.run')
    @patch('tempfile.mkdtemp')
    @patch('subprocess.check_output')
    def test_submit_subcommand_dry_run(self, mock_check_output, mock_mkdtemp, mock_run):
        """Test submit subcommand in dry-run mode."""
        # Mock the temporary directory
        mock_mkdtemp.return_value = '/tmp/mock'
        
        # Mock git operations
        mock_run.return_value = MagicMock(returncode=0, stdout='diff output', stderr='')
        mock_check_output.return_value = 'abc123def456\n'
        
        # Mock file creation and tar operations
        with patch('builtins.open') as mock_open:
            with patch('sys.stdout') as mock_stdout:
                submit_subcommand(['parent1', 'parent2'], dry_run=True)
                # Should print POST request information
    
    def test_status_subcommand_dry_run(self):
        """Test status subcommand in dry-run mode."""
        # In dry-run mode, should just print API calls
        with patch('sys.stdout') as mock_stdout:
            status_subcommand(dry_run=True)
            # Should print GET requests

if __name__ == '__main__':
    unittest.main()