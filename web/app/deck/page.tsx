import { deckScreens } from '@/lib/docs';
import { Deck } from '@/components/dashboard/Deck';
import { Masthead } from '@/components/site/Masthead';

export const metadata = { title: 'Ethplane — deck' };

export default function DeckPage() {
  return (
    <main className="ep">
      <Masthead current="deck" />
      <Deck screens={deckScreens()} />
    </main>
  );
}
