// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IRegistry} from "./interfaces/IRegistry.sol";

/// @title EthplaneSubregistry — our own ENSv2 subregistry for ethplane.eth
/// @notice ENSv2 lets a name point at any registry contract; the hackathon deployment's own
///         UserRegistry implementation cannot be initialised (no initializer, so a proxy deploys
///         with no roles and can never register anything), so ethplane.eth points here instead.
///
/// Two ways in. The maintainer registers anything. Anyone may register one of the 65 strawmap node
/// ids, once, for free — node registration is permissionless by design (PRD 3.21), and "once" is
/// what stops it being a squatting surface. Expiry is how a lineage or guest name lapses: after it,
/// `getResolver` and `getSubregistry` return zero, so the name stops resolving without anyone
/// having to delete anything.
contract EthplaneSubregistry is IRegistry {
    struct Entry {
        address owner;
        address resolver;
        address subregistry;
        uint64 expiry;
    }

    mapping(uint256 => Entry) internal _entries;   // labelhash -> entry
    mapping(uint256 => bool) public isStrawmapLabel;
    mapping(uint256 => bool) public strawmapClaimed;

    address public registrar;                      // the maintainer
    IRegistry public immutable parentRegistry;
    string public parentLabel;                     // "ethplane"

    event Renewed(uint256 indexed labelHash, uint64 expiry);
    event Transferred(uint256 indexed labelHash, address indexed from, address indexed to);
    event RegistrarSet(address registrar);

    error NotRegistrar();
    error NotOwner();
    error AlreadyRegistered();
    error NotStrawmapLabel();
    error AlreadyClaimed();
    error ZeroOwner();

    modifier onlyRegistrar() {
        if (msg.sender != registrar) revert NotRegistrar();
        _;
    }

    modifier onlyNameOwner(string memory label) {
        if (_entries[_labelHash(label)].owner != msg.sender) revert NotOwner();
        _;
    }

    constructor(address registrar_, IRegistry parentRegistry_, string memory parentLabel_, uint256[] memory strawmap) {
        require(registrar_ != address(0), "registrar=0");
        registrar = registrar_;
        parentRegistry = parentRegistry_;
        parentLabel = parentLabel_;
        for (uint256 i = 0; i < strawmap.length; i++) {
            isStrawmapLabel[strawmap[i]] = true;
        }
        emit RegistrarSet(registrar_);
    }

    function _labelHash(string memory label) internal pure returns (uint256) {
        return uint256(keccak256(bytes(label)));
    }

    function labelHash(string calldata label) external pure returns (uint256) {
        return _labelHash(label);
    }

    // ------------------------------------------------------------- IRegistry

    function getSubregistry(string calldata label) external view returns (IRegistry) {
        Entry storage e = _entries[_labelHash(label)];
        if (_expired(e)) return IRegistry(address(0));
        return IRegistry(e.subregistry);
    }

    function getResolver(string calldata label) external view returns (address) {
        Entry storage e = _entries[_labelHash(label)];
        if (_expired(e)) return address(0);
        return e.resolver;
    }

    function getParent() external view returns (IRegistry parent, string memory label) {
        return (parentRegistry, parentLabel);
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IRegistry).interfaceId || interfaceId == 0x01ffc9a7;
    }

    function _expired(Entry storage e) internal view returns (bool) {
        return e.owner == address(0) || (e.expiry != 0 && block.timestamp >= e.expiry);
    }

    // ------------------------------------------------------------ management

    function setRegistrar(address registrar_) external onlyRegistrar {
        registrar = registrar_;
        emit RegistrarSet(registrar_);
    }

    /// @notice Register any label. Maintainer only.
    function register(string calldata label, address owner, address resolver, address subregistry, uint64 expiry)
        external
        onlyRegistrar
    {
        _register(label, owner, resolver, subregistry, expiry);
    }

    /// @notice Register one of the 65 strawmap node ids. Anyone, free, once ever.
    /// @dev "Once" is the whole defence: without it a permissionless registrar is a squatting
    ///      surface. A node that has been claimed can only change hands through its owner.
    function registerStrawmapNode(string calldata label, address owner, address resolver) external {
        uint256 h = _labelHash(label);
        if (!isStrawmapLabel[h]) revert NotStrawmapLabel();
        if (strawmapClaimed[h]) revert AlreadyClaimed();
        strawmapClaimed[h] = true;
        _register(label, owner, resolver, address(0), 0);   // node names do not expire
    }

    function _register(string calldata label, address owner, address resolver, address subregistry, uint64 expiry)
        internal
    {
        if (owner == address(0)) revert ZeroOwner();
        uint256 h = _labelHash(label);
        Entry storage e = _entries[h];
        if (!_expired(e)) revert AlreadyRegistered();
        e.owner = owner;
        e.resolver = resolver;
        e.subregistry = subregistry;
        e.expiry = expiry;
        emit NewSubname(h, label);
        emit ResolverSet(h, resolver);
        emit SubregistrySet(h, subregistry);
    }

    function setResolver(string calldata label, address resolver) external onlyNameOwner(label) {
        uint256 h = _labelHash(label);
        _entries[h].resolver = resolver;
        emit ResolverSet(h, resolver);
    }

    function setSubregistry(string calldata label, address subregistry) external onlyNameOwner(label) {
        uint256 h = _labelHash(label);
        _entries[h].subregistry = subregistry;
        emit SubregistrySet(h, subregistry);
    }

    /// @notice Extend a name. The registrar may renew anything (it pays for the guests); an owner
    ///         may renew its own. A lineage name is renewed on heartbeat, which is what makes an
    ///         abandoned lineage lapse on its own.
    function renew(string calldata label, uint64 expiry) external {
        uint256 h = _labelHash(label);
        Entry storage e = _entries[h];
        if (msg.sender != registrar && msg.sender != e.owner) revert NotOwner();
        if (e.owner == address(0)) revert NotOwner();
        e.expiry = expiry;
        emit Renewed(h, expiry);
    }

    function transfer(string calldata label, address to) external onlyNameOwner(label) {
        if (to == address(0)) revert ZeroOwner();
        uint256 h = _labelHash(label);
        emit Transferred(h, msg.sender, to);
        _entries[h].owner = to;
    }

    // ---------------------------------------------------------------- views

    function ownerOf(uint256 labelhash) external view returns (address) {
        Entry storage e = _entries[labelhash];
        return _expired(e) ? address(0) : e.owner;
    }

    function entry(string calldata label)
        external
        view
        returns (address owner, address resolver, address subregistry, uint64 expiry, bool expired)
    {
        Entry storage e = _entries[_labelHash(label)];
        return (e.owner, e.resolver, e.subregistry, e.expiry, _expired(e));
    }
}
