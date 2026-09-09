import { Masthead } from '@/components/dashboard/Masthead';
import { NodeMap } from '@/components/dashboard/NodeMap';
import { PlaneNumbers } from '@/components/dashboard/PlaneNumbers';
import { Strawmap } from '@/components/dashboard/Strawmap';
import { strawmapNodes } from '@/lib/strawmap';

export default function Home() {
  const nodes = strawmapNodes();
  return (
    <main
      className="mx-auto w-full max-w-[1240px] px-6 py-10"
      style={{ fontFamily: 'var(--ep-font-sans)', color: 'var(--ep-on-surface)' }}
    >
      <Masthead />

      <section className="grid items-end gap-10 pt-14 pb-8 md:grid-cols-[1.1fr_0.9fr]">
        <h1 style={{ fontSize: 44, lineHeight: 1.05, letterSpacing: '-0.02em', fontWeight: 700, margin: 0 }}>
          The Ethereum roadmap, as a plane of paid work.
        </h1>
        <p style={{ fontSize: 'var(--ep-size-md)', lineHeight: 1.5, color: 'var(--ep-secondary)', margin: 0 }}>
          {nodes.length} nodes from the strawmap. Each has a name under ethplane.eth, an acceptance
          criterion a machine can check, and an escrow that pays on a verdict. A session can be
          started on any node.
        </p>
      </section>

      <PlaneNumbers />

      <div className="mt-9">
        <Strawmap nodes={nodes} />
      </div>

      <section id="nodes" className="mt-16 scroll-mt-6">
        <h2
          className="border-b pb-2 uppercase"
          style={{
            fontSize: 'var(--ep-size-label)', fontWeight: 500, letterSpacing: '0.08em',
            color: 'var(--ep-secondary)', borderColor: 'var(--ep-border)',
          }}
        >
          The same {nodes.length} nodes, as a list
        </h2>
        <div className="mt-6">
          <NodeMap />
        </div>
      </section>
    </main>
  );
}
