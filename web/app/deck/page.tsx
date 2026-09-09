import { Architecture } from '@/components/site/Architecture';
import { Masthead } from '@/components/site/Masthead';

export const metadata = { title: 'Ethplane — how it works' };

export default function DeckPage() {
  return (
    <main className="ep">
      <Masthead current="deck" />
      <Architecture />
    </main>
  );
}
