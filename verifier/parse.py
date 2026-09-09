"""Parser for leanVM output based on the spec requirements.

Every field is an INTEGER. The contract's four measurement arguments are uint256 and cast refuses a
decimal point outright — `parser error: 1500000.0 expected at most 0 decimals` — so a float here is
not a rounding question, it is a verdict that cannot be recorded. It happened on 2026-09-09: a
measured submission was left pending because "1.5 s" became 1500000.0 microseconds.
"""

import re
from typing import Dict, Optional

def parse_output(output: str) -> Dict[str, Optional[int]]:
    """
    Parse the output of the pinned command and extract metrics.
    
    Expected regex patterns from spec:
    - cycles (VM steps): \\s*:\\s*([\\d,]+)
    - proving time: \\s*:\\s*([\\d.]+) s ± ([\\d.]+)%
    - proof size: \\s*:\\s*([\\d.]+) KiB
    - verifying: \\s*:\\s*([\\d.]+) s
    
    Returns dictionary with keys: cycles, provingMicros, proofSizeBytes, verifyMicros — all int
    or None. Microseconds are already finer than the measurement's own precision, so rounding to
    the nearest one loses nothing.
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
        result['provingMicros'] = round(float(proving_match.group(1)) * 1_000_000)
    
    # Parse proof size
    proof_size_match = re.search(r'proof size\s*:\s*([\d.]+) KiB', output)
    if proof_size_match:
        # Convert to bytes
        result['proofSizeBytes'] = int(float(proof_size_match.group(1)) * 1024)
    
    # Parse verifying time
    verify_match = re.search(r'verifying\s*:\s*([\d.]+) s', output)
    if verify_match:
        # Convert to microseconds
        result['verifyMicros'] = round(float(verify_match.group(1)) * 1_000_000)
    
    return result