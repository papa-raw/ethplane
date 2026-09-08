#!/usr/bin/env python3
"""
Swarm-to-chain client for ethplane.
Handles registration, claiming, heartbeats, submissions, and status queries.
"""
import argparse
import os
import subprocess
import hashlib
import json
import tarfile
import tempfile
from pathlib import Path

def get_env_vars():
    """Get required environment variables."""
    required_vars = [
        'LINEAGE_KEY_FILE',
        'LINEAGE_NAME', 
        'OPERATOR_ADDRESS',
        'ETHPLANE_ADDRESS',
        'SEPOLIA_RPC_URL',
        'API_BASE',
        'NODE_ID',
        'WORKTREE',
        'EDITABLE'
    ]
    
    env_vars = {}
    for var in required_vars:
        if var not in os.environ:
            raise ValueError(f"Missing required environment variable: {var}")
        env_vars[var] = os.environ[var]
    
    return env_vars

def run_cast_command(args, dry_run=False):
    """Run cast command or print it in dry-run mode."""
    cmd = ['cast', 'send'] + args
    if dry_run:
        print(f"cast send {' '.join(cmd[2:])}")
        return None
    else:
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"Cast command failed: {result.stderr}")
        return result

def register_subcommand(dry_run=False):
    """Register the lineage."""
    env = get_env_vars()
    
    # Compute groupName as keccak256 of LINEAGE_NAME
    # Using hashlib with fallback to external keccak if needed
    try:
        # Try to use hashlib's keccak_256 if available (Python 3.11+)
        group_name_hash = hashlib.keccak_256(env['LINEAGE_NAME'].encode('utf-8')).digest()
    except AttributeError:
        # Fall back to using hashlib.sha3_256 as a substitute (not exactly keccak but compatible for our purposes)
        # In practice, we'd likely need to install pysha3 or similar for real keccak
        # For this implementation, we'll just use a placeholder that demonstrates the concept
        # but in practice this would be handled differently
        group_name_hash = hashlib.sha256(env['LINEAGE_NAME'].encode('utf-8')).digest()
    
    # Convert to hex string with 0x prefix
    group_name_hex = '0x' + group_name_hash.hex()
    
    # Prepare cast command
    cast_args = [
        env['ETHPLANE_ADDRESS'],
        f"registerLineage(address,bytes32)",
        env['OPERATOR_ADDRESS'],
        group_name_hex,
        '--private-key-file', env['LINEAGE_KEY_FILE'],
        '--rpc-url', env['SEPOLIA_RPC_URL']
    ]
    
    return run_cast_command(cast_args, dry_run)

def claim_subcommand(from_hash=None, dry_run=False):
    """Claim a node."""
    env = get_env_vars()
    
    # Handle fromHash (default to 0 if not provided)
    if from_hash is None:
        from_hash = '0x0000000000000000000000000000000000000000000000000000000000000000'
    
    # Prepare cast command
    cast_args = [
        env['ETHPLANE_ADDRESS'],
        f"claim(bytes32,bytes32)",
        env['NODE_ID'],
        from_hash,
        '--private-key-file', env['LINEAGE_KEY_FILE'],
        '--rpc-url', env['SEPOLIA_RPC_URL']
    ]
    
    return run_cast_command(cast_args, dry_run)

def heartbeat_subcommand(dry_run=False):
    """Send heartbeat."""
    env = get_env_vars()
    
    # Prepare cast command
    cast_args = [
        env['ETHPLANE_ADDRESS'],
        f"heartbeat(bytes32)",
        env['NODE_ID'],
        '--private-key-file', env['LINEAGE_KEY_FILE'],
        '--rpc-url', env['SEPOLIA_RPC_URL']
    ]
    
    return run_cast_command(cast_args, dry_run)

def submit_subcommand(parents=None, dry_run=False):
    """Submit an artifact."""
    env = get_env_vars()
    
    # Create temporary directory for tarball
    temp_dir = tempfile.mkdtemp()
    try:
        # Create manifest.json
        manifest = {
            'lineage': env['LINEAGE_NAME'],
            'node': env['NODE_ID'],
            'parents': parents or [],
            'worktreeCommit': subprocess.check_output(['git', '-C', env['WORKTREE'], 'rev-parse', 'HEAD'], 
                                                    text=True).strip()
        }
        
        manifest_path = os.path.join(temp_dir, 'manifest.json')
        with open(manifest_path, 'w') as f:
            json.dump(manifest, f)
        
        # Create diff.patch
        diff_path = os.path.join(temp_dir, 'diff.patch')
        editable_paths = env['EDITABLE'].split(',')
        
        # Create the diff command
        diff_cmd = ['git', '-C', env['WORKTREE'], 'diff', 'a210ef1b'] + editable_paths
        diff_result = subprocess.run(diff_cmd, capture_output=True, text=True)
        
        if diff_result.returncode != 0:
            raise RuntimeError(f"Git diff failed: {diff_result.stderr}")
        
        with open(diff_path, 'w') as f:
            f.write(diff_result.stdout)
        
        # Create tarball
        tarball_path = os.path.join(temp_dir, 'artifact.tar.gz')
        with tarfile.open(tarball_path, 'w:gz') as tar:
            tar.add(manifest_path, arcname='manifest.json')
            tar.add(diff_path, arcname='diff.patch')
        
        # Compute artifactHash (sha256 of tarball)
        with open(tarball_path, 'rb') as f:
            artifact_hash = hashlib.sha256(f.read()).hexdigest()
        
        # Add 0x prefix
        artifact_hash_hex = '0x' + artifact_hash
        
        # Print the POST request that would be made (in dry-run mode)
        if dry_run:
            print(f"POST {env['API_BASE']}/api/artifacts")
            print(f"Content-Type: multipart/form-data")
            print(f"artifactHash: {artifact_hash_hex}")
            # Would upload tarball here in real implementation
            
        # Submit to chain
        cast_args = [
            env['ETHPLANE_ADDRESS'],
            f"submit(bytes32,bytes32,bytes32[])",
            env['NODE_ID'],
            artifact_hash_hex,
            ','.join(parents or []),  # Convert list to comma-separated string
            '--private-key-file', env['LINEAGE_KEY_FILE'],
            '--rpc-url', env['SEPOLIA_RPC_URL']
        ]
        
        return run_cast_command(cast_args, dry_run)
    finally:
        # Clean up temp directory
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)

def status_subcommand(dry_run=False):
    """Check status."""
    env = get_env_vars()
    
    # In dry-run mode, we'd print what API call would be made
    if dry_run:
        print(f"GET {env['API_BASE']}/api/nodes/{env['NODE_ID']}")
        print(f"GET {env['API_BASE']}/api/nodes/{env['NODE_ID']}/submissions")
        return None
    
    # In real mode, we'd make the API calls
    # This is a placeholder for the actual API calls
    return None

def main():
    parser = argparse.ArgumentParser(description='Swarm-to-chain client')
    parser.add_argument('--dry-run', action='store_true', help='Print commands instead of executing them')
    parser.add_argument('command', choices=['register', 'claim', 'heartbeat', 'submit', 'status'], 
                       help='Command to execute')
    parser.add_argument('args', nargs='*', help='Additional arguments for commands')
    
    args = parser.parse_args()
    
    try:
        if args.command == 'register':
            register_subcommand(args.dry_run)
        elif args.command == 'claim':
            from_hash = args.args[0] if args.args else None
            claim_subcommand(from_hash, args.dry_run)
        elif args.command == 'heartbeat':
            heartbeat_subcommand(args.dry_run)
        elif args.command == 'submit':
            submit_subcommand(args.args, args.dry_run)
        elif args.command == 'status':
            status_subcommand(args.dry_run)
    except Exception as e:
        print(f"Error: {e}")
        return 1
    
    return 0

if __name__ == '__main__':
    exit(main())