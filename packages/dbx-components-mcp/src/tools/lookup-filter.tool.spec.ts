import { describe, expect, it } from 'vitest';
import { runLookupFilter } from './lookup-filter.tool.js';

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
