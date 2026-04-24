import { describe, expect, it } from 'vitest';
import { runSearch } from './search.tool.js';

function firstText(result: ReturnType<typeof runSearch>): string {
  expect(result.content.length).toBeGreaterThan(0);
  const first = result.content[0];
  expect(first.type).toBe('text');
  return first.text;
}

describe('dbx_search', () => {
  it('rejects missing query via arktype', () => {
    const result = runSearch({});
    expect(result.isError).toBe(true);
    expect(firstText(result)).toMatch(/Invalid arguments/);
  });

  it('ranks exact slug matches highest', () => {
    const text = firstText(runSearch({ query: 'phone' }));
    expect(text).toMatch(/# Search: `phone`/);
    const firstResult = /## `([^`]+)`/.exec(text);
    expect(firstResult?.[1]).toBe('phone');
  });

  it('expands aliases as OR alternatives before searching', () => {
    const text = firstText(runSearch({ query: 'datepicker' }));
    expect(text).toMatch(/Tokens: `datepicker → date`/);
    expect(text).toMatch(/## `date`/);
  });

  it('broad queries hit substring matches not just aliased exact targets', () => {
    // "address" aliases to "address-group"; raw substring hits should still
    // surface address-line, address-list, etc.
    const text = firstText(runSearch({ query: 'address' }));
    expect(text).toMatch(/address-group/);
    expect(text).toMatch(/address-line/);
    expect(text).toMatch(/address-list/);
  });

  it('AND-combines multi-word queries', () => {
    const text = firstText(runSearch({ query: 'searchable chip' }));
    expect(text).toMatch(/searchable-chip/);
    expect(text).not.toMatch(/## `text`/);
  });

  it('matches by produces value', () => {
    const text = firstText(runSearch({ query: 'RowField' }));
    expect(text).toMatch(/row/);
    expect(text).toMatch(/date-range-row/);
  });

  it('respects the limit cap', () => {
    const text = firstText(runSearch({ query: 'field', limit: 3 }));
    const resultSections = text.match(/## `[^`]+`/g) ?? [];
    expect(resultSections.length).toBeLessThanOrEqual(3);
  });

  it('returns a friendly message when nothing matches', () => {
    const text = firstText(runSearch({ query: 'zzzz-nothing-here' }));
    expect(text).toMatch(/No results matched/);
  });

  it('includes Firebase models in the result set', () => {
    const text = firstText(runSearch({ query: 'StorageFile' }));
    expect(text).toMatch(/# Search: `StorageFile`/);
    expect(text).toMatch(/StorageFile.*firebase model/);
    expect(text).toMatch(/\*\*identity:\*\* `storageFileIdentity`/);
  });

  it('ranks collection prefix matches for Firebase models', () => {
    const text = firstText(runSearch({ query: 'nb' }));
    expect(text).toMatch(/NotificationBox.*firebase model/);
  });

  it('surfaces the decode-tool hint in Firebase results', () => {
    const text = firstText(runSearch({ query: 'StorageFileGroup' }));
    expect(text).toMatch(/dbx_decode/);
  });
});
