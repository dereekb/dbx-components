import { describe, expect, it } from 'vitest';
import { runSearchForge } from './search-forge.tool.js';

function firstText(result: ReturnType<typeof runSearchForge>): string {
  expect(result.content.length).toBeGreaterThan(0);
  const first = result.content[0];
  expect(first.type).toBe('text');
  return first.text;
}

describe('dbx_form_search', () => {
  it('rejects missing query via arktype', () => {
    const result = runSearchForge({});
    expect(result.isError).toBe(true);
    expect(firstText(result)).toMatch(/Invalid arguments/);
  });

  it('ranks exact slug matches highest', () => {
    const text = firstText(runSearchForge({ query: 'phone' }));
    expect(text).toMatch(/# Search: `phone`/);
    const firstResult = /## `([^`]+)`/.exec(text);
    expect(firstResult?.[1]).toBe('phone');
  });

  it('expands aliases as OR alternatives before searching', () => {
    const text = firstText(runSearchForge({ query: 'datepicker' }));
    expect(text).toMatch(/Tokens: `datepicker → date`/);
    expect(text).toMatch(/## `date`/);
  });

  it('broad queries hit substring matches not just aliased exact targets', () => {
    const text = firstText(runSearchForge({ query: 'address' }));
    expect(text).toMatch(/address-group/);
    expect(text).toMatch(/address-line/);
    expect(text).toMatch(/address-list/);
  });

  it('AND-combines multi-word queries', () => {
    const text = firstText(runSearchForge({ query: 'searchable chip' }));
    expect(text).toMatch(/searchable-chip/);
    expect(text).not.toMatch(/## `text`/);
  });

  it('matches by produces value', () => {
    const text = firstText(runSearchForge({ query: 'RowField' }));
    expect(text).toMatch(/row/);
    expect(text).toMatch(/date-range-row/);
  });

  it('respects the limit cap', () => {
    const text = firstText(runSearchForge({ query: 'field', limit: 3 }));
    const resultSections = text.match(/## `[^`]+`/g) ?? [];
    expect(resultSections.length).toBeLessThanOrEqual(3);
  });

  it('returns a friendly message when nothing matches', () => {
    const text = firstText(runSearchForge({ query: 'zzzz-nothing-here' }));
    expect(text).toMatch(/No forge entries matched/);
  });
});
