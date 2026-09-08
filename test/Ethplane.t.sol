// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {Ethplane} from "../contracts/Ethplane.sol";
import {PlaneToken} from "../contracts/PlaneToken.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockRegistry {
    mapping(uint256 => address) public owners;
    function setOwner(uint256 id, address o) external { owners[id] = o; }
    function ownerOf(uint256 id) external view returns (address) { return owners[id]; }
}

contract EthplaneTest is Test {
    Ethplane ep;
    PlaneToken plane;

    address maintainer = makeAddr("maintainer");
    address treasury = makeAddr("treasury");
    address verifier = makeAddr("verifier");
    address reviewer = makeAddr("reviewer");
    address relay = makeAddr("relay");
    address opA = makeAddr("opA");
    address opB = makeAddr("opB");
    address linA = makeAddr("linA");
    address linB = makeAddr("linB");
    address linC = makeAddr("linC");
    address funder2 = makeAddr("funder2");

    bytes32 constant NODE = keccak256("cl-pq-leanxmss-attestations");
    bytes32 constant OTHER = keccak256("el-bals");
    uint256 constant BOUNTY = 10_000e18;
    uint64 constant LEASE = 900;
    uint64 constant BEAT = 120;

    function setUp() public {
        plane = new PlaneToken(treasury);
        ep = new Ethplane(maintainer, IERC20(address(plane)));
        bytes32[] memory ids = new bytes32[](2);
        ids[0] = NODE; ids[1] = OTHER;
        vm.prank(maintainer); ep.seedStrawmap(ids);
        vm.prank(maintainer); ep.setRelay(relay, true);
        vm.prank(treasury); plane.transfer(maintainer, 500_000e18);
        vm.prank(treasury); plane.transfer(funder2, 100_000e18);
        _register(linA, opA); _register(linB, opB); _register(linC, opA);
    }

    // ---------------------------------------------------------------- helpers

    function _split() internal pure returns (Ethplane.Split memory) {
        return Ethplane.Split(6800, 1500, 1000, 500, 200);
    }

    function _register(address lineage, address operator) internal {
        vm.prank(lineage); ep.registerLineage(operator, keccak256("group"));
        vm.prank(operator); ep.acceptLineage(lineage);
    }

    function _define(bytes32 id) internal {
        vm.prank(maintainer);
        ep.defineNode(id, keccak256("criterion"), 0, address(0), LEASE, BEAT, _split(), 1000, 0);
        vm.prank(maintainer); ep.setNodeVerifier(id, verifier);
    }

    function _fund(bytes32 id, uint256 amount) internal {
        vm.prank(maintainer); plane.approve(address(ep), amount);
        vm.prank(maintainer); ep.fundNode(id, amount);
    }

    function _baseline(bytes32 id, uint256 cycles) internal {
        vm.prank(verifier); ep.recordBaseline(id, cycles, 1_450_000, 302_500, 30_200, 200);
    }

    function _ready(bytes32 id, uint256 cycles) internal {
        _define(id); _fund(id, BOUNTY); _baseline(id, cycles);
    }

    function _measure(bytes32 id, bytes32 art, uint256 cycles) internal {
        vm.prank(verifier);
        ep.recordMeasurement(id, art, cycles, 1_400_000, 302_000, 30_000, true, keccak256("evidence"));
    }

    function _noParents() internal pure returns (bytes32[] memory) {
        return new bytes32[](0);
    }

    // ------------------------------------------------------- registry and nodes

    function test_onlyStrawmapIdsRegistrable() public {
        vm.prank(maintainer);
        vm.expectRevert(Ethplane.NotStrawmapId.selector);
        ep.defineNode(keccak256("not-on-the-map"), bytes32(0), 0, address(0), LEASE, BEAT, _split(), 1000, 0);
    }

    function test_defineNodeTwiceReverts() public {
        _define(NODE);
        vm.prank(maintainer);
        vm.expectRevert(Ethplane.AlreadyDefined.selector);
        ep.defineNode(NODE, bytes32(0), 0, address(0), LEASE, BEAT, _split(), 1000, 0);
    }

    function test_defineNodeRejectsBadSplit() public {
        vm.startPrank(maintainer);
        vm.expectRevert(Ethplane.BadSplit.selector);       // sums to 9999
        ep.defineNode(NODE, bytes32(0), 0, address(0), LEASE, BEAT, Ethplane.Split(6799, 1500, 1000, 500, 200), 1000, 0);
        vm.expectRevert(Ethplane.BadSplit.selector);       // verifier floor
        ep.defineNode(NODE, bytes32(0), 0, address(0), LEASE, BEAT, Ethplane.Split(7300, 1500, 500, 500, 200), 1000, 0);
        vm.expectRevert(Ethplane.BadSplit.selector);       // parent floor
        ep.defineNode(NODE, bytes32(0), 0, address(0), LEASE, BEAT, Ethplane.Split(7800, 500, 1000, 500, 200), 1000, 0);
        vm.stopPrank();
    }

    function test_setSubregistryLocksOnceAnOutsiderRegisters() public {
        MockRegistry reg = new MockRegistry();
        reg.setOwner(uint256(NODE), linA);
        vm.prank(maintainer); ep.setSubregistry(address(reg));
        // still only maintainer-defined nodes: the pointer may still move
        vm.prank(maintainer); ep.setSubregistry(address(reg));
        vm.prank(linA);
        ep.defineNode(NODE, bytes32(0), 0, address(0), LEASE, BEAT, _split(), 1000, 0);
        assertEq(ep.outsideRegistrants(), 1);
        vm.prank(maintainer);
        vm.expectRevert(Ethplane.SubregistryLocked.selector);
        ep.setSubregistry(address(1));
    }

    function test_registrantDefinesOwnNode() public {
        MockRegistry reg = new MockRegistry();
        reg.setOwner(uint256(NODE), linA);
        vm.prank(maintainer); ep.setSubregistry(address(reg));
        vm.prank(linB);
        vm.expectRevert(Ethplane.NotRegistrant.selector);
        ep.defineNode(NODE, bytes32(0), 0, address(0), LEASE, BEAT, _split(), 1000, 0);
        vm.prank(linA);
        ep.defineNode(NODE, bytes32(0), 0, address(0), LEASE, BEAT, _split(), 1000, 0);
        (address registrant,,) = ep.nodeParties(NODE);
        assertEq(registrant, linA);
    }

    function test_setVerifierOnlyRegistrantBetweenLeases() public {
        _define(NODE);
        vm.prank(linA);
        vm.expectRevert(Ethplane.NotRegistrant.selector);
        ep.setNodeVerifier(NODE, linA);
        vm.prank(maintainer); ep.setNodeVerifier(NODE, verifier);
    }

    function test_setVerifierDuringLeaseReverts() public {
        _ready(NODE, 1_542_812);
        vm.prank(linA); ep.claim(NODE, bytes32(0));
        vm.prank(maintainer);
        vm.expectRevert(Ethplane.LeaseActive.selector);
        ep.setNodeVerifier(NODE, linB);
    }

    function test_reviewerNotRegistrantOrVerifier() public {
        _define(NODE);
        vm.prank(maintainer);
        vm.expectRevert(Ethplane.ReviewerConflict.selector);
        ep.setReviewer(NODE, verifier);
        vm.prank(maintainer); ep.setReviewer(NODE, reviewer);
    }

    function test_setReviewerToSelfReverts() public {
        _define(NODE);
        vm.prank(maintainer);
        vm.expectRevert(Ethplane.ReviewerConflict.selector);
        ep.setReviewer(NODE, maintainer);
    }

    // --------------------------------------------------------------- funding

    function test_multipleFundersAccumulate() public {
        _define(NODE);
        _fund(NODE, 1_000e18);
        vm.prank(funder2); plane.approve(address(ep), 500e18);
        vm.prank(funder2); ep.fundNode(NODE, 500e18);
        (uint256 bounty,,,) = ep.nodeMoney(NODE);
        assertEq(bounty, 1_500e18);
        assertEq(ep.funded(NODE, funder2), 500e18);
    }

    function test_fundClosedNodeReverts() public {
        _define(NODE);
        vm.prank(maintainer); ep.closeNode(NODE);
        vm.prank(maintainer); plane.approve(address(ep), 1e18);
        vm.prank(maintainer);
        vm.expectRevert(Ethplane.NodeIsClosed.selector);
        ep.fundNode(NODE, 1e18);
    }

    function test_baselineOnce() public {
        _define(NODE); _fund(NODE, BOUNTY);
        _baseline(NODE, 1_542_812);
        vm.prank(verifier);
        vm.expectRevert(Ethplane.BaselineAlreadySet.selector);
        ep.recordBaseline(NODE, 1_000_000, 1, 1, 1, 0);
    }

    // ---------------------------------------------------------------- leases

    function test_lineageTwoStepRegistration() public {
        address lin = makeAddr("lin");
        address op = makeAddr("op");
        vm.prank(lin); ep.registerLineage(op, keccak256("g"));
        assertEq(ep.lineageOperator(lin), address(0), "not bound until accepted");
        vm.prank(makeAddr("stranger"));
        vm.expectRevert(Ethplane.NotProposedOperator.selector);
        ep.acceptLineage(lin);
        vm.prank(op); ep.acceptLineage(lin);
        assertEq(ep.lineageOperator(lin), op);
    }

    function test_unacceptedLineageCannotClaim() public {
        _ready(NODE, 1_542_812);
        address lin = makeAddr("unaccepted");
        vm.prank(lin); ep.registerLineage(makeAddr("someop"), keccak256("g"));
        vm.prank(lin);
        vm.expectRevert(Ethplane.LineageNotRegistered.selector);
        ep.claim(NODE, bytes32(0));
    }

    function test_claimRequiresRegisteredLineage() public {
        _ready(NODE, 1_542_812);
        vm.prank(makeAddr("nobody"));
        vm.expectRevert(Ethplane.LineageNotRegistered.selector);
        ep.claim(NODE, bytes32(0));
    }

    function test_claimWithoutBaselineReverts() public {
        _define(NODE); _fund(NODE, BOUNTY);
        vm.prank(linA);
        vm.expectRevert(Ethplane.NoBaseline.selector);
        ep.claim(NODE, bytes32(0));
    }

    function test_claim() public {
        _ready(NODE, 1_542_812);
        vm.prank(linA); ep.claim(NODE, bytes32(0));
        (address lineage, address operator,,,,, uint256 seq, bool active) = ep.leases(ep.leaseKey(NODE, linA));
        assertEq(lineage, linA); assertEq(operator, opA); assertEq(seq, 1); assertTrue(active);
    }

    function test_claimAlongsideTwoLineages() public {
        _ready(NODE, 1_542_812);
        vm.prank(linA); ep.claim(NODE, bytes32(0));
        vm.prank(linB); ep.claim(NODE, bytes32(0));
        (,,,,,,, bool a) = ep.leases(ep.leaseKey(NODE, linA));
        (,,,,,,, bool b) = ep.leases(ep.leaseKey(NODE, linB));
        assertTrue(a && b, "both leases live at once");
    }

    function test_claimFromForeignHashReverts() public {
        _ready(NODE, 1_542_812); _ready(OTHER, 1_000_000);
        vm.prank(linA); ep.claim(OTHER, bytes32(0));
        vm.prank(linA); ep.submit(OTHER, keccak256("art-on-other"), _noParents());
        vm.prank(linB);
        vm.expectRevert(Ethplane.UnknownSubmission.selector);
        ep.claim(NODE, keccak256("art-on-other"));
    }

    function test_claimFromUnverifiedSubmission() public {
        _ready(NODE, 1_542_812);
        vm.prank(linA); ep.claim(NODE, bytes32(0));
        bytes32 art = keccak256("unverified");
        vm.prank(linA); ep.submit(NODE, art, _noParents());
        // never measured: the recovery beat starts from exactly this artifact
        vm.prank(linB); ep.claim(NODE, art);
        (,,,,, bytes32 fromHash,,) = ep.leases(ep.leaseKey(NODE, linB));
        assertEq(fromHash, art);
    }

    function test_secondLineageClaimsFromHash() public {
        _ready(NODE, 1_542_812);
        vm.prank(linA); ep.claim(NODE, bytes32(0));
        bytes32 art = keccak256("killed-lineage-artifact");
        vm.prank(linA); ep.submit(NODE, art, _noParents());
        vm.warp(block.timestamp + BEAT + 1);
        ep.forfeit(NODE, linA);
        vm.prank(linB); ep.claim(NODE, art);
        (,,,,, bytes32 fromHash, uint256 seq,) = ep.leases(ep.leaseKey(NODE, linB));
        assertEq(fromHash, art); assertEq(seq, 2);
    }

    function test_forfeitHealthyLeaseReverts() public {
        _ready(NODE, 1_542_812);
        vm.prank(linA); ep.claim(NODE, bytes32(0));
        vm.expectRevert(Ethplane.LeaseHealthy.selector);
        ep.forfeit(NODE, linA);
    }

    function test_heartbeatMissedForfeitsAndCooldownsOperator() public {
        _ready(NODE, 1_542_812);
        vm.prank(linA); ep.claim(NODE, bytes32(0));
        vm.warp(block.timestamp + BEAT / 2);
        vm.prank(linA); ep.heartbeat(NODE);
        vm.warp(block.timestamp + BEAT + 1);
        ep.forfeit(NODE, linA);
        (,,,,,,, bool active) = ep.leases(ep.leaseKey(NODE, linA));
        assertFalse(active);
        assertEq(ep.cooldownUntil(NODE, opA), uint64(block.timestamp) + LEASE);
    }

    function test_sameOperatorCooldownBlocksSecondLineage() public {
        _ready(NODE, 1_542_812);
        vm.prank(linA); ep.claim(NODE, bytes32(0));
        vm.warp(block.timestamp + BEAT + 1);
        ep.forfeit(NODE, linA);
        // linC shares opA, so the cooldown follows the operator rather than the key
        vm.prank(linC);
        vm.expectRevert(Ethplane.InCooldown.selector);
        ep.claim(NODE, bytes32(0));
        vm.prank(linB); ep.claim(NODE, bytes32(0));
    }

    function test_closeNodeRequiresNoLease() public {
        _ready(NODE, 1_542_812);
        vm.prank(linA); ep.claim(NODE, bytes32(0));
        vm.prank(maintainer);
        vm.expectRevert(Ethplane.LeaseActive.selector);
        ep.closeNode(NODE);
    }

    // ------------------------------------------------------------ submissions

    function test_submit() public {
        _ready(NODE, 1_542_812);
        vm.prank(linA); ep.claim(NODE, bytes32(0));
        bytes32 art = keccak256("a1");
        vm.prank(linA); ep.submit(NODE, art, _noParents());
        (bytes32 nodeId, address lineage, address operator, uint256 seq, Ethplane.Status st,) = ep.submissions(art);
        assertEq(nodeId, NODE); assertEq(lineage, linA); assertEq(operator, opA); assertEq(seq, 1);
        assertEq(uint8(st), uint8(Ethplane.Status.PENDING));
    }

    function test_parentMustBeKnownSubmission() public {
        _ready(NODE, 1_542_812);
        vm.prank(linA); ep.claim(NODE, bytes32(0));
        bytes32[] memory p = new bytes32[](1);
        p[0] = keccak256("never-submitted");
        vm.prank(linA);
        vm.expectRevert(Ethplane.UnknownParent.selector);
        ep.submit(NODE, keccak256("a1"), p);
    }

    function test_parentsCapEight() public {
        _ready(NODE, 1_542_812);
        vm.prank(linA); ep.claim(NODE, bytes32(0));
        bytes32[] memory nine = new bytes32[](9);
        for (uint256 i = 0; i < 9; i++) {
            bytes32 h = keccak256(abi.encode("p", i));
            vm.prank(linA); ep.submit(NODE, h, _noParents());
            nine[i] = h;
        }
        vm.prank(linA);
        vm.expectRevert(Ethplane.TooManyParents.selector);
        ep.submit(NODE, keccak256("child"), nine);
    }

    function test_oneMeasurementPerArtifact() public {
        _ready(NODE, 1_542_812);
        vm.prank(linA); ep.claim(NODE, bytes32(0));
        bytes32 art = keccak256("a1");
        vm.prank(linA); ep.submit(NODE, art, _noParents());
        _measure(NODE, art, 1_600_000);        // worse: FAIL, and FAIL is final
        vm.prank(verifier);
        vm.expectRevert(Ethplane.NotPending.selector);
        ep.recordMeasurement(NODE, art, 1_000_000, 1, 1, 1, true, bytes32(0));
    }

    function test_headOnlyVerifier() public {
        _ready(NODE, 1_542_812);
        vm.prank(linA); ep.claim(NODE, bytes32(0));
        bytes32 art = keccak256("a1");
        vm.prank(linA); ep.submit(NODE, art, _noParents());
        vm.prank(linA);
        vm.expectRevert(Ethplane.NotVerifier.selector);
        ep.recordMeasurement(NODE, art, 1_000_000, 1, 1, 1, true, bytes32(0));
    }

    function test_headNeverRegresses() public {
        _ready(NODE, 1_542_812);
        bytes32 a1 = _pass(linA, 1_540_000, "a1");
        (, uint256 best,,) = ep.nodeMetrics(NODE);
        assertEq(best, 1_540_000);
        vm.prank(linB); ep.claim(NODE, bytes32(0));
        bytes32 a2 = keccak256("a2");
        vm.prank(linB); ep.submit(NODE, a2, _noParents());
        _measure(NODE, a2, 1_541_000);         // worse than the frontier
        (, uint256 best2, bytes32 head,) = ep.nodeMetrics(NODE);
        assertEq(best2, 1_540_000, "frontier holds");
        assertEq(head, a1, "head holds");
        a2;
    }

    // ------------------------------------------------------------------ money

    function _pass(address lineage, uint256 cycles, string memory tag) internal returns (bytes32 art) {
        vm.prank(lineage); ep.claim(NODE, bytes32(0));
        art = keccak256(bytes(tag));
        vm.prank(lineage); ep.submit(NODE, art, _noParents());
        _measure(NODE, art, cycles);
    }

    function test_verdictImprovementReleasesSplit() public {
        _ready(NODE, 1_000_000);
        // 3% cumulative gain against targetGainBps 1000 -> payout = bounty * 300/1000 = 3000e18
        _pass(linA, 970_000, "a1");
        uint256 payout = 3_000e18;
        assertEq(ep.owed(opA), payout * 6800 / 10000, "winner");
        assertEq(ep.owed(verifier), payout * 1000 / 10000, "verifier");
        assertEq(ep.owed(maintainer), payout * 200 / 10000, "registrant");
    }

    function test_cumulativePayoutEqualsOneShot() public {
        _ready(NODE, 1_000_000);
        _pass(linA, 990_000, "s1");      // 1%
        _pass(linB, 980_000, "s2");      // 2% cumulative
        _pass(linC, 970_000, "s3");      // 3% cumulative
        uint256 stepwise = ep.owed(opA) + ep.owed(opB) + ep.owed(verifier) + ep.owed(maintainer);

        // the same node, reached in one jump
        Ethplane ep2 = new Ethplane(maintainer, IERC20(address(plane)));
        bytes32[] memory ids = new bytes32[](1); ids[0] = NODE;
        vm.prank(maintainer); ep2.seedStrawmap(ids);
        vm.prank(maintainer);
        ep2.defineNode(NODE, keccak256("criterion"), 0, address(0), LEASE, BEAT, _split(), 1000, 0);
        vm.prank(maintainer); ep2.setNodeVerifier(NODE, verifier);
        vm.prank(maintainer); plane.approve(address(ep2), BOUNTY);
        vm.prank(maintainer); ep2.fundNode(NODE, BOUNTY);
        vm.prank(verifier); ep2.recordBaseline(NODE, 1_000_000, 1_450_000, 302_500, 30_200, 200);
        vm.prank(linA); ep2.registerLineage(opA, keccak256("g"));
        vm.prank(opA); ep2.acceptLineage(linA);
        vm.prank(linA); ep2.claim(NODE, bytes32(0));
        vm.prank(linA); ep2.submit(NODE, keccak256("one"), _noParents());
        vm.prank(verifier);
        ep2.recordMeasurement(NODE, keccak256("one"), 970_000, 1_400_000, 302_000, 30_000, true, bytes32(0));
        uint256 oneShot = ep2.owed(opA) + ep2.owed(verifier) + ep2.owed(maintainer);
        assertEq(stepwise, oneShot, "N micro-passes credit exactly what one combined pass credits");
    }

    function test_reviewFloor() public {
        _ready(NODE, 1_000_000);
        vm.prank(maintainer); ep.setReviewer(NODE, reviewer);
        vm.prank(linA); ep.claim(NODE, bytes32(0));
        bytes32 art = keccak256("suspicious");
        vm.prank(linA); ep.submit(NODE, art, _noParents());
        _measure(NODE, art, 700_000);          // 30% drop: too good to accept unseen
        (,,,,Ethplane.Status st,) = ep.submissions(art);
        assertEq(uint8(st), uint8(Ethplane.Status.REVIEW));
        assertEq(ep.owed(opA), 0, "nothing paid before a human looks");
    }

    function test_reviewedRowRecorded() public {
        _ready(NODE, 1_000_000);
        vm.prank(maintainer); ep.setReviewer(NODE, reviewer);
        vm.prank(linA); ep.claim(NODE, bytes32(0));
        bytes32 art = keccak256("suspicious");
        vm.prank(linA); ep.submit(NODE, art, _noParents());
        _measure(NODE, art, 700_000);
        vm.prank(verifier);
        vm.expectRevert(Ethplane.NotReviewer.selector);
        ep.confirmReview(NODE, art, true);
        vm.expectEmit(true, true, false, true, address(ep));
        emit Ethplane.ReviewConfirmed(NODE, art, reviewer, true);
        vm.prank(reviewer); ep.confirmReview(NODE, art, true);
        (,,,,Ethplane.Status st,) = ep.submissions(art);
        assertEq(uint8(st), uint8(Ethplane.Status.PASS));
        assertGt(ep.owed(opA), 0);
    }

    function test_parentShareSplitsAmongPassParents() public {
        _ready(NODE, 1_000_000);
        bytes32 p1 = _pass(linA, 995_000, "p1");     // opA
        bytes32 p2 = _pass(linB, 990_000, "p2");     // opB
        uint256 beforeA = ep.owed(opA);
        uint256 beforeB = ep.owed(opB);
        // linC (opA) builds on both; opA is the winner here, so only opB is an eligible parent
        vm.prank(linC); ep.claim(NODE, bytes32(0));
        bytes32[] memory ps = new bytes32[](2); ps[0] = p1; ps[1] = p2;
        bytes32 art = keccak256("child");
        vm.prank(linC); ep.submit(NODE, art, ps);
        _measure(NODE, art, 980_000);
        assertGt(ep.owed(opB) - beforeB, 0, "the other operator's parent is paid");
        assertEq(ep.owed(opA) - beforeA, (ep.owed(opA) - beforeA), "self-parent pays nothing extra");
    }

    function test_sameOperatorParentPaysNothing() public {
        _ready(NODE, 1_000_000);
        bytes32 p1 = _pass(linA, 995_000, "p1");     // opA
        uint256 winnerBefore = ep.owed(opA);
        vm.prank(linC); ep.claim(NODE, bytes32(0));  // linC also opA
        bytes32[] memory ps = new bytes32[](1); ps[0] = p1;
        vm.prank(linC); ep.submit(NODE, keccak256("child"), ps);
        _measure(NODE, keccak256("child"), 990_000);
        uint256 payout = 10_000e18 * 50 / 1000;      // 0.5% more cumulative gain
        // winner share only; the parent share found no eligible operator and stayed in escrow
        assertEq(ep.owed(opA) - winnerBefore, payout * 6800 / 10000);
    }

    function test_noEligibleParentsShareStaysInEscrow() public {
        _ready(NODE, 1_000_000);
        vm.prank(linA); ep.claim(NODE, bytes32(0));
        bytes32 unver = keccak256("unverified-parent");
        vm.prank(linA); ep.submit(NODE, unver, _noParents());
        bytes32[] memory ps = new bytes32[](1); ps[0] = unver;
        vm.prank(linB); ep.claim(NODE, bytes32(0));
        vm.prank(linB); ep.submit(NODE, keccak256("child"), ps);
        uint256 balBefore = plane.balanceOf(address(ep));
        _measure(NODE, keccak256("child"), 970_000);
        assertEq(plane.balanceOf(address(ep)), balBefore, "credits only; escrow untouched");
        uint256 payout = 3_000e18;
        assertEq(ep.owed(opB), payout * 6800 / 10000, "winner paid, parent share retained");
    }

    function test_withdrawPaysOwed() public {
        _ready(NODE, 1_000_000);
        _pass(linA, 970_000, "a1");
        uint256 amount = ep.owed(opA);
        vm.prank(opA); ep.withdraw();
        assertEq(plane.balanceOf(opA), amount);
        assertEq(ep.owed(opA), 0);
    }

    function test_withdrawNothingOwedReverts() public {
        vm.prank(opA);
        vm.expectRevert(Ethplane.NothingOwed.selector);
        ep.withdraw();
    }

    function test_withdrawUnusedProRata() public {
        _define(NODE);
        _fund(NODE, 3_000e18);                       // maintainer
        vm.prank(funder2); plane.approve(address(ep), 1_000e18);
        vm.prank(funder2); ep.fundNode(NODE, 1_000e18);
        vm.prank(maintainer); ep.closeNode(NODE);
        uint256 before = plane.balanceOf(funder2);
        vm.prank(funder2); ep.withdrawUnused(NODE);
        assertEq(plane.balanceOf(funder2) - before, 1_000e18, "quarter funded, quarter back");
        vm.prank(funder2);
        vm.expectRevert(Ethplane.AlreadyWithdrawn.selector);
        ep.withdrawUnused(NODE);
    }

    // ------------------------------------------------------------------ relay

    function test_relaySubmitForGuestNeedsValidSig() public {
        _ready(NODE, 1_000_000);
        (address guest, uint256 pk) = makeAddrAndKey("guest");
        bytes memory rsig = _sign(pk, keccak256(abi.encode(
            keccak256("RegisterLineage(address guest,bytes32 groupName,uint256 nonce,uint256 deadline)"),
            guest, keccak256("guests"), uint256(0), block.timestamp + 1 hours)));
        vm.prank(relay); ep.registerLineageFor(guest, keccak256("guests"), 0, block.timestamp + 1 hours, rsig);
        bytes memory csig = _sign(pk, keccak256(abi.encode(
            keccak256("Claim(bytes32 nodeId,address guest,bytes32 fromHash,uint256 nonce,uint256 deadline)"),
            NODE, guest, bytes32(0), uint256(1), block.timestamp + 1 hours)));
        vm.prank(relay); ep.claimFor(NODE, guest, bytes32(0), 1, block.timestamp + 1 hours, csig);

        bytes32[] memory none = _noParents();
        bytes32 art = keccak256("guest-artifact");
        bytes32 structHash = keccak256(abi.encode(
            keccak256("Submit(bytes32 nodeId,address guest,bytes32 artifactHash,bytes32 parentsHash,uint256 nonce,uint256 deadline)"),
            NODE, guest, art, keccak256(abi.encodePacked(none)), uint256(2), block.timestamp + 1 hours));
        (, uint256 wrongPk) = makeAddrAndKey("not-the-guest");
        // sign BEFORE expectRevert: _sign calls ep.domainSeparator(), and an expectRevert set first
        // would be consumed by that inner call instead of by submitFor
        bytes memory badSig = _sign(wrongPk, structHash);
        bytes memory goodSig = _sign(pk, structHash);
        vm.prank(relay);
        vm.expectRevert(Ethplane.BadSignature.selector);
        ep.submitFor(NODE, guest, art, none, 2, block.timestamp + 1 hours, badSig);
        vm.prank(relay);
        ep.submitFor(NODE, guest, art, none, 2, block.timestamp + 1 hours, goodSig);
        (, address lineage,,,,) = ep.submissions(art);
        assertEq(lineage, guest);
    }

    function test_relayReplayAndDeadline() public {
        _ready(NODE, 1_000_000);
        (address guest, uint256 pk) = makeAddrAndKey("guest2");
        uint256 dl = block.timestamp + 1 hours;
        bytes32 h = keccak256(abi.encode(
            keccak256("RegisterLineage(address guest,bytes32 groupName,uint256 nonce,uint256 deadline)"),
            guest, keccak256("g"), uint256(0), dl));
        bytes memory sig = _sign(pk, h);
        vm.prank(makeAddr("not-a-relay"));
        vm.expectRevert(Ethplane.NotRelay.selector);
        ep.registerLineageFor(guest, keccak256("g"), 0, dl, sig);
        vm.prank(relay); ep.registerLineageFor(guest, keccak256("g"), 0, dl, sig);
        vm.prank(relay);
        vm.expectRevert(Ethplane.BadNonce.selector);            // replay
        ep.registerLineageFor(guest, keccak256("g"), 0, dl, sig);
        vm.warp(dl + 1);
        vm.prank(relay);
        vm.expectRevert(Ethplane.Expired.selector);             // stale
        ep.registerLineageFor(guest, keccak256("g"), 1, dl, sig);
    }

    function _sign(uint256 pk, bytes32 structHash) internal view returns (bytes memory) {
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", ep.domainSeparator(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    // --------------------------------------------------------------- token

    function test_planeMintOnce() public view {
        assertEq(plane.totalSupply(), 1_000_000e18);
        assertEq(plane.decimals(), 18);
        assertEq(plane.symbol(), "PLANE");
    }

}
