import { describe, expect, it } from 'vitest';
import { parseDocsFrontmatter } from './docs-frontmatter';
import { buildDocsManifest, DOCS_MANIFEST_VERSION, type DocsManifestSourceFile } from './docs-manifest';
import { extractDocsSections, slugifyDocsHeading } from './docs-sections';

function docFile(path: string, content: string): DocsManifestSourceFile {
  return { path, content: Buffer.from(content, 'utf8') };
}

describe('parseDocsFrontmatter()', () => {
  it('should parse scalars, inline lists and block lists', () => {
    const result = parseDocsFrontmatter(['---', 'title: "Setup Guide"', 'audience: [admin, user]', 'tags:', '  - setup', "  - 'getting started'", '# a comment', '---', '# Body'].join('\n'));
    expect(result.hasFrontmatter).toBe(true);
    expect(result.values).toEqual({ title: 'Setup Guide', audience: ['admin', 'user'], tags: ['setup', 'getting started'] });
    expect(result.body).toBe('# Body');
    expect(result.problems).toHaveLength(0);
  });

  it('should return the whole content as the body when there is no frontmatter', () => {
    const result = parseDocsFrontmatter('# Title\n\ntext');
    expect(result.hasFrontmatter).toBe(false);
    expect(result.body).toBe('# Title\n\ntext');
  });

  it('should report unreadable lines and an unclosed block', () => {
    expect(parseDocsFrontmatter('---\ntitle: x\nnot a key line\n---\n').problems).toHaveLength(1);
    expect(parseDocsFrontmatter('---\ntitle: x\n').problems[0].message).toContain('never closed');
  });
});

describe('extractDocsSections()', () => {
  it('should extract H2/H3 headings, skip fenced code and dedupe ids', () => {
    const body = ['# Title', '## Getting Started', 'text', '```md', '## Not A Heading', '```', '### Step `one`', '## Getting Started', '#### Too deep'].join('\n');
    expect(extractDocsSections(body)).toEqual([
      { id: 'getting-started', title: 'Getting Started', depth: 2 },
      { id: 'step-one', title: 'Step `one`', depth: 3 },
      { id: 'getting-started-2', title: 'Getting Started', depth: 2 }
    ]);
  });

  it('should slug links and punctuation', () => {
    expect(slugifyDocsHeading('Use [the API](https://x.y) & more!')).toBe('use-the-api-more');
    expect(slugifyDocsHeading('!!!')).toBe('section');
  });
});

describe('buildDocsManifest()', () => {
  const generatedAt = new Date('2026-01-01T00:00:00.000Z');

  it('should build entries with ids, titles, sections, sha256 and size', () => {
    const { manifest, findings } = buildDocsManifest({
      app: 'demo-api',
      audiences: ['admin', 'user'],
      generatedAt,
      files: [docFile('guides/setup.md', '---\naudience: [user]\ntags: [setup]\ndescription: How to set up\n---\n# Setup\n\n## Install\n'), docFile('about.md', '---\naudience: any\ntitle: About\n---\ntext')]
    });

    expect(findings).toHaveLength(0);
    expect(manifest.version).toBe(DOCS_MANIFEST_VERSION);
    expect(manifest.generatedAt).toBe(generatedAt.toISOString());
    expect(manifest.audiences).toEqual(['admin', 'user']);
    expect(manifest.docs.map((x) => x.id)).toEqual(['about', 'guides/setup']);

    const setup = manifest.docs[1];
    expect(setup.title).toBe('Setup');
    expect(setup.description).toBe('How to set up');
    expect(setup.tags).toEqual(['setup']);
    expect(setup.audience).toEqual(['user']);
    expect(setup.sections).toEqual([{ id: 'install', title: 'Install', depth: 2 }]);
    expect(setup.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(setup.size).toBeGreaterThan(0);
  });

  it('should error on a missing or unknown audience and leave the doc out', () => {
    const { manifest, findings } = buildDocsManifest({ app: 'x', audiences: ['admin'], files: [docFile('a.md', '# A'), docFile('b.md', '---\naudience: [school]\n---\n# B')] });
    expect(manifest.docs).toHaveLength(0);
    expect(findings.map((x) => [x.code, x.severity])).toEqual([
      ['DOCS_AUDIENCE_MISSING', 'error'],
      ['DOCS_AUDIENCE_UNKNOWN', 'error']
    ]);
  });

  it('should apply the default audience and warn on unknown keys and a missing title', () => {
    const { manifest, findings } = buildDocsManifest({ app: 'x', audiences: ['admin'], defaultAudience: ['admin'], files: [docFile('notes/raw-notes.md', '---\nowner: me\n---\ntext')] });
    expect(manifest.docs[0].audience).toEqual(['admin']);
    expect(manifest.docs[0].title).toBe('raw-notes');
    expect(findings.map((x) => x.code)).toEqual(['DOCS_FRONTMATTER_UNKNOWN_KEY', 'DOCS_TITLE_MISSING']);
  });
});
