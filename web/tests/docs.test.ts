import { describe, it, expect } from 'vitest';
import { deckSlides, deckScreens, availableDocs, renderMarkdown } from '@/lib/docs';

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

describe('deck screens', () => {
  const screens = deckScreens();

  it('gives one screen per section, opening on the first section rather than the preamble', () => {
    expect(screens.length).toBe(deckSlides().length);
    expect(screens[0].title).toBe('The question');
  });

  it('takes the point from the first sentence and leaves the rest as body', () => {
    const plane = screens.find((s) => s.title === 'The plane');
    expect(plane?.point).toBe('The Ethereum roadmap as a plane of paid work.');
    expect(plane?.bodyHtml).toContain('nodes from the Foundation');
  });

  it('keeps a full stop inside a name out of the sentence split', () => {
    const join = screens.find((s) => s.title === 'Join');
    expect(join?.bodyHtml).toContain('guests.ethplane.eth');
  });

  it('marks the numbers a reader could check, and leaves version suffixes alone', () => {
    const today = screens.find((s) => s.title === 'What happened today');
    expect(today?.bodyHtml).toContain('<span class="ep-fig">1,541,462</span>');
    expect(today?.bodyHtml).toContain('Node 2,');
    const swarm = screens.find((s) => s.title === 'The swarm');
    expect(swarm?.point).toContain('Qwen3-Coder 30B');
    expect(swarm?.bodyHtml).not.toContain('ep-fig');
  });

  it('lifts a figure only where the file labels it in one word', () => {
    const today = screens.find((s) => s.title === 'What happened today');
    expect(today?.figures).toEqual([
      { value: '16', label: 'measurements' },
      { value: '1,541,462', label: 'cycles' },
      { value: '1,542,812', label: 'baseline' },
    ]);
    expect(screens.find((s) => s.title === 'The plane')?.figures).toEqual([]);
  });
});
