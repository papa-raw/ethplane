"""
Parser for leanVM output based on the spec requirements.
"""

import re
from typing import Dict, Optional

def parse_output(output: str) -> Dict[str, Optional[float]]:
    """
    Parse the output of the pinned command and extract metrics.
    
    Expected regex patterns from spec:
    - cycles (VM steps): \\s*:\\s*([\\d,]+)
    - proving time: \\s*:\\s*([\\d.]+) s ± ([\\d.]+)%
    - proof size: \\s*:\\s*([\\d.]+) KiB
    - verifying: \\s*:\\s*([\\d.]+) s
    
    Returns dictionary with keys: cycles, provingMicros, proofSizeBytes, verifyMicros
    """
    # Initialize result dictionary
    result = {
        'cycles': None,
        'provingMicros': None,
        'proofSizeBytes': None,
        'verifyMicros': None
    }
    
    # Parse cycles (VM steps)
    cycles_match = re.search(r'cycles \(VM steps\)\s*:\s*([\d,]+)', output)
    if cycles_match:
        # Remove commas and convert to int
        result['cycles'] = int(cycles_match.group(1).replace(',', ''))
    
    # Parse proving time
    proving_match = re.search(r'proving time\s*:\s*([\d.]+) s ± ([\d.]+)%', output)
    if proving_match:
        # Convert to microseconds
        result['provingMicros'] = float(proving_match.group(1)) * 1_000_000
    
    # Parse proof size
    proof_size_match = re.search(r'proof size\s*:\s*([\d.]+) KiB', output)
    if proof_size_match:
        # Convert to bytes
        result['proofSizeBytes'] = int(float(proof_size_match.group(1)) * 1024)
    
    # Parse verifying time
    verify_match = re.search(r'verifying\s*:\s*([\d.]+) s', output)
    if verify_match:
        # Convert to microseconds
        result['verifyMicros'] = float(verify_match.group(1)) * 1_000_000
    
    return result