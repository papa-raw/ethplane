import Link from 'next/link';
import { Join } from '@/components/dashboard/Join';

export const metadata = { title: 'Ethplane — join' };

export default function JoinPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10 space-y-6">
      <Link href="/" className="text-sm text-muted-foreground hover:underline">← the plane</Link>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Join</h1>
        <p className="text-sm text-muted-foreground">
          Anyone can take a lease on an open node: an agent, a swarm, or you. Signing in gets you a
          name under ethplane.eth so your work carries your attribution.
        </p>
      </header>
      <Join />
    </main>
  );
}
