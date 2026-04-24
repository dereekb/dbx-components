import { describe, expect, it } from 'vitest';
import { runExamples } from './examples.tool.js';
import { EXAMPLE_PATTERNS } from './data/patterns.js';

function firstText(result: ReturnType<typeof runExamples>): string {
  expect(result.content.length).toBeGreaterThan(0);
  const first = result.content[0];
  expect(first.type).toBe('text');
  return first.text;
}

describe('dbx_examples', () => {
  it('rejects missing pattern via arktype', () => {
    const result = runExamples({});
    expect(result.isError).toBe(true);
    expect(firstText(result)).toMatch(/Invalid arguments/);
  });

  it('renders the pattern catalog for "list"', () => {
    const text = firstText(runExamples({ pattern: 'list' }));
    expect(text).toMatch(/# Forge example patterns/);
    for (const pattern of EXAMPLE_PATTERNS) {
      expect(text).toContain(pattern.slug);
    }
  });

  it('returns the full snippet by default', () => {
    const text = firstText(runExamples({ pattern: 'contact-form' }));
    expect(text).toMatch(/# Contact form/);
    expect(text).toMatch(/\*\*depth:\*\* `full`/);
    expect(text).toMatch(/dbxForgeNameField/);
    expect(text).toMatch(/ContactFormValue/);
  });

  it('returns the minimal snippet when requested', () => {
    const text = firstText(runExamples({ pattern: 'contact-form', depth: 'minimal' }));
    expect(text).toMatch(/\*\*depth:\*\* `minimal`/);
    expect(text).not.toMatch(/ContactFormValue/);
    expect(text).toMatch(/dbxForgeNameField/);
    expect(text).toMatch(/dbx_examples pattern="contact-form" depth="full"/);
  });

  it('surfaces notes in full depth when present', () => {
    const text = firstText(runExamples({ pattern: 'sign-up-form', depth: 'full' }));
    expect(text).toMatch(/## Notes/);
  });

  it('falls back gracefully on unknown pattern', () => {
    const text = firstText(runExamples({ pattern: 'not-a-real-pattern' }));
    expect(text).toMatch(/No example pattern matched/);
    expect(text).toMatch(/Available patterns:/);
  });
});
