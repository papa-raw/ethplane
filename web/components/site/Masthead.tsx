import './site.css';
import { GitHubMark, XMark } from '@/components/site/GitHubMark';

/**
 * One masthead for every page: the name, two text links, the two marks, and Join as a button.
 * Written once so the docs and the join page cannot drift apart from each other.
 */
const LINKS = [
  { key: 'map', href: '/' },
  { key: 'docs', href: '/docs' },
] as const;

export type MastheadPage = (typeof LINKS)[number]['key'] | 'join';

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
        <a className="ep-source" href="https://github.com/papa-raw/ethplane" aria-label="Source on GitHub">
          <GitHubMark />
        </a>
        <a
          className="ep-social"
          href="https://x.com/papa_raw"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Pat on X"
        >
          <XMark />
        </a>
        <a
          className={current === 'join' ? 'ep-join ep-join-current' : 'ep-join'}
          href="/join"
          aria-current={current === 'join' ? 'page' : undefined}
        >
          Join
        </a>
      </div>
    </header>
  );
}
