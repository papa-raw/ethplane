// SPDX-License-Identifier: MIT
pragma solidity >=0.8.13;

/// @dev Events an ENSv2 registry emits. Declared here rather than imported so this repo has no
///      dependency on an unreleased contracts-v2 branch; the signatures match theirs.
interface IRegistryEvents {
    event NewSubname(uint256 indexed labelHash, string label);
    event ResolverSet(uint256 indexed labelHash, address resolver);
    event SubregistrySet(uint256 indexed labelHash, address subregistry);
}

/// @notice The ENSv2 registry interface, copied field for field from contracts-v2.
/// @dev Interface selector `0x51f67f40` — asserted in the tests, so a drift from upstream fails
///      loudly instead of producing a registry the Universal Resolver silently ignores.
interface IRegistry is IRegistryEvents {
    function getSubregistry(string calldata label) external view returns (IRegistry);
    function getResolver(string calldata label) external view returns (address);
    function getParent() external view returns (IRegistry parent, string memory label);
}
