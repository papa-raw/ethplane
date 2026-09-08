import unittest
import os
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)) + "/..")
from run import validate_paths

class TestNormPath(unittest.TestCase):
    
    def test_normpath_traversal_is_frozen_path(self):
        """Test that normpath traversal is properly detected as frozen path."""
        # Test that ../../../etc/passwd is detected as frozen path after normalization
        result = validate_paths(["crates/lean_compiler/../../../etc/passwd"])
        self.assertFalse(result[0])  # Should be invalid
        self.assertEqual(result[1], "frozen-path")  # Should give frozen-path reason

if __name__ == '__main__':
    unittest.main()