import { describe, expect, it } from 'vitest';
import { runUiExamples } from './ui-examples.tool.js';
import { UI_PATTERNS } from './data/ui-patterns.js';

function firstText(result: ReturnType<typeof runUiExamples>): string {
  expect(result.content.length).toBeGreaterThan(0);
  const first = result.content[0];
  expect(first.type).toBe('text');
  return first.text;
}

describe('dbx_ui_examples', () => {
  it('rejects missing pattern via arktype', () => {
    const result = runUiExamples({});
    expect(result.isError).toBe(true);
    expect(firstText(result)).toMatch(/Invalid arguments/);
  });

  it('renders the pattern catalog for "list"', () => {
    const text = firstText(runUiExamples({ pattern: 'list' }));
    expect(text).toMatch(/# UI example patterns/);
    for (const pattern of UI_PATTERNS) {
      expect(text).toContain(pattern.slug);
    }
  });

  it('returns the full snippet by default', () => {
    const text = firstText(runUiExamples({ pattern: 'settings-section' }));
    expect(text).toMatch(/# Settings section/);
    expect(text).toMatch(/\*\*depth:\*\* `full`/);
    expect(text).toMatch(/dbx-section/);
  });

  it('returns the minimal snippet when requested', () => {
    const text = firstText(runUiExamples({ pattern: 'settings-section', depth: 'minimal' }));
    expect(text).toMatch(/\*\*depth:\*\* `minimal`/);
    expect(text).toMatch(/dbx_ui_examples pattern="settings-section" depth="full"/);
  });

  it('returns the brief snippet when requested', () => {
    const text = firstText(runUiExamples({ pattern: 'list-page', depth: 'brief' }));
    expect(text).toMatch(/\*\*depth:\*\* `brief`/);
    expect(text).toMatch(/dbx_ui_examples pattern="list-page" depth="full"/);
  });

  it('surfaces notes in full depth when present', () => {
    const text = firstText(runUiExamples({ pattern: 'two-column-detail', depth: 'full' }));
    expect(text).toMatch(/## Notes/);
  });

  it('falls back gracefully on unknown pattern', () => {
    const text = firstText(runUiExamples({ pattern: 'not-a-real-pattern' }));
    expect(text).toMatch(/No UI pattern matched/);
    expect(text).toMatch(/Available patterns:/);
  });

  it('every pattern uses real UI slugs from the registry', async () => {
    const { loadUiComponentRegistry } = await import('../manifest/load-ui-components-registry.js');
    const result = await loadUiComponentRegistry({ cwd: process.cwd() });
    const slugs = new Set(result.registry.all.map((c) => c.slug));
    for (const pattern of UI_PATTERNS) {
      for (const ref of pattern.usesUiSlugs) {
        expect(slugs.has(ref), `pattern ${pattern.slug} references unknown UI slug "${ref}"`).toBe(true);
      }
    }
  });
});
