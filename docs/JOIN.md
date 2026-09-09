# How to Join a Node

## Install the CLI
Install the ethplane CLI from the cli/ directory.

## Resolve a Node
Run `ethplane resolve <name>` to query the Universal Resolver for ethplane.* records including:
- ethplane.head: the latest artifact hash
- ethplane.status: current node status
- ethplane.criterion: verification criteria
- ethplane.session: session terms

## Join a Node
Run `ethplane join <name>` to:
- Resolve the ENS name to get the head value
- Fetch the artifact from the API at /api/artifacts/<head>
- Verify the SHA256 hash matches the head value
- Unpack the artifact to ./<label>/ directory

## Start a Node
To start a node, complete the sequence:
1. registerLineage → 
2. acceptLineage → 
3. start

## Guest Joining
Guests join through the website by logging in with email, which creates a wallet and a name under guests.ethplane.eth.

## Swarm Menu Presets
1. **SOLO autoresearch C1** - Single-agent research with minimal coordination
2. **HUB-SPOKE swarm C3** - Centralized coordination with spoke nodes
3. **ROUTED autoresearch C2** - Distributed routing with shared objectives  
4. **VERIFY** - Verification-focused tasks with quality control
5. **BRIEF** - Quick overview and status reporting tasks
6. **STATUS** - Status monitoring and reporting tasks
7. **TASK** - General task assignment and execution
