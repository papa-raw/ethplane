// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

interface IEnsRegistry {
    function ownerOf(uint256 tokenId) external view returns (address);
}

/// @title Ethplane — registry, leases, submissions, measurements, head, escrow and attribution
/// @notice One contract, per PRD 3.3.2. Head lives here rather than in a separate contract so
///         rotating a node's verifier cannot strand it. Metric values are raw cycle counts; no
///         scaling anywhere.
contract Ethplane is ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;

    enum Status { NONE, PENDING, FAIL, PASS, REVIEW }
    enum Kind { WINNER, PARENT, VERIFIER, COMPUTE, REGISTRANT }

    struct Split {
        uint16 winnerBps;
        uint16 parentBps;
        uint16 verifierBps;
        uint16 computeBps;
        uint16 registrantBps;
    }

    struct Node {
        address registrant;
        address verifier;
        address reviewer;
        bytes32 criterionHash;
        uint8 lane;
        address assignee;
        uint64 leaseDuration;
        uint64 heartbeatEvery;
        Split split;
        uint16 targetGainBps;
        uint16 thresholdBps;
        uint16 paidGainBps;
        uint256 originalMetric;
        uint256 bestMetric;
        uint256 baseProvingMicros;
        uint256 baseProofBytes;
        uint256 baseVerifyMicros;
        uint16 spreadBps;
        uint256 bounty;
        uint256 released;
        bytes32 head;
        uint256 leaseSeq;
        bool open;
        bool closed;
    }

    struct Lease {
        address lineage;
        address operator;
        uint64 start;
        uint64 expiry;
        uint64 lastHeartbeat;
        bytes32 fromHash;
        uint256 seq;
        bool active;
    }

    struct Submission {
        bytes32 nodeId;
        address lineage;
        address operator;
        uint256 leaseSeq;
        bytes32[] parents;
        Status status;
        uint256 cycles;
    }

    /// @dev Grouped so recordMeasurement does not run out of stack.
    struct Measurement {
        uint256 cycles;
        uint256 provingMicros;
        uint256 proofBytes;
        uint256 verifyMicros;
        bool verifierAccepted;
        bytes32 evidenceHash;
    }

    mapping(bytes32 => Node) public nodes;
    mapping(bytes32 => Lease) public leases;                       // leaseKey -> lease
    mapping(bytes32 => mapping(address => uint64)) public cooldownUntil;
    mapping(address => address) public lineageOperator;
    mapping(address => address) public pendingOperator;
    mapping(address => bytes32) public lineageGroup;
    mapping(bytes32 => Submission) internal _submissions;          // artifactHash -> submission
    mapping(bytes32 => mapping(address => uint256)) public funded;
    mapping(bytes32 => mapping(address => bool)) public unusedWithdrawn;
    mapping(address => uint256) public owed;
    mapping(address => uint256) public nonces;
    mapping(address => bool) public relays;

    address public immutable maintainer;
    IERC20 public immutable plane;
    bytes32[] public strawmapIds;
    mapping(bytes32 => bool) public isStrawmapId;
    bool public strawmapSeeded;

    /// @notice The ENSv2 subregistry whose token owner may define a node. Zero until the subregistry
    /// exists on chain; while it is zero only the maintainer may define, which is the same rule
    /// 3.3.2 gives for ids not yet registered as names.
    address public subregistry;

    event LineageProposed(address indexed lineage, address indexed operator, bytes32 groupName);
    event LineageRegistered(address indexed lineage, address indexed operator, bytes32 groupName);
    event NodeDefined(
        bytes32 indexed nodeId, address indexed registrant, bytes32 criterionHash, uint8 lane,
        uint64 leaseDuration, uint64 heartbeatEvery, Split split, uint16 targetGainBps, uint16 thresholdBps
    );
    event VerifierSet(bytes32 indexed nodeId, address verifier);
    event ReviewerSet(bytes32 indexed nodeId, address reviewer);
    event NodeFunded(bytes32 indexed nodeId, address indexed funder, uint256 amount, uint256 bounty);
    event BaselineRecorded(
        bytes32 indexed nodeId, uint256 cycles, uint256 provingMicros, uint256 proofBytes,
        uint256 verifyMicros, uint16 spreadBps
    );
    event LeaseClaimed(
        bytes32 indexed nodeId, address indexed lineage, address indexed operator, bytes32 fromHash,
        uint64 expiry, uint256 seq
    );
    event Heartbeat(bytes32 indexed nodeId, address indexed lineage, uint256 seq, uint256 at);
    event LeaseForfeited(
        bytes32 indexed nodeId, address indexed lineage, address indexed operator, uint256 seq, uint8 reason
    );
    event SubmissionMade(
        bytes32 indexed nodeId, address indexed lineage, address indexed operator, bytes32 artifactHash,
        uint256 seq, bytes32[] parents
    );
    event MeasurementRecorded(
        bytes32 indexed nodeId, bytes32 indexed artifactHash, uint256 seq, uint256 cycles,
        uint256 provingMicros, uint256 proofBytes, uint256 verifyMicros, bool verifierAccepted,
        Status status, bytes32 evidenceHash, address signer
    );
    event ReviewConfirmed(bytes32 indexed nodeId, bytes32 indexed artifactHash, address reviewer, bool pass);
    event HeadAdvanced(bytes32 indexed nodeId, bytes32 artifactHash, uint256 cycles);
    event Payout(bytes32 indexed nodeId, bytes32 indexed artifactHash, address indexed to, Kind kind, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event NodeClosed(bytes32 indexed nodeId);
    event UnusedWithdrawn(bytes32 indexed nodeId, address indexed funder, uint256 share);
    event RelaySet(address indexed relay, bool allowed);
    event StrawmapSeeded(uint256 count);
    event SubregistrySet(address subregistry);

    error NotMaintainer();
    error NotRegistrant();
    error NotVerifier();
    error NotReviewer();
    error NotRelay();
    error NotStrawmapId();
    error AlreadyDefined();
    error BadSplit();
    error AlreadySeeded();
    error NoBaseline();
    error BaselineAlreadySet();
    error NodeIsClosed();
    error NodeNotOpen();
    error NoVerifier();
    error LeaseActive();
    error NoActiveLease();
    error NotLeaseHolder();
    error LeaseHealthy();
    error InCooldown();
    error LineageNotRegistered();
    error LineageAlreadyRegistered();
    error NotProposedOperator();
    error NotAssignee();
    error UnknownParent();
    error TooManyParents();
    error DuplicateArtifact();
    error UnknownSubmission();
    error NotPending();
    error NotInReview();
    error ReviewerConflict();
    error NothingOwed();
    error AlreadyWithdrawn();
    error NotFunder();
    error Expired();
    error BadNonce();
    error BadSignature();

    bytes32 private constant CLAIM_TYPEHASH =
        keccak256("Claim(bytes32 nodeId,address guest,bytes32 fromHash,uint256 nonce,uint256 deadline)");
    bytes32 private constant SUBMIT_TYPEHASH =
        keccak256("Submit(bytes32 nodeId,address guest,bytes32 artifactHash,bytes32 parentsHash,uint256 nonce,uint256 deadline)");
    bytes32 private constant REGISTER_TYPEHASH =
        keccak256("RegisterLineage(address guest,bytes32 groupName,uint256 nonce,uint256 deadline)");
    bytes32 private constant REVIEW_TYPEHASH =
        keccak256("ConfirmReview(bytes32 nodeId,address guest,bytes32 artifactHash,bool pass,uint256 nonce,uint256 deadline)");

    modifier onlyMaintainer() {
        _onlyMaintainer();
        _;
    }

    function _onlyMaintainer() private view {
        if (msg.sender != maintainer) revert NotMaintainer();
    }

    constructor(address maintainer_, IERC20 plane_) EIP712("Ethplane", "1") {
        require(maintainer_ != address(0) && address(plane_) != address(0), "zero arg");
        maintainer = maintainer_;
        plane = plane_;
    }

    // ------------------------------------------------------------------ admin

    function setRelay(address relay, bool allowed) external onlyMaintainer {
        relays[relay] = allowed;
        emit RelaySet(relay, allowed);
    }

    function setSubregistry(address subregistry_) external onlyMaintainer {
        subregistry = subregistry_;
        emit SubregistrySet(subregistry_);
    }

    function seedStrawmap(bytes32[] calldata ids) external onlyMaintainer {
        if (strawmapSeeded) revert AlreadySeeded();
        strawmapSeeded = true;
        for (uint256 i = 0; i < ids.length; i++) {
            strawmapIds.push(ids[i]);
            isStrawmapId[ids[i]] = true;
        }
        emit StrawmapSeeded(ids.length);
    }

    /// @notice Explicit getters: the auto-generated `nodes` getter omits the nested Split and
    /// returns a 24-field tuple nobody can read. These are what clients and tests actually use.
    function nodeSplit(bytes32 id) external view returns (Split memory) {
        return nodes[id].split;
    }

    function nodeParties(bytes32 id) external view returns (address registrant, address verifier, address reviewer) {
        Node storage n = nodes[id];
        return (n.registrant, n.verifier, n.reviewer);
    }

    function nodeMetrics(bytes32 id)
        external
        view
        returns (uint256 originalMetric, uint256 bestMetric, bytes32 head, uint16 paidGainBps)
    {
        Node storage n = nodes[id];
        return (n.originalMetric, n.bestMetric, n.head, n.paidGainBps);
    }

    function nodeMoney(bytes32 id)
        external
        view
        returns (uint256 bounty, uint256 released, bool open, bool closed)
    {
        Node storage n = nodes[id];
        return (n.bounty, n.released, n.open, n.closed);
    }

    function strawmapCount() external view returns (uint256) {
        return strawmapIds.length;
    }

    // ------------------------------------------------------- lineage registration

    function registerLineage(address operator, bytes32 groupName) external {
        if (lineageOperator[msg.sender] != address(0)) revert LineageAlreadyRegistered();
        pendingOperator[msg.sender] = operator;
        lineageGroup[msg.sender] = groupName;
        emit LineageProposed(msg.sender, operator, groupName);
    }

    function acceptLineage(address lineage) external {
        if (pendingOperator[lineage] != msg.sender) revert NotProposedOperator();
        pendingOperator[lineage] = address(0);
        lineageOperator[lineage] = msg.sender;
        emit LineageRegistered(lineage, msg.sender, lineageGroup[lineage]);
    }

    // ------------------------------------------------------------------ nodes

    function defineNode(
        bytes32 nodeId,
        bytes32 criterionHash,
        uint8 lane,
        address assignee,
        uint64 leaseDuration,
        uint64 heartbeatEvery,
        Split calldata split,
        uint16 targetGainBps,
        uint16 thresholdBps
    ) external {
        if (!isStrawmapId[nodeId]) revert NotStrawmapId();
        Node storage n = nodes[nodeId];
        if (n.registrant != address(0)) revert AlreadyDefined();
        uint256 sum = uint256(split.winnerBps) + split.parentBps + split.verifierBps + split.computeBps
            + split.registrantBps;
        if (sum != 10000 || split.verifierBps < 1000 || split.parentBps < 1000) revert BadSplit();
        // The ENS owner of the node's subname defines it. Until the subregistry exists, only the
        // maintainer may define, with itself as registrant (3.3.2's rule for ids not yet named).
        if (subregistry == address(0)) {
            if (msg.sender != maintainer) revert NotRegistrant();
        } else if (IEnsRegistry(subregistry).ownerOf(uint256(nodeId)) != msg.sender) {
            revert NotRegistrant();
        }
        n.registrant = msg.sender;
        n.reviewer = maintainer;
        n.criterionHash = criterionHash;
        n.lane = lane;
        n.assignee = assignee;
        n.leaseDuration = leaseDuration;
        n.heartbeatEvery = heartbeatEvery;
        n.split = split;
        n.targetGainBps = targetGainBps;
        n.thresholdBps = thresholdBps;
        emit NodeDefined(
            nodeId, msg.sender, criterionHash, lane, leaseDuration, heartbeatEvery, split, targetGainBps, thresholdBps
        );
    }

    function setNodeVerifier(bytes32 nodeId, address verifier) external {
        Node storage n = nodes[nodeId];
        if (msg.sender != n.registrant) revert NotRegistrant();
        if (_hasActiveLease(nodeId)) revert LeaseActive();
        n.verifier = verifier;
        emit VerifierSet(nodeId, verifier);
    }

    function setReviewer(bytes32 nodeId, address reviewer) external {
        Node storage n = nodes[nodeId];
        if (msg.sender != n.registrant) revert NotRegistrant();
        if (reviewer == n.registrant || reviewer == n.verifier || reviewer == address(0)) revert ReviewerConflict();
        n.reviewer = reviewer;
        emit ReviewerSet(nodeId, reviewer);
    }

    function fundNode(bytes32 nodeId, uint256 amount) external nonReentrant {
        Node storage n = nodes[nodeId];
        if (n.registrant == address(0)) revert AlreadyDefined();
        if (n.closed) revert NodeIsClosed();
        plane.safeTransferFrom(msg.sender, address(this), amount);
        funded[nodeId][msg.sender] += amount;
        n.bounty += amount;
        n.open = true;
        emit NodeFunded(nodeId, msg.sender, amount, n.bounty);
    }

    function recordBaseline(
        bytes32 nodeId,
        uint256 cycles,
        uint256 provingMicros,
        uint256 proofBytes,
        uint256 verifyMicros,
        uint16 spreadBps
    ) external {
        Node storage n = nodes[nodeId];
        if (msg.sender != n.verifier || n.verifier == address(0)) revert NotVerifier();
        if (n.originalMetric != 0) revert BaselineAlreadySet();
        n.originalMetric = cycles;
        n.bestMetric = cycles;
        n.baseProvingMicros = provingMicros;
        n.baseProofBytes = proofBytes;
        n.baseVerifyMicros = verifyMicros;
        n.spreadBps = spreadBps;
        emit BaselineRecorded(nodeId, cycles, provingMicros, proofBytes, verifyMicros, spreadBps);
    }

    function closeNode(bytes32 nodeId) external {
        Node storage n = nodes[nodeId];
        if (msg.sender != n.registrant) revert NotRegistrant();
        if (_hasActiveLease(nodeId)) revert LeaseActive();
        n.closed = true;
        n.open = false;
        emit NodeClosed(nodeId);
    }

    // ------------------------------------------------------------------ leases

    function leaseKey(bytes32 nodeId, address lineage) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(nodeId, lineage));
    }

    uint256 private _activeLeaseCount;
    mapping(bytes32 => uint256) private _activeOn;

    function _hasActiveLease(bytes32 nodeId) internal view returns (bool) {
        return _activeOn[nodeId] > 0;
    }

    function claim(bytes32 nodeId, bytes32 fromHash) external {
        _claim(nodeId, msg.sender, fromHash);
    }

    function _claim(bytes32 nodeId, address lineage, bytes32 fromHash) internal {
        Node storage n = nodes[nodeId];
        address operator = lineageOperator[lineage];
        if (operator == address(0)) revert LineageNotRegistered();
        if (n.originalMetric == 0) revert NoBaseline();
        if (n.verifier == address(0)) revert NoVerifier();
        if (!n.open || n.closed) revert NodeNotOpen();
        if (n.lane != 0 && lineage != n.assignee) revert NotAssignee();
        if (cooldownUntil[nodeId][operator] > block.timestamp) revert InCooldown();
        bytes32 k = leaseKey(nodeId, lineage);
        if (leases[k].active) revert LeaseActive();
        if (fromHash != bytes32(0) && _submissions[fromHash].nodeId != nodeId) revert UnknownSubmission();
        n.leaseSeq += 1;
        leases[k] = Lease({
            lineage: lineage,
            operator: operator,
            start: uint64(block.timestamp),
            expiry: uint64(block.timestamp) + n.leaseDuration,
            lastHeartbeat: uint64(block.timestamp),
            fromHash: fromHash,
            seq: n.leaseSeq,
            active: true
        });
        _activeOn[nodeId] += 1;
        emit LeaseClaimed(nodeId, lineage, operator, fromHash, leases[k].expiry, n.leaseSeq);
    }

    function heartbeat(bytes32 nodeId) external {
        bytes32 k = leaseKey(nodeId, msg.sender);
        Lease storage l = leases[k];
        if (!l.active) revert NoActiveLease();
        if (block.timestamp > l.lastHeartbeat + nodes[nodeId].heartbeatEvery) revert NoActiveLease();
        l.lastHeartbeat = uint64(block.timestamp);
        emit Heartbeat(nodeId, msg.sender, l.seq, block.timestamp);
    }

    function forfeit(bytes32 nodeId, address lineage) external {
        bytes32 k = leaseKey(nodeId, lineage);
        Lease storage l = leases[k];
        if (!l.active) revert NoActiveLease();
        uint8 reason;
        if (block.timestamp > l.expiry) reason = 1;
        else if (block.timestamp > l.lastHeartbeat + nodes[nodeId].heartbeatEvery) reason = 2;
        else revert LeaseHealthy();
        l.active = false;
        _activeOn[nodeId] -= 1;
        cooldownUntil[nodeId][l.operator] = uint64(block.timestamp) + nodes[nodeId].leaseDuration;
        emit LeaseForfeited(nodeId, lineage, l.operator, l.seq, reason);
    }

    // -------------------------------------------------------------- submissions

    function submit(bytes32 nodeId, bytes32 artifactHash, bytes32[] calldata parents) external {
        _submit(nodeId, msg.sender, artifactHash, parents);
    }

    function _submit(bytes32 nodeId, address lineage, bytes32 artifactHash, bytes32[] calldata parents) internal {
        bytes32 k = leaseKey(nodeId, lineage);
        Lease storage l = leases[k];
        if (!l.active) revert NotLeaseHolder();
        if (parents.length > 8) revert TooManyParents();
        if (_submissions[artifactHash].lineage != address(0)) revert DuplicateArtifact();
        for (uint256 i = 0; i < parents.length; i++) {
            if (_submissions[parents[i]].nodeId != nodeId) revert UnknownParent();
        }
        _submissions[artifactHash] = Submission({
            nodeId: nodeId,
            lineage: lineage,
            operator: l.operator,
            leaseSeq: l.seq,
            parents: parents,
            status: Status.PENDING,
            cycles: 0
        });
        emit SubmissionMade(nodeId, lineage, l.operator, artifactHash, l.seq, parents);
    }

    function submissions(bytes32 artifactHash)
        external
        view
        returns (bytes32 nodeId, address lineage, address operator, uint256 seq, Status status, uint256 cycles)
    {
        Submission storage s = _submissions[artifactHash];
        return (s.nodeId, s.lineage, s.operator, s.leaseSeq, s.status, s.cycles);
    }

    function parentsOf(bytes32 artifactHash) external view returns (bytes32[] memory) {
        return _submissions[artifactHash].parents;
    }

    function recordMeasurement(
        bytes32 nodeId,
        bytes32 artifactHash,
        uint256 cycles,
        uint256 provingMicros,
        uint256 proofBytes,
        uint256 verifyMicros,
        bool verifierAccepted,
        bytes32 evidenceHash
    ) external {
        Node storage n = nodes[nodeId];
        if (msg.sender != n.verifier || n.verifier == address(0)) revert NotVerifier();
        if (n.originalMetric == 0) revert NoBaseline();
        Submission storage s = _submissions[artifactHash];
        if (s.nodeId != nodeId) revert UnknownSubmission();
        if (s.status != Status.PENDING) revert NotPending();
        Measurement memory m = Measurement(cycles, provingMicros, proofBytes, verifyMicros, verifierAccepted, evidenceHash);
        Status st = _judge(n, m);
        s.cycles = cycles;
        s.status = st;
        emit MeasurementRecorded(
            nodeId, artifactHash, s.leaseSeq, cycles, provingMicros, proofBytes, verifyMicros,
            verifierAccepted, st, evidenceHash, msg.sender
        );
        if (st == Status.PASS) _advance(nodeId, artifactHash, cycles);
    }

    /// @dev The whole verdict, in one place: a measurement passes only if the verifier accepted it,
    /// the cycle count strictly improves by at least thresholdBps, and none of the three
    /// non-regression fields got worse. A drop of more than 20% is not rejected — it is sent to a
    /// human (REVIEW), because a suspiciously large gain is the shape of a broken measurement.
    function _judge(Node storage n, Measurement memory m) internal view returns (Status) {
        if (!m.verifierAccepted) return Status.FAIL;
        if (m.cycles >= n.bestMetric) return Status.FAIL;
        uint256 dropBps = (n.bestMetric - m.cycles) * 10000 / n.bestMetric;
        if (dropBps < n.thresholdBps) return Status.FAIL;
        if (m.provingMicros > n.baseProvingMicros * (10000 + n.spreadBps) / 10000) return Status.FAIL;
        if (m.proofBytes > n.baseProofBytes) return Status.FAIL;
        if (m.verifyMicros > n.baseVerifyMicros * 10500 / 10000) return Status.FAIL;
        return dropBps > 2000 ? Status.REVIEW : Status.PASS;
    }

    function confirmReview(bytes32 nodeId, bytes32 artifactHash, bool pass) external {
        _confirmReview(nodeId, msg.sender, artifactHash, pass);
    }

    function _confirmReview(bytes32 nodeId, address reviewer, bytes32 artifactHash, bool pass) internal {
        Node storage n = nodes[nodeId];
        if (reviewer != n.reviewer) revert NotReviewer();
        Submission storage s = _submissions[artifactHash];
        if (s.nodeId != nodeId) revert UnknownSubmission();
        if (s.status != Status.REVIEW) revert NotInReview();
        if (pass) {
            s.status = Status.PASS;
            emit ReviewConfirmed(nodeId, artifactHash, reviewer, true);
            _advance(nodeId, artifactHash, s.cycles);
        } else {
            s.status = Status.FAIL;
            emit ReviewConfirmed(nodeId, artifactHash, reviewer, false);
        }
    }

    // ------------------------------------------------------------------ money

    function _advance(bytes32 nodeId, bytes32 artifactHash, uint256 cycles) internal {
        Node storage n = nodes[nodeId];
        n.bestMetric = cycles;
        n.head = artifactHash;
        emit HeadAdvanced(nodeId, artifactHash, cycles);
        _release(nodeId, artifactHash);
    }

    /// @dev Credits only, never transfers. Payout is a function of CUMULATIVE progress from the
    /// original baseline, so N micro-passes pay exactly what one combined pass pays and salami
    /// slicing earns nothing.
    function _release(bytes32 nodeId, bytes32 artifactHash) internal {
        Node storage n = nodes[nodeId];
        uint256 cumulativeGainBps = (n.originalMetric - n.bestMetric) * 10000 / n.originalMetric;
        uint256 capped = cumulativeGainBps > n.targetGainBps ? n.targetGainBps : cumulativeGainBps;
        if (capped <= n.paidGainBps) return;
        uint256 payout = n.bounty * (capped - n.paidGainBps) / n.targetGainBps;
        uint256 remaining = n.bounty - n.released;
        if (payout > remaining) payout = remaining;
        n.paidGainBps = uint16(capped);
        n.released += payout;
        if (payout == 0) return;

        Submission storage s = _submissions[artifactHash];
        _credit(nodeId, artifactHash, s.operator, Kind.WINNER, payout * n.split.winnerBps / 10000);
        _payParents(nodeId, artifactHash, payout * n.split.parentBps / 10000);
        _credit(nodeId, artifactHash, n.verifier, Kind.VERIFIER, payout * n.split.verifierBps / 10000);
        // COMPUTE stays in escrow in v1; emitted to address(0) so the indexer still shows the row.
        emit Payout(nodeId, artifactHash, address(0), Kind.COMPUTE, payout * n.split.computeBps / 10000);
        _credit(nodeId, artifactHash, n.registrant, Kind.REGISTRANT, payout * n.split.registrantBps / 10000);
    }

    function _credit(bytes32 nodeId, bytes32 artifactHash, address to, Kind kind, uint256 amount) internal {
        if (amount == 0 || to == address(0)) return;
        owed[to] += amount;
        emit Payout(nodeId, artifactHash, to, kind, amount);
    }

    /// @dev Only PASS parents with an operator other than the winner's are paid. An unverified
    /// parent is still recorded as a reuse edge by SubmissionMade; it is simply not paid. Shares
    /// that find no eligible parent stay in escrow rather than falling to the winner.
    function _payParents(bytes32 nodeId, bytes32 artifactHash, uint256 amount) internal {
        if (amount == 0) return;
        Submission storage s = _submissions[artifactHash];
        uint256 len = s.parents.length;
        if (len == 0) return;
        address[] memory eligible = new address[](len);
        uint256 count;
        for (uint256 i = 0; i < len; i++) {
            Submission storage p = _submissions[s.parents[i]];
            if (p.status != Status.PASS) continue;
            address op = p.operator;
            if (op == address(0) || op == s.operator) continue;
            bool seen;
            for (uint256 j = 0; j < count; j++) {
                if (eligible[j] == op) { seen = true; break; }
            }
            if (!seen) { eligible[count] = op; count++; }
        }
        if (count == 0) return;
        uint256 each = amount / count;
        for (uint256 i = 0; i < count; i++) {
            _credit(nodeId, artifactHash, eligible[i], Kind.PARENT, each);
        }
    }

    function withdraw() external nonReentrant {
        uint256 amount = owed[msg.sender];
        if (amount == 0) revert NothingOwed();
        owed[msg.sender] = 0;
        plane.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function withdrawUnused(bytes32 nodeId) external nonReentrant {
        Node storage n = nodes[nodeId];
        if (!n.closed) revert NodeNotOpen();
        uint256 mine = funded[nodeId][msg.sender];
        if (mine == 0) revert NotFunder();
        if (unusedWithdrawn[nodeId][msg.sender]) revert AlreadyWithdrawn();
        unusedWithdrawn[nodeId][msg.sender] = true;
        uint256 remaining = n.bounty - n.released;
        uint256 share = remaining * mine / n.bounty;
        if (share > 0) plane.safeTransfer(msg.sender, share);
        emit UnusedWithdrawn(nodeId, msg.sender, share);
    }

    // ------------------------------------------------------------------ relay

    function _relayPre(address guest, uint256 nonce, uint256 deadline) internal {
        if (!relays[msg.sender]) revert NotRelay();
        if (block.timestamp > deadline) revert Expired();
        if (nonce != nonces[guest]) revert BadNonce();
        nonces[guest] = nonce + 1;
    }

    function _check(bytes32 structHash, address guest, bytes calldata sig) internal view {
        if (ECDSA.recover(_hashTypedDataV4(structHash), sig) != guest) revert BadSignature();
    }

    function registerLineageFor(address guest, bytes32 groupName, uint256 nonce, uint256 deadline, bytes calldata sig)
        external
    {
        _relayPre(guest, nonce, deadline);
        _check(keccak256(abi.encode(REGISTER_TYPEHASH, guest, groupName, nonce, deadline)), guest, sig);
        if (lineageOperator[guest] != address(0)) revert LineageAlreadyRegistered();
        // The guest's signature IS the acceptance, so both halves are set in one step.
        lineageGroup[guest] = groupName;
        lineageOperator[guest] = guest;
        emit LineageProposed(guest, guest, groupName);
        emit LineageRegistered(guest, guest, groupName);
    }

    function claimFor(bytes32 nodeId, address guest, bytes32 fromHash, uint256 nonce, uint256 deadline, bytes calldata sig)
        external
    {
        _relayPre(guest, nonce, deadline);
        _check(keccak256(abi.encode(CLAIM_TYPEHASH, nodeId, guest, fromHash, nonce, deadline)), guest, sig);
        _claim(nodeId, guest, fromHash);
    }

    function submitFor(
        bytes32 nodeId,
        address guest,
        bytes32 artifactHash,
        bytes32[] calldata parents,
        uint256 nonce,
        uint256 deadline,
        bytes calldata sig
    ) external {
        _relayPre(guest, nonce, deadline);
        _check(
            keccak256(
                abi.encode(SUBMIT_TYPEHASH, nodeId, guest, artifactHash, keccak256(abi.encodePacked(parents)), nonce, deadline)
            ),
            guest,
            sig
        );
        _submit(nodeId, guest, artifactHash, parents);
    }

    function confirmReviewFor(
        bytes32 nodeId,
        address guest,
        bytes32 artifactHash,
        bool pass,
        uint256 nonce,
        uint256 deadline,
        bytes calldata sig
    ) external {
        _relayPre(guest, nonce, deadline);
        _check(keccak256(abi.encode(REVIEW_TYPEHASH, nodeId, guest, artifactHash, pass, nonce, deadline)), guest, sig);
        _confirmReview(nodeId, guest, artifactHash, pass);
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
