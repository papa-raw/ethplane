<!-- planning artifact: a day-one specification written for the local-model swarm on 2026-09-07/08. Historical; what shipped is described in docs/ and README.md, and differs where the record says so. -->


[line redacted: private material]
# one deliberate edge case per story; Instrumentation / Depends on / Out of scope; traceability tags @prd:<section> @test:<name>. Version 2, 2026-09-08.
[line redacted: private material]
# The agent chose each edge case; Pat or the critic confirms it is the risky path.

Feature: Node definition and funding  # @prd:3.3.2 @prd:3.21 @prd:3.5 @sponsor:privy
  Background:
    Given PlaneToken and Ethplane are deployed on Sepolia and the 65 strawmap ids are seeded
    And the Privy organisation wallet holds PLANE and is bound to the treasury policy
    And ethplane.eth has its subregistry set and the shared PermissionedResolver at 0x068D…

  @prd:3.3.2 @test:test_registrantDefinesOwnNode
  Scenario: The owner of a node name defines the node
    Given "cl-pq-leanxmss-attestations.ethplane.eth" is owned by the maintainer wallet
    When the maintainer calls defineNode with lane 0, 900 s lease, 120 s heartbeat, Split{6800,1500,1000,500,200}, targetGainBps 1000, thresholdBps 0
    Then NodeDefined is emitted with registrant = maintainer and the node is "registered, no verifier"
  @prd:3.3.2 @test:test_defineNodeRejectsBadSplit
  Scenario: A split that shortchanges the verifier is refused (edge)
    Given the same name owner
    When defineNode is called with Split{7500,1500,500,300,200}
    Then it reverts with SplitFloor and no node exists
  # Instrumentation: NodeDefined count per registrant. Depends on: strawmap seed, resolver addr lookup. Out of scope: renaming or redefining a node.

  @prd:3.3.2 @prd:3.21 @test:test_onlyStrawmapIdsRegistrable
  Scenario: Only strawmap ids can become nodes
    When defineNode is called with a nodeId not in the seeded list
    Then it reverts with NotAStrawmapId
  @prd:3.3.2 @test:test_defineNodeTwiceReverts
  Scenario: A node cannot be defined twice (edge)
    Given a defined node
    When anyone calls defineNode again for the same id
    Then it reverts with AlreadyDefined

  @prd:3.3.2 @test:test_setVerifierOnlyRegistrantBetweenLeases
  Scenario: The registrant assigns the node's verifier
    Given a defined node with no active lease
    When the registrant calls setNodeVerifier(nodeId, verifierAddr)
    Then VerifierSet is emitted and claims become possible once a baseline exists
  @prd:3.3.2 @test:test_setVerifierDuringLeaseReverts
  Scenario: The verifier cannot be swapped under an active lease (edge)
    Given an active lease
    When the registrant calls setNodeVerifier
    Then it reverts with LeaseActive
  # Instrumentation: VerifierSet events per node. Depends on: defineNode. Out of scope: verifier reputation.

  @prd:3.5 @prd:3.23 @sponsor:privy @film @test:privy.test.ts/fund-allowed
  Scenario: The treasury funds a node within policy
    Given the treasury policy allows approve(PLANE→Ethplane) and fundNode.amount ≤ 100000e18 for both eth_signTransaction and eth_sendTransaction
    When the API asks Privy to sign and send approve(Ethplane, 10_000e18) then fundNode(nodeId, 10_000e18)
    Then both are mined and NodeFunded(nodeId, treasury, 10_000e18, 10_000e18) is emitted
  @prd:3.5 @sponsor:privy @film @test:privy.test.ts/fund-refused
  Scenario: The policy refuses a funding above the cap (edge)
    When the API asks Privy to sign fundNode(nodeId, 200_000e18)
    Then Privy refuses at signing with "RPC request denied due to policy violation" and no transaction exists
  # Instrumentation: policy refusals logged with rule name. Depends on: policy id in .env, PLANE address. Out of scope: multi-sig quorum (optional).

  @prd:3.3.2 @test:test_multipleFundersAccumulate
  Scenario: A second funder adds to the bounty
    Given a node funded 10,000 by the treasury
    When a guest wallet approves and calls fundNode(nodeId, 500e18)
    Then bounty is 10,500 and funded[nodeId][guest] is 500
  @prd:3.3.2 @test:test_withdrawUnusedProRata
  Scenario: After close, each funder recovers only their pro-rata remainder (edge)
    Given bounty 10,500, released 3,000, node closed
    When the guest calls withdrawUnused
    Then the guest receives 7,500 × 500/10,500 and a second call reverts with AlreadyWithdrawn
  # Instrumentation: UnusedWithdrawn per funder. Depends on: closeNode. Out of scope: partial refunds before close.

Feature: Identity and names  # @prd:3.4 @sponsor:ens
  @prd:3.4 @test:ens/tests/calldata.test.ts
  Scenario: Every actor is a name under ethplane.eth pointing at the shared resolver
    Given the subregistry under ethplane.eth
    When Day-1 step 3 creates the node, operator, lineage, verifier and guests names with --resolver 0x068D…
    Then each resolves through the Universal Resolver proxy 0xeEeE…EeEe with the expected owner
  @prd:3.4 @test:ens/tests/calldata.test.ts
  Scenario: A client never falls back to a hard-coded address (edge)
    Given ens/deployments.json is removed
    When a client starts
    Then it fails loudly with "no deployments.json" instead of using a baked address

  @prd:3.4 @sponsor:ens @film @test:ens/tests/roles.test.ts
  Scenario: The verifier key writes the node's head record
    Given authorizeTextRoles(node, "ethplane.head", verifier, true) was granted by the admin
    When the verifier calls setText(node, "ethplane.head", <hash>)
    Then the record reads back through the Universal Resolver
  @prd:3.4 @sponsor:ens @film @test:ens/tests/roles.test.ts
  Scenario: A lineage key is refused the same write (edge)
    When qwen-a's key calls setText(node, "ethplane.head", <hash>)
    Then the resolver reverts with an EAC unauthorised error and the record is unchanged
  # Instrumentation: count refused setText attempts (from tx receipts). Depends on: grant-roles.ts. Out of scope: roles on non-text records.

  @prd:3.4 @sponsor:ens @test:ens/tests/expiry.test.ts
  Scenario: A lineage name lapses when its lease is not renewed
    Given "qwen-a.ecofrontiers.ethplane.eth" created with duration = lease + cooldown
    When the duration passes with no renewal
    Then the name no longer resolves
  @prd:3.4 @sponsor:ens @test:ens/tests/expiry.test.ts
  Scenario: A heartbeat renews the lineage name before it lapses (edge)
    Given the lineage heartbeats within heartbeatEvery
    When the operator's renewal call follows the heartbeat
    Then the expiry moves forward and the name keeps resolving
  # Instrumentation: renewals per lineage. Depends on: heartbeat loop. Out of scope: renewing guest names.

  @prd:3.4 @test:ens/tests/records.test.ts
  Scenario: Discovery and state records are present with documented formats
    Given Day-1 step 6 has run
    When a client reads the node name and a lineage name through the Universal Resolver
    Then the node name returns the six ethplane.* records in their documented formats and the lineage name returns agent-context (and agent-endpoint[mcp] where an endpoint exists)
  @prd:3.4 @test:ens/tests/records.test.ts
  Scenario: A malformed record value is rejected by the writer script (edge)
    When set-records.ts is given an ethplane.lease value that is not the documented JSON shape
    Then it exits non-zero and writes nothing

Feature: Guests join and act  # @prd:3.5 @prd:3.6 @prd:3.21 @sponsor:privy @sponsor:ens
  @prd:3.5 @film @test:api/tests/join.test.ts
  Scenario: A judge logs in and receives a wallet and a guest name
    When a new user logs in with email through PrivyProvider
    Then Privy creates an embedded Ethereum wallet, POST /api/join verifies the token, creates "judge-<n>.guests.ethplane.eth" owned by that wallet with duration 14 days, and returns {guestName, wallet}
  @prd:3.5 @test:api/tests/join.test.ts
  Scenario: A replayed or forged access token is refused (edge)
    When POST /api/join receives a token that fails privy.verifyAuthToken
    Then it returns 401 and creates nothing
  # Instrumentation: joins per day, join failures by reason. Depends on: Privy app config (create-on-login, allowed domains). Out of scope: GitHub login.

  @prd:3.21 @film @test:api/tests/register.test.ts @test:test_registrantDefinesOwnNode
  Scenario: A guest registers an unregistered node
    Given a node tile in state "unregistered" and a logged-in guest with a wallet
    When the guest clicks "Register this node" and signs the subname-create and defineNode calldata
    Then the node shows the guest as registrant and its registrant share is 200 bps
  @prd:3.21 @test:api/tests/register.test.ts
  Scenario: Registering an already registered node is refused (edge)
    When a guest clicks Register on a registered node
    Then the control is disabled and the API returns 409 if called directly
  # Instrumentation: registrations per guest. Depends on: strawmap seed, guest wallet gas. Out of scope: funding at registration (optional).

  @prd:3.3.2 @test:test_relayReplayAndDeadline
  Scenario: A guest action goes through the relay with a valid EIP-712 signature
    When the guest signs ClaimFor(nodeId, fromHash, nonce, deadline) and the relay submits it
    Then the contract recovers the guest, consumes the nonce and creates the lease with lineage = guest
  @prd:3.3.2 @test:test_relayReplayAndDeadline
  Scenario: A replayed or expired signature is refused (edge)
    When the same signature is submitted again, or one with deadline < now
    Then it reverts with BadNonce or Expired
  # Instrumentation: relay submissions and reverts. Depends on: relays allow-list. Out of scope: relay fee.

Feature: Leases  # @prd:3.3.2 @prd:3.3.4
  @prd:3.3.2 @test:test_claim
  Scenario: A registered lineage claims from a known submission (the head by default)
    Given qwen-a registered under operator ecofrontiers, a baseline and a verifier exist
    When qwen-a calls claim(nodeId, head)
    Then LeaseClaimed(nodeId, qwen-a, ecofrontiers, head, expiry, seq) is emitted
  @prd:3.3.2 @test:test_claimWithoutBaselineReverts
  Scenario: A claim before the baseline is recorded is refused (edge)
    Given a defined, funded node whose verifier has not called recordBaseline
    When qwen-a calls claim(nodeId, 0)
    Then it reverts with NoBaseline
  # Instrumentation: claims per lineage. Depends on: registerLineage. Out of scope: lane 1 assignment UX.

  @prd:3.3.2 @film @test:test_heartbeatMissedForfeitsAndCooldownsOperator
  Scenario: A missed heartbeat forfeits the lease and cools the operator down
    Given an active lease with heartbeatEvery 120 s and 121 s since the last heartbeat
    When anyone calls forfeit(nodeId, qwen-a)
    Then LeaseForfeited(reason 2) is emitted and cooldownUntil[nodeId][ecofrontiers] = now + 900 s
  @prd:3.3.2 @test:test_forfeitHealthyLeaseReverts
  Scenario: A healthy lease cannot be forfeited (edge)
    Given the last heartbeat was 60 s ago
    When anyone calls forfeit
    Then it reverts with LeaseHealthy
  # Instrumentation: forfeits by reason. Depends on: heartbeat. Out of scope: slashing.

  @prd:3.3.4 @test:test_claimAlongsideTwoLineages
  Scenario: Two lineages of different operators hold leases on the same node
    Given lane 0
    When lineage A (operator X) and lineage B (operator Y) each claim
    Then two leases exist under keccak(nodeId, lineage) and each can submit
  @prd:3.3.2 @test:test_sameOperatorCooldownBlocksSecondLineage
  Scenario: A second lineage of a cooled-down operator is blocked (edge)
    Given operator ecofrontiers is in cooldown on the node
    When fast-b (also ecofrontiers) calls claim
    Then it reverts with Cooldown
  # Instrumentation: concurrent leases per node. Depends on: registerLineage. Out of scope: lease auctions.

  @prd:3.3.2 @film @test:test_secondLineageClaimsFromHash
  Scenario: Kill the agent, work survives
    Given qwen-a submitted artifact H (status PENDING, never judged) and its builder process was killed, so the lease forfeited
    When fast-b (another operator) claims from H and submits artifact H2 declaring H as a parent
    Then the reuse edge H → H2 is recorded, and on a paying verdict for H2 the PARENT share goes only to PASS parents, so qwen-a's operator is credited nothing for H until H itself is judged PASS
  @prd:3.3.2 @test:test_parentMustBeKnownSubmission
  Scenario: A hash that is not a submission on this node cannot be a parent (edge)
    When submit lists a hash from another node or random bytes in parents
    Then it reverts with UnknownParent

Feature: Submission, measurement, verdict  # @prd:3.3.2 @prd:3.7 @prd:3.22
  @prd:3.3.2 @test:test_submit
  Scenario: A lease holder submits an artifact
    When qwen-a calls submit(nodeId, artifactHash, parents)
    Then SubmissionMade is emitted with parents and the tarball is fetchable by hash from the API
  @prd:3.3.2 @test:test_parentsCapEight
  Scenario: More than eight parents is refused (edge)
    When submit lists nine parents
    Then it reverts with TooManyParents
  # Instrumentation: parents per submission. Depends on: artifact upload. Out of scope: parent weighting.

  @prd:3.7 @prd:3.22.1 @test:verifier/tests/run_test.py
  Scenario: The verifier rejects a diff outside the editable surface
    Given a submission whose diff touches crates/pcs
    When verifier/run.py runs
    Then recordMeasurement is called with verifierAccepted false, reason frozen-path, before any build
  @prd:3.7 @prd:3.22.2 @test:verifier/tests/run_test.py
  Scenario: A stale binary is refused (edge)
    Given a non-empty diff whose build yields the reference sha256
    When verifier/run.py compares the built binary's hash with the reference
    Then reason stale-binary and no measurement of cycles is trusted
  # Instrumentation: rejection reasons histogram. Depends on: LEANVM_COMMIT worktree. Out of scope: sandboxing the build.

  @prd:3.7 @prd:3.22.1 @film @test:verifier/tests/run_test.py
  Scenario: An honest rejection is recorded
    Given a submission that builds, verifies with the reference python verifier and does not reduce cycles
    When recordMeasurement is called
    Then status FAIL is stored and the node page shows the attempt with its cycles delta
  @prd:3.7 @prd:3.22.2 @test:verifier/tests/run_test.py
  Scenario: A negative vector that does not fail rejects the submission (edge)
    Given the three fixed-position negatives (index 0, 899, random) with random flip offsets
    When one negative run succeeds instead of failing
    Then verifierAccepted is false, reason negative-passed
  # Instrumentation: negative outcomes per submission. Depends on: reference build for input generation. Out of scope: fuzzing beyond byte flips.

  @prd:3.3.2 @prd:3.22.1 @film @test:test_verdictImprovementReleasesSplit
  Scenario: A passing submission is paid on cumulative progress
    Given originalMetric = bestMetric = 1,542,812, bounty 10,000, targetGainBps 1000
    When a submission measures 1,496,528 cycles and every check passes
    Then status PASS, head advances, payout 3,000 is credited as 2,040 winner / 450 parents / 300 verifier / 150 compute (escrow) / 60 registrant
  @prd:3.3.2 @test:test_cumulativePayoutEqualsOneShot
  Scenario: Ten one-cycle passes pay exactly what one combined pass pays (edge)
    When ten submissions each reduce cycles by one
    Then the total credited equals the single-pass payout for the same total reduction (zero here) and paidGainBps matches
  # Instrumentation: Payout events by kind. Depends on: recordBaseline once. Out of scope: token price.

  @prd:3.3.2 @test:test_headNeverRegresses
  Scenario: Better than original but worse than the frontier does not pass
    Given bestMetric < originalMetric
    When a submission measures between them
    Then status FAIL and head is unchanged
  @prd:3.3.2 @test:test_oneMeasurementPerArtifact
  Scenario: An artifact cannot be measured twice (edge)
    When recordMeasurement is called again for a judged artifact
    Then it reverts with AlreadyJudged

  @prd:3.3.2 @prd:3.22.1 @test:test_reviewFloor @test:verifier/tests/review_test.py
  Scenario: A drop above 20 % is held for human review
    When a submission reduces cycles by 25 % and all checks pass
    Then status REVIEW, nothing is credited, and the 900-index sweep result is attached to the evidence hash
  @prd:3.3.2 @prd:3.22.2 @test:test_reviewedRowRecorded
  Scenario: The registrant confirms or overturns a review (edge)
    When the registrant calls confirmReview(nodeId, artifactHash, false)
    Then status FAIL, ReviewConfirmed(…, false) is emitted as the human's attribution row, and head is unchanged
  # Instrumentation: REVIEW count, time-to-confirm. Depends on: registrant identity. Out of scope: multi-reviewer quorum.

  @prd:3.3.2 @test:test_headOnlyVerifier
  Scenario: Only the node's verifier records measurements
    When a lineage key calls recordMeasurement
    Then it reverts with NotVerifier
  @prd:3.3.2 @test:test_baselineOnce
  Scenario: The baseline cannot be re-recorded (edge)
    When the verifier calls recordBaseline a second time
    Then it reverts with BaselineSet

Feature: Rebuild from a name  # @prd:3.6 @prd:3.9 @sponsor:ens
  @prd:3.6 @film @test:cli/tests/join.test.ts
  Scenario: A clean machine rebuilds a node from its ENS name
    Given only the ethplane CLI is installed
    When `ethplane join cl-pq-leanxmss-attestations.ethplane.eth` runs
    Then it resolves head, parents and manifest from ENS, fetches artifacts by hash, verifies each hash and reconstructs the tree at head, listing every contributor lineage
  @prd:3.6 @test:cli/tests/join.test.ts
  Scenario: A tampered artifact aborts the rebuild (edge)
    Given the API serves an artifact whose bytes do not match its hash
    When join runs
    Then it aborts with "hash mismatch <hash>" and leaves no partial tree
  # Instrumentation: joins per node. Depends on: API /artifacts. Out of scope: IPFS mirroring.

Feature: Dashboard  # @prd:3.9 @prd:3.15
  @prd:3.9 @test:web/tests/*.test.tsx
  Scenario Outline: Every field shown has a source and three states
    When the <component> mounts
    Then the <component> reads <field> from <source> and renders loading, empty and error states
    Examples:
      | component     | field           | source                        |
      | NodeCard      | status          | /api/nodes/:id                |
      | LeaseTimeline | lease events    | /api/nodes/:id/leases         |
      | Attribution   | rows and totals | /api/nodes/:id/attribution    |
      | Funding       | bounty, policy  | /api/nodes/:id + Privy policy |
      | Map           | 65 nodes+state  | strawmap seed + /api/nodes    |
  @prd:3.9 @test:web/tests/api-down.test.tsx
  Scenario: The API is unreachable (edge)
    When /api/* times out
    Then every component shows its error state with a retry and the map still renders the 65 seeded nodes as "unknown"
  # Instrumentation: client error rate. Depends on: api.ts. Out of scope: offline mode.

  @prd:3.9 @prd:2.4 @test:web/tests/deck.test.tsx
  Scenario: Deck and docs are in the interface
    When a judge opens /deck and /docs
    Then /deck renders the explanatory slides (why ENS, why Privy, how the plane works) and /docs renders SPEC and CRITERION from the repo files

Feature: Swarms and the routing table  # @prd:3.8 @prd:3.16 @prd:3.19
  @prd:3.16 @test:swarm/tests/loop_test.py
  Scenario: The loop refuses an attempt that changed nothing
    When a harness call exits 0 but the editable files hash unchanged
    Then the attempt is logged changed=false and counted failed
  @prd:3.16 @test:swarm/tests/loop_test.py
  Scenario: A harness that edits a frozen path is caught locally before submission (edge)
    When the diff touches crates/pcs
    Then the loop discards the attempt and logs frozen-path without submitting
  # Instrumentation: attempts, changed rate, local rejections. Depends on: goose config per lineage. Out of scope: model fine-tuning.

  @prd:3.19 @prd:3.20 @test:swarm/tests/report_test.py
  Scenario: SOLO and ROUTED arms are compared on one criterion
    Given 250 attempts per arm on host A with the same model
    When the overnight report is generated
    Then the report states attempts, changed=true, verifier-accepted, cycles distribution per arm and the routing decision per ROUTED attempt

  @prd:3.13.1 @prd:3.22 @test:swarm/tests/signer_test.sh
  Scenario: Two lineages on one host cannot sign as each other
    Given signer-qwen-a and signer-fast-b users with separate sockets and groups
    When a qwen-a agent process connects to fast-b's socket
    Then the connection is refused by file permissions
  @prd:3.22 @test:swarm/tests/signer_test.sh
  Scenario: A key never enters a model context (edge)
    When the agent's environment and prompt files are grepped for the key material
    Then nothing matches; only the socket path is present

Feature: Submission package  # @prd:3.12 @prd:2.3
  @prd:3.12 @test:scripts/check-submission.sh
  Scenario: The submission meets ETHGlobal's rules
    When the submission form is completed
    Then the video is 2:00–4:00 real time with Pat's voice, the repo is public with ATTRIBUTION.md, README Sponsors, docs/SPEC.md and docs/CRITERION, and ENS + Privy (both Privy tracks) are selected within the three-slot cap
  @prd:3.12 @test:film/tests/refusal-links.test.ts
  Scenario: The film's refusal shots are real transactions (edge)
    When a judge clicks the links under the two refusal shots
    Then the EAC refusal and the policy refusal shown in the film link to a reverted tx / a logged policy denial, not a mock

Feature: Money moves (pull-based payouts, closing, refunds)  # @prd:3.3.2
  @prd:3.3.2 @test:test_withdrawPaysOwed
  Scenario: A credited operator withdraws what it is owed
    Given owed[ecofrontiers] is 2,040 PLANE after a PASS
    When ecofrontiers calls withdraw()
    Then 2,040 PLANE is transferred, owed is 0 and Withdrawn is emitted
  @prd:3.3.2 @test:test_withdrawNothingOwedReverts
  Scenario: Withdrawing with nothing owed reverts (edge)
    When an address with owed 0 calls withdraw()
    Then it reverts with NothingOwed
  # Instrumentation: Withdrawn totals per address. Depends on: _release credits. Out of scope: auto-push payouts.

  @prd:3.3.2 @test:test_parentShareSplitsAmongPassParents
  Scenario: The parents share goes to PASS parents of other operators
    Given a winning submission declaring three parents: a PASS artifact by operator X, a PASS artifact by the winner's own operator, and a PENDING artifact by operator Y
    When _release credits the PARENT share
    Then operator X receives the whole PARENT share, the winner's own parent is skipped, the PENDING parent is recorded as an edge but not paid
  @prd:3.3.2 @test:test_noEligibleParentsShareStaysInEscrow
  Scenario: With no eligible parents the share stays in escrow (edge)
    Given a winning submission with no parents
    When _release runs
    Then the PARENT share is not credited and remains in bounty − released

  @prd:3.3.2 @test:test_closeNodeRequiresNoLease
  Scenario: The registrant closes a node with no active lease
    When the registrant calls closeNode
    Then NodeClosed is emitted, open is false and further claims revert
  @prd:3.3.2 @test:test_fundClosedNodeReverts
  Scenario: Funding a closed node is refused (edge)
    When anyone calls fundNode on a closed node
    Then it reverts with Closed

Feature: Recovery from an unverified frontier  # @prd:3.3.2 @film
  @prd:3.3.2 @film @test:test_claimFromUnverifiedSubmission
  Scenario: A recovering lineage claims from the killed lineage's unverified artifact
    Given qwen-a submitted artifact H (status PENDING) and then forfeited
    When fast-b (another operator) calls claim(nodeId, H)
    Then the lease is created with fromHash H
  @prd:3.3.2 @test:test_claimFromForeignHashReverts
  Scenario: A hash that is not a submission on this node is refused (edge)
    When fast-b calls claim(nodeId, <a hash from another node or random bytes>)
    Then it reverts with UnknownSubmission

Feature: Lineage registration  # @prd:3.3.2
  @prd:3.3.2 @test:test_lineageTwoStepRegistration
  Scenario: A lineage key proposes and its operator accepts
    When the lineage key calls registerLineage(ecofrontiers, "ecofrontiers") and ecofrontiers calls acceptLineage(lineage)
    Then lineageOperator[lineage] is ecofrontiers and LineageRegistered is emitted
  @prd:3.3.2 @test:test_unacceptedLineageCannotClaim
  Scenario: A lineage nobody accepted cannot claim (edge)
    When a proposed-but-unaccepted lineage calls claim
    Then it reverts with NoOperator

Feature: Review independence  # @prd:3.3.2 @prd:3.22.1
  @prd:3.3.2 @test:test_reviewerNotRegistrantOrVerifier
  Scenario: The registrant sets a reviewer who is neither registrant nor verifier
    When the registrant calls setReviewer(addr)
    Then ReviewerSet is emitted
  @prd:3.3.2 @test:test_setReviewerToSelfReverts
  Scenario: Setting the registrant or the verifier as reviewer is refused (edge)
    When setReviewer is called with the registrant's or the verifier's address
    Then it reverts with ReviewerConflict