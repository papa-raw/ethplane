# Project name (Ethplane)

Ethplane

# One-line description (≤ 120 characters)

A collaborative plane for research and engineering work with ENS addressing, Privy treasury, and swarm coordination.

# Description (≤ 250 words: the question, the plane, the first node, what is live)

The question is: how can we design a collaborative plane that lets humans and AI, working as a swarm, pull and rebuild a history of contributions, build on it, and receive attribution for their own contributions? 

Ethplane is a task registry and verification system for research and engineering work. It holds a roadmap as a set of nodes, lets many independent agent groups and people work on those nodes in parallel, verifies results with code the contributors cannot modify, records every contribution as a content-addressed checkpoint addressable by an ENS name, and pays out on verified results under an organisation's policy.

Its first history is the Ethereum protocol roadmap: the 65 nodes of the EF strawmap, classified by criterion type and routed by task shape, with the EF's own maturity pipeline as the node lifecycle and the Hegotá tier list as priority. The proof of concept runs one node.

Live: https://ethplane.ecofrontiers.xyz — the 65-node map, the node pages, the deck and the docs. Contracts, names and treasury on Sepolia: docs/DEPLOYMENTS.md. The first node, cl-pq-leanxmss-attestations.ethplane.eth, is open with a funded bounty and a recorded baseline; its acceptance criterion is docs/CRITERION-pq-leanxmss.md.

# How it is made (≤ 300 words: contracts, our ENSv2 subregistry and per-node resolvers and why, the Privy treasury policy, the indexer and dashboard, the verifier with differential probes, the local-model swarm with an orchestrator that has four tools and no shell)

Ethplane is built with smart contracts on Sepolia, ENSv2 names for addressing, and a Privy server wallet for treasury policy. The contracts include Ethplane (registry, sessions, submissions, measurements, escrow, attribution), PlaneToken (PLANE, test ERC-20), EthplaneSubregistry (our ENSv2 registry under ethplane.eth), and per-node resolvers.

Our ENSv2 subregistry and per-node resolvers are implemented because the hackathon deployment's registry and resolver implementations expose no initializer, so proxies from its factory hold no roles and cannot register names or write records. Additionally, the deployed resolver scopes record roles per key rather than per name. 

The Privy treasury policy allows only approve(PLANE → Ethplane), fundNode with amount ≤ 100,000 PLANE, and defineNode whose split gives the verifier at least 10%. Every other transaction is refused at signing.

The indexer and dashboard are built with Node.js and Next.js respectively, using viem for contract interaction and SQLite for local storage. The dashboard is a web application that renders the EF strawmap as an interactive graph, showing node details and enabling users to join tasks.

The verifier with differential probes is a Python-based system that runs submissions on verifier-owned compute against held-out data. It performs differential probes at 900 signature indices to ensure all signatures are properly checked, with each probe taking about 15 seconds on the verifier's host.

The local-model swarm consists of role sessions in tmux with an orchestrator that has four tools and no shell. The orchestrator handles coordination, building, critiquing, and testing tasks in parallel.

# ENS track statement (≤ 150 words, addressed to the ENS judges: what is central, not cosmetic, and which ENSv2 features are used: hierarchical registries, expiring names, per-node resolvers, Universal Resolver resolution, agents as namespaces)

ENS is central to Ethplane's architecture, not cosmetic. Every actor is a name under ethplane.eth: the 65 roadmap nodes, operators, their lineages (the agents), the verifier and guests. Hierarchical registries are used through our own subregistry. Expiring names are used for sessions and guest names after fourteen days. Per-node resolvers handle each node's records. Universal Resolver resolution enables ethplane join <name> to work from any machine. Agents are namespaces through their subnames under operator identities.

# Privy track statement (≤ 150 words: the policy rules, the refusal, guests with embedded wallets, which of the two Privy tracks each part serves)

The Privy policy rules allow exactly three actions: approve(PLANE → Ethplane), fundNode under a cap, and defineNode whose split gives the verifier at least ten percent. Everything else is refused before a signature exists (RPC request denied due to policy violation, recorded on the node page). Guests log in with email or a wallet, receive an embedded wallet, and get a guest name under guests.ethplane.eth; their sessions and submissions go through a relay with EIP-712 signatures. The policy serves the treasury track, ensuring funds are managed according to organizational policy.

# Links (site, repo, docs/DEPLOYMENTS.md, the node page URL for cl-pq-leanxmss-attestations)

Site: https://ethplane.ecofrontiers.xyz
Repo: https://github.com/Ecofrontiers/ethplane
Docs/DEPLOYMENTS.md: docs/DEPLOYMENTS.md
Node page URL: https://ethplane.ecofrontiers.xyz/node/cl-pq-leanxmss-attestations

# Honest limitations (≤ 100 words: the compiler is frozen so a pass is unlikely on the first node; the 7B model could not call tools; what runs where)

The compiler is frozen so a pass is unlikely on the first node. The 7B model could not call tools. The verifier and dashboard run on dedicated machines, while the local-model swarm with orchestrator runs locally in tmux sessions. The contracts and indexer run on Sepolia testnet.