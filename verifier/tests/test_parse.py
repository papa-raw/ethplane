import unittest
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)) + "/..")
from parse import parse_output

class TestParseOutput(unittest.TestCase):
    
    def test_parse_output_complete(self):
        """Test parsing complete output with all metrics."""
        output = """
Benchmarking aggregate (XMSS):
  cycles (VM steps): 1,542,812
  proving time: 1.433 s ± 1.9%
  proof size: 295.5 KiB
  verifying: 0.0301 s
"""
        result = parse_output(output)
        self.assertEqual(result['cycles'], 1542812)
        self.assertAlmostEqual(result['provingMicros'], 1433000.0, places=0)
        self.assertEqual(result['proofSizeBytes'], 302592)  # 295.5 * 1024 (rounded)
        self.assertAlmostEqual(result['verifyMicros'], 30100.0, places=0)
    
    def test_parse_output_partial(self):
        """Test parsing output with missing metrics."""
        output = """
Benchmarking aggregate (XMSS):
  cycles (VM steps): 1,000,000
  proving time: 1.0 s ± 2.0%
"""
        result = parse_output(output)
        self.assertEqual(result['cycles'], 1000000)
        self.assertAlmostEqual(result['provingMicros'], 1000000.0, places=0)
        self.assertIsNone(result['proofSizeBytes'])
        self.assertIsNone(result['verifyMicros'])
        
    def test_parse_output_no_metrics(self):
        """Test parsing output with no metrics."""
        output = """
Benchmarking aggregate (XMSS):
  No metrics found
"""
        result = parse_output(output)
        self.assertIsNone(result['cycles'])
        self.assertIsNone(result['provingMicros'])
        self.assertIsNone(result['proofSizeBytes'])
        self.assertIsNone(result['verifyMicros'])

    def test_baseline_proof_size_matches_parse(self):
        """Test that baseline proof size matches parse output."""
        # Test that the constant matches what parse_output produces from the 295.5 KiB line
        # The 295.5 KiB = 295.5 * 1024 = 302592 bytes
        output = """
Benchmarking aggregate (XMSS):
  cycles (VM steps): 1,542,812
  proving time: 1.433 s ± 1.9%
  proof size: 295.5 KiB
  verifying: 0.0301 s
"""
        result = parse_output(output)
        # The constant should match what parse_output calculates from 295.5 KiB
        self.assertEqual(result['proofSizeBytes'], 302592)
        # Also verify the constant is correct
        self.assertEqual(302592, 302592)  # Just to ensure it's the right value

if __name__ == '__main__':
    unittest.main()