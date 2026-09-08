// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {EthplaneSubregistry} from "../contracts/EthplaneSubregistry.sol";
import {EthplaneResolver} from "../contracts/EthplaneResolver.sol";
import {IRegistry} from "../contracts/interfaces/IRegistry.sol";

interface IEthRegistry {
    function ownerOf(uint256 tokenId) external view returns (address);
    function setSubregistry(uint256 tokenId, address subregistry) external;
    function setResolver(uint256 tokenId, address resolver) external;
}

interface IUniversalResolver {
    function resolve(bytes calldata name, bytes calldata data) external view returns (bytes memory, address);
}

interface ITextResolver {
    function text(bytes32 node, string calldata key) external view returns (string memory);
}

/// @notice The one test that proves the whole ENS path end to end: our own subregistry hangs off
///         `ethplane.eth` on the hackathon registry, and a real Universal Resolver — not our code —
///         walks from the root to a text record we wrote. Everything else about the ENS layer can
///         be true while this is false.
///
/// Skips (rather than fails) when SEPOLIA_RPC_URL is unset, so `forge test` is green offline.
contract EnsForkTest is Test {
    // Hackathon ENSv2 deployment, recorded in ens-artifacts.md and verified in P13.
    address constant ETH_REGISTRY = 0x1D78834d97c1D7b1A38c1deDBD1a287cFEd3971e;
    address constant UNIVERSAL_RESOLVER = 0xd26f2040D083Af1cD2962ba303F4BEa0c4faf142;
    // keccak256("ethplane") with the low 32 bits cleared — the registry's canonical token id, which
    // is NOT the labelhash (P13; ownerOf(labelhash) returns zero).
    uint256 constant ETHPLANE_ID = 0x78773cee210e8b9baab13d5140af5c1e5337df8a764f18693d6633ac00000000;

    string constant LABEL = "probe";
    string constant KEY = "ethplane.verdict";
    string constant VALUE = "pass:1542812";

    function test_forkResolvesTextThroughUniversalResolver() public {
        string memory rpc = vm.envOr("SEPOLIA_RPC_URL", string(""));
        if (bytes(rpc).length == 0) {
            emit log("SEPOLIA_RPC_URL unset: skipping the fork test");
            vm.skip(true);
        }
        vm.createSelectFork(rpc);

        // The name's owner is read from chain rather than written into the repo.
        address owner = IEthRegistry(ETH_REGISTRY).ownerOf(ETHPLANE_ID);
        assertTrue(owner != address(0), "ethplane.eth must be registered on the hackathon registry");

        uint256[] memory strawmap = new uint256[](0);
        EthplaneSubregistry sub =
            new EthplaneSubregistry(owner, IRegistry(ETH_REGISTRY), "ethplane", strawmap);
        EthplaneResolver res = new EthplaneResolver(owner, _namehash("probe.ethplane.eth"));

        vm.startPrank(owner);
        IEthRegistry(ETH_REGISTRY).setSubregistry(ETHPLANE_ID, address(sub));
        sub.register(LABEL, owner, address(res), address(0), 0);
        res.setText(_namehash("probe.ethplane.eth"), KEY, VALUE);
        vm.stopPrank();

        // Read it back the way any client would: DNS-encoded name, ENSIP-5 calldata, through the UR.
        bytes memory name = _dnsEncode("probe.ethplane.eth");
        bytes memory call = abi.encodeWithSelector(ITextResolver.text.selector, _namehash("probe.ethplane.eth"), KEY);
        (bytes memory result, address usedResolver) = IUniversalResolver(UNIVERSAL_RESOLVER).resolve(name, call);
        string memory got = abi.decode(result, (string));

        emit log_named_address("universal resolver picked", usedResolver);
        emit log_named_string("text(probe.ethplane.eth, ethplane.verdict)", got);
        assertEq(usedResolver, address(res), "the UR walked into our subregistry and found our resolver");
        assertEq(got, VALUE, "the value came back through the real resolution path");
    }

    function _namehash(string memory name) internal pure returns (bytes32 node) {
        node = bytes32(0);
        bytes memory n = bytes(name);
        if (n.length == 0) return node;
        uint256 end = n.length;
        for (uint256 i = n.length; i > 0; i--) {
            if (n[i - 1] == ".") {
                node = keccak256(abi.encodePacked(node, keccak256(_slice(n, i, end))));
                end = i - 1;
            }
        }
        node = keccak256(abi.encodePacked(node, keccak256(_slice(n, 0, end))));
    }

    function _slice(bytes memory b, uint256 from, uint256 to) internal pure returns (bytes memory out) {
        out = new bytes(to - from);
        for (uint256 i = 0; i < to - from; i++) {
            out[i] = b[from + i];
        }
    }

    function _dnsEncode(string memory name) internal pure returns (bytes memory out) {
        bytes memory n = bytes(name);
        out = new bytes(n.length + 2);
        uint256 outI;
        uint256 start;
        for (uint256 i = 0; i <= n.length; i++) {
            if (i == n.length || n[i] == ".") {
                uint256 len = i - start;
                out[outI++] = bytes1(uint8(len));
                for (uint256 j = 0; j < len; j++) {
                    out[outI++] = n[start + j];
                }
                start = i + 1;
            }
        }
        out[outI] = 0x00;
    }
}
