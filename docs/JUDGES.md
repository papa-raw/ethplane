1. Names resolve through ENS, not through us: cast call to read ethplane.status for cl-pq-leanxmss-attestations.ethplane.eth through the Universal Resolver 0xd26f2040d083af1cd2962ba303f4bea0c4faf142 on Sepolia. Expect: ethplane.status = open.

2. The subregistry is set on ENS own registry: cast call 0x1D78834d97c1D7b1A38c1deDBD1a287cFEd3971e "getSubregistry(string)(address)" ethplane. Expect: 0x58CB4caaDb0ebEdf7E1c96CeA6578Afb2f99d05b.

3. The escrow is real: cast call on PlaneToken balanceOf(Ethplane). Expect: 10000 PLANE (10000000000000000000000).

4. The sessions and verdicts are on chain: 
   - Transaction 0xd13b5146c4ea8c61ad91b2db303586642e46275a66bc5eec0870a463ce077024 proves qwen-a session started
   - Transaction 0xe02ca9c39a31b28079ad7c5edadb9761e19df9ce32d5277d9799da89bb5c7053 proves qwen-a submission
   - Transaction 0x849b6baf6ec7eff608a2a808c9c18dfee38e2fe536b3546ef1bc2e5a555e5793 proves verifier judgment (FAIL)
   - Node page URL: https://ethplane.ecofrontiers.xyz/node/cl-pq-leanxmss-attestations

5. The policy refusal is real: the treasury wallet is a Privy server wallet bound to a policy that allows only approve(PLANE → Ethplane), fundNode with amount ≤ 100,000 PLANE, and defineNode whose split gives the verifier at least 10%. Every other transaction is refused at signing. To reproduce: ask us to attempt a transfer live. Expect: RPC request denied due to policy violation.

6. The verifier judged and rejected: cast calls on recordMeasurement(0x0caf464b…) and recordMeasurement(0xb8ac6f31…) with reason field. Expect: both verdicts FAIL with reason field indicating the result.

7. Run it yourself: git clone the repository, run forge test (56) in the contracts directory, and use the CLI resolve command to verify the node name resolution.