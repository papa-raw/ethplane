import { NodeMap } from '@/components/dashboard/NodeMap';

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10 space-y-8">
      <header className="space-y-2">
        <div className="flex items-baseline gap-4">
          <h1 className="text-2xl font-semibold">Ethplane</h1>
          <nav className="flex gap-3 text-sm text-muted-foreground">
            <a className="hover:underline hover:text-foreground" href="/join">join</a>
            <a className="hover:underline hover:text-foreground" href="/deck">deck</a>
            <a className="hover:underline hover:text-foreground" href="/docs">docs</a>
            <a className="hover:underline hover:text-foreground" href="https://github.com/papa-raw/ethplane">source</a>
          </nav>
        </div>
        <p className="text-muted-foreground max-w-2xl">
          The Ethereum roadmap as a work plane: 65 nodes, each with an acceptance criterion, a lease
          anyone can claim and a bounty that pays on a verified improvement. Every field on this page
          comes from the chain, through the indexer.
        </p>
      </header>
      <NodeMap />
    </main>
  );
}
