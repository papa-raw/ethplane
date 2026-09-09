'use client';
import { useState, useEffect, useCallback } from 'react';
import type { Screen } from '@/lib/docs';
import '@/components/site/site.css';

/**
 * One screen per level-2 section of docs/DECK.md, in file order. It is presented rather than
 * browsed, so the arrow keys and the space bar move between screens and the screen number is in the
 * URL hash, which makes a link open on a screen.
 *
 * Type follows web/design/BRIEF.md §6: the largest thing on a screen is the point being made, and
 * where the section states a figure the figure is the largest thing and the sentence steps down one
 * size. Body word counts are on the DOM as data-words so the 40-word limit can be measured.
 */

/** A first sentence longer than this reads as a paragraph at 32px, so it is set one size down. */
const LONG_POINT = 160;

export function Deck({ screens }: { screens: Screen[] }) {
  const [i, setI] = useState(0);

  const go = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(screens.length - 1, next));
      setI(clamped);
      if (typeof window !== 'undefined') window.location.hash = String(clamped + 1);
    },
    [screens.length],
  );

  useEffect(() => {
    const fromHash =
      Number(typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '') - 1;
    if (!Number.isNaN(fromHash) && fromHash >= 0 && fromHash < screens.length) setI(fromHash);
  }, [screens.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        go(i + 1);
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(i - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [i, go]);

  if (screens.length === 0) {
    return (
      <div className="ep-wrap">
        <p data-testid="deck-empty" className="ep-panel">
          docs/DECK.md is missing. There are no screens to show.
        </p>
      </div>
    );
  }

  const s = screens[i];
  const pointClass =
    s.figures.length > 0
      ? 'ep-point ep-point-quiet'
      : s.point.length > LONG_POINT
        ? 'ep-point ep-point-long'
        : 'ep-point';

  return (
    <div data-testid="deck" className="ep-wrap ep-deck-screen">
      <div className="ep-deck-head">
        <span className="ep-deck-n">
          {String(i + 1).padStart(2, '0')} / {String(screens.length).padStart(2, '0')}
        </span>
        <h2 className="ep-label">{s.title}</h2>
      </div>

      <div className="ep-deck-main">
        <p className={pointClass}>{s.point}</p>
        {s.bodyHtml ? (
          <p
            data-testid="deck-body"
            data-words={s.words}
            className="ep-deck-body"
            dangerouslySetInnerHTML={{ __html: s.bodyHtml }}
          />
        ) : (
          <p data-testid="deck-body" data-words={0} className="ep-deck-body" />
        )}
      </div>

      {s.figures.length > 0 ? (
        <div data-testid="deck-figures" className="ep-nums">
          {s.figures.map((f) => (
            <div key={f.value}>
              <b>{f.value}</b>
              <span>{f.label}</span>
            </div>
          ))}
        </div>
      ) : null}

      <footer className="ep-deck-foot">
        <button
          className="ep-btn"
          aria-label="previous screen"
          onClick={() => go(i - 1)}
          disabled={i === 0}
        >
          ←
        </button>
        <button
          className="ep-btn"
          aria-label="next screen"
          onClick={() => go(i + 1)}
          disabled={i === screens.length - 1}
        >
          →
        </button>
        <span data-testid="deck-counter" className="ep-counter">
          {i + 1} / {screens.length}
        </span>
        <span className="ep-ticks">
          {screens.map((x, n) => (
            <button
              key={x.title}
              className="ep-tick"
              aria-label={x.title}
              aria-current={n === i}
              onClick={() => go(n)}
            />
          ))}
        </span>
      </footer>
    </div>
  );
}
