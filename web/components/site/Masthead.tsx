import './site.css';

/**
 * One masthead for every page: the name, five links, one hairline under them. Written once so the
 * deck, the docs and the join page cannot drift apart from each other.
 */
const LINKS = [
  { key: 'map', href: '/' },
  { key: 'nodes', href: '/#nodes' },
  { key: 'deck', href: '/deck' },
  { key: 'docs', href: '/docs' },
  { key: 'join', href: '/join' },
] as const;

export type MastheadPage = (typeof LINKS)[number]['key'];

export function Masthead({ current }: { current?: MastheadPage }) {
  return (
    <header>
      <div className="ep-wrap ep-masthead-row">
        <a className="ep-mark" href="/">Ethplane</a>
        <nav className="ep-nav">
          {LINKS.map((l) => (
            <a key={l.key} href={l.href} aria-current={l.key === current ? 'page' : undefined}>
              {l.key}
            </a>
          ))}
        </nav>
        <a className="ep-source" href="https://github.com/papa-raw/ethplane">source</a>
      </div>
    </header>
  );
}
