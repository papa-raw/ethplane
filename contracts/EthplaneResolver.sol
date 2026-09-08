// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title EthplaneResolver — one resolver instance per node (PRD 3.4, fallback resolver)
/// @notice ENSIP-5 text records plus an address record, with per-key write roles.
///
/// Why per-node instances rather than one shared resolver: on the hackathon's own
/// PermissionedResolver deployment, role resources are derived from the text KEY alone, so a role
/// granted for `ethplane.verdict` on one name is that role on every name sharing the resolver
/// (measured in P13b: two registered names produced byte-identical resource ids for one key). Node
/// separation therefore has to come from separate instances, not from separate keys — a key scheme
/// is one forgotten suffix away from the same hole.
contract EthplaneResolver {
    /// @dev ENSIP-5 text() / ENSIP-1 addr() / ERC-165, the three interfaces a client actually asks for.
    bytes4 private constant INTERFACE_TEXT = 0x59d1d43c;
    bytes4 private constant INTERFACE_ADDR = 0x3b3b57de;
    bytes4 private constant INTERFACE_ERC165 = 0x01ffc9a7;

    /// @notice The single node this instance serves. One resolver per node is not a convention here
    /// but an invariant: with a shared instance, a writer granted one key writes that key for every
    /// node (measured on the hackathon resolver, P13b), so the separation is enforced in code.
    bytes32 public immutable servedNode;
    address public owner;
    mapping(bytes32 => mapping(string => string)) private _texts;
    mapping(bytes32 => address) private _addrs;
    /// @dev key => account => may write that key on any node this instance serves.
    mapping(string => mapping(address => bool)) public writer;

    event TextChanged(bytes32 indexed node, string indexed indexedKey, string key, string value);
    event AddrChanged(bytes32 indexed node, address a);
    event WriterSet(string key, address indexed account, bool allowed);
    event OwnerTransferred(address indexed from, address indexed to);

    error NotOwner();
    error NotAuthorized(string key, address account);
    error WrongNode(bytes32 asked, bytes32 served);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address owner_, bytes32 servedNode_) {
        require(owner_ != address(0), "owner=0");
        owner = owner_;
        servedNode = servedNode_;
        emit OwnerTransferred(address(0), owner_);
    }

    modifier onlyServed(bytes32 node) {
        if (node != servedNode) revert WrongNode(node, servedNode);
        _;
    }

    function transferOwnership(address to) external onlyOwner {
        require(to != address(0), "owner=0");
        emit OwnerTransferred(owner, to);
        owner = to;
    }

    /// @notice Grant or revoke the right to write one text key. The owner may write every key.
    function setWriter(string calldata key, address account, bool allowed) external onlyOwner {
        writer[key][account] = allowed;
        emit WriterSet(key, account, allowed);
    }

    function setText(bytes32 node, string calldata key, string calldata value) external onlyServed(node) {
        if (msg.sender != owner && !writer[key][msg.sender]) revert NotAuthorized(key, msg.sender);
        _texts[node][key] = value;
        emit TextChanged(node, key, key, value);
    }

    /// @dev Reads for any other node return empty rather than reverting: a resolver that reverts on
    /// an unknown node breaks the Universal Resolver's walk, which expects "no record" as an answer.
    function text(bytes32 node, string calldata key) external view returns (string memory) {
        if (node != servedNode) return "";
        return _texts[node][key];
    }

    function setAddr(bytes32 node, address a) external onlyOwner onlyServed(node) {
        _addrs[node] = a;
        emit AddrChanged(node, a);
    }

    function addr(bytes32 node) external view returns (address) {
        if (node != servedNode) return address(0);
        return _addrs[node];
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == INTERFACE_TEXT || interfaceId == INTERFACE_ADDR
            || interfaceId == INTERFACE_ERC165;
    }
}
