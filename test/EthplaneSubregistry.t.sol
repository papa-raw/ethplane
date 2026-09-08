// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {EthplaneSubregistry} from "../contracts/EthplaneSubregistry.sol";
import {EthplaneResolver} from "../contracts/EthplaneResolver.sol";
import {IRegistry} from "../contracts/interfaces/IRegistry.sol";

contract EthplaneSubregistryTest is Test {
    EthplaneSubregistry reg;
    EthplaneResolver res;

    address maintainer = makeAddr("maintainer");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    string constant NODE_LABEL = "pq-leanxmss-attestations";
    string constant GUEST_LABEL = "guest-0001";

    function setUp() public {
        uint256[] memory strawmap = new uint256[](2);
        strawmap[0] = uint256(keccak256(bytes(NODE_LABEL)));
        strawmap[1] = uint256(keccak256(bytes("el-bals")));
        reg = new EthplaneSubregistry(maintainer, IRegistry(address(0)), "ethplane", strawmap);
        res = new EthplaneResolver(maintainer, keccak256("probe"));
    }

    function test_registerAndResolve() public {
        vm.prank(maintainer);
        reg.register("qwen-a", alice, address(res), address(0), uint64(block.timestamp + 30 days));
        assertEq(reg.getResolver("qwen-a"), address(res));
        assertEq(reg.ownerOf(uint256(keccak256("qwen-a"))), alice);
        assertEq(address(reg.getSubregistry("qwen-a")), address(0));
    }

    function test_registryInterfaceIdMatchesUpstream() public view {
        // contracts-v2 documents 0x51f67f40. If our copy of IRegistry drifts, the Universal
        // Resolver stops recognising this contract as a registry — and it does so silently.
        assertEq(type(IRegistry).interfaceId, bytes4(0x51f67f40));
        assertTrue(reg.supportsInterface(0x51f67f40));
        assertTrue(reg.supportsInterface(0x01ffc9a7));
        assertFalse(reg.supportsInterface(0xdeadbeef));
    }

    function test_expiredReturnsZero() public {
        vm.prank(maintainer);
        reg.register(GUEST_LABEL, alice, address(res), address(0), uint64(block.timestamp + 14 days));
        assertEq(reg.getResolver(GUEST_LABEL), address(res));
        vm.warp(block.timestamp + 14 days + 1);
        assertEq(reg.getResolver(GUEST_LABEL), address(0), "a lapsed name stops resolving");
        assertEq(address(reg.getSubregistry(GUEST_LABEL)), address(0));
        assertEq(reg.ownerOf(uint256(keccak256(bytes(GUEST_LABEL)))), address(0));
        // and the label is free again, which is what makes expiry a lifecycle rather than a leak.
        // vm.getBlockTimestamp(), not block.timestamp: under via_ir the compiler folds repeated
        // block.timestamp reads across the vm.warp call, so the second register would otherwise be
        // handed the PRE-warp clock and register an already-expired name.
        vm.prank(maintainer);
        reg.register(GUEST_LABEL, bob, address(res), address(0), uint64(vm.getBlockTimestamp() + 14 days));
        assertEq(reg.ownerOf(uint256(keccak256(bytes(GUEST_LABEL)))), bob);
    }

    function test_renewKeepsAliveAndOnlyOwnerOrRegistrar() public {
        vm.prank(maintainer);
        reg.register(GUEST_LABEL, alice, address(res), address(0), uint64(block.timestamp + 1 days));
        vm.prank(bob);
        vm.expectRevert(EthplaneSubregistry.NotOwner.selector);
        reg.renew(GUEST_LABEL, uint64(block.timestamp + 999 days));
        vm.prank(alice);
        reg.renew(GUEST_LABEL, uint64(block.timestamp + 30 days));
        vm.warp(block.timestamp + 2 days);
        assertEq(reg.getResolver(GUEST_LABEL), address(res), "renewed before it lapsed");
    }

    function test_onlyOwnerSetters() public {
        vm.prank(maintainer);
        reg.register("qwen-a", alice, address(res), address(0), 0);
        vm.prank(bob);
        vm.expectRevert(EthplaneSubregistry.NotOwner.selector);
        reg.setResolver("qwen-a", address(1));
        vm.prank(bob);
        vm.expectRevert(EthplaneSubregistry.NotOwner.selector);
        reg.setSubregistry("qwen-a", address(1));
        vm.prank(alice);
        reg.setResolver("qwen-a", address(1));
        assertEq(reg.getResolver("qwen-a"), address(1));
        vm.prank(alice);
        reg.transfer("qwen-a", bob);
        assertEq(reg.ownerOf(uint256(keccak256("qwen-a"))), bob);
        vm.prank(alice);
        vm.expectRevert(EthplaneSubregistry.NotOwner.selector);
        reg.setResolver("qwen-a", address(2));
    }

    function test_onlyRegistrarRegisters() public {
        vm.prank(bob);
        vm.expectRevert(EthplaneSubregistry.NotRegistrar.selector);
        reg.register("qwen-a", bob, address(res), address(0), 0);
    }

    function test_strawmapPermissionlessOnce() public {
        // anyone may claim a node id, without paying and without the maintainer
        vm.prank(alice);
        reg.registerStrawmapNode(NODE_LABEL, alice, address(res));
        assertEq(reg.ownerOf(uint256(keccak256(bytes(NODE_LABEL)))), alice);

        vm.prank(bob);
        vm.expectRevert(EthplaneSubregistry.AlreadyClaimed.selector);
        reg.registerStrawmapNode(NODE_LABEL, bob, address(res));

        vm.prank(bob);
        vm.expectRevert(EthplaneSubregistry.NotStrawmapLabel.selector);
        reg.registerStrawmapNode("not-a-node", bob, address(res));
    }
}
