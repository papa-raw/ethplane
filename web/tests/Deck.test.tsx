import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Deck } from '@/components/dashboard/Deck';
import type { Screen } from '@/lib/docs';

const screens: Screen[] = [
  {
    title: 'The question',
    point: 'Humans and AI as a swarm.',
    bodyHtml: 'A history of contributions, built on and paid for.',
    words: 9,
    figures: [],
  },
  { title: 'Why ENS', point: 'Names carry the work.', bodyHtml: '', words: 0, figures: [] },
  {
    title: 'The numbers',
    point: 'Node 2, compiler open.',
    bodyHtml: '<span class="ep-fig">16</span> measurements, cycles unchanged.',
    words: 4,
    figures: [{ value: '16', label: 'measurements' }],
  },
];

// The deck writes the screen number into the location hash, and jsdom keeps it between tests, so a
// test that did not clear it opened on whichever screen the previous test left.
beforeEach(() => {
  window.location.hash = '';
});

describe('Deck', () => {
  it('says so when DECK.md is missing rather than showing a blank stage', () => {
    render(<Deck screens={[]} />);
    expect(screen.getByTestId('deck-empty')).toHaveTextContent('DECK.md is missing');
  });

  it('opens on the first screen and counts them', () => {
    render(<Deck screens={screens} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('The question');
    expect(screen.getByTestId('deck-counter')).toHaveTextContent('1 / 3');
  });

  it('advances with the arrow key, because it is presented rather than browsed', () => {
    render(<Deck screens={screens} />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Why ENS');
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('The question');
  });

  it('renders the body it was given, and states its word count on the element', () => {
    render(<Deck screens={screens} />);
    const body = screen.getByTestId('deck-body');
    expect(body).toHaveTextContent('A history of contributions');
    expect(body).toHaveAttribute('data-words', '9');
  });

  it('shows a figure strip only for a screen that states figures', () => {
    render(<Deck screens={screens} />);
    expect(screen.queryByTestId('deck-figures')).toBeNull();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByTestId('deck-figures')).toHaveTextContent('16');
  });

  it('steps the sentence down a size when the figures are the largest thing', () => {
    render(<Deck screens={screens} />);
    expect(document.querySelector('.ep-point')?.className).not.toContain('ep-point-quiet');
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(document.querySelector('.ep-point')?.className).toContain('ep-point-quiet');
  });
});
