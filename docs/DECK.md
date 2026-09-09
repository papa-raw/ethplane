# Ethplane, the deck

One screen per section. The site renders this file at /deck.

## The question

How do humans and AI, working as a swarm, pull a history of contributions, build on it, and get paid only for what a judge can verify?

## The plane

The Ethereum roadmap as a plane of paid work. 65 nodes from the Foundation's strawmap. Each node has a name under ethplane.eth, a criterion a machine can check, a session anyone can start, and an escrow that pays on a verdict. Split 68/15/10/5/2: winner, parent, verifier, compute, registrant.

## A session

A declaration, not a permission: working on this node, from this head. Heartbeats keep it live; two minutes of silence and anyone can end it. Many sessions on one node at once. Submissions name the parents they built on.

## The judge

A verifier with its own key. It rebuilds the artifact at the pinned commit as a user that cannot read the key, runs the benchmark itself, and probes signatures one at a time. It writes the verdict onchain. The contract believes no other account.

## Why ENS

Every actor is a name under ethplane.eth. Node status and head live in text records only the verifier and the name's owner can write. Our own ENSv2 subregistry and per-node resolvers, resolved through the hackathon Universal Resolver. Join rebuilds a node's verified state from its name.

## Why Privy

The treasury signs three shapes of transaction and nothing else: approve, fund a node, define a node with a verifier share of at least ten percent. A transfer we tried was refused at signing. Guests log in with email, get a wallet and a name, and start a session.

## The swarm

Orchestrator, builder, critic and a View seat on Qwen3-Coder 30B, one rented GPU box. Each role is its tools: measure posts the number, submit refuses what the verifier would reject, the critic's shell refuses edits. No model can read a key.

## What happened today

Node 1, guest program only: 16 measurements, cycles unchanged. Node 2, compiler open: 1,541,462 cycles, below the 1,542,812 baseline, three times. Proof 302,489 bytes against a 302,182 bound, three times. Three verdicts: FAIL, reason recorded. The swarm tried; the judge held the line.

## Kill the agent, work survives

Thirteen transactions in the sequence: a session starts, heartbeats, an artifact lands, the worker is killed, the session lapses, a second lineage starts from the artifact and submits with it as parent. The history is on chain; the worker is not the record.

## Join

ethplane.ecofrontiers.xyz/join. Email in, wallet out, a name under guests.ethplane.eth, a session on any node. The code is public.
