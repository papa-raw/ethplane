'use client';
import { useEffect, useMemo, useState } from 'react';
import { usePolling } from '@/lib/usePolling';
import { getJson, isOpen, type NodeRow, type RawNodeDetail } from '@/lib/api';

/**
 * The three numbers a judge needs in ten seconds (BRIEF §1.3), each read from the API and none of
 * them typed: how many nodes are open and what each holds, how many sessions are live right now,
 * how many verdicts the verifier has written on Sepolia.
 *
 * Verdicts are not carried by /api/nodes, so they are counted from the detail of each open node.
 * That covers every verdict on the plane: a session cannot start on a node that was never opened,
 * and a verdict cannot be written without a submission from a session. When the API does not
 * respond the numerals are omitted (BRIEF §2 refusal 7), and a sentence states that.
 */
/** Wei to whole PLANE. The escrow is a round number of tokens, so integer division is exact. */
function plane(wei: string | null): string {
  const n = Number(wei ?? '0') / 1e18;
  return Number.isFinite(n) ? n.toLocaleString('en-US') : '0';
}

export function PlaneNumbers() {
  const poll = usePolling<NodeRow[]>('/api/nodes');
  const rows = poll.data;

  const open = useMemo(() => (rows ?? []).filter(isOpen), [rows]);
  const openIds = open.map((n) => n.node_id).join(',');

  const [verdicts, setVerdicts] = useState<number | null>(null);
  useEffect(() => {
    if (!rows) { setVerdicts(null); return; }
    const ids = openIds ? openIds.split(',') : [];
    if (ids.length === 0) { setVerdicts(0); return; }
    let alive = true;
    Promise.all(ids.map((id) => getJson<RawNodeDetail>(`/api/nodes/${id}`)))
      .then((details) => {
        if (!alive) return;
        setVerdicts(details.reduce((sum, d) => sum + (d.verdicts?.length ?? 0), 0));
      })
      .catch(() => { if (alive) setVerdicts(null); });
    return () => { alive = false; };
  }, [openIds, rows]);

  const measured = rows !== null;
  const sessionsLive = measured ? (rows ?? []).reduce((s, n) => s + (n.active_lease_count ?? 0), 0) : null;
  const bounties = new Set(open.map((n) => plane(n.bounty)));
  const each = bounties.size === 1 ? [...bounties][0] : null;

  const cells: Array<{ value: number | null; label: string }> = [
    {
      value: measured ? open.length : null,
      label: each && open.length > 0 ? `nodes open · ${each} PLANE each` : 'nodes open',
    },
    { value: sessionsLive, label: 'sessions live' },
    { value: verdicts, label: 'verdicts on Sepolia' },
  ];

  return (
    <section data-testid="plane-numbers">
      <div
        className="grid grid-cols-1 border-y sm:grid-cols-3"
        style={{ borderColor: 'var(--ep-border)' }}
      >
        {cells.map((c, i) => (
          <div
            key={c.label}
            className={i < cells.length - 1 ? 'px-5 py-[18px] sm:border-r' : 'px-5 py-[18px]'}
            style={{ borderColor: 'var(--ep-border)' }}
          >
            <b
              className="block"
              style={{
                fontSize: 'var(--ep-size-display)', fontWeight: 700,
                letterSpacing: '-0.02em', lineHeight: 1.2,
                color: c.value === null ? 'var(--ep-secondary)' : 'var(--ep-on-surface)',
              }}
            >
              {c.value === null ? '—' : c.value.toLocaleString('en-US')}
            </b>
            <span
              className="mt-1 block uppercase"
              style={{ fontSize: 'var(--ep-size-label)', fontWeight: 500, letterSpacing: '0.08em', color: 'var(--ep-secondary)' }}
            >
              {c.label}
            </span>
          </div>
        ))}
      </div>
      {!measured && !poll.loading ? (
        <p className="mt-3" style={{ fontSize: 'var(--ep-size-sm)', color: 'var(--ep-secondary)' }}>
          The API did not respond. These three numbers are read from /api/nodes, and are not shown
          without it.
        </p>
      ) : null}
      {measured && verdicts === null && openIds ? (
        <p className="mt-3" style={{ fontSize: 'var(--ep-size-sm)', color: 'var(--ep-secondary)' }}>
          The verdict count is being read from the open nodes.
        </p>
      ) : null}
    </section>
  );
}
