import { availableDocs } from '@/lib/docs';
import { Masthead } from '@/components/site/Masthead';

export const metadata = { title: 'Ethplane — docs' };

/** The repo's own documents, rendered as they land on main. Nothing is retyped for the web. */
export default function DocsPage() {
  const docs = availableDocs();
  return (
    <main className="ep">
      <Masthead current="docs" />

      <div className="ep-wrap">
        <div className="ep-hero">
          <h1>Docs</h1>
          <p className="ep-lead">
            The repository&apos;s own markdown, rendered at build time: {docs.length} document
            {docs.length === 1 ? '' : 's'}. Each heading below is the file it came from.
          </p>
        </div>

        {docs.length === 0 ? (
          <p data-testid="docs-empty" className="ep-panel">
            No documents found in docs/.
          </p>
        ) : (
          <>
            <nav data-testid="docs-nav" className="ep-index">
              {docs.map((d) => (
                <a key={d.file} href={`#${d.file}`}>
                  <span className="ep-index-title">{d.title}</span>
                  <span className="ep-index-file">docs/{d.file}</span>
                </a>
              ))}
            </nav>

            {docs.map((d) => (
              <section
                key={d.file}
                id={d.file}
                data-testid="docs-section"
                style={{ scrollMarginTop: '16px' }}
              >
                <div className="ep-doc-head">
                  <h2>{d.title}</h2>
                  <span className="ep-index-file">docs/{d.file}</span>
                </div>
                <div className="ep-doc" dangerouslySetInnerHTML={{ __html: d.html }} />
              </section>
            ))}
          </>
        )}

        <p className="ep-foot">
          <a href="/">Back to the map</a>
        </p>
      </div>
    </main>
  );
}
