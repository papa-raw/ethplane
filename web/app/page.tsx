import { NodeMap } from '@/components/dashboard/NodeMap';
import { Strawmap } from '@/components/dashboard/Strawmap';
import { strawmapNodes } from '@/lib/strawmap';

export default function Home() {
  const nodes = strawmapNodes();
  return (
    <main className="mx-auto max-w-[1400px] px-6 py-10 space-y-10">
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
        <p className="text-muted-foreground max-w-3xl">
          The Ethereum roadmap as a work plane. In principle anybody can contribute to any node: you
          start a session on one, work from the current head, and submit. A verified improvement pays
          from the node&apos;s escrow, and the record of who built on whose work is on chain.
        </p>
      </header>

      <Strawmap nodes={nodes} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          The same 65 nodes, as a list
        </h2>
        <NodeMap />
      </section>
    </main>
  );
}
