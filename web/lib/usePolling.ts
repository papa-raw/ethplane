'use client';
import { useEffect, useState } from 'react';
import { getJson } from './api';

export type Poll<T> = { data: T | null; error: string | null; loading: boolean };

/**
 * One hook for every panel, so loading, empty and error are the same three states everywhere
 * (PRD 3.15). Polls every 8 s, which is the API's own poll interval — asking faster only shows the
 * same rows again.
 */
export function usePolling<T>(path: string, intervalMs = 8000): Poll<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const tick = async () => {
      try {
        const next = await getJson<T>(path, controller.signal);
        if (!alive) return;
        setData(next);
        setError(null);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (alive) setLoading(false);
      }
    };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => { alive = false; controller.abort(); clearInterval(id); };
  }, [path, intervalMs]);

  return { data, error, loading };
}
