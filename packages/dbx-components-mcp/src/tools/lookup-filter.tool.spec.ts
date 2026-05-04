import { describe, expect, it } from 'vitest';
import { createFilterRegistryFromEntries, type FilterEntryInfo } from '../registry/filters-runtime.js';
import { createLookupFilterTool } from './lookup-filter.tool.js';

const FIXTURE_ENTRIES: readonly FilterEntryInfo[] = [
  {
    slug: 'source',
    kind: 'directive',
    className: 'DbxFilterSourceDirective',
    selector: '[dbxFilterSource]',
    module: '@dereekb/dbx-core',
    description: 'Provides a FilterSource in DI so child components can inject and consume the current filter value.',
    inputs: [],
    outputs: [],
    relatedSlugs: ['connect-source', 'source-connector', 'map-source'],
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    example: '<div dbxFilterSource>\n  <my-filter-form></my-filter-form>\n</div>'
  },
  {
    slug: 'map',
    kind: 'directive',
    className: 'DbxFilterMapDirective',
    selector: '[dbxFilterMap]',
    module: '@dereekb/dbx-core',
    description: 'Provides a FilterMap instance in DI so multiple child sources can register and look up filters by string key.',
    inputs: [],
    outputs: [],
    relatedSlugs: ['map-source', 'map-source-connector'],
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    example: '<div dbxFilterMap><div [dbxFilterMapSource]="\'a\'"></div></div>'
  },
  {
    slug: 'map-source',
    kind: 'directive',
    className: 'DbxFilterMapSourceDirective',
    selector: '[dbxFilterMapSource]',
    module: '@dereekb/dbx-core',
    description: 'Provides a FilterSource for a keyed entry in an ancestor FilterMap.',
    inputs: [{ name: 'dbxFilterMapSource', type: 'Maybe<FilterMapKey>', description: 'The map key this source binds to.' }],
    outputs: [],
    relatedSlugs: ['map', 'map-source-connector'],
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    example: '<div dbxFilterMap><div [dbxFilterMapSource]="\'k\'"></div></div>'
  },
  {
    slug: 'clickable-preset',
    kind: 'pattern',
    className: 'ClickableFilterPreset',
    selector: undefined,
    module: '@dereekb/dbx-core',
    description: 'Pattern for declaring a preset filter chip — combines an anchor display with a preset string identifier.',
    inputs: [],
    outputs: [],
    relatedSlugs: ['source'],
    skillRefs: ['dbx__ref__dbx-component-patterns'],
    example: "const preset: ClickableFilterPreset<F> = { preset: 'a', title: 'A', presetValue: { preset: 'a' } };"
  }
];

const tool = createLookupFilterTool({
  registry: createFilterRegistryFromEntries({ entries: FIXTURE_ENTRIES, loadedSources: ['@dereekb/dbx-core'] })
});

function runLookupFilter(args: unknown): { isError?: boolean; content: { type: string; text: string }[] } {
  return tool.run(args) as { isError?: boolean; content: { type: string; text: string }[] };
}

describe('dbx_filter_lookup', () => {
  it('returns isError when topic is missing', () => {
    const result = runLookupFilter({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid arguments');
  });

  it('returns the catalog for topic="list"', () => {
    const result = runLookupFilter({ topic: 'list' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('# Filter catalog');
    expect(result.content[0].text).toContain('source');
    expect(result.content[0].text).toContain('clickable-preset');
  });

  it('matches by slug', () => {
    const result = runLookupFilter({ topic: 'source' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('# DbxFilterSourceDirective');
    expect(result.content[0].text).toContain('[dbxFilterSource]');
  });

  it('matches by selector with brackets', () => {
    const result = runLookupFilter({ topic: '[dbxFilterMap]' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('# DbxFilterMapDirective');
  });

  it('matches by selector without brackets', () => {
    const result = runLookupFilter({ topic: 'dbxFilterSource' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('# DbxFilterSourceDirective');
  });

  it('matches by class name', () => {
    const result = runLookupFilter({ topic: 'DbxFilterMapSourceDirective' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('# DbxFilterMapSourceDirective');
  });

  it('respects depth=brief', () => {
    const result = runLookupFilter({ topic: 'source', depth: 'brief' });
    expect(result.content[0].text).not.toContain('## Example');
    expect(result.content[0].text).toContain('depth="full"');
  });

  it('returns fuzzy candidates on miss', () => {
    const result = runLookupFilter({ topic: 'fltr' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No filter entry matched');
  });

  it('renders the pattern entry with a TS code block', () => {
    const result = runLookupFilter({ topic: 'clickable-preset' });
    expect(result.content[0].text).toContain('# ClickableFilterPreset');
    expect(result.content[0].text).toContain('```ts');
  });
});
