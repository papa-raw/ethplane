import fs from 'fs';
import path from 'path';
import { marked } from 'marked';

/**
 * Build-time markdown. The deck and the docs page render the repo's own files, so the words have one
 * home: change docs/DECK.md and the slides change. Rendering happens at build, not in the browser,
 * so the export ships HTML and no markdown parser.
 */
function docsDir(): string {
  const candidates = [path.join(process.cwd(), '..', 'docs'), path.join(process.cwd(), 'docs')];
  return candidates.find((c) => fs.existsSync(c)) ?? candidates[0];
}

export function readDoc(file: string): string | null {
  const p = path.join(docsDir(), file);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : null;
}

export function renderMarkdown(md: string): string {
  return marked.parse(md, { async: false }) as string;
}

export type Slide = { title: string; html: string };

/**
 * DECK.md is a list of level-2 sections; each one is a slide, in file order. The file also opens
 * with an H1 and a line saying what it is, and splitting on `## ` alone turned that preamble into
 * slide one, titled `# Ethplane, the deck` — so everything before the first `## ` is dropped.
 */
export function deckSlides(): Slide[] {
  const md = readDoc('DECK.md');
  if (!md) return [];
  const first = md.search(/^## /m);
  if (first === -1) return [];
  const parts = md.slice(first).split(/^## /m).filter((s) => s.trim().length > 0);
  return parts.map((part) => {
    const nl = part.indexOf('\n');
    const title = (nl === -1 ? part : part.slice(0, nl)).trim();
    const body = nl === -1 ? '' : part.slice(nl + 1);
    return { title, html: renderMarkdown(body) };
  });
}

export const DOC_FILES = [
  { file: 'SPEC.md', title: 'Spec' },
  { file: 'CRITERION-pq-leanxmss.md', title: 'Criterion' },
  { file: 'DEPLOYMENTS.md', title: 'Deployments' },
  { file: 'ENS-PROBES.md', title: 'ENS probes' },
  { file: 'DECK.md', title: 'Deck' },
  { file: 'FILM.md', title: 'Film' },
  { file: 'JOIN.md', title: 'Join' },
  { file: 'ROLES.md', title: 'Roles' },
];

/** Only the files that exist: a docs page that lists a missing file is a broken promise. */
export function availableDocs(): Array<{ file: string; title: string; html: string }> {
  return DOC_FILES.flatMap(({ file, title }) => {
    const md = readDoc(file);
    return md ? [{ file, title, html: renderMarkdown(md) }] : [];
  });
}
