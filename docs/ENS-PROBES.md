# ENS Probes

## Why our own subregistry and resolvers (the probes that decided it)

PermissionedResolverImpl 0xa9d3814ab151bf6e37a427432795371a8361614e and UserRegistryImpl 0x47b442d0cf617c41cabaff5f02f44dd1e5f72546 expose no initialize function.

VerifiableFactory 0x894bc9cc8ff1ad96b8a288c86a8c71d662c07780 deployProxy with the CLI init calldata reverts and with empty init succeeds and leaves no role holder (hasRoles false, admin slot zero, grantRoles reverts).

on the deployed resolver setText reverts with EACUnauthorizedAccountRoles(resource, 16, caller) and the resource is a function of the text KEY only: same key on ethplane.eth and ethplane-probe.eth gave resource f7b7261c…, a different key gave 270a244c… on both names.

Therefore one shared resolver would let a key holder write that key on every name.

Our answer: EthplaneSubregistry implements IRegistry (getSubregistry, getResolver, getParent, ERC-165 id 0x51f67f40) and is set as ethplane.eth subregistry on ETHRegistry 0x1D78834d97c1D7b1A38c1deDBD1a287cFEd3971e; one EthplaneResolver per node with an immutable servedNode; a fork test resolves probe.ethplane.eth through the Universal Resolver 0xd26f2040d083af1cd2962ba303f4bea0c4faf142 and reads our record.

## End to end, 2026-09-09 14:25 UTC

Every line below is a command and what it returned, against Sepolia through the hackathon Universal
Resolver `0xd26f2040d083af1cd2962ba303f4bea0c4faf142`. RPC: `https://ethereum-sepolia-rpc.publicnode.com`.
The resolution path is root → `.eth` → `ethplane` → our subregistry → the node's own resolver; the
address in the second return value is the resolver the Universal Resolver picked, which is the part
worth reading.

```
$ cast namehash cl-pq-leanxmss-attestations.ethplane.eth
0xc17c010aa3d31fe32aa48f7afe431ee48dcae4f77740697bf87b66b928743041
$ cast call $UR 'resolve(bytes,bytes)(bytes,address)' $DNS $(cast calldata 'addr(bytes32)' $NAMEHASH)
0x0000…0000  0xA11a923dA99Bb3aaE3643758DA8D408173199Bec
$ cast call $UR 'resolve(bytes,bytes)(bytes,address)' $DNS $(cast calldata 'text(bytes32,string)' $NAMEHASH ethplane.status)
"open"
   ethplane.criterion  "cycles < 1,542,812 @ leanVM a210ef1b; proving, size, verify not worse; docs/CRITERION-pq-leanxmss.md 0xa2e71ccb"
   ethplane.head       ""     (no verified submission yet)
   ethplane.node       "0x8e67c816b1f39fa072094b67f4f74937bd1920a7a9d79e4b98e785ae9aa29d58"
   ethplane.verdict    ""     (written by the verifier when it records one)

$ cast namehash dl-leanvm.ethplane.eth
0xdfe03fabad128b17be645ee8b1e7e931aa971fa58c634e32eb033065bc107bd4
   addr                0x0000…0000  resolver 0xaFE89fc8d99950B7F4c61BAE2602A80BC31De872
   ethplane.status     "open"
   ethplane.criterion  "cycles < baseline measured by the verifier itself with run.py --baseline at leanVM a210ef1b; docs/CRITERION-pq-leanxmss.md"
   ethplane.head       ""     (three submissions judged, all FAIL: see docs/JUDGES.md)
   ethplane.node       "0x662b44f5cf418a3e3d4126a187d0154034afbdc8d2536b9076c68f2a4440c37e"
   ethplane.verdict    ""

$ cast namehash ecofrontiers.ethplane.eth
0x9d10adc74860c69f31702bcb678ca8086a962312eff1d52bfe2d7a0f4cfb626f
   addr                0x3D70eA482c25e203bb650a86d6FDbe291E59b6b8  resolver 0x47572265f1795F26A3e657DA154577904aAA57Ed
   every ethplane.* text  ""
```

Registry wiring, read the same way:

```
ETHRegistry.getSubregistry("ethplane")                         0x58CB4caaDb0ebEdf7E1c96CeA6578Afb2f99d05b
EthplaneSubregistry.getResolver("cl-pq-leanxmss-attestations") 0xA11a923dA99Bb3aaE3643758DA8D408173199Bec
EthplaneSubregistry.getResolver("dl-leanvm")                   0xaFE89fc8d99950B7F4c61BAE2602A80BC31De872
EthplaneSubregistry.getResolver("ecofrontiers")                0x47572265f1795F26A3e657DA154577904aAA57Ed
EthplaneSubregistry.getSubregistry(each of the three)          0x0000…0000   (leaf names: no child registry)
```

Writer roles, on both node resolvers, for the verifier `0x0A6Ad2a627F8736E0f34849a0B5B80a109F81759`:

```
resolver 0xA11a923d… owner 0x3D70eA48…   writer(ethplane.head)=true  writer(ethplane.status)=true  writer(ethplane.verdict)=false
resolver 0xaFE89fc8… owner 0x3D70eA48…   writer(ethplane.head)=true  writer(ethplane.status)=true  writer(ethplane.verdict)=false
```

And the fork test on that same path, which needs the RPC in the environment or it skips rather than
runs — a skipped test is not a passing one:

```
$ SEPOLIA_RPC_URL=… forge test --match-path test/EnsFork.t.sol -vv
[PASS] test_forkResolvesTextThroughUniversalResolver() (gas: 1648239)
  universal resolver picked: 0x2e234DAe75C793f67A35089C9d99245E1C58470b
  text(probe.ethplane.eth, ethplane.verdict): pass:1542812
1 passed; 0 failed; 0 skipped
```

## Records written

All three were sent after the first pass of this document and re-resolved through the Universal
Resolver on 2026-09-09; the values below are what came back, not what was sent.

| name | record | value | transaction |
|---|---|---|---|
| `cl-pq-leanxmss-attestations.ethplane.eth` | `ethplane.node` | `0x8e67c816b1f39fa072094b67f4f74937bd1920a7a9d79e4b98e785ae9aa29d58` | `0xbeb49886…` |
| `dl-leanvm.ethplane.eth` | `ethplane.node` | `0x662b44f5cf418a3e3d4126a187d0154034afbdc8d2536b9076c68f2a4440c37e` | `0xdc90385d…` |
| `ecofrontiers.ethplane.eth` | `addr` | `0x3D70eA482c25e203bb650a86d6FDbe291E59b6b8` | `0x5b28b76e…` |

So a judge who resolves either node name now gets the on-chain node id from ENS and can read the
contract's own record for it. `addr` on the two node names stays zero: a node is not an account, and
the resolver answers the question that has an answer.

`ethplane.verdict` stays unwritable by the verifier by design: it holds head and status, and a verdict
line is the contract's own record. Granting it would be `setWriter("ethplane.verdict", verifier, true)`
on each resolver, and is deliberately not done.
