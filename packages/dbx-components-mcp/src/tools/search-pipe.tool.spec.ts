import { describe, expect, it } from 'vitest';
import { createPipeRegistryFromEntries, type PipeEntryInfo } from '@dereekb/dbx-cli';
import { createSearchPipeTool } from './search-pipe.tool.js';

const FIXTURE_ENTRIES: readonly PipeEntryInfo[] = [
  {
    slug: 'dollar-amount',
    category: 'value',
    pipeName: 'dollarAmount',
    className: 'DollarAmountPipe',
    module: '@dereekb/dbx-core',
    inputType: 'Maybe<number>',
    outputType: 'Maybe<string>',
    purity: 'pure',
    description: 'Formats a numeric value as a US dollar string.',
    args: [],
    relatedSlugs: [],
    skillRefs: [],
    example: '<span>{{ amount | dollarAmount }}</span>'
  },
  {
    slug: 'date-distance',
    category: 'date',
    pipeName: 'dateDistance',
    className: 'DateDistancePipe',
    module: '@dereekb/dbx-core',
    inputType: 'Maybe<Date>',
    outputType: 'Maybe<string>',
    purity: 'pure',
    description: 'Renders the distance between a date and now.',
    args: [],
    relatedSlugs: [],
    skillRefs: [],
    example: '<span>{{ d | dateDistance }}</span>'
  },
  {
    slug: 'as-observable',
    category: 'async',
    pipeName: 'asObservable',
    className: 'AsObservablePipe',
    module: '@dereekb/dbx-core',
    inputType: 'Observable<T>',
    outputType: 'Observable<T>',
    purity: 'pure',
    description: 'Coerces a value or observable to an observable.',
    args: [],
    relatedSlugs: [],
    skillRefs: [],
    example: '<span>{{ x | asObservable | async }}</span>'
  }
];

const REGISTRY = createPipeRegistryFromEntries({ entries: FIXTURE_ENTRIES, loadedSources: ['fixture'] });
const TOOL = createSearchPipeTool({ registry: REGISTRY });

describe('dbx_pipe_search', () => {
  it('exact slug match ranks first', async () => {
    const result = (await TOOL.run({ query: 'dollar-amount' })) as { isError?: boolean; content: { text: string }[] };
    expect(result.isError).toBeFalsy();
    const text = result.content[0].text;
    expect(text).toContain('## `dollar-amount`');
  });

  it('pipe name match scores high', async () => {
    const result = (await TOOL.run({ query: 'dateDistance' })) as { content: { text: string }[] };
    const text = result.content[0].text;
    expect(text).toMatch(/^# Search: `dateDistance`/);
    expect(text).toContain('## `date-distance`');
  });

  it('category match ranks pipes in that category above unrelated entries', async () => {
    const result = (await TOOL.run({ query: 'date' })) as { content: { text: string }[] };
    const text = result.content[0].text;
    // `date-distance` has slug + category + pipeName + className + inputType matches, so it must rank first.
    const firstHeader = text.split('\n').find((line) => line.startsWith('## `'));
    expect(firstHeader).toContain('date-distance');
  });

  it('returns empty-state on no matches', async () => {
    const result = (await TOOL.run({ query: 'qqqzz' })) as { content: { text: string }[] };
    expect(result.content[0].text).toContain('No pipes matched');
  });

  it('caps results at limit', async () => {
    const result = (await TOOL.run({ query: 'pipe', limit: 1 })) as { content: { text: string }[] };
    const text = result.content[0].text;
    const matches = text.match(/^## `/gm) ?? [];
    expect(matches.length).toBeLessThanOrEqual(1);
  });

  it('rejects missing query', async () => {
    const result = (await TOOL.run({})) as { isError?: boolean; content: { text: string }[] };
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid arguments');
  });
});
