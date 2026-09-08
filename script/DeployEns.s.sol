// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {EthplaneSubregistry} from "../contracts/EthplaneSubregistry.sol";
import {EthplaneResolver} from "../contracts/EthplaneResolver.sol";
import {IRegistry} from "../contracts/interfaces/IRegistry.sol";

interface IEthRegistry {
    function ownerOf(uint256 tokenId) external view returns (address);
    function setSubregistry(uint256 tokenId, address subregistry) external;
}

/// @notice Hangs our own subregistry off ethplane.eth and registers the Day-1 names (PRD 3.4 step 4).
///
/// One resolver per node, not one shared resolver: on the hackathon's PermissionedResolver the role
/// resource is derived from the text KEY alone, so a shared instance would let any node's writer
/// write every node's records (measured in P13b). Our own resolver has the same shape per instance,
/// so the separation has to be instances.
///
/// Env: ETH_REGISTRY, ETHPLANE_ID, MAINTAINER, and optionally GUEST_TTL (seconds, default 14 days).
/// Run: forge script script/DeployEns.s.sol --rpc-url $SEPOLIA_RPC_URL --private-key $KEY --broadcast
contract DeployEns is Script {
    using stdJson for string;

    string constant NODE_LABEL = "pq-leanxmss-attestations";
    /// namehash("ethplane.eth"), the parent every name below hangs from.
    bytes32 constant ETHPLANE_NODE = 0x4bd2f3aed992f15dfd3b487a898f4fd9b6c19da79f4871cc1553c073126f3204;

    function _child(string memory label) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(ETHPLANE_NODE, keccak256(bytes(label))));
    }

    function run() external {
        address ethRegistry = vm.envAddress("ETH_REGISTRY");
        uint256 ethplaneId = vm.envUint("ETHPLANE_ID");
        address maintainer = vm.envAddress("MAINTAINER");
        uint64 guestTtl = uint64(vm.envOr("GUEST_TTL", uint256(14 days)));

        address owner = IEthRegistry(ethRegistry).ownerOf(ethplaneId);
        require(owner != address(0), "ethplane.eth is not registered");

        string memory idsJson = vm.readFile("contracts/deployments/strawmap-ids.json");
        bytes32[] memory ids = idsJson.readBytes32Array(".ids");
        uint256[] memory strawmap = new uint256[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            strawmap[i] = uint256(ids[i]);
        }

        vm.startBroadcast();
        EthplaneSubregistry sub = new EthplaneSubregistry(maintainer, IRegistry(ethRegistry), "ethplane", strawmap);
        IEthRegistry(ethRegistry).setSubregistry(ethplaneId, address(sub));

        // The PoC node gets its own resolver; the operator and guest names share one instance
        // because they hold identity records, not per-node verdicts.
        // Each resolver is constructed with the node it serves; the contract refuses writes for any
        // other node, so "one resolver per node" is an invariant rather than a deployment habit.
        EthplaneResolver nodeResolver = new EthplaneResolver(maintainer, _child(NODE_LABEL));
        EthplaneResolver identityResolver = new EthplaneResolver(maintainer, _child("ecofrontiers"));

        sub.register(NODE_LABEL, maintainer, address(nodeResolver), address(0), 0);
        sub.register("ecofrontiers", maintainer, address(identityResolver), address(0), 0);
        // One instance per name, for the same reason as the node: a shared identity resolver would
        // let any writer set any operator's records.
        uint64 guestExpiry = guestTtl == 0 ? 0 : uint64(block.timestamp) + guestTtl;
        string[4] memory labels = ["qwen-a", "fast-b", "verifier", "guests"];
        address[4] memory resolvers;
        for (uint256 i = 0; i < labels.length; i++) {
            EthplaneResolver r = new EthplaneResolver(maintainer, _child(labels[i]));
            resolvers[i] = address(r);
            sub.register(labels[i], maintainer, address(r), address(0), i < 2 ? guestExpiry : 0);
        }
        vm.stopBroadcast();

        string memory out = "ens";
        out.serialize("chainId", block.chainid);
        out.serialize("ethRegistry", ethRegistry);
        out.serialize("ethplaneId", ethplaneId);
        out.serialize("EthplaneSubregistry", address(sub));
        out.serialize("nodeResolver", address(nodeResolver));
        out.serialize("identityResolver", address(identityResolver));
        out.serialize("nodeLabel", NODE_LABEL);
        string memory finished = out.serialize("strawmapLabels", ids.length);
        vm.writeJson(finished, "contracts/deployments/sepolia-ens.json");
    }
}
