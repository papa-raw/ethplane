import unittest
from unittest.mock import patch, MagicMock
import sys
import os

# Add the swarm directory to the path so we can import client
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from swarm.client import get_env_vars, read_session, write_session, state_path, resume_subcommand


class TestResume(unittest.TestCase):
    
    def setUp(self):
        # Create a mock SESSION_STATE_DIR
        self.mock_state_dir = "/tmp/test_session_state"
        os.environ["SESSION_STATE_DIR"] = self.mock_state_dir
        # Set up required environment variables for testing
        os.environ["ETHPLANE_ADDRESS"] = "0x1234567890123456789012345678901234567890"
        os.environ["SEPOLIA_RPC_URL"] = "https://sepolia.example.com"
        os.environ["NODE_ID"] = "0xabcdef1234567890abcdef1234567890abcdef12"
        os.environ["LINEAGE_ADDRESS"] = "0x9876543210987654321098765432109876543210"
        
    def tearDown(self):
        # Clean up any created files
        import shutil
        if os.path.exists(self.mock_state_dir):
            shutil.rmtree(self.mock_state_dir)
        
    def test_get_env_vars_with_command(self):
        """Test that get_env_vars works with a command parameter"""
        # Set up required environment variables
        os.environ["ETHPLANE_ADDRESS"] = "0x1234567890123456789012345678901234567890"
        os.environ["SEPOLIA_RPC_URL"] = "https://sepolia.example.com"
        os.environ["NODE_ID"] = "0xabcdef1234567890abcdef1234567890abcdef12"
        os.environ["LINEAGE_NAME"] = "test_lineage"
        os.environ["OPERATOR_ADDRESS"] = "0x9876543210987654321098765432109876543210"
        
        # Test with register command
        vars_dict = get_env_vars("register")
        self.assertIn("ETHPLANE_ADDRESS", vars_dict)
        self.assertIn("SEPOLIA_RPC_URL", vars_dict)
        self.assertIn("NODE_ID", vars_dict)
        self.assertIn("LINEAGE_NAME", vars_dict)
        self.assertIn("OPERATOR_ADDRESS", vars_dict)
        
    def test_read_write_session(self):
        """Test reading and writing session state"""
        node_id = "0xabcdef1234567890abcdef1234567890abcdef12"
        from_hash = "0x1234567890123456789012345678901234567890123456789012345678901234"
        
        # Write session
        write_session(node_id, from_hash)
        
        # Read session
        session_data = read_session(node_id)
        self.assertEqual(session_data["node"], node_id)
        self.assertEqual(session_data["fromHash"], from_hash)
        
    def test_state_path(self):
        """Test that state_path generates correct paths"""
        node_id = "0xabcdef1234567890abcdef1234567890abcdef12"
        path = state_path(node_id)
        self.assertTrue(path.endswith("session-test_lineage-0xabcdef12.json"))
        
    def test_state_path_custom_name(self):
        """Test state path with custom LINEAGE_NAME"""
        os.environ["LINEAGE_NAME"] = "custom_lineage"
        node_id = "0xabcdef1234567890abcdef1234567890abcdef12"
        path = state_path(node_id)
        self.assertTrue(path.endswith("session-custom_lineage-0xabcdef12.json"))


if __name__ == '__main__':
    unittest.main()