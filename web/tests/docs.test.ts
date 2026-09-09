import { describe, it, expect } from 'vitest';
import { docsRootFiles, DOC_FILES, availableDocs, renderMarkdown } from '@/lib/docs';

describe('docs source', () => {
  it('lists only documents that exist, so the page never links to a missing file', () => {
    const docs = availableDocs();
    expect(docs.length).toBeGreaterThan(0);
    for (const d of docs) expect(d.html.length).toBeGreaterThan(0);
    expect(docs.map((d) => d.file)).toContain('SPEC.md');
  });

  it('renders markdown to html', () => {
    expect(renderMarkdown('# Title\n\ntext')).toContain('<h1');
  });
});

describe('DOC_FILES', () => {
  it('lists every markdown file at the root of docs/, in both directions', () => {
    const listed = DOC_FILES.map((d) => d.file).sort();
    // Missing a file is the failure that shipped: JUDGES.md existed and the page written for judges
    // did not carry it. Listing a file that does not exist is the failure availableDocs() guards.
    expect(listed).toEqual(docsRootFiles());
    expect(new Set(listed).size).toBe(listed.length);
  });
});
