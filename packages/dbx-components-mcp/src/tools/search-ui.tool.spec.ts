import { describe, expect, it } from 'vitest';
import { runSearchUi } from './search-ui.tool.js';

function firstText(result: ReturnType<typeof runSearchUi>): string {
  expect(result.content.length).toBeGreaterThan(0);
  const first = result.content[0];
  expect(first.type).toBe('text');
  return first.text;
}

describe('dbx_ui_search', () => {
  it('rejects missing query via arktype', () => {
    const result = runSearchUi({});
    expect(result.isError).toBe(true);
    expect(firstText(result)).toMatch(/Invalid arguments/);
  });

  it('ranks exact slug matches highest', () => {
    const text = firstText(runSearchUi({ query: 'section' }));
    expect(text).toMatch(/# Search: `section`/);
    const firstResult = /## `([^`]+)`/.exec(text);
    expect(firstResult?.[1]).toBe('section');
  });

  it('matches "loading" against multiple loading-prefixed entries', () => {
    const text = firstText(runSearchUi({ query: 'loading' }));
    expect(text).toMatch(/loading/);
    expect(text).toMatch(/loading-progress|basic-loading/);
  });

  it('AND-combines multi-word queries', () => {
    const text = firstText(runSearchUi({ query: 'two column' }));
    expect(text).toMatch(/two-column/);
  });

  it('respects category filter', () => {
    const text = firstText(runSearchUi({ query: 'list', category: 'list' }));
    expect(text).toMatch(/category=`list`/);
    expect(text).toMatch(/## `list`/);
  });

  it('respects the limit cap', () => {
    const text = firstText(runSearchUi({ query: 'list', limit: 2 }));
    const resultSections = text.match(/## `[^`]+`/g) ?? [];
    expect(resultSections.length).toBeLessThanOrEqual(2);
  });

  it('matches by selector substring', () => {
    const text = firstText(runSearchUi({ query: 'dbx-button' }));
    expect(text).toMatch(/## `button`/);
  });

  it('returns a friendly message when nothing matches', () => {
    const text = firstText(runSearchUi({ query: 'zzzz-nothing-here' }));
    expect(text).toMatch(/No UI components matched/);
  });
});
