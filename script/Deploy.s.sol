// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {Ethplane} from "../contracts/Ethplane.sol";
import {PlaneToken} from "../contracts/PlaneToken.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Deploy order per PRD 3.3.3: PlaneToken(treasury) -> Ethplane(maintainer, plane)
///         -> seedStrawmap(65 ids) -> setRelay. Two contracts; EthplaneHead is folded into Ethplane.
///
/// Arguments come from the environment so no key or address is checked into the repo:
///   TREASURY   the Privy organisation wallet that receives the whole PLANE supply
///   MAINTAINER the maintainer address (defines nodes until the ENS subregistry exists)
///   RELAY      the relay allowed to submit guest-signed calls
/// Run: forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --private-key $KEY --broadcast
contract Deploy is Script {
    using stdJson for string;

    function run() external {
        address treasury = vm.envAddress("TREASURY");
        address maintainer = vm.envAddress("MAINTAINER");
        address relay = vm.envAddress("RELAY");

        string memory idsJson = vm.readFile("contracts/deployments/strawmap-ids.json");
        bytes32[] memory ids = idsJson.readBytes32Array(".ids");
        require(ids.length == 65, "expected 65 strawmap ids");

        vm.startBroadcast();
        PlaneToken plane = new PlaneToken(treasury);
        Ethplane ethplane = new Ethplane(maintainer, IERC20(address(plane)));
        ethplane.seedStrawmap(ids);
        ethplane.setRelay(relay, true);
        vm.stopBroadcast();

        string memory out = "deployment";
        out.serialize("chainId", block.chainid);
        out.serialize("PlaneToken", address(plane));
        out.serialize("Ethplane", address(ethplane));
        out.serialize("treasury", treasury);
        out.serialize("maintainer", maintainer);
        out.serialize("relay", relay);
        string memory finished = out.serialize("strawmapCount", ids.length);
        vm.writeJson(finished, "contracts/deployments/sepolia.json");
    }
}
