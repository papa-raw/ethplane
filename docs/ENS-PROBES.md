# ENS Probes

PermissionedResolverImpl 0xa9d3814ab151bf6e37a427432795371a8361614e and UserRegistryImpl 0x47b442d0cf617c41cabaff5f02f44dd1e5f72546 expose no initialize function.

VerifiableFactory 0x894bc9cc8ff1ad96b8a288c86a8c71d662c07780 deployProxy with the CLI init calldata reverts and with empty init succeeds and leaves no role holder (hasRoles false, admin slot zero, grantRoles reverts).

on the deployed resolver setText reverts with EACUnauthorizedAccountRoles(resource, 16, caller) and the resource is a function of the text KEY only: same key on ethplane.eth and ethplane-probe.eth gave resource f7b7261c…, a different key gave 270a244c… on both names.

Therefore one shared resolver would let a key holder write that key on every name.

Our answer: EthplaneSubregistry implements IRegistry (getSubregistry, getResolver, getParent, ERC-165 id 0x51f67f40) and is set as ethplane.eth subregistry on ETHRegistry 0x1D78834d97c1D7b1A38c1deDBD1a287cFEd3971e; one EthplaneResolver per node with an immutable servedNode; a fork test resolves probe.ethplane.eth through the Universal Resolver 0xd26f2040d083af1cd2962ba303f4bea0c4faf142 and reads our record.