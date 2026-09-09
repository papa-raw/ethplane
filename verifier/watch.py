#!/usr/bin/env python3
"""
Verifier watcher for ethplane - polls submissions and processes pending artifacts.
"""
import argparse
import os
import sys
import time
import json
import hashlib
import tempfile
import subprocess
import urllib.request
import urllib.error
from pathlib import Path

def get_env_vars():
    """Get required environment variables."""
    required_vars = [
        'VERIFIER_KEY_FILE',
        'API_BASE',
        'NODE_ID',
        'LEANVM_REF',
        'REFERENCE_COMMIT',
        'ETHPLANE_ADDRESS',
        'SEPOLIA_RPC_URL'
    ]
    
    env_vars = {}
    for var in required_vars:
        if var not in os.environ:
            raise ValueError(f"Missing required environment variable: {var}")
        env_vars[var] = os.environ[var]
    
    return env_vars

def get_pending_submissions(api_base, node_id):
    """Get pending submissions from API."""
    import requests
    
    url = f"{api_base}/api/nodes/{node_id}/submissions"
    response = requests.get(url)
    response.raise_for_status()
    
    submissions = response.json()
    
    # Filter for PENDING submissions only
    pending = [s for s in submissions if s.get('status') == 'PENDING']
    
    return pending

def fetch_artifact(api_base, artifact_hash):
    """Fetch artifact from API to a temporary file."""
    import requests
    
    url = f"{api_base}/api/artifacts/{artifact_hash}"
    response = requests.get(url)
    response.raise_for_status()
    
    # Create temporary file
    temp_file = tempfile.NamedTemporaryFile(mode='wb', delete=False)
    temp_file.write(response.content)
    temp_file.close()
    
    return temp_file.name

def run_verifier(tarball_path):
    """Run the verifier on the artifact."""
    env = get_env_vars()
    
    # Run the verifier with the tarball
    cmd = [sys.executable, "verifier/run.py", tarball_path]
    
    # Set environment variables for the verifier
    env_vars = os.environ.copy()
    env_vars['LEANVM_REF'] = env['LEANVM_REF']
    env_vars['REFERENCE_COMMIT'] = env['REFERENCE_COMMIT']
    
    # Run the command
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        env=env_vars
    )
    
    if result.returncode != 0:
        raise RuntimeError(f"Verifier failed: {result.stderr}")
    
    # Parse the verdict JSON
    try:
        verdict = json.loads(result.stdout.strip())
        return verdict
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Failed to parse verdict JSON: {e}")

def record_measurement(node_id, artifact_hash, verdict):
    """Record measurement on chain."""
    env = get_env_vars()
    
    # Extract values from verdict
    cycles = verdict.get('cycles', 0)
    proving_micros = verdict.get('provingMicros', 0)
    proof_size_bytes = verdict.get('proofSizeBytes', 0)
    verify_micros = verdict.get('verifyMicros', 0)
    verifier_accepted = verdict.get('verifierAccepted', False)
    
    # Compute evidence hash (SHA256 of verdict JSON)
    evidence_hash = hashlib.sha256(json.dumps(verdict, sort_keys=True).encode()).hexdigest()
    
    # Format as 0x prefixed hex
    evidence_hash_hex = '0x' + evidence_hash
    
    # Prepare cast command
    cast_args = [
        env['ETHPLANE_ADDRESS'],
        f"recordMeasurement(bytes32,bytes32,uint256,uint256,uint256,uint256,bool,bytes32)",
        node_id,
        artifact_hash,
        str(cycles),
        str(proving_micros),
        str(proof_size_bytes),
        str(verify_micros),
        str(verifier_accepted).lower(),
        evidence_hash_hex,
        '--private-key-file', env['VERIFIER_KEY_FILE'],
        '--rpc-url', env['SEPOLIA_RPC_URL']
    ]
    
    return cast_args

def main():
    parser = argparse.ArgumentParser(description='Verifier watcher for ethplane')
    parser.add_argument('--dry-run', action='store_true', help='Print commands instead of executing them')
    parser.add_argument('--once', action='store_true', help='Run only once, then exit')
    parser.add_argument('--interval', type=int, default=30, help='Polling interval in seconds')
    
    args = parser.parse_args()
    
    # Check required environment variables
    try:
        env = get_env_vars()
    except ValueError as e:
        print(f"Error: {e}")
        return 1
    
    # Create watched file if it doesn't exist
    watched_file = Path('.watched')
    if not watched_file.exists():
        watched_file.touch()
    
    # Read already watched hashes
    watched_hashes = set()
    if watched_file.exists():
        with open(watched_file, 'r') as f:
            watched_hashes = {line.strip() for line in f if line.strip()}
    
    # Main loop
    while True:
        try:
            # Get pending submissions
            if args.dry_run:
                print(f"GET {env['API_BASE']}/api/nodes/{env['NODE_ID']}/submissions")
                print("Would select PENDING submissions whose artifact hash is not in .watched")
                print("Would fetch artifacts and run verifier")
                print("Would print cast send line for each")
                if args.once:
                    break
                time.sleep(args.interval)
                continue
            
            # Get pending submissions from API
            pending_submissions = get_pending_submissions(env['API_BASE'], env['NODE_ID'])
            
            # Filter out already watched submissions
            unwatched_pending = [s for s in pending_submissions if s.get('artifactHash') not in watched_hashes]
            
            # Process each unwatched pending submission
            for submission in unwatched_pending:
                artifact_hash = submission.get('artifactHash')
                if not artifact_hash:
                    continue
                    
                try:
                    # Fetch artifact
                    tarball_path = fetch_artifact(env['API_BASE'], artifact_hash)
                    
                    # Run verifier
                    verdict = run_verifier(tarball_path)
                    
                    # Print the cast send line for recordMeasurement
                    cast_args = record_measurement(env['NODE_ID'], artifact_hash, verdict)
                    cast_cmd = ['cast', 'send'] + cast_args
                    print(' '.join(cast_cmd))
                    
                    # Append hash to watched file
                    with open(watched_file, 'a') as f:
                        f.write(f"{artifact_hash}\n")
                    
                    # Clean up temp file
                    os.unlink(tarball_path)
                    
                except Exception as e:
                    print(f"Error processing submission {artifact_hash}: {e}")
                    # Continue with next submission even if one fails
                    continue
            
            if args.once:
                break
                
            time.sleep(args.interval)
            
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"Error in watcher: {e}")
            if args.once:
                break
    
    return 0

if __name__ == '__main__':
    exit(main())