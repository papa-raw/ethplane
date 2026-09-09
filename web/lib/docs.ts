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

/**
 * DECK.md is no longer parsed here. /deck was a ten-screen carousel built from that file; it is now
 * a written architecture page, so the slide and screen parsers and their figure-lifting are gone
 * rather than left as unused exports. The file itself stays in docs/ and is listed below.
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
