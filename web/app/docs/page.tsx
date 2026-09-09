import Link from 'next/link';
import { availableDocs } from '@/lib/docs';

export const metadata = { title: 'Ethplane — docs' };

/** The repo's own documents, rendered as they land on main. Nothing is retyped for the web. */
export default function DocsPage() {
  const docs = availableDocs();
  return (
    <main className="mx-auto max-w-4xl px-6 py-10 space-y-8">
      <Link href="/" className="text-sm text-muted-foreground hover:underline">← the plane</Link>
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Docs</h1>
        <p className="text-sm text-muted-foreground">
          Rendered from the repository, not rewritten for the web: {docs.length} document{docs.length === 1 ? '' : 's'}.
        </p>
      </header>

      {docs.length === 0 ? (
        <p data-testid="docs-empty" className="text-muted-foreground">No documents found in docs/.</p>
      ) : (
        <>
          <nav data-testid="docs-nav" className="flex flex-wrap gap-2">
            {docs.map((d) => (
              <a key={d.file} href={`#${d.file}`} className="rounded-md border px-3 py-1 text-sm hover:bg-muted">
                {d.title}
              </a>
            ))}
          </nav>
          <div className="space-y-12">
            {docs.map((d) => (
              <section key={d.file} id={d.file} data-testid="docs-section" className="space-y-3 scroll-mt-8">
                <h2 className="text-lg font-bold">
                  {d.title} <span className="font-mono text-xs text-muted-foreground">docs/{d.file}</span>
                </h2>
                <div
                  className="prose prose-zinc max-w-none prose-pre:overflow-x-auto prose-headings:scroll-mt-8"
                  dangerouslySetInnerHTML={{ __html: d.html }}
                />
              </section>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
