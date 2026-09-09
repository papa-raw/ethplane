import Link from 'next/link';
import { GitHubMark, XMark } from '@/components/site/GitHubMark';

/**
 * One masthead for every route, so nothing jumps between pages (BRIEF §2 refusal 5): the same
 * 1240px column, the name, five links, one hairline rule.
 */
const NAV = [
  { href: '/', label: 'map' },
  { href: '/docs', label: 'docs' },
];

export function Masthead() {
  return (
    <header
      className="flex flex-wrap items-baseline gap-x-7 gap-y-2 border-b pb-[18px]"
      style={{ borderColor: 'var(--ep-border)' }}
    >
      <Link
        href="/"
        style={{
          fontSize: 'var(--ep-size-lg)', fontWeight: 700, letterSpacing: '-0.01em',
          color: 'var(--ep-on-surface)', textDecoration: 'none',
        }}
      >
        Ethplane
      </Link>
      <nav className="flex flex-wrap gap-x-[18px]">
        {NAV.map((n) => (
          <Link
            key={n.label}
            href={n.href}
            className="hover:underline"
            style={{ fontSize: 'var(--ep-size-sm)', color: 'var(--ep-secondary)' }}
          >
            {n.label}
          </Link>
        ))}
      </nav>
      <a
        href="https://github.com/papa-raw/ethplane"
        aria-label="Source on GitHub"
        className="ml-auto inline-flex items-center hover:opacity-70"
        style={{ color: 'var(--ep-secondary)' }}
      >
        <GitHubMark />
      </a>
      <a
        href="https://x.com/papa_raw"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Pat on X"
        className="inline-flex items-center hover:opacity-70"
        style={{ color: 'var(--ep-secondary)' }}
      >
        <XMark />
      </a>
      <a
        href="/join"
        className="ml-4 no-underline"
        style={{
          padding: '7px 14px', borderRadius: 'var(--ep-radius-md)', background: 'var(--ep-primary)',
          color: '#ffffff', fontSize: 'var(--ep-size-sm)', fontWeight: 500,
        }}
      >
        Join
      </a>
    </header>
  );
}
