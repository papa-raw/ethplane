'use client';
import { useState, useEffect, useCallback } from 'react';
import type { Slide } from '@/lib/docs';
import { Button } from '@/components/ui/button';

/**
 * Nine slides, one per level-2 heading in docs/DECK.md. Keyboard-driven because it is presented,
 * not browsed: ← → and space, with the slide number in the URL hash so a link opens on a slide.
 */
export function Deck({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0);

  const go = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(slides.length - 1, next));
    setI(clamped);
    if (typeof window !== 'undefined') window.location.hash = String(clamped + 1);
  }, [slides.length]);

  useEffect(() => {
    const fromHash = Number(typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '') - 1;
    if (!Number.isNaN(fromHash) && fromHash >= 0 && fromHash < slides.length) setI(fromHash);
  }, [slides.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); go(i + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [i, go]);

  if (slides.length === 0) {
    return <p data-testid="deck-empty" className="text-muted-foreground">docs/DECK.md is missing, so there are no slides to show.</p>;
  }

  const slide = slides[i];
  return (
    <div data-testid="deck" className="flex min-h-[70vh] flex-col justify-between gap-8">
      <article className="space-y-4">
        <h2 className="text-3xl font-bold tracking-tight">{slide.title}</h2>
        <div
          data-testid="deck-body"
          className="prose prose-zinc max-w-3xl text-lg [&_li]:my-1 [&_p]:my-3"
          dangerouslySetInnerHTML={{ __html: slide.html }}
        />
      </article>
      <footer className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => go(i - 1)} disabled={i === 0}>←</Button>
        <Button variant="outline" size="sm" onClick={() => go(i + 1)} disabled={i === slides.length - 1}>→</Button>
        <span data-testid="deck-counter" className="text-sm text-muted-foreground">{i + 1} / {slides.length}</span>
        <span className="ml-auto flex gap-1">
          {slides.map((s, n) => (
            <button
              key={s.title}
              aria-label={s.title}
              onClick={() => go(n)}
              className={`h-1.5 w-6 rounded-full ${n === i ? 'bg-foreground' : 'bg-muted'}`}
            />
          ))}
        </span>
      </footer>
    </div>
  );
}
