/**
 * Formatter specs for the `dbx_model_test_*` cluster.
 *
 * Verifies that each view mode produces a non-empty markdown body and that
 * filters narrow the output as expected.
 */

import { describe, expect, it } from 'vitest';
import { extractSpecTreeFromText } from './extract.js';
import { formatTreeAsMarkdown } from './format.markdown.js';
import { formatTreeAsJson } from './format.json.js';

const SPEC = `import { hellosubsApiFunctionContextFactory, hellosubsCountryContext, hellosubsJobContext } from '../../../test/fixture';
hellosubsApiFunctionContextFactory((f) => {
  describe('admin', () => {
    hellosubsCountryContext({ f }, (rc) => {
      describe('jobs', () => {
        hellosubsJobContext({ f }, (j) => {
          it('publishes', () => {});
          it('cancels', () => {});
        });
      });
    });
  });
});
`;

describe('formatTreeAsMarkdown', () => {
  it('renders the all view with both describes and fixtures', () => {
    const tree = extractSpecTreeFromText({ text: SPEC, specPath: 'spec.ts' });
    const md = formatTreeAsMarkdown(tree, 'all');
    expect(md).toContain('describe');
    expect(md).toContain('fixture');
    expect(md).toContain('Country');
    expect(md).toContain('publishes');
  });

  it('describes view drops fixtures', () => {
    const tree = extractSpecTreeFromText({ text: SPEC, specPath: 'spec.ts' });
    const md = formatTreeAsMarkdown(tree, 'describes');
    expect(md).not.toContain('**fixture**');
    expect(md).toContain('admin');
    expect(md).toContain('jobs');
    expect(md).toContain('publishes');
  });

  it('fixtures view drops describes', () => {
    const tree = extractSpecTreeFromText({ text: SPEC, specPath: 'spec.ts' });
    const md = formatTreeAsMarkdown(tree, 'fixtures');
    expect(md).not.toContain('**describe**');
    expect(md).toContain('Country');
    expect(md).toContain('Job');
  });

  it('its view emits a flat index with describe paths', () => {
    const tree = extractSpecTreeFromText({ text: SPEC, specPath: 'spec.ts' });
    const md = formatTreeAsMarkdown(tree, 'its');
    expect(md).toContain('admin > jobs > `publishes`');
    expect(md).toContain('admin > jobs > `cancels`');
  });

  it('helpers view renders the helpers table', () => {
    const text = `function describeFoo() { describe('a', () => { it('b', () => {}); }); }\n`;
    const tree = extractSpecTreeFromText({ text, specPath: 'spec.ts' });
    const md = formatTreeAsMarkdown(tree, 'helpers');
    expect(md).toContain('describeFoo');
  });

  it('filterByModel narrows to subtrees containing that model', () => {
    const tree = extractSpecTreeFromText({ text: SPEC, specPath: 'spec.ts' });
    const md = formatTreeAsMarkdown(tree, 'all', { filterByModel: 'Job' });
    expect(md).toContain('Country');
    expect(md).toContain('Job');
  });
});

describe('formatTreeAsJson', () => {
  it('returns a JSON document with the requested view + filters', () => {
    const tree = extractSpecTreeFromText({ text: SPEC, specPath: 'spec.ts' });
    const json = formatTreeAsJson(tree, 'all');
    const parsed = JSON.parse(json);
    expect(parsed.specPath).toBe('spec.ts');
    expect(parsed.view).toBe('all');
    expect(parsed.counts.its).toBe(2);
  });

  it('its view returns flat list', () => {
    const tree = extractSpecTreeFromText({ text: SPEC, specPath: 'spec.ts' });
    const json = formatTreeAsJson(tree, 'its');
    const parsed = JSON.parse(json);
    expect(parsed.its).toHaveLength(2);
    expect(parsed.its[0].describePath).toEqual(['admin', 'jobs']);
  });
});
