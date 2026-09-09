'use client';
import Link from 'next/link';
import { useMemo } from 'react';
import { usePolling } from '@/lib/usePolling';
import { NodeRow, STATE_STYLE, STATE_INK, stateOf, apiState } from '@/lib/api';
import { Panel } from './Panel';

/**
 * The same nodes as a list, grouped the way the strawmap groups them: layer, then track. The map
 * above owns the only legend on the page (BRIEF §2, one page one legend), so this view names each
 * node's state on its own row instead of repeating the key.
 */
export function NodeMap() {
  const poll = usePolling<NodeRow[]>('/api/nodes');
  return (
    <Panel poll={poll} empty="No worknodes have been indexed. The indexer writes all 65 when it sees StrawmapSeeded.">
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

  return (
    <div className="space-y-10">
      {[...byLayer.entries()].map(([layer, tracks]) => (
        <section key={layer} className="space-y-4">
          <h3
            className="uppercase"
            style={{
              fontSize: 'var(--ep-size-label)', fontWeight: 700,
              letterSpacing: '0.08em', color: 'var(--ep-on-surface)',
            }}
          >
            {layer}
          </h3>
          {[...tracks.entries()].map(([track, rows]) => (
            <div key={track} className="grid gap-x-8 md:grid-cols-[140px_1fr]">
              <div
                className="pt-[9px]"
                style={{ fontSize: 'var(--ep-size-label)', color: 'var(--ep-secondary)' }}
              >
                {track}
              </div>
              <ul className="m-0 list-none border-t p-0" style={{ borderColor: 'var(--ep-border)' }}>
                {rows.map((n) => {
                  const derived = stateOf(n);
                  const label = STATE_STYLE[derived]?.label ?? derived;
                  return (
                    <li key={n.node_id} className="border-b" style={{ borderColor: 'var(--ep-border)' }}>
                      <Link
                        href={`/node/${n.node_id}`}
                        data-testid="map-node"
                        className="flex items-baseline gap-4 py-2 hover:underline"
                        style={{ fontSize: 'var(--ep-size-sm)', color: 'var(--ep-on-surface)' }}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {n.label ?? n.node_id.slice(0, 10)}
                        </span>
                        <span
                          className="w-[48px] shrink-0 text-right uppercase"
                          style={{ fontSize: 'var(--ep-size-label)', letterSpacing: '0.08em', color: 'var(--ep-secondary)' }}
                        >
                          {n.tag && n.tag !== 'none' ? n.tag : ''}
                        </span>
                        <span
                          className="w-[96px] shrink-0 text-right"
                          style={{ fontSize: 'var(--ep-size-label)', color: 'var(--ep-secondary)' }}
                        >
                          {n.fork ?? '—'}
                        </span>
                        <span
                          className="w-[84px] shrink-0 text-right"
                          style={{
                            fontSize: 'var(--ep-size-label)', fontWeight: apiState(n) === 'open' ? 700 : 500,
                            color: apiState(n) === 'open' ? 'var(--ep-primary)' : (STATE_INK[derived] ?? 'var(--ep-secondary)'),
                          }}
                        >
                          {label}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
