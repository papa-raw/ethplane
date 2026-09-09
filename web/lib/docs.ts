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

/**
 * A deck screen: the section title, the first sentence as the point, the rest as body, and any
 * figures the section states plainly enough to lift out.
 *
 * Nothing here writes words. Every string on a screen is a slice of docs/DECK.md, and `words` is the
 * body count so the 40-word limit in web/design/BRIEF.md §6 can be read off the DOM instead of
 * counted by eye.
 */
export type Screen = {
  title: string;
  point: string;
  bodyHtml: string;
  words: number;
  figures: Array<{ value: string; label: string }>;
};

/** Markdown to plain text. DECK.md is plain paragraphs today; this holds if that changes. */
function plain(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/^[#>\-*+\s]+/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Sentence split. The boundary is a full stop followed by whitespace and a capital or a digit, so
 * "ethplane.eth," "guests.ethplane.eth," and "1,541,462" survive intact while "…paid work. 65 nodes"
 * splits. A digit only ever follows the boundary; it never creates one.
 */
function sentences(text: string): string[] {
  return text
    .split(/(?<=[.?!])\s+(?=[A-Z(\d])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * A number a reader could check: digit-led and not part of a word, so ENSv2 and 30B are not numbers.
 * A single digit is an ordinal in this file — "Node 1", "Node 2" — so it is left in the prose; only
 * two characters or more are set as a value. A group separator only counts inside a number, so
 * the comma after "Node 2" is punctuation and stays in the prose.
 */
const NUMBER = /\b\d+(?:,\d+)*(?:\/\d+)*(?![\w])/g;

/**
 * A figure is a number the file itself labels: a digit-led value, one lowercase word, then a comma
 * or a full stop. "16 measurements," qualifies; "65 nodes from the Foundation's strawmap" does not,
 * because the label would have to be cut somewhere the file does not cut it. The strict form is why
 * only the results section carries a strip: everywhere else the file states its numbers in prose.
 */
const FIGURE = /(\b\d+(?:,\d+)*(?:\/\d+)*)(?![\w])\s+([a-z]+)(?=[,.])/g;

export function deckScreens(): Screen[] {
  const md = readDoc('DECK.md');
  if (!md) return [];
  // Everything before the first "## " is the file's own title and one line about the file. It is not
  // a section, so it is not a screen — the same drop deckSlides makes, made the same way.
  const first = md.search(/^## /m);
  if (first === -1) return [];
  const parts = md.slice(first).split(/^## /m).filter((s) => s.trim().length > 0);
  return parts.map((part) => {
    const nl = part.indexOf('\n');
    const title = (nl === -1 ? part : part.slice(0, nl)).trim();
    const text = plain(nl === -1 ? '' : part.slice(nl + 1));
    const [point, ...rest] = sentences(text);
    const body = rest.join(' ');
    const figures = [...text.matchAll(FIGURE)]
      .map((m) => ({ value: m[1], label: m[2] }))
      .slice(0, 3);
    return {
      title,
      point: point ?? '',
      bodyHtml: escapeHtml(body).replace(NUMBER, (n) =>
        n.length > 1 ? `<span class="ep-fig">${n}</span>` : n,
      ),
      words: body.split(/\s+/).filter(Boolean).length,
      figures,
    };
  });
}

/**
 * Every markdown file at the root of docs/, in reading order for a judge. The list is ordered by
 * hand and checked by a test against the directory, because the failure it had was the silent one:
 * four files existed and were simply not listed, JUDGES.md among them — the document written for
 * judges, absent from the page written for judges.
 */
export const DOC_FILES = [
  { file: 'JUDGES.md', title: 'For a judge' },
  { file: 'SUBMISSION.md', title: 'Submission' },
  { file: 'SPEC.md', title: 'Spec' },
  { file: 'CRITERION-pq-leanxmss.md', title: 'Criterion' },
  { file: 'CRITERION-pq-leanxmss@a2e71ccb.md', title: 'Criterion, the frozen copy' },
  { file: 'DEPLOYMENTS.md', title: 'Deployments' },
  { file: 'ENS-PROBES.md', title: 'ENS probes' },
  { file: 'REHEARSAL.md', title: 'Rehearsal' },
  { file: 'DECK.md', title: 'Deck' },
  { file: 'FILM.md', title: 'Film' },
  { file: 'JOIN.md', title: 'Join' },
  { file: 'ROLES.md', title: 'Roles' },
];

/** The markdown files that exist at the root of docs/, for the test that guards DOC_FILES. */
export function docsRootFiles(): string[] {
  const d = docsDir();
  return fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.md')).sort() : [];
}

/** Only the files that exist: a docs page that lists a missing file is a broken promise. */
export function availableDocs(): Array<{ file: string; title: string; html: string }> {
  return DOC_FILES.flatMap(({ file, title }) => {
    const md = readDoc(file);
    return md ? [{ file, title, html: renderMarkdown(md) }] : [];
  });
}
