/**
 * What is on Sepolia, typed once and read by the architecture page and the docs page.
 *
 * Every value here was decoded from a log or read from `docs/DEPLOYMENTS.md`, which itself records
 * a chain read on 2026-09-09. Nothing in this file is illustrative: if a number changes on chain,
 * it is wrong here until it is edited, so it carries the date it was read.
 */
export const READ_ON = '2026-09-09';
export const EXPLORER = 'https://sepolia.etherscan.io';

export const CONTRACTS = [
  { name: 'Ethplane', what: 'worknodes, sessions, submissions, measurements, escrow, attribution', address: '0xB9569968fB40569E326f44f266F2720D72aA8091' },
  { name: 'PlaneToken (PLANE)', what: 'test ERC-20, whole supply to the treasury', address: '0x814817A2e7332749990500c324cb6B0c77deBFC1' },
  { name: 'EthplaneSubregistry', what: 'our ENSv2 registry under ethplane.eth', address: '0x58CB4caaDb0ebEdf7E1c96CeA6578Afb2f99d05b' },
  { name: 'Resolver, cl-pq-leanxmss-attestations', what: 'one resolver per worknode, immutable servedNode', address: '0xA11a923dA99Bb3aaE3643758DA8D408173199Bec' },
  { name: 'Resolver, dl-leanvm', what: 'one resolver per worknode, immutable servedNode', address: '0xaFE89fc8d99950B7F4c61BAE2602A80BC31De872' },
  { name: 'Resolver, operator and guest names', what: 'lineage, operator and guest identities', address: '0x47572265f1795F26A3e657DA154577904aAA57Ed' },
  { name: 'Verifier', what: 'records measurements, writes head and status', address: '0x0A6Ad2a627F8736E0f34849a0B5B80a109F81759' },
  { name: 'Maintainer', what: 'registrant and reviewer', address: '0x3D70eA482c25e203bb650a86d6FDbe291E59b6b8' },
] as const;

export const WORKNODES = [
  {
    name: 'cl-pq-leanxmss-attestations',
    ens: 'cl-pq-leanxmss-attestations.ethplane.eth',
    id: '0x8e67c816b1f39fa072094b67f4f74937bd1920a7a9d79e4b98e785ae9aa29d58',
    escrow: '10,000 PLANE',
    editable: 'crates/rec_aggregation/guests/',
    baseline: '1,542,812 cycles, 1,433,000 µs proving, 302,592 B proof',
    /** BaselineRecorded at block 11662947: cycles, provingMicros, proofBytes, verifyMicros, spreadBps. */
    recorded: { cycles: 1542812, proving: 1433000, proof: 302592, verify: 30100, spreadBps: 190 },
  },
  {
    name: 'dl-leanvm',
    ens: 'dl-leanvm.ethplane.eth',
    id: '0x662b44f5cf418a3e3d4126a187d0154034afbdc8d2536b9076c68f2a4440c37e',
    escrow: '10,000 PLANE',
    editable: 'crates/rec_aggregation/guests/, crates/lean_compiler/',
    baseline: '1,542,812 cycles, 7,158,000 µs proving, 302,182 B proof',
    /** BaselineRecorded at block 11668042. */
    recorded: { cycles: 1542812, proving: 7158000, proof: 302182, verify: 554333, spreadBps: 2367 },
  },
] as const;

/** The seven MeasurementRecorded events, decoded from the logs. All seven carry accepted=false. */
export const VERDICTS = [
  { block: 11667718, node: 1, cycles: 0, proof: 0, note: 'rejected before anything was measured', tx: '0x849b6baf6ec7eff608a2a808c9c18dfee38e2fe536b3546ef1bc2e5a555e5793' },
  { block: 11667719, node: 1, cycles: 0, proof: 0, note: 'rejected before anything was measured', tx: '0x9419005534e34ebd5a3c97c414826a8117b8ad944530ab5e2b1c5f28509ea8b0' },
  { block: 11668015, node: 1, cycles: 1542812, proof: 302182, note: 'the baseline exactly, unchanged', tx: '0x08fc8db192a2cf6f3c7d54987aefe6a790dd5907ce19f03cf39bb98324001597' },
  { block: 11668029, node: 1, cycles: 1542812, proof: 302182, note: 'the baseline exactly, unchanged', tx: '0xeaf2f490bd2bee064cba126ea9c23745382d98c4bec900f37e7f1f4de849f1e4' },
  { block: 11668581, node: 2, cycles: 1541462, proof: 302489, note: '1,350 cycles below, proof 307 B over the bound', tx: '0x46a9e0997e587aaf45a6a28723ac4f744aadde88fda2c0bca03103e9f6fd48e4' },
  { block: 11668587, node: 2, cycles: 1541462, proof: 302489, note: '1,350 cycles below, proof 307 B over the bound', tx: '0x55a14b41ade7e786d6cca0a27bc93f81004c5b393b5d390ab32249be92b05b26' },
  { block: 11668625, node: 2, cycles: 1541462, proof: 302489, note: '1,350 cycles below, proof 307 B over the bound', tx: '0x905609d17f2b4b6df1a4b8aece722f5351d65311f83d37692912c30a0d94548a' },
] as const;

export const PRIVY = {
  policy: 'c8io5x5g08igo85ljedozu2k',
  wallet: 'eezbtlnxyfgntb2hvz1cfaqh',
  rules: [
    'approve PLANE, and only to the Ethplane contract',
    'fundNode, capped at 100,000 PLANE per call',
    'defineNode, only where the split gives the verifier at least 10%',
  ],
  refusedAt: '2026-09-09 14:52:33 UTC',
  refusal: 'RPC request denied due to policy violation',
} as const;

export const SPLIT = [
  { pct: '68%', who: 'the lineage that submitted it' },
  { pct: '15%', who: 'the parent it built on' },
  { pct: '10%', who: 'the verifier' },
  { pct: '5%', who: 'held for compute' },
  { pct: '2%', who: 'whoever registered the worknode' },
] as const;

export const UNIVERSAL_RESOLVER = '0xd26f2040d083af1cd2962ba303f4bea0c4faf142';
export const ETH_REGISTRY = '0x1D78834d97c1D7b1A38c1deDBD1a287cFEd3971e';
export const REPO = 'https://github.com/papa-raw/ethplane';

export const REFERENCE_COMMIT = 'a210ef1b';

/** The recorded baseline for a worknode id, or null when the id is not one of the two open ones. */
export function baselineFor(nodeId: string) {
  const w = WORKNODES.find((n) => n.id.toLowerCase() === nodeId.toLowerCase());
  return w ? { ...w.recorded, editable: w.editable, name: w.name } : null;
}

/** The proving bound the spread implies: provingMicros * (1 + spreadBps/10000), rounded down. */
export function provingBound(b: { proving: number; spreadBps: number }): number {
  return Math.floor(b.proving * (1 + b.spreadBps / 10000));
}
