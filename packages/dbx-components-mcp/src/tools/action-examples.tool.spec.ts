import { describe, expect, it } from 'vitest';
import { runActionExamples } from './action-examples.tool.js';
import { ACTION_EXAMPLE_PATTERNS } from './data/patterns/action-patterns.js';

function firstText(result: ReturnType<typeof runActionExamples>): string {
  expect(result.content.length).toBeGreaterThan(0);
  const first = result.content[0];
  expect(first.type).toBe('text');
  return first.text;
}

describe('dbx_action_examples', () => {
  it('rejects missing pattern via arktype', () => {
    const result = runActionExamples({});
    expect(result.isError).toBe(true);
    expect(firstText(result)).toMatch(/Invalid arguments/);
  });

  it('renders the pattern catalog for "list"', () => {
    const text = firstText(runActionExamples({ pattern: 'list' }));
    expect(text).toMatch(/# Action example patterns/);
    for (const pattern of ACTION_EXAMPLE_PATTERNS) {
      expect(text).toContain(pattern.slug);
    }
  });

  it('returns the full snippet by default', () => {
    const text = firstText(runActionExamples({ pattern: 'button-confirm-delete' }));
    expect(text).toMatch(/# Button \+ confirm \+ delete/);
    expect(text).toMatch(/\*\*depth:\*\* `full`/);
    expect(text).toMatch(/dbxAction/);
    expect(text).toMatch(/handleDelete/);
  });

  it('returns the minimal snippet when requested', () => {
    const text = firstText(runActionExamples({ pattern: 'button-confirm-delete', depth: 'minimal' }));
    expect(text).toMatch(/\*\*depth:\*\* `minimal`/);
    expect(text).not.toMatch(/handleDelete: Work<void/);
    expect(text).toMatch(/dbxActionValue/);
    expect(text).toMatch(/dbx_action_examples pattern="button-confirm-delete" depth="full"/);
  });

  it('surfaces notes in full depth when present', () => {
    const text = firstText(runActionExamples({ pattern: 'form-submit', depth: 'full' }));
    expect(text).toMatch(/## Notes/);
  });

  it('uses an html fence on minimal/brief depths and a ts fence on full', () => {
    const minimal = firstText(runActionExamples({ pattern: 'button-confirm-delete', depth: 'minimal' }));
    expect(minimal).toMatch(/```html/);
    const full = firstText(runActionExamples({ pattern: 'button-confirm-delete', depth: 'full' }));
    expect(full).toMatch(/```ts/);
  });

  it('falls back gracefully on unknown pattern', () => {
    const text = firstText(runActionExamples({ pattern: 'not-a-real-pattern' }));
    expect(text).toMatch(/No action example pattern matched/);
    expect(text).toMatch(/Available patterns:/);
  });
});
