/**
 * Prints the calls that register the guest names waiting in pending_names. It signs nothing and
 * holds no key: the maintainer pastes these, or pipes them to a shell that has the key. Keeping the
 * signing out of the API is the point — a web request must never be one bug away from a key.
 *
 *   DB_PATH=/opt/ethplane-private/ethplane.db SUBREGISTRY=0x… npx ts-node scripts/register-pending.ts
 */
import Database from 'better-sqlite3';

const DB_PATH = process.env.DB_PATH ?? './data/ethplane.db';
const SUBREGISTRY = process.env.SUBREGISTRY ?? '<EthplaneSubregistry address>';

const db = new Database(DB_PATH, { readonly: true });
const rows = db
  .prepare(`SELECT label, owner, resolver, expiry FROM pending_names WHERE registered = 0 ORDER BY created_at`)
  .all() as Array<{ label: string; owner: string; resolver: string; expiry: number }>;

if (rows.length === 0) {
  console.log('# nothing pending');
  process.exit(0);
}

console.log(`# ${rows.length} name(s) to register on ${SUBREGISTRY}`);
console.log('# each is one call; re-running after a success is harmless (register reverts AlreadyRegistered)');
for (const r of rows) {
  console.log(
    `cast send ${SUBREGISTRY} "register(string,address,address,address,uint64)" ` +
      `"${r.label}" ${r.owner} ${r.resolver} 0x0000000000000000000000000000000000000000 ${r.expiry} ` +
      `--rpc-url "$SEPOLIA_RPC_URL" --private-key "$MAINTAINER_KEY"`
  );
}
console.log('\n# then mark them registered:');
console.log(
  `sqlite3 ${DB_PATH} "UPDATE pending_names SET registered = 1 WHERE label IN (${rows
    .map((r) => `'${r.label}'`)
    .join(', ')});"`
);
