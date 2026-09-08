/**
 * Poller: Ethplane's events -> SQLite. PRD 3.6 (poller) and 3.14 (events and columns).
 *
 * Rewritten against the real ABI. The first draft switched on event names that do not exist on the
 * contract (LeaseCreated, VerdictCreated, AttributionCreated...); the deployed contract emits the
 * 22 events in abi/Ethplane.json, and every name below is one of them.
 *
 * Nothing here infers: one table row per event, exactly as 3.3.2's "attribution rows for the
 * indexer" says. Reorgs are handled by `removed` on the log, not by rewriting history.
 */
import { createPublicClient, http, decodeEventLog, type Log, type AbiEvent } from 'viem';
import { sepolia } from 'viem/chains';
import fs from 'fs';
import path from 'path';
import { db } from './db';

const abiPath = path.join(__dirname, 'abi', 'Ethplane.json');
export const abi = JSON.parse(fs.readFileSync(abiPath, 'utf-8'));
export const events: AbiEvent[] = abi.filter((x: { type: string }) => x.type === 'event');

const RPC_URL = process.env.SEPOLIA_RPC_URL ?? '';
const ETHPLANE_ADDRESS = (process.env.ETHPLANE_ADDRESS ?? '') as `0x${string}`;
/** Blocks per getLogs call. Sepolia public RPCs answer a 10k range in well under a second (P7). */
const CHUNK = BigInt(process.env.CHUNK ?? 9000);
/** Where to start when the cursor is empty: the deploy block, or a short look-back. */
const START_BLOCK = process.env.START_BLOCK ? BigInt(process.env.START_BLOCK) : null;
const LOOKBACK = BigInt(process.env.LOOKBACK ?? 5000);

export const client = createPublicClient({ chain: sepolia, transport: http(RPC_URL) });

const num = (v: unknown): number => Number(v as bigint | number);
const str = (v: unknown): string => String(v);

function getCursor(): bigint | null {

  const row = db.prepare(`SELECT v FROM cursor WHERE k = 'block'`).get() as { v?: number } | undefined;
  return row?.v ? BigInt(row.v) : null;
}

function setCursor(block: bigint): void {

  db.prepare(`INSERT INTO cursor(k, v) VALUES('block', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v`)
    .run(Number(block));
}

/** One decoded log -> its rows. Returns true when the event produced at least one row. */
export function storeEvent(
  eventName: string,
  args: Record<string, unknown>,
  meta: { block: number; ts: number; tx: string; logIndex: number; removed: boolean }
): boolean {

  const { block, ts, tx, logIndex } = meta;

  if (meta.removed) {
    // A reorged-out log: mark it rather than delete it, so the row's disappearance is visible.
    db.prepare(`UPDATE lease_events SET removed = 1 WHERE tx = ? AND log_index = ?`).run(tx, logIndex);
    return true;
  }

  const leaseEvent = (nodeId: string, lineage: string, seq: number, kind: string) =>
    db.prepare(
      `INSERT INTO lease_events(node_id, lineage, lease_seq, kind, block, ts, tx, log_index) VALUES(?,?,?,?,?,?,?,?)`
    ).run(nodeId, lineage, seq, kind, block, ts, tx, logIndex);

  switch (eventName) {
    case 'NodeDefined':
      db.prepare(
        `INSERT INTO nodes(node_id, criterion_hash, state, opened_block, bounty)
         VALUES(?,?,?,?,'0')
         ON CONFLICT(node_id) DO UPDATE SET criterion_hash = excluded.criterion_hash, state = 'defined'`
      ).run(str(args.nodeId), str(args.criterionHash), 'defined', block);
      return true;

    case 'NodeFunded':
      db.prepare(`UPDATE nodes SET bounty = ?, state = 'funded' WHERE node_id = ?`)
        .run(str(args.bounty), str(args.nodeId));
      return true;

    case 'BaselineRecorded':
      db.prepare(`UPDATE nodes SET state = 'open' WHERE node_id = ?`).run(str(args.nodeId));
      return true;

    case 'NodeClosed':
      db.prepare(`UPDATE nodes SET state = 'closed' WHERE node_id = ?`).run(str(args.nodeId));
      return true;

    case 'LeaseClaimed':
      db.prepare(
        `INSERT INTO leases(node_id, lineage, operator, lease_seq, start, expiry, last_heartbeat, from_hash, active)
         VALUES(?,?,?,?,?,?,?,?,1)
         ON CONFLICT(node_id, lineage, lease_seq) DO UPDATE SET active = 1`
      ).run(str(args.nodeId), str(args.lineage), str(args.operator), num(args.seq), ts, num(args.expiry), ts, str(args.fromHash));
      leaseEvent(str(args.nodeId), str(args.lineage), num(args.seq), 'claimed');
      return true;

    case 'Heartbeat':
      db.prepare(`UPDATE leases SET last_heartbeat = ? WHERE node_id = ? AND lineage = ? AND lease_seq = ?`)
        .run(num(args.at), str(args.nodeId), str(args.lineage), num(args.seq));
      leaseEvent(str(args.nodeId), str(args.lineage), num(args.seq), 'heartbeat');
      return true;

    case 'LeaseForfeited':
      db.prepare(`UPDATE leases SET active = 0 WHERE node_id = ? AND lineage = ? AND lease_seq = ?`)
        .run(str(args.nodeId), str(args.lineage), num(args.seq));
      leaseEvent(str(args.nodeId), str(args.lineage), num(args.seq), num(args.reason) === 1 ? 'expired' : 'missed-heartbeat');
      return true;

    case 'SubmissionMade':
      db.prepare(
        `INSERT OR IGNORE INTO submissions(artifact_hash, node_id, lineage, operator, lease_seq, parents, block, ts, tx)
         VALUES(?,?,?,?,?,?,?,?,?)`
      ).run(
        str(args.artifactHash), str(args.nodeId), str(args.lineage), str(args.operator), num(args.seq),
        JSON.stringify((args.parents as string[]) ?? []), block, ts, tx
      );
      return true;

    case 'MeasurementRecorded':
      // status: 0 NONE, 1 PENDING, 2 FAIL, 3 PASS, 4 REVIEW — PASS is the only one that pays.
      db.prepare(
        `INSERT INTO verdicts(node_id, artifact_hash, lease_seq, passed, metric, metric_hash, spread, block, ts, tx)
         VALUES(?,?,?,?,?,?,?,?,?,?)`
      ).run(
        str(args.nodeId), str(args.artifactHash), num(args.seq), num(args.status) === 3 ? 1 : 0,
        str(args.cycles), str(args.evidenceHash), str(args.proofBytes), block, ts, tx
      );
      return true;

    case 'ReviewConfirmed':
      db.prepare(`UPDATE verdicts SET passed = ? WHERE artifact_hash = ?`)
        .run(args.pass ? 1 : 0, str(args.artifactHash));
      return true;

    case 'HeadAdvanced':
      db.prepare(
        `INSERT INTO heads(node_id, head, block, ts) VALUES(?,?,?,?)
         ON CONFLICT(node_id) DO UPDATE SET head = excluded.head, block = excluded.block, ts = excluded.ts`
      ).run(str(args.nodeId), str(args.artifactHash), block, ts);
      return true;

    case 'Payout':
      db.prepare(
        `INSERT INTO attribution(node_id, operator, kind, weight, artifact_hash, block, ts, tx) VALUES(?,?,?,?,?,?,?,?)`
      ).run(str(args.nodeId), str(args.to), num(args.kind), str(args.amount), str(args.artifactHash), block, ts, tx);
      return true;

    case 'Withdrawn':
      db.prepare(`INSERT INTO releases(to_addr, amount, block, ts, tx) VALUES(?,?,?,?,?)`)
        .run(str(args.to), str(args.amount), block, ts, tx);
      return true;

    case 'LineageRegistered':
      db.prepare(
        `INSERT INTO hosts(host, lineage, last_seen, status) VALUES(?,?,?,'registered')
         ON CONFLICT(host) DO UPDATE SET lineage = excluded.lineage, last_seen = excluded.last_seen`
      ).run(str(args.operator), str(args.lineage), ts);
      return true;

    case 'StrawmapSeeded':
      // The event carries only a count, so the ids come from the contract's own array. This is the
      // one place the indexer reads state rather than a log, and it is why the dashboard can show
      // all 65 nodes before anybody has defined one.
      return false;   // rows are written by seedNodesFromChain(), called by the poller

    // Emitted and intentionally not stored: they change contract configuration, not the work graph.
    case 'LineageProposed':
    case 'VerifierSet':
    case 'ReviewerSet':
    case 'SubregistrySet':
    case 'RelaySet':
    case 'StrawmapSeeded':
    case 'UnusedWithdrawn':
    case 'EIP712DomainChanged':
      return false;

    default:
      console.warn(`indexer: no handler for ${eventName}`);
      return false;
  }
}

export function parseAndStoreEvent(log: Log, ts: number): boolean {
  const decoded = decodeEventLog({ abi, data: log.data, topics: log.topics }) as unknown as {
    eventName: string;
    args: Record<string, unknown>;
  };
  return storeEvent(decoded.eventName, decoded.args ?? {}, {
    block: Number(log.blockNumber ?? 0n),
    ts,
    tx: log.transactionHash ?? '',
    logIndex: log.logIndex ?? 0,
    removed: Boolean(log.removed),
  });
}

/** Read the 65 strawmap ids from the contract and register them as nodes in state `seeded`. */
export async function seedNodesFromChain(): Promise<number> {
  const count = Number(
    await client.readContract({ address: ETHPLANE_ADDRESS, abi, functionName: 'strawmapCount' })
  );
  if (count === 0) return 0;
  const ids = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      client.readContract({ address: ETHPLANE_ADDRESS, abi, functionName: 'strawmapIds', args: [BigInt(i)] })
    )
  );
  const insert = db.prepare(
    `INSERT INTO nodes(node_id, state, bounty) VALUES(?, 'seeded', '0') ON CONFLICT(node_id) DO NOTHING`
  );
  const tx = db.transaction((rows: string[]) => {
    for (const id of rows) insert.run(id);
  });
  tx(ids as string[]);
  return (db.prepare('SELECT COUNT(*) AS n FROM nodes').get() as { n: number }).n;
}

/** One pass. Returns how many rows it wrote, so the caller can report a number rather than a mood. */
export async function runIndexer(): Promise<number> {
  if (!ETHPLANE_ADDRESS) throw new Error('ETHPLANE_ADDRESS not set');
  const latest = await client.getBlockNumber();
  let from = getCursor();
  if (from === null) from = START_BLOCK ?? (latest > LOOKBACK ? latest - LOOKBACK : 0n);
  if (from > latest) return 0;

  let rows = 0;
  let sawSeed = false;
  for (let start = from; start <= latest; start += CHUNK + 1n) {
    const end = start + CHUNK > latest ? latest : start + CHUNK;
    const logs = await client.getLogs({ address: ETHPLANE_ADDRESS, events, fromBlock: start, toBlock: end });
    for (const log of logs) {
      // blockTimestamp rides on the log itself (P7), so no second call per row.
      const ts = Number((log as unknown as { blockTimestamp?: string }).blockTimestamp ?? 0) || Math.floor(Date.now() / 1000);
      if (parseAndStoreEvent(log, ts)) rows++;
      if (isStrawmapSeeded(log)) sawSeed = true;
    }
    setCursor(end);
  }
  if (sawSeed) rows += await seedNodesFromChain();
  return rows;
}

function isStrawmapSeeded(log: Log): boolean {
  try {
    const d = decodeEventLog({ abi, data: log.data, topics: log.topics }) as unknown as { eventName: string };
    return d.eventName === 'StrawmapSeeded';
  } catch {
    return false;
  }
}
