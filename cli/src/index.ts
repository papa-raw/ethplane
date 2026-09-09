#!/usr/bin/env node
import { Command } from 'commander';
import path from 'path';
import { makeClient, readNode, NODE_KEYS, DEFAULT_RPC } from './ens';
import { fetchArtifact, unpack, DEFAULT_API } from './artifacts';

const program = new Command();
program
  .name('ethplane')
  .description('Read Ethplane nodes from ENS, and pick up the work on one')
  .version('0.1.0');

function table(rows: Array<[string, string]>): string {
  const width = Math.max(...rows.map(([k]) => k.length));
  return rows.map(([k, v]) => `  ${k.padEnd(width)}  ${v || '—'}`).join('\n');
}

program
  .command('resolve')
  .argument('<name>', 'ENS name, e.g. cl-pq-leanxmss-attestations.ethplane.eth')
  .option('--rpc <url>', 'Sepolia RPC', process.env.SEPOLIA_RPC_URL || DEFAULT_RPC)
  .description("read a node's records through the Universal Resolver")
  .action(async (name: string, opts: { rpc: string }) => {
    const records = await readNode(makeClient(opts.rpc), name);
    console.log(`\n${name}\n`);
    console.log(table(NODE_KEYS.map((k) => [k, records[k]])));
    console.log();
    if (!Object.values(records).some(Boolean)) {
      console.log('  (no records: the name may not be registered, or its resolver is not set)\n');
    }
  });

program
  .command('join')
  .argument('<name>', 'ENS name of the node to work on')
  .option('--rpc <url>', 'Sepolia RPC', process.env.SEPOLIA_RPC_URL || DEFAULT_RPC)
  .option('--api <url>', 'API base', DEFAULT_API)
  .option('--dir <path>', 'where to unpack', '')
  .description('fetch the current head artifact for a node and unpack it')
  .action(async (name: string, opts: { rpc: string; api: string; dir: string }) => {
    const records = await readNode(makeClient(opts.rpc), name);
    const label = name.split('.')[0];
    const head = records['ethplane.head'];

    // A name with no ethplane.status record is not a worknode. readText turns every resolver error
    // into an empty string, so without this check a typo and a guest name printed the same "you
    // would be first" brief as a real open worknode, and a guest could not tell them apart.
    if (!records['ethplane.status']) {
      console.error(`not an ethplane node: ${name}`);
      console.error('  join takes a worknode name, for example cl-pq-leanxmss-attestations.ethplane.eth');
      process.exitCode = 1;
      return;
    }

    // No head is not a failure: it is an open worknode with nothing built on it yet, and the useful
    // answer is the brief and where to read more, not an error code.
    if (!head) {
      console.log(`\n${name} has no verified submission yet — you would be first.\n`);
      console.log(table([
        ['status', records['ethplane.status']],
        ['criterion', records['ethplane.criterion']],
        ['lease', records['ethplane.lease']],
      ]));
      console.log(`\n  node page  ${opts.api}/node/${label}\n`);
      return;
    }

    const dir = opts.dir || path.resolve(process.cwd(), label);
    console.log(`\nhead ${head}`);
    const buf = await fetchArtifact(head, opts.api);
    console.log(`  ${buf.length} bytes, hash verified`);
    const manifest = unpack(buf, dir);
    console.log(`  unpacked into ${dir}`);
    const contributors = (manifest?.contributors as string[] | undefined) ?? [];
    if (contributors.length) {
      console.log('\n  built on work by:');
      for (const c of contributors) console.log(`    ${c}`);
    } else {
      console.log('\n  (no manifest.json contributors in this artifact)');
    }
    console.log();
  });

// Errors are a message and an exit code, never a stack trace: this is a tool, not a service.
program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(`ethplane: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
