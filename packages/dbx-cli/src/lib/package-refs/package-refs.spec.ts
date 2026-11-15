import { describe, expect, it } from 'vitest';
import { buildPackageRefsDocsIndex, type EmbeddedPackageRefs, packageRefsDocsTopics, renderPackageRefsDocsIndexMarkdown, resolvePackageRefsDocsTopic } from './package-refs';

const ALPHA_REF = '---\nname: alpha\ndescription: The alpha ref.\n---\n\n# Alpha\n\nSee `setup` and `shared`.\n';

const TEST_REFS: EmbeddedPackageRefs = {
  packageName: '@acme/pkg',
  refs: [
    { name: 'alpha', content: ALPHA_REF, docs: { shared: '# Alpha Shared\n', setup: '# Setup\n\nSteps.\n' } },
    { name: 'beta', content: '# Beta\n\nNo frontmatter.\n', docs: { shared: 'No heading here.\n' } },
    { name: 'gamma', content: 'plain text' }
  ]
};

describe('packageRefsDocsTopics()', () => {
  it('should list each ref then its sorted sub-docs', () => {
    expect(packageRefsDocsTopics(TEST_REFS)).toEqual(['alpha', 'alpha/setup', 'alpha/shared', 'beta', 'beta/shared', 'gamma']);
  });
});

describe('resolvePackageRefsDocsTopic()', () => {
  it('should resolve a ref name to its REF.md verbatim', () => {
    expect(resolvePackageRefsDocsTopic(TEST_REFS, 'alpha')).toEqual({ found: true, topic: 'alpha', content: ALPHA_REF });
  });

  it('should resolve <ref>/<doc> to the sub-doc', () => {
    expect(resolvePackageRefsDocsTopic(TEST_REFS, 'beta/shared')).toEqual({ found: true, topic: 'beta/shared', content: 'No heading here.\n' });
  });

  it('should resolve a bare doc key that exactly one ref has', () => {
    expect(resolvePackageRefsDocsTopic(TEST_REFS, 'setup')).toEqual({ found: true, topic: 'alpha/setup', content: '# Setup\n\nSteps.\n' });
  });

  it('should report a bare doc key two refs share as ambiguous', () => {
    expect(resolvePackageRefsDocsTopic(TEST_REFS, 'shared')).toEqual({ found: false, reason: 'ambiguous', candidates: ['alpha/shared', 'beta/shared'] });
  });

  it('should report an unknown topic with every topic as candidates', () => {
    const result = resolvePackageRefsDocsTopic(TEST_REFS, 'nope');
    expect(result).toEqual({ found: false, reason: 'not-found', candidates: packageRefsDocsTopics(TEST_REFS) });
  });

  it('should report an unknown <ref>/<doc> as not found', () => {
    expect(resolvePackageRefsDocsTopic(TEST_REFS, 'gamma/setup').found).toBe(false);
  });
});

describe('buildPackageRefsDocsIndex()', () => {
  it('should read titles from headings and the description from frontmatter', () => {
    expect(buildPackageRefsDocsIndex(TEST_REFS)).toEqual([
      { topic: 'alpha', title: 'Alpha', description: 'The alpha ref.' },
      { topic: 'alpha/setup', title: 'Setup' },
      { topic: 'alpha/shared', title: 'Alpha Shared' },
      { topic: 'beta', title: 'Beta' },
      { topic: 'beta/shared', title: 'beta/shared' },
      { topic: 'gamma', title: 'gamma' }
    ]);
  });
});

describe('renderPackageRefsDocsIndexMarkdown()', () => {
  it('should render one row per topic and a closing run line', () => {
    const markdown = renderPackageRefsDocsIndexMarkdown(TEST_REFS, 'acme-cli');
    expect(markdown).toContain('# acme-cli docs');
    expect(markdown).toContain('`@acme/pkg`');
    expect(markdown).toContain('- `alpha`: Alpha — The alpha ref.');
    expect(markdown).toContain('- `alpha/setup`: Setup');
    expect(markdown.trimEnd().endsWith('Run: acme-cli docs <topic>')).toBe(true);
  });
});
