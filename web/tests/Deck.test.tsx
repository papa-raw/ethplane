import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Deck } from '@/components/dashboard/Deck';

const slides = [
  { title: 'The question', html: '<p>Humans and AI as a swarm.</p>' },
  { title: 'Why ENS', html: '<p>Names carry the work.</p>' },
  { title: 'The numbers', html: '<p>65% against 7.6%.</p>' },
];

describe('Deck', () => {
  it('says so when DECK.md is missing rather than showing a blank stage', () => {
    render(<Deck slides={[]} />);
    expect(screen.getByTestId('deck-empty')).toHaveTextContent('DECK.md is missing');
  });

  it('opens on the first slide and counts them', () => {
    render(<Deck slides={slides} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('The question');
    expect(screen.getByTestId('deck-counter')).toHaveTextContent('1 / 3');
  });

  it('advances with the arrow key, because it is presented rather than browsed', () => {
    render(<Deck slides={slides} />);
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Why ENS');
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('The question');
  });

  it('renders the slide body from the markdown it was given', () => {
    render(<Deck slides={slides} />);
    expect(screen.getByTestId('deck-body')).toHaveTextContent('Humans and AI as a swarm.');
  });
});
