import { describe, expect, it } from 'vitest';
import { type DocsListResult, type DocsSearchResult } from '@dereekb/firebase';
import { renderDocsListMarkdown, renderDocsSearchMarkdown } from './docs-api.render';

const LIST: DocsListResult = {
  docs: [
    {
      id: 'guestbook/signing',
      title: 'Signing a guestbook',
      description: 'How entries are signed.',
      tags: ['guestbook', 'entries'],
      sections: [
        { id: 'overview', title: 'Overview', depth: 2 },
        { id: 'details', title: 'Details', depth: 3 }
      ]
    },
    { id: 'getting-started', title: 'Getting started', sections: [] }
  ]
};

describe('renderDocsListMarkdown()', () => {
  it('should render one line per doc and the read footer', () => {
    const markdown = renderDocsListMarkdown(LIST, { cliName: 'demo-cli' });
    expect(markdown).toContain('# Docs you can read (2)');
    expect(markdown).toContain('- `guestbook/signing` — Signing a guestbook. How entries are signed. _(tags: guestbook, entries)_');
    expect(markdown).toContain('- `getting-started` — Getting started.');
    expect(markdown).toContain('`demo-cli docs read <id> [section]`');
    expect(markdown).not.toContain('`overview`');
  });

  it('should list section ids indented by depth with sections', () => {
    const markdown = renderDocsListMarkdown(LIST, { cliName: 'demo-cli', sections: true });
    expect(markdown).toContain('\n  - `overview` Overview');
    expect(markdown).toContain('\n    - `details` Details');
  });

  it('should use the command name in the footer', () => {
    expect(renderDocsListMarkdown(LIST, { cliName: 'demo-cli', commandName: 'app-docs' })).toContain('`demo-cli app-docs search <words..>`');
  });

  it('should explain an empty list', () => {
    expect(renderDocsListMarkdown({ docs: [] })).toContain('No docs are visible to this login.');
  });
});

describe('renderDocsSearchMarkdown()', () => {
  const RESULT: DocsSearchResult = {
    total: 3,
    results: [
      { id: 'guestbook/signing', title: 'Signing a guestbook', description: 'How entries are signed.' },
      { id: 'guestbook/signing', title: 'Signing a guestbook', section: { id: 'overview', title: 'Overview' } }
    ]
  };

  it('should render doc and section hits with the limit hint', () => {
    const markdown = renderDocsSearchMarkdown(RESULT, { query: 'guestbook', cliName: 'demo-cli' });
    expect(markdown).toContain('# Docs matching "guestbook" (2 of 3)');
    expect(markdown).toContain('- `guestbook/signing` — Signing a guestbook. How entries are signed.');
    expect(markdown).toContain('- `guestbook/signing` § `overview` — Overview');
    expect(markdown).toContain('Showing 2 of 3; raise `--limit` (max 50) for more.');
    expect(markdown).not.toContain('_No doc matched every word');
  });

  it('should note a partial match', () => {
    expect(renderDocsSearchMarkdown({ ...RESULT, total: 2, partial: true }, { query: 'guestbook zebra' })).toContain('_No doc matched every word; these match some of them._');
  });

  it('should omit the limit hint when every hit is shown', () => {
    expect(renderDocsSearchMarkdown({ ...RESULT, total: 2 }, { query: 'guestbook' })).not.toContain('raise `--limit`');
  });

  it('should explain no hits', () => {
    expect(renderDocsSearchMarkdown({ total: 0, results: [] }, { query: 'zebra', cliName: 'demo-cli' })).toBe('No docs match "zebra". List the docs you can read: `demo-cli docs list`.');
  });
});
