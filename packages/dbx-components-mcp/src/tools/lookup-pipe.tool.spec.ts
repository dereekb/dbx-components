import { describe, expect, it } from 'vitest';
import { createPipeRegistryFromEntries, type PipeEntryInfo } from '../registry/pipes-runtime.js';
import { createLookupPipeTool } from './lookup-pipe.tool.js';

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
    args: [{ name: 'defaultIfNull', type: 'Maybe<string>', description: 'Fallback when input is null.', required: false }],
    relatedSlugs: [],
    skillRefs: ['dbx-value-pipes'],
    example: '<span>{{ amount | dollarAmount }}</span>'
  },
  {
    slug: 'cut-text',
    category: 'value',
    pipeName: 'cutText',
    className: 'CutTextPipe',
    module: '@dereekb/dbx-core',
    inputType: 'Maybe<string>',
    outputType: 'Maybe<string>',
    purity: 'pure',
    description: 'Truncates a string to a maximum length.',
    args: [
      { name: 'maxLength', type: 'number', description: 'Maximum allowed length before truncation.', required: true },
      { name: 'endText', type: 'Maybe<string>', description: 'Suffix appended on truncation.', required: false }
    ],
    relatedSlugs: [],
    skillRefs: ['dbx-value-pipes'],
    example: '<span>{{ text | cutText:5 }}</span>'
  },
  {
    slug: 'get-value',
    category: 'value',
    pipeName: 'getValue',
    className: 'GetValuePipe',
    module: '@dereekb/dbx-core',
    inputType: 'GetterOrValue<T>',
    outputType: 'T',
    purity: 'impure',
    description: 'Resolves a getter/value to its underlying value.',
    args: [],
    relatedSlugs: ['get-value-once'],
    skillRefs: ['dbx-value-pipes'],
    example: '<span>{{ getter | getValue }}</span>'
  },
  {
    slug: 'as-observable',
    category: 'async',
    pipeName: 'asObservable',
    className: 'AsObservablePipe',
    module: '@dereekb/dbx-core',
    inputType: 'ObservableOrValueGetter<T>',
    outputType: 'Observable<T>',
    purity: 'pure',
    description: 'Normalizes a value/getter/Observable into an Observable.',
    args: [],
    relatedSlugs: [],
    skillRefs: [],
    example: '<span>{{ value | asObservable | async }}</span>'
  },
  {
    slug: 'date-distance',
    category: 'date',
    pipeName: 'dateDistance',
    className: 'DateDistancePipe',
    module: '@dereekb/dbx-core',
    inputType: 'Maybe<DateOrDateString>',
    outputType: 'string',
    purity: 'impure',
    description: 'Formats the distance between two dates.',
    args: [],
    relatedSlugs: [],
    skillRefs: [],
    example: '<span>{{ d | dateDistance }}</span>'
  },
  {
    slug: 'date-time-range',
    category: 'date',
    pipeName: 'dateTimeRange',
    className: 'DateTimeRangePipe',
    module: '@dereekb/dbx-core',
    inputType: 'Maybe<DateRange>',
    outputType: 'string',
    purity: 'pure',
    description: 'Formats a DateRange as a time range string.',
    args: [],
    relatedSlugs: [],
    skillRefs: [],
    example: '<span>{{ range | dateTimeRange }}</span>'
  }
];

const tool = createLookupPipeTool({
  registry: createPipeRegistryFromEntries({ entries: FIXTURE_ENTRIES, loadedSources: ['@dereekb/dbx-core'] })
});

function runLookupPipe(args: unknown): { isError?: boolean; content: { type: string; text: string }[] } {
  return tool.run(args) as { isError?: boolean; content: { type: string; text: string }[] };
}

describe('dbx_pipe_lookup', () => {
  it('returns isError when topic is missing', () => {
    const result = runLookupPipe({});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Invalid arguments');
  });

  it('returns the catalog for topic="list"', () => {
    const result = runLookupPipe({ topic: 'list' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('# Pipe catalog');
    expect(result.content[0].text).toContain('dollar-amount');
    expect(result.content[0].text).toContain('date-distance');
  });

  it('groups the catalog by category', () => {
    const result = runLookupPipe({ topic: 'catalog' });
    expect(result.content[0].text).toContain('## value');
    expect(result.content[0].text).toContain('## date');
    expect(result.content[0].text).toContain('## async');
  });

  it('matches by slug', () => {
    const result = runLookupPipe({ topic: 'dollar-amount' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('# DollarAmountPipe');
    expect(result.content[0].text).toContain('`dollarAmount`');
    expect(result.content[0].text).toContain('Maybe<number>');
  });

  it('matches by Angular pipe name', () => {
    const result = runLookupPipe({ topic: 'getValue' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('# GetValuePipe');
    expect(result.content[0].text).toContain('`impure`');
  });

  it('matches by class name', () => {
    const result = runLookupPipe({ topic: 'DateTimeRangePipe' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('# DateTimeRangePipe');
    expect(result.content[0].text).toContain('`dateTimeRange`');
  });

  it('renders args table when args are present', () => {
    const result = runLookupPipe({ topic: 'cut-text' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain('## Args');
    expect(result.content[0].text).toContain('`maxLength`');
    expect(result.content[0].text).toContain('| yes |');
  });

  it('omits args section when args are empty', () => {
    const result = runLookupPipe({ topic: 'as-observable' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).not.toContain('## Args');
    expect(result.content[0].text).toContain('## Example');
  });

  it('respects depth=brief', () => {
    const result = runLookupPipe({ topic: 'dollar-amount', depth: 'brief' });
    expect(result.content[0].text).not.toContain('## Example');
    expect(result.content[0].text).toContain('depth="full"');
  });

  it('returns fuzzy candidates on miss', () => {
    const result = runLookupPipe({ topic: 'doll' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('No pipe entry matched');
    expect(result.content[0].text).toContain('dollar-amount');
  });

  it('returns a not-found pointer to the catalog when no candidates score', () => {
    const result = runLookupPipe({ topic: 'totallyUnrelatedTopicXYZ' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Try `dbx_pipe_lookup topic="list"`');
  });

  it('renders example as an HTML code fence', () => {
    const result = runLookupPipe({ topic: 'date-time-range' });
    expect(result.content[0].text).toContain('```html');
  });
});
