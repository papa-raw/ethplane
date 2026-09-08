# Coverage table v2.3 (2026-09-08) — 65 rows from coverage.json

Counts: reviewed checklist 29, proof check 10, spec conformance 10, test suite 8, metric 8. Judgement data exists: unknown 32, no 29, yes 4. EF Hegotá tier present on 9 rows.


## CL


### fork G

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| cl-epbs | ePBS | SFI | SFI | open | test suite | the submission passes the relevant test suite for 'ePBS' with no regressions | yes (ethereum/consensus-spec-tests tests/mainnet/gloas/) | CPU-hours | sequential (C2) | 1 | [] |
| cl-fast-confirmation | fast confirmation | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'fast confirmation' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'fast confirmation' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |

### fork H

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| cl-crypto-specs-lean4 | cryptography specs in Lean 4 | none |  | open | proof check | the submitted artefact passes the proof/type checker or known-answer test vectors for 'cryptography specs in Lean 4' | unknown | proof-checker time | single agent (C1) per proof attempt; verifier is the checker; several lineages may attempt in parallel | 4 | ["identify or build the checker/KAT-vector source for 'cryptography specs in Lean 4' -- named candidate repos noted in judgement_data, none independently confirmed this pass"] |
| cl-focil | FOCIL | SFI | S | open | test suite | the submission passes the relevant test suite for 'FOCIL' with no regressions | yes (ethereum/consensus-spec-tests tests/mainnet/eip7805/) | CPU-hours | sequential (C2) | 1 | ['confirm multi-client devnet test status directly (search-summarized only this pass, not independently fetched)'] |
| cl-post-quantum-pubkey-registry | post quantum pubkey registry | none |  | open | proof check | the submitted artefact passes the proof/type checker or known-answer test vectors for 'post quantum pubkey registry' | unknown | proof-checker time | single agent (C1) per proof attempt; verifier is the checker; several lineages may attempt in parallel | 4 | ["identify or build the checker/KAT-vector source for 'post quantum pubkey registry' -- named candidate repos noted in judgement_data, none independently confirmed this pass"] |

### fork I

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| cl-beacon-leancl-specs-merge | beacon & leanCL specs merge | none |  | open | proof check | the submitted artefact passes the proof/type checker or known-answer test vectors for 'beacon & leanCL specs merge' | unknown | proof-checker time | single agent (C1) per proof attempt; verifier is the checker; several lineages may attempt in parallel | 4 | ["identify or build the checker/KAT-vector source for 'beacon & leanCL specs merge' -- named candidate repos noted in judgement_data, none independently confirmed this pass"] |
| cl-decoupled-consensus | decoupled consensus | none |  | headliner, checklist pending EIP | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'decoupled consensus' | no | reviewer time | orchestrated (C4) | 3 | ["name and recruit the reviewer panel for 'decoupled consensus' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |
| cl-post-quantum-heartbeat | post quantum heartbeat | none |  | open | proof check | the submitted artefact passes the proof/type checker or known-answer test vectors for 'post quantum heartbeat' | unknown | proof-checker time | single agent (C1) per proof attempt; verifier is the checker; several lineages may attempt in parallel | 3 | ["identify or build the checker/KAT-vector source for 'post quantum heartbeat' -- named candidate repos noted in judgement_data, none independently confirmed this pass"] |
| cl-quick-slots | quick slots | EIP | B | open | test suite | the submission passes the relevant test suite for 'quick slots' with no regressions | unknown | CPU-hours | sequential (C2) | 3 | ["resolve the EIP number behind 'quick slots' (not individually looked up in eth-governance.md -- 14 of 20 EIP/SFI/CFI-tagged nodes are still unresolved) and check execution-spec-tests / consensus-spec-tests for existing vectors"] |
| cl-tapered-issuance-burn | tapered issuance burn | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'tapered issuance burn' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'tapered issuance burn' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |

### fork L

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| cl-1-round-finality | 1-round finality | none |  | headliner, checklist pending EIP | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for '1-round finality' | no | reviewer time | orchestrated (C4) | 3 | ["name and recruit the reviewer panel for '1-round finality' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |
| cl-attester-proposer-separation | attester-proposer separation | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'attester-proposer separation' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'attester-proposer separation' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |
| cl-pq-leanxmss-attestations | PQ leanXMSS attestations | none |  | open (PoC node) | metric | python-verifier/verifier.py accepts the proof on the verifier's fresh inputs; wall time beats the current best by more than the published noise-floor threshold; proof size and verify time do not regress | yes (https://github.com/leanEthereum/leanVM, python-verifier/verifier.py) | CPU-hours | sequential (C2) | 3 | Linux/server timing unknown until P10 (all published numbers are M4 Max); CLI parser file not yet located; hot-path crate confirmed by profiling on Day 1 |
| cl-real-time-cl-proofs | real-time CL proofs | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'real-time CL proofs' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'real-time CL proofs' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |
| cl-tech-debt-reset | tech debt reset | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'tech debt reset' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'tech debt reset' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |

### fork I-L (bar)

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| cl-slot-duration-decreases | slot duration decreases | none |  | open | metric | the submitted benchmark meets or exceeds the node's target metric for 'slot duration decreases', computed by the verifier on held-out conditions | unknown | GPU-hours | sequential (C2) | 4 | ["confirm or build a benchmark harness and held-out measurement environment for 'slot duration decreases'"] |

### fork longer term

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| cl-51pct-attack-auto-recovery | 51% attack auto-recovery | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for '51% attack auto-recovery' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for '51% attack auto-recovery' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |
| cl-distributed-block-building | distributed block building | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'distributed block building' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'distributed block building' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |
| cl-return-to-1m-attesters | return to 1M attesters | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'return to 1M attesters' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'return to 1M attesters' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |
| cl-secret-proposers | secret proposers | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'secret proposers' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'secret proposers' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |
| cl-vdf-randomness | VDF randomness | none |  | open | proof check | the submitted artefact passes the proof/type checker or known-answer test vectors for 'VDF randomness' | unknown | proof-checker time | single agent (C1) per proof attempt; verifier is the checker; several lineages may attempt in parallel | 4 | ["identify or build the checker/KAT-vector source for 'VDF randomness' -- named candidate repos noted in judgement_data, none independently confirmed this pass"] |

### fork north star

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| cl-fast-l1 | fast L1 | none |  | open | metric | the submitted benchmark meets or exceeds the node's target metric for 'fast L1', computed by the verifier on held-out conditions | unknown | GPU-hours | sequential (C2) | 5 | ["confirm or build a benchmark harness and held-out measurement environment for 'fast L1'"] |

## DL


### fork G

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| dl-cell-level-deltas | cell-level deltas | CFI |  | open | test suite | the submission passes the relevant test suite for 'cell-level deltas' with no regressions | unknown | CPU-hours | sequential (C2) | 2 | ["resolve the EIP number behind 'cell-level deltas' (not individually looked up in eth-governance.md -- 14 of 20 EIP/SFI/CFI-tagged nodes are still unresolved) and check execution-spec-tests / consensus-spec-tests for existing vectors", 'DEVIATION: DL layer has no named spec-tests repo in the handoff rules; this row was classified as test suite via consensus-spec-tests by judgement, not by rule -- confirm with a DL-specific test source before relying on this'] |
| dl-sparse-blobpool | sparse blobpool | CFI |  | open | test suite | the submission passes the relevant test suite for 'sparse blobpool' with no regressions | unknown | CPU-hours | sequential (C2) | 2 | ["resolve the EIP number behind 'sparse blobpool' (not individually looked up in eth-governance.md -- 14 of 20 EIP/SFI/CFI-tagged nodes are still unresolved) and check execution-spec-tests / consensus-spec-tests for existing vectors", 'DEVIATION: DL layer has no named spec-tests repo in the handoff rules; this row was classified as test suite via consensus-spec-tests by judgement, not by rule -- confirm with a DL-specific test source before relying on this'] |

### fork H

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| dl-local-blob-reconstruction | local blob reconstruction | none | related: C | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'local blob reconstruction' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'local blob reconstruction' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |

### fork I

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| dl-leanvm | leanVM | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'leanVM' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'leanVM' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |
| dl-pq-leanda-sampling | PQ leanDA sampling | none |  | open | proof check | the submitted artefact passes the proof/type checker or known-answer test vectors for 'PQ leanDA sampling' | unknown | proof-checker time | single agent (C1) per proof attempt; verifier is the checker; several lineages may attempt in parallel | 4 | ["identify or build the checker/KAT-vector source for 'PQ leanDA sampling' -- named candidate repos noted in judgement_data, none independently confirmed this pass"] |

### fork K

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| dl-post-quantum-l1 | post quantum L1 | none |  | open | proof check | the submitted artefact passes the proof/type checker or known-answer test vectors for 'post quantum L1' | unknown | proof-checker time | single agent (C1) per proof attempt; verifier is the checker; several lineages may attempt in parallel | 5 | ["identify or build the checker/KAT-vector source for 'post quantum L1' -- named candidate repos noted in judgement_data, none independently confirmed this pass"] |

### fork L

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| dl-remove-blob-transaction-type | remove blob transaction type | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'remove blob transaction type' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'remove blob transaction type' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |

### fork I-L (bar)

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| dl-data-availability-increases | data availability increases | none |  | open | metric | the submitted benchmark meets or exceeds the node's target metric for 'data availability increases', computed by the verifier on held-out conditions | unknown | GPU-hours | sequential (C2) | 4 | ["confirm or build a benchmark harness and held-out measurement environment for 'data availability increases'"] |

### fork longer term

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| dl-blob-streaming | blob streaming | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'blob streaming' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'blob streaming' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |
| dl-proofs-of-custody | proofs of custody | none |  | open | proof check | the submitted artefact passes the proof/type checker or known-answer test vectors for 'proofs of custody' | unknown | proof-checker time | single agent (C1) per proof attempt; verifier is the checker; several lineages may attempt in parallel | 4 | ["identify or build the checker/KAT-vector source for 'proofs of custody' -- named candidate repos noted in judgement_data, none independently confirmed this pass"] |
| dl-short-dated-blob-futures | short-dated blob futures | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'short-dated blob futures' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'short-dated blob futures' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |

### fork north star

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| dl-teragas-l2 | teragas L2 | none |  | open | metric | the submitted benchmark meets or exceeds the node's target metric for 'teragas L2', computed by the verifier on held-out conditions | unknown | GPU-hours | sequential (C2) | 5 | ["confirm or build a benchmark harness and held-out measurement environment for 'teragas L2'"] |

## EL


### fork G

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| el-bals | BALs | SFI | SFI | open | test suite | the submission passes the relevant test suite for 'BALs' with no regressions | yes (ethereum/execution-spec-tests tests/amsterdam/eip7928_block_level_access_lists/) | CPU-hours | sequential (C2) | 1 | [] |
| el-evm-asm-canonical-guest | evm-asm canonical guest | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'evm-asm canonical guest' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'evm-asm canonical guest' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |
| el-frame-transactions | frame transactions | CFI | S | open | test suite | the submission passes the relevant test suite for 'frame transactions' with no regressions | unknown | CPU-hours | sequential (C2) | 1 | ["resolve the EIP number behind 'frame transactions' (not individually looked up in eth-governance.md -- 14 of 20 EIP/SFI/CFI-tagged nodes are still unresolved) and check execution-spec-tests / consensus-spec-tests for existing vectors"] |
| el-glamsterdam-repricing | Glamsterdam repricing | CFI |  | open | test suite | the submission passes the relevant test suite for 'Glamsterdam repricing' with no regressions | unknown | CPU-hours | sequential (C2) | 2 | ["resolve the EIP number behind 'Glamsterdam repricing' (not individually looked up in eth-governance.md -- 14 of 20 EIP/SFI/CFI-tagged nodes are still unresolved) and check execution-spec-tests / consensus-spec-tests for existing vectors"] |
| el-keyed-nonces-recent-roots | keyed nonces & recent roots | EIP | A | open | spec conformance | the submission's behavior matches the referenced EIP's spec tests bit-for-bit | unknown | CPU-hours | sequential (C2) | 2 | ["resolve the EIP number behind 'keyed nonces & recent roots' (not individually looked up in eth-governance.md -- 14 of 20 EIP/SFI/CFI-tagged nodes are still unresolved) and check execution-spec-tests / consensus-spec-tests for existing vectors"] |

### fork H

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| el-data-repricing | data repricing | EIP |  | open | spec conformance | the submission's behavior matches the referenced EIP's spec tests bit-for-bit | unknown | CPU-hours | sequential (C2) | 3 | ["resolve the EIP number behind 'data repricing' (not individually looked up in eth-governance.md -- 14 of 20 EIP/SFI/CFI-tagged nodes are still unresolved) and check execution-spec-tests / consensus-spec-tests for existing vectors"] |
| el-ephemeral-keys | ephemeral keys | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'ephemeral keys' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'ephemeral keys' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |
| el-ethp2p-broadcast | ethp2p broadcast | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'ethp2p broadcast' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'ethp2p broadcast' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |
| el-evmify-long-tail-precompiles | EVMify long-tail precompiles | EIP | C | open | spec conformance | the submission's behavior matches the referenced EIP's spec tests bit-for-bit | unknown | CPU-hours | sequential (C2) | 4 | ["resolve the EIP number behind 'EVMify long-tail precompiles' (not individually looked up in eth-governance.md -- 14 of 20 EIP/SFI/CFI-tagged nodes are still unresolved) and check execution-spec-tests / consensus-spec-tests for existing vectors"] |
| el-optional-2of3-proofs | optional 2-of-3 proofs | EIP | A | open | spec conformance | the submission's behavior matches the referenced EIP's spec tests bit-for-bit | unknown | CPU-hours | sequential (C2) | 2 | ["resolve the EIP number behind 'optional 2-of-3 proofs' (not individually looked up in eth-governance.md -- 14 of 20 EIP/SFI/CFI-tagged nodes are still unresolved) and check execution-spec-tests / consensus-spec-tests for existing vectors"] |
| el-state-asm | state-asm | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'state-asm' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'state-asm' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |

### fork I

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| el-multidimensional-pricing | multidimensional pricing | EIP |  | open | spec conformance | the submission's behavior matches the referenced EIP's spec tests bit-for-bit | unknown | CPU-hours | sequential (C2) | 3 | ["resolve the EIP number behind 'multidimensional pricing' (not individually looked up in eth-governance.md -- 14 of 20 EIP/SFI/CFI-tagged nodes are still unresolved) and check execution-spec-tests / consensus-spec-tests for existing vectors"] |
| el-partitioned-binary-tree | partitioned binary tree | EIP |  | open | spec conformance | the submission's behavior matches the referenced EIP's spec tests bit-for-bit | unknown | CPU-hours | sequential (C2) | 3 | ["resolve the EIP number behind 'partitioned binary tree' (not individually looked up in eth-governance.md -- 14 of 20 EIP/SFI/CFI-tagged nodes are still unresolved) and check execution-spec-tests / consensus-spec-tests for existing vectors"] |
| el-pureth-purges | pureth purges | EIP |  | open | spec conformance | the submission's behavior matches the referenced EIP's spec tests bit-for-bit | unknown | CPU-hours | sequential (C2) | 3 | ["resolve the EIP number behind 'pureth purges' (not individually looked up in eth-governance.md -- 14 of 20 EIP/SFI/CFI-tagged nodes are still unresolved) and check execution-spec-tests / consensus-spec-tests for existing vectors"] |

### fork J

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| el-leanda-block-sampling | leanDA block sampling | EIP |  | open | spec conformance | the submission's behavior matches the referenced EIP's spec tests bit-for-bit | unknown | CPU-hours | sequential (C2) | 3 | ["resolve the EIP number behind 'leanDA block sampling' (not individually looked up in eth-governance.md -- 14 of 20 EIP/SFI/CFI-tagged nodes are still unresolved) and check execution-spec-tests / consensus-spec-tests for existing vectors"] |
| el-pq-leansphincs-transactions | PQ leanSPHINCS transactions | EIP |  | open | proof check | the submitted artefact passes the proof/type checker or known-answer test vectors for 'PQ leanSPHINCS transactions' | unknown | proof-checker time | single agent (C1) per proof attempt; verifier is the checker; several lineages may attempt in parallel | 3 | ["identify or build the checker/KAT-vector source for 'PQ leanSPHINCS transactions' -- named candidate repos noted in judgement_data, none independently confirmed this pass"] |
| el-validity-only-partial-state | validity-only partial state | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'validity-only partial state' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'validity-only partial state' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |

### fork K

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| el-decentralized-state | decentralized state | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'decentralized state' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'decentralized state' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |
| el-leansphincs-mempool | leanSPHINCS mempool | EIP |  | open | proof check | the submitted artefact passes the proof/type checker or known-answer test vectors for 'leanSPHINCS mempool' | unknown | proof-checker time | single agent (C1) per proof attempt; verifier is the checker; several lineages may attempt in parallel | 3 | ["identify or build the checker/KAT-vector source for 'leanSPHINCS mempool' -- named candidate repos noted in judgement_data, none independently confirmed this pass"] |
| el-mandatory-1of1-proofs | mandatory 1-of-1 proofs | none |  | headliner, checklist pending EIP | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'mandatory 1-of-1 proofs' | no | reviewer time | orchestrated (C4) | 3 | ["name and recruit the reviewer panel for 'mandatory 1-of-1 proofs' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |
| el-zkzk-frames | zkzk frames | none |  | headliner, checklist pending EIP | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'zkzk frames' | no | reviewer time | orchestrated (C4) | 3 | ["name and recruit the reviewer panel for 'zkzk frames' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |

### fork L

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| el-ethp2p-unification | ethp2p unification | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'ethp2p unification' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'ethp2p unification' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |
| el-native-rollups | native rollups | EIP |  | open | spec conformance | the submission's behavior matches the referenced EIP's spec tests bit-for-bit | unknown | CPU-hours | sequential (C2) | 3 | ["resolve the EIP number behind 'native rollups' (not individually looked up in eth-governance.md -- 14 of 20 EIP/SFI/CFI-tagged nodes are still unresolved) and check execution-spec-tests / consensus-spec-tests for existing vectors"] |

### fork H-L (bar)

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| el-gas-limit-increases | gas limit increases | none |  | open | metric | the submitted benchmark meets or exceeds the node's target metric for 'gas limit increases', computed by the verifier on held-out conditions | unknown | GPU-hours | sequential (C2) | 4 | ["confirm or build a benchmark harness and held-out measurement environment for 'gas limit increases'"] |

### fork longer term

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| el-encrypted-mempool | encrypted mempool | EIP |  | open | spec conformance | the submission's behavior matches the referenced EIP's spec tests bit-for-bit | unknown | CPU-hours | sequential (C2) | 3 | ["resolve the EIP number behind 'encrypted mempool' (not individually looked up in eth-governance.md -- 14 of 20 EIP/SFI/CFI-tagged nodes are still unresolved) and check execution-spec-tests / consensus-spec-tests for existing vectors"] |
| el-endgame-state | endgame state | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'endgame state' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'endgame state' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |
| el-lean-privacy-pool-wormholes | lean privacy pool & wormholes | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'lean privacy pool & wormholes' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'lean privacy pool & wormholes' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |
| el-long-dated-gas-futures | long-dated gas futures | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'long-dated gas futures' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'long-dated gas futures' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |
| el-sharded-mempool | sharded mempool | none |  | specification only | reviewed checklist | a majority of the assigned reviewer panel scores the submission as meeting the node's checklist for 'sharded mempool' | no | reviewer time | orchestrated (C4) | 4 | ["name and recruit the reviewer panel for 'sharded mempool' (two reviewers if headliner, per SS13.1) before this node opens for claims"] |

### fork north star

| id | label | tag | EF tier | state | criterion type | criterion | judgement exists | compute | routing | priority | open questions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| el-gigagas-l1 | gigagas L1 | none |  | open | metric | the submitted benchmark meets or exceeds the node's target metric for 'gigagas L1', computed by the verifier on held-out conditions | unknown | GPU-hours | sequential (C2) | 5 | ["confirm or build a benchmark harness and held-out measurement environment for 'gigagas L1'"] |
| el-private-l1 | private L1 | none |  | open | metric | the submitted benchmark meets or exceeds the node's target metric for 'private L1', computed by the verifier on held-out conditions | unknown | GPU-hours | sequential (C2) | 5 | ["confirm or build a benchmark harness and held-out measurement environment for 'private L1'"] |
