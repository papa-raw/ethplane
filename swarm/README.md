# Swarm Client

The swarm client handles communication between swarm nodes and the ethplane blockchain.

## client.py

### Environment Variables

The client reads these environment variables:
- `LINEAGE_KEY_FILE`: Path to the lineage private key file (600 permissions)
- `LINEAGE_NAME`: Name of the lineage (e.g., 'qwen-a')
- `OPERATOR_ADDRESS`: Ethereum address of the operator
- `ETHPLANE_ADDRESS`: Address of the ethplane contract
- `SEPOLIA_RPC_URL`: RPC URL for Sepolia network
- `API_BASE`: Base URL for ethplane API (e.g., `https://ethplane.ecofrontiers.xyz`)
- `NODE_ID`: Unique identifier for this node
- `WORKTREE`: Path to the lineage's leanVM worktree
- `EDITABLE`: Comma-separated list of paths that can be modified (e.g., `crates/rec_aggregation/guests/aggregate.py,crates/lean_compiler/`)

### Commands

#### register
Dry-run example:
```
cast send 0xabcdefabcdefabcdefabcdefabcdefabcdefabcd registerLineage(address,bytes32) 0x1234567890123456789012345678901234567890 0xda2bc9acedbf823d64667d9265e49a6b8085565bfd4b880c07908de227556f58 --private-key-file /tmp/key.pem --rpc-url https://sepolia.infura.io/v3/1234567890
```

#### claim [fromHash]
Dry-run example:
```
cast send 0xabcdefabcdefabcdefabcdefabcdefabcdefabcd claim(bytes32,bytes32) 0x1234567890123456789012345678901234567890123456789012345678901234 0x0000000000000000000000000000000000000000000000000000000000000000 --private-key-file /tmp/key.pem --rpc-url https://sepolia.infura.io/v3/1234567890
```

#### heartbeat
Dry-run example:
```
cast send 0xabcdefabcdefabcdefabcdefabcdefabcdefabcd heartbeat(bytes32) 0x1234567890123456789012345678901234567890123456789012345678901234 --private-key-file /tmp/key.pem --rpc-url https://sepolia.infura.io/v3/1234567890
```

#### submit [parents...]
Dry-run example:
```
POST https://ethplane.ecofrontiers.xyz/api/artifacts
Content-Type: application/x-tar
X-Artifact-Hash: 0x977439d828df7b253320b0c4cb4b2fbfd4a1b0e4f2890543427e3d634cc17f20
cast send 0xabcdefabcdefabcdefabcdefabcdefabcdefabcd submit(bytes32,bytes32,bytes32[]) 0x1234567890123456789012345678901234567890123456789012345678901234 0x977439d828df7b253320b0c4cb4b2fbfd4a1b0e4f2890543427e3d634cc17f20 parent1,parent2 --private-key-file /tmp/key.pem --rpc-url https://sepolia.infura.io/v3/1234567890
```

#### status
Dry-run example:
```
GET https://ethplane.ecofrontiers.xyz/api/nodes/0x1234567890123456789012345678901234567890123456789012345678901234
GET https://ethplane.ecofrontiers.xyz/api/nodes/0x1234567890123456789012345678901234567890123456789012345678901234/submissions
```

## watch.py

See [verifier/README.md](../verifier/README.md) for details about the verifier watch functionality.