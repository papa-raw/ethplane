export const metadata = {
  title: 'Ethplane — docs',
  /* The architecture page and the docs are one page now. Old links still land somewhere. */
  other: { refresh: '0; url=/docs' },
};

export default function DeckPage() {
  return (
    <main style={{ padding: 24, fontFamily: 'var(--ep-font-sans)' }}>
      <p>
        This page moved. <a href="/docs" style={{ color: 'var(--ep-primary)' }}>Continue to the docs</a>.
      </p>
    </main>
  );
}
