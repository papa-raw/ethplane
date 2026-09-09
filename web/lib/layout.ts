/**
 * The strawmap's geometry, as a pure function so it can be tested without a browser.
 *
 * Structure copied from the EF strawmap itself, not invented: fork targets are columns left to
 * right, layers are horizontal bands, tracks are sub-bands inside a layer, and a node sits in the
 * cell where its fork column meets its track band. Throughlines are drawn between chips.
 */
export type StrawNode = {
  id: string;
  hash: string;
  label: string;
  layer: string;
  track: string;
  fork_target: string;
  tag?: string;
  throughlines_to?: string[];
};

export type Chip = StrawNode & { x: number; y: number; w: number; h: number };
export type Line = { from: string; to: string; x1: number; y1: number; x2: number; y2: number };
export type Band = { layer: string; track: string; y: number; h: number };
export type Column = { fork: string; x: number; w: number };
export type Layout = {
  chips: Chip[]; lines: Line[]; bands: Band[]; columns: Column[];
  layers: Array<{ layer: string; y: number; h: number }>;
  width: number; height: number;
};

/** Fork order along the strawmap's own timeline; anything unknown goes last, in the order it appears. */
export const FORK_ORDER = ['G', 'H', 'H-L (bar)', 'I', 'I-L (bar)', 'J', 'K', 'L', 'longer term', 'north star'];
export const LAYER_ORDER = ['CL', 'DL', 'EL'];

const COL_W = 132;
const CHIP_H = 22;
const CHIP_GAP = 4;
const TRACK_PAD = 10;
const HEADER_H = 34;
const GUTTER = 116;   // left gutter for layer and track names

export function layout(nodes: StrawNode[]): Layout {
  const forks = [
    ...FORK_ORDER.filter((f) => nodes.some((n) => n.fork_target === f)),
    ...[...new Set(nodes.map((n) => n.fork_target))].filter((f) => !FORK_ORDER.includes(f)),
  ];
  const columns: Column[] = forks.map((fork, i) => ({ fork, x: GUTTER + i * COL_W, w: COL_W }));
  const colX = new Map(columns.map((c) => [c.fork, c.x]));

  const layers = [
    ...LAYER_ORDER.filter((l) => nodes.some((n) => n.layer === l)),
    ...[...new Set(nodes.map((n) => n.layer))].filter((l) => !LAYER_ORDER.includes(l)),
  ];

  const bands: Band[] = [];
  const layerBoxes: Array<{ layer: string; y: number; h: number }> = [];
  const chips: Chip[] = [];
  let y = HEADER_H;

  for (const layer of layers) {
    const layerTop = y;
    const tracks = [...new Set(nodes.filter((n) => n.layer === layer).map((n) => n.track))].sort();
    for (const track of tracks) {
      const inTrack = nodes.filter((n) => n.layer === layer && n.track === track);
      // the band is as tall as its busiest column, so nothing overlaps and nothing is hidden
      const deepest = Math.max(...forks.map((f) => inTrack.filter((n) => n.fork_target === f).length), 1);
      const h = deepest * (CHIP_H + CHIP_GAP) + TRACK_PAD;
      bands.push({ layer, track, y, h });
      for (const fork of forks) {
        const cell = inTrack.filter((n) => n.fork_target === fork);
        cell.forEach((n, i) => {
          chips.push({
            ...n,
            x: (colX.get(fork) ?? GUTTER) + 4,
            y: y + TRACK_PAD / 2 + i * (CHIP_H + CHIP_GAP),
            w: COL_W - 12,
            h: CHIP_H,
          });
        });
      }
      y += h;
    }
    layerBoxes.push({ layer, y: layerTop, h: y - layerTop });
  }

  const byId = new Map(chips.map((c) => [c.id, c]));
  const lines: Line[] = [];
  for (const c of chips) {
    for (const target of c.throughlines_to ?? []) {
      const t = byId.get(target);
      if (!t) continue;   // a throughline to a node not on the map is dropped, not drawn to nowhere
      lines.push({ from: c.id, to: target, x1: c.x + c.w, y1: c.y + c.h / 2, x2: t.x, y2: t.y + t.h / 2 });
    }
  }

  return { chips, lines, bands, columns, layers: layerBoxes, width: GUTTER + forks.length * COL_W + 16, height: y + 12 };
}
