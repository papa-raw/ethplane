import Link from 'next/link';
import { GitHubMark } from '@/components/site/GitHubMark';

/**
 * One masthead for every route, so nothing jumps between pages (BRIEF §2 refusal 5): the same
 * 1240px column, the name, five links, one hairline rule.
 */
const NAV = [
  { href: '/', label: 'map' },
  { href: '/#nodes', label: 'worknodes' },
  { href: '/deck', label: 'deck' },
  { href: '/docs', label: 'docs' },
  { href: '/join', label: 'join' },
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
    </header>
  );
}
