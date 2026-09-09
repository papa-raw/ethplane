import { strawmapIds } from '@/lib/strawmap';
import { NodePage } from '@/components/dashboard/NodePage';

/**
 * Static export needs every id up front, or a judge's deep link 404s (the export had 0 node pages
 * before this). The ids are the 65 strawmap slugs hashed the same way the contract hashes them.
 */
export function generateStaticParams() {
  const ids = strawmapIds();
  return ids.map((n) => ({ id: n.hash }));
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Every id written by the export is the lower-case keccak hash, so this is an exact match.
  const known = strawmapIds().find((n) => n.hash === id);
  return (
    <NodePage
      nodeId={id}
      slug={known?.id ?? null}
      label={known?.label ?? null}
      summary={known?.summary ?? null}
    />
  );
}
