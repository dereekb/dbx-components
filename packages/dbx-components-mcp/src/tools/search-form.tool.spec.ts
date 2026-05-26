import { describe, expect, it } from 'vitest';
import { FORM_FIELDS, createForgeFieldRegistryFromEntries } from '@dereekb/dbx-cli';
import { createSearchFormTool } from './search-form.tool.js';

const tool = createSearchFormTool({
  registry: createForgeFieldRegistryFromEntries({ entries: FORM_FIELDS, loadedSources: ['@dereekb/dbx-form'] })
});

function firstText(result: ReturnType<typeof tool.run>): string {
  expect(result.content.length).toBeGreaterThan(0);
  const first = result.content[0];
  expect(first.type).toBe('text');
  return first.text;
}

describe('dbx_form_search', () => {
  it('rejects missing query via arktype', () => {
    const result = tool.run({});
    expect(result.isError).toBe(true);
    expect(firstText(result)).toMatch(/Invalid arguments/);
  });

  it('ranks exact slug matches highest', () => {
    const text = firstText(tool.run({ query: 'phone' }));
    expect(text).toMatch(/# Search: `phone`/);
    const firstResult = /## `([^`]+)`/.exec(text);
    expect(firstResult?.[1]).toBe('phone');
  });

  it('expands aliases as OR alternatives before searching', () => {
    const text = firstText(tool.run({ query: 'datepicker' }));
    expect(text).toMatch(/Tokens: `datepicker → date`/);
    expect(text).toMatch(/## `date`/);
  });

  it('broad queries hit substring matches not just aliased exact targets', () => {
    const text = firstText(tool.run({ query: 'address' }));
    expect(text).toMatch(/address-group/);
    expect(text).toMatch(/address-line/);
    expect(text).toMatch(/address-list/);
  });

  it('AND-combines multi-word queries', () => {
    const text = firstText(tool.run({ query: 'searchable chip' }));
    expect(text).toMatch(/searchable-chip/);
    expect(text).not.toMatch(/## `text`/);
  });

  it('matches by produces value', () => {
    const text = firstText(tool.run({ query: 'RowField' }));
    expect(text).toMatch(/row/);
    expect(text).toMatch(/date-range-row/);
  });

  it('respects the limit cap', () => {
    const text = firstText(tool.run({ query: 'field', limit: 3 }));
    const resultSections = text.match(/## `[^`]+`/g) ?? [];
    expect(resultSections.length).toBeLessThanOrEqual(3);
  });

  it('returns a friendly message when nothing matches', () => {
    const text = firstText(tool.run({ query: 'zzzz-nothing-here' }));
    expect(text).toMatch(/No form entries matched/);
  });

  it('aliases dbx-list to list-selection so the dbx-list query lands on the right entry', () => {
    const text = firstText(tool.run({ query: 'dbx-list' }));
    expect(text).toMatch(/Tokens: `dbx-list → list-selection`/);
    expect(text).toMatch(/## `list-selection`/);
  });

  it('scores by ngFormType so unaliased ng-forge type names surface their factory', () => {
    const text = firstText(tool.run({ query: 'dbx-pickable-list' }));
    expect(text).toMatch(/## `pickable-list`/);
  });
});
