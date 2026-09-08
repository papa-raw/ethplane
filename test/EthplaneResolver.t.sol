// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {EthplaneResolver} from "../contracts/EthplaneResolver.sol";

contract EthplaneResolverTest is Test {
    EthplaneResolver r;
    address owner = makeAddr("resolverOwner");
    address writerA = makeAddr("writerA");
    address stranger = makeAddr("stranger");

    bytes32 constant NODE = keccak256("node.ethplane.eth");
    bytes32 constant OTHER = keccak256("other.ethplane.eth");

    function setUp() public {
        r = new EthplaneResolver(owner, NODE);
        vm.prank(owner);
        r.setWriter("ethplane.verdict", writerA, true);
    }

    function test_writerOnlyOwnKey() public {
        vm.prank(writerA);
        r.setText(NODE, "ethplane.verdict", "pass");
        assertEq(r.text(NODE, "ethplane.verdict"), "pass");

        // the same account has no business writing a key it was not granted
        vm.prank(writerA);
        vm.expectRevert(abi.encodeWithSelector(EthplaneResolver.NotAuthorized.selector, "ethplane.head", writerA));
        r.setText(NODE, "ethplane.head", "0xdead");

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(EthplaneResolver.NotAuthorized.selector, "ethplane.verdict", stranger));
        r.setText(NODE, "ethplane.verdict", "pass");
    }

    function test_ownerAnyKey() public {
        vm.startPrank(owner);
        r.setText(NODE, "ethplane.verdict", "pass");
        r.setText(NODE, "ethplane.head", "0xbeef");
        r.setText(NODE, "agent-context", "an Ethplane node");
        r.setAddr(NODE, address(0xA11CE));
        vm.stopPrank();
        assertEq(r.text(NODE, "ethplane.head"), "0xbeef");
        assertEq(r.text(NODE, "agent-context"), "an Ethplane node");
        assertEq(r.addr(NODE), address(0xA11CE));

        vm.prank(stranger);
        vm.expectRevert(EthplaneResolver.NotOwner.selector);
        r.setAddr(NODE, stranger);
    }

    function test_resolverServesExactlyOneNode() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(EthplaneResolver.WrongNode.selector, OTHER, NODE));
        r.setText(OTHER, "ethplane.verdict", "pass");
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(EthplaneResolver.WrongNode.selector, OTHER, NODE));
        r.setAddr(OTHER, address(1));
        // reads for another node answer "no record" rather than reverting: the Universal Resolver's
        // walk expects an empty answer, not a revert
        assertEq(r.text(OTHER, "ethplane.verdict"), "");
        assertEq(r.addr(OTHER), address(0));
    }

    function test_resolverSupportsEnsipInterfaces() public view {
        assertTrue(r.supportsInterface(0x59d1d43c), "text");
        assertTrue(r.supportsInterface(0x3b3b57de), "addr");
        assertTrue(r.supportsInterface(0x01ffc9a7), "erc165");
        assertFalse(r.supportsInterface(0xdeadbeef));
    }
}
