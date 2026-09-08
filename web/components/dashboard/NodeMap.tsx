'use client';
import Link from 'next/link';
import { useMemo } from 'react';
import { usePolling } from '@/lib/usePolling';
import { NodeRow, STATE_STYLE, stateOf } from '@/lib/api';
import { Panel } from './Panel';
import { Badge } from '@/components/ui/badge';

/** The map is the strawmap's own grouping — layer, then track — not a layout of our invention. */
export function NodeMap() {
  const poll = usePolling<NodeRow[]>('/api/nodes');
  return (
    <Panel poll={poll} empty="No nodes yet. The indexer writes all 65 the moment it sees StrawmapSeeded.">
      {(nodes) => <MapBody nodes={nodes} />}
    </Panel>
  );
}

export function MapBody({ nodes }: { nodes: NodeRow[] }) {
  const byLayer = useMemo(() => {
    const groups = new Map<string, Map<string, NodeRow[]>>();
    for (const n of nodes) {
      const layer = n.layer || 'unclassified';
      const track = n.track || 'other';
      if (!groups.has(layer)) groups.set(layer, new Map());
      const tracks = groups.get(layer)!;
      if (!tracks.has(track)) tracks.set(track, []);
      tracks.get(track)!.push(n);
    }
    return groups;
  }, [nodes]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const n of nodes) c[stateOf(n)] = (c[stateOf(n)] ?? 0) + 1;
    return c;
  }, [nodes]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3" data-testid="map-legend">
        <span className="text-sm text-muted-foreground">{nodes.length} nodes</span>
        {Object.entries(STATE_STYLE).map(([key, s]) =>
          counts[key] ? (
            <span key={key} className="flex items-center gap-1.5 text-sm">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${s.dot}`} />
              {s.label} <span className="text-muted-foreground">{counts[key]}</span>
            </span>
          ) : null
        )}
      </div>

      {[...byLayer.entries()].map(([layer, tracks]) => (
        <section key={layer} className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{layer}</h2>
          {[...tracks.entries()].map(([track, rows]) => (
            <div key={track} className="space-y-1.5">
              <div className="text-xs text-muted-foreground">{track}</div>
              <div className="flex flex-wrap gap-2">
                {rows.map((n) => {
                  const s = STATE_STYLE[stateOf(n)] ?? STATE_STYLE.seeded;
                  return (
                    <Link
                      key={n.node_id}
                      href={`/node/${n.node_id}`}
                      data-testid="map-node"
                      className={`group flex items-center gap-2 rounded-md border px-3 py-2 text-sm ring-1 ring-inset transition hover:shadow-sm ${s.ring}`}
                    >
                      <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${s.dot}`} />
                      <span className="truncate max-w-[16rem]">{n.label ?? n.node_id.slice(0, 10)}</span>
                      {n.tag && n.tag !== 'none' ? (
                        <Badge variant="secondary" className="ml-1 text-[10px] uppercase">{n.tag}</Badge>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
