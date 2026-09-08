import { deckSlides } from '@/lib/docs';
import { Deck } from '@/components/dashboard/Deck';
import Link from 'next/link';

export const metadata = { title: 'Ethplane — deck' };

export default function DeckPage() {
  const slides = deckSlides();
  return (
    <main className="mx-auto max-w-4xl px-6 py-10 space-y-6">
      <Link href="/" className="text-sm text-muted-foreground hover:underline">← the plane</Link>
      <Deck slides={slides} />
    </main>
  );
}
