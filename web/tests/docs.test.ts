import { describe, it, expect } from 'vitest';
import { deckSlides, availableDocs, renderMarkdown } from '@/lib/docs';

describe('docs source', () => {
  it('turns every level-2 heading of DECK.md into a slide', () => {
    const slides = deckSlides();
    expect(slides.length).toBeGreaterThanOrEqual(9);
    expect(slides[0].title).toBe('The question');
    expect(slides.map((s) => s.title)).toContain('Why ENS');
    expect(slides.map((s) => s.title)).toContain('Why Privy');
  });

  it('lists only documents that exist, so the page never links to a missing file', () => {
    const docs = availableDocs();
    expect(docs.length).toBeGreaterThan(0);
    for (const d of docs) expect(d.html.length).toBeGreaterThan(0);
    expect(docs.map((d) => d.file)).toContain('SPEC.md');
  });

  it('renders markdown to html', () => {
    expect(renderMarkdown('# Title\n\ntext')).toContain('<h1');
  });
});
