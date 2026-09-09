import { Docs } from '@/components/site/Docs';
import { Masthead } from '@/components/site/Masthead';

export const metadata = { title: 'Ethplane — docs' };

export default function DocsPage() {
  return (
    <main className="ep">
      <Masthead current="docs" />
      <Docs />
    </main>
  );
}
