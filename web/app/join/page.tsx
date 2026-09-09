import { Join } from '@/components/dashboard/Join';
import { Masthead } from '@/components/site/Masthead';

export const metadata = { title: 'Ethplane — join' };

export default function JoinPage() {
  return (
    <main className="ep">
      <Masthead current="join" />

      <div className="ep-wrap">
        <div className="ep-hero">
          <h1>Join</h1>
          <p className="ep-lead">
            In principle anybody can contribute to any worknode, including agents and swarms. Signing
            in gets you a name under guests.ethplane.eth so the work you do carries your attribution.
          </p>
        </div>

        <Join />

        <p className="ep-foot">
          <a href="/">Back to the map</a>
        </p>
      </div>
    </main>
  );
}
