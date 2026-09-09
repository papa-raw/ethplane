'use client';
import { useMemo } from 'react';
import { usePolling } from '@/lib/usePolling';
import { NodeRow, apiState, STATE_INK } from '@/lib/api';
import { layout, type StrawNode } from '@/lib/layout';

/**
 * The roadmap as a picture, in the strawmap's own structure: fork targets left to right, layers as
 * bands, tracks as sub-bands, throughlines drawn between nodes.
 *
 * Direction A, Blueprint: the grid is the graphic. The fork columns and the layer/track bands are
 * hairline rules carried the full width and height of the drawing, the cells they make are the
 * map's own cells, and a cell with no node in it stays empty. Ink on white, one blue, and the blue
 * is spent only on the nodes the API returns as open.
 *
 * The geometry is not this file's business: web/lib/layout.ts computes every column, band and chip
 * position from research/strawmap-nodes.json. What is decided here is fill, stroke, type and how a
 * label sets inside the cell it was given.
 */

/** Width of the left strip that carries the layer name, so track names never sit on top of it. */
const LAYER_STRIP = 22;
const LABEL_SIZE = 11;

/**
 * Geist metrics are not available at build time, so a label's width is estimated per character.
 * The estimate only decides where a line breaks. A conservative estimate costs an extra break and
 * never cuts a word, which is the behaviour this replaces.
 */
const NARROW = new Set(" iljtfrI.,;:!|()[]'`-".split(''));
const WIDE = new Set('mwMW@'.split(''));
function textWidth(s: string, size = LABEL_SIZE): number {
  let u = 0;
  for (const ch of s) {
    u += NARROW.has(ch) ? 0.3 : WIDE.has(ch) ? 0.85 : /[A-Z0-9]/.test(ch) ? 0.62 : 0.55;
  }
  return u * size;
}

/**
 * Set a node's name on at most two lines inside its own cell. Every word is kept: if a name does
 * not fit on two lines the remainder is carried onto the second line rather than dropped, and only
 * then is it shortened. All 65 names in research/strawmap-nodes.json fit on two lines at this
 * width, so the shortening branch is a guard and not the normal path.
 */
export function wrapLabel(label: string, maxWidth: number, maxLines = 2): string[] {
  const words = label.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [label];
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (textWidth(next) <= maxWidth || !line) { line = next; continue; }
    lines.push(line);
    line = word;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines - 1);
    kept.push(lines.slice(maxLines - 1).join(' '));
    lines.length = 0;
    lines.push(...kept);
  }
  const last = lines[lines.length - 1];
  if (textWidth(last) > maxWidth) {
    let cut = last;
    while (cut.length > 1 && textWidth(`${cut}…`) > maxWidth) cut = cut.slice(0, -1);
    lines[lines.length - 1] = `${cut}…`;
  }
  return lines;
}

export function Strawmap({ nodes, chrome = true }: { nodes: StrawNode[]; chrome?: boolean }) {
  const poll = usePolling<NodeRow[]>('/api/nodes');
  const rows = poll.data;

  /** node_id -> the state column, exactly as the API returned it. Never a name match. */
  const live = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows ?? []) m.set(r.node_id.toLowerCase(), apiState(r));
    return m;
  }, [rows]);

  const l = useMemo(() => layout(nodes), [nodes]);

  /**
   * Counts are measured or they are absent (BRIEF §2 refusal 7). With no response there is no
   * fallback state to count, so the legend prints no number at all and the caption says why.
   */
  const counts = useMemo(() => {
    if (!rows) return null;
    const c: Record<string, number> = {};
    for (const n of nodes) {
      const s = live.get(n.hash.toLowerCase());
      if (!s) continue;
      c[s] = (c[s] ?? 0) + 1;
    }
    return c;
  }, [nodes, live, rows]);

  const measured = counts !== null;
  const known = measured ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;

  return (
    <figure className="ep-map m-0" data-testid="strawmap">
      <style>{`
        .ep-map .chip rect { transition: none; }
        .ep-map .chip:hover rect { stroke: var(--ep-primary); stroke-width: 1.5px; }
        .ep-map .chip:focus-visible rect { stroke: var(--ep-primary); stroke-width: 2px; }
      `}</style>

      <div
        className="overflow-x-auto border px-2 py-4"
        style={{ borderColor: 'var(--ep-border)' }}
      >
        <svg
          viewBox={`0 0 ${l.width} ${l.height}`}
          role="img"
          aria-label="The Ethereum roadmap: nodes by fork target, layer and track"
          preserveAspectRatio="xMinYMin meet"
          className="h-auto w-full"
          style={{ minWidth: `${l.width}px`, fontFamily: 'var(--ep-font-sans)' }}
        >
          {/* the grid: fork columns full height, then track rules, then layer rules on top */}
          {l.columns.map((c) => (
            <line
              key={`col-${c.fork}`}
              x1={c.x} y1={18} x2={c.x} y2={l.height}
              style={{ stroke: 'var(--ep-border)' }} strokeWidth={1}
            />
          ))}
          <line
            x1={LAYER_STRIP} y1={34} x2={LAYER_STRIP} y2={l.height}
            style={{ stroke: 'var(--ep-border)' }} strokeWidth={1}
          />
          <line
            x1={l.width - 16} y1={18} x2={l.width - 16} y2={l.height}
            style={{ stroke: 'var(--ep-border)' }} strokeWidth={1}
          />

          {l.bands.map((b) => (
            <line
              key={`band-${b.layer}-${b.track}`}
              x1={0} y1={b.y} x2={l.width - 16} y2={b.y}
              style={{ stroke: 'var(--ep-border)' }} strokeWidth={1}
            />
          ))}

          {/* the top rule the fork labels sit on, and one ink rule per layer boundary */}
          <line x1={0} y1={34} x2={l.width - 16} y2={34} style={{ stroke: 'var(--ep-on-surface)' }} strokeWidth={1} />
          {l.layers.map((b) => (
            <line
              key={`layer-${b.layer}`}
              x1={0} y1={b.y + b.h} x2={l.width - 16} y2={b.y + b.h}
              style={{ stroke: 'var(--ep-on-surface)' }} strokeWidth={1}
            />
          ))}

          {l.columns.map((c) => (
            <text
              key={`fork-${c.fork}`}
              x={c.x + 6} y={26} fontSize={LABEL_SIZE} fontWeight={500}
              style={{ fill: 'var(--ep-secondary)' }}
            >
              {c.fork}
            </text>
          ))}

          {l.layers.map((b) => (
            <text
              key={`layername-${b.layer}`}
              x={LAYER_STRIP / 2} y={b.y + b.h / 2} fontSize={LABEL_SIZE} fontWeight={700}
              style={{ fill: 'var(--ep-on-surface)' }} textAnchor="middle" letterSpacing="0.08em"
              transform={`rotate(-90 ${LAYER_STRIP / 2} ${b.y + b.h / 2})`}
            >
              {b.layer}
            </text>
          ))}

          {l.bands.map((b) => (
            <text
              key={`track-${b.layer}-${b.track}`}
              x={LAYER_STRIP + 8} y={b.y + 15} fontSize={LABEL_SIZE} fontWeight={400}
              style={{ fill: 'var(--ep-secondary)' }}
            >
              {b.track}
            </text>
          ))}

          {/* throughlines first, so a chip is never hidden behind a line */}
          {l.lines.map((ln) => (
            <path
              key={`${ln.from}->${ln.to}`}
              d={`M ${ln.x1} ${ln.y1} C ${ln.x1 + 20} ${ln.y1}, ${ln.x2 - 20} ${ln.y2}, ${ln.x2} ${ln.y2}`}
              fill="none" strokeWidth={1} strokeOpacity={0.5}
              style={{ stroke: 'var(--ep-primary)' }}
            />
          ))}

          {l.chips.map((c) => {
            const state = live.get(c.hash.toLowerCase()) ?? 'unknown';
            const open = state === 'open';
            const unknown = state === 'unknown';
            const lines = wrapLabel(c.label, c.w - 8);
            const first = lines.length > 1 ? c.y + 12 : c.y + c.h / 2 + 4;
            return (
              <a
                key={c.id} className="chip" href={`/node/${c.hash}`} data-testid="strawmap-chip"
                aria-label={`${c.label} (${state})`}
              >
                <title>{`${c.label} — ${state}`}</title>
                <rect
                  x={c.x} y={c.y} width={c.w} height={c.h} rx={4}
                  style={{
                    fill: open ? 'var(--ep-primary)' : unknown ? 'var(--ep-state-unknown)' : 'var(--ep-surface)',
                    stroke: open || unknown ? 'none' : 'var(--ep-border)',
                  }}
                  strokeWidth={1}
                />
                {lines.map((text, i) => (
                  <text
                    key={i} x={c.x + 4} y={first + i * 12}
                    fontSize={LABEL_SIZE} fontWeight={open ? 700 : 500}
                    style={{ fill: open ? '#FFFFFF' : unknown ? '#3F3F46' : 'var(--ep-on-surface)' }}
                  >
                    {text}
                  </text>
                ))}
              </a>
            );
          })}
        </svg>
      </div>

      {chrome ? (
        <figcaption className="mt-[10px] flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2" data-testid="map-legend">
            {measured
              ? Object.entries(counts)
                  .sort((a, b) => (a[0] === 'open' ? -1 : b[0] === 'open' ? 1 : a[0].localeCompare(b[0])))
                  .map(([key, n]) => (
                    <span
                      key={key}
                      className="inline-flex items-center gap-[6px]"
                      style={{ fontSize: 'var(--ep-size-sm)', color: 'var(--ep-secondary)' }}
                    >
                      <i
                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{ background: STATE_INK[key] ?? 'var(--ep-state-unknown)' }}
                      />
                      {key} <span style={{ fontWeight: 700, color: 'var(--ep-on-surface)' }}>{n}</span>
                    </span>
                  ))
              : (
                <span style={{ fontSize: 'var(--ep-size-sm)', color: 'var(--ep-secondary)' }}>
                  no state counts
                </span>
              )}
          </div>
          <div style={{ fontSize: 'var(--ep-size-sm)', color: 'var(--ep-secondary)' }}>
            {measured
              ? 'columns are fork targets · bands are layers and tracks · lines are throughlines'
              : 'columns are fork targets · bands are layers and tracks'}
          </div>
        </figcaption>
      ) : null}

      {chrome && !measured ? (
        <p className="mt-2 max-w-[92ch]" style={{ fontSize: 'var(--ep-size-sm)', color: 'var(--ep-secondary)' }}>
          Live state unavailable; node states are not shown. The API did not respond, so no counts
          are given and every node is drawn in the unknown grey. The layout is read from the strawmap
          file at build time and does not depend on the API.
        </p>
      ) : null}

      {chrome && measured ? (
        <p className="mt-2 max-w-[92ch]" style={{ fontSize: 'var(--ep-size-sm)', color: 'var(--ep-secondary)' }}>
          A filled chip is a node the API returns as open. States for {known} of the {nodes.length}
          nodes were read from that response. Select a node for its criterion, its sessions and its
          payouts.
        </p>
      ) : null}
    </figure>
  );
}
