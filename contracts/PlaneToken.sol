// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title PlaneToken — the bounty asset (PRD 3.3.1)
/// @notice Fixed supply, minted once to the treasury at construction. There is no mint function:
///         the supply a node can ever pay out is the supply that exists here.
contract PlaneToken is ERC20 {
    uint256 public constant INITIAL_SUPPLY = 1_000_000e18;

    constructor(address treasury) ERC20("Plane", "PLANE") {
        require(treasury != address(0), "treasury=0");
        _mint(treasury, INITIAL_SUPPLY);
    }
}
