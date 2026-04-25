import { describe, expect, it } from 'vitest';
import { runLookupForm } from './lookup-form.tool.js';
import { resolveTopicAlias } from './form-alias-resolver.js';

function firstText(result: ReturnType<typeof runLookupForm>): string {
  expect(result.content.length).toBeGreaterThan(0);
  const first = result.content[0];
  expect(first.type).toBe('text');
  return first.text;
}

describe('dbx_form_lookup', () => {
  it('rejects missing topic via arktype validation', () => {
    const result = runLookupForm({});
    expect(result.isError).toBe(true);
    expect(firstText(result)).toMatch(/Invalid arguments/);
  });

  it('resolves a canonical slug to a single full entry', () => {
    const text = firstText(runLookupForm({ topic: 'text' }));
    expect(text).toMatch(/# dbxForgeTextField/);
    expect(text).toMatch(/\*\*slug:\*\* `text`/);
    expect(text).toMatch(/## Factory/);
    expect(text).toMatch(/## Config/);
    expect(text).toMatch(/## Example/);
  });

  it('brief depth omits factory/config/example sections and returns just the summary', () => {
    const text = firstText(runLookupForm({ topic: 'text', depth: 'brief' }));
    expect(text).toMatch(/## dbxForgeTextField/);
    expect(text).not.toMatch(/## Factory/);
    expect(text).not.toMatch(/## Config/);
    expect(text).not.toMatch(/## Example/);
  });

  it('resolves factory names (case-insensitive)', () => {
    const text = firstText(runLookupForm({ topic: 'DBXFORGETEXTFIELD' }));
    expect(text).toMatch(/# dbxForgeTextField/);
  });

  it('resolves aliases', () => {
    expect(resolveTopicAlias('datepicker')).toBe('date');
    expect(resolveTopicAlias('chips')).toBe('pickable-chip');
    const text = firstText(runLookupForm({ topic: 'datepicker' }));
    expect(text).toMatch(/# dbxForgeDateField/);
  });

  it('resolves a produces value to a grouped list spanning tiers', () => {
    const text = firstText(runLookupForm({ topic: 'RowField' }));
    expect(text).toMatch(/# Form entries producing `RowField`/);
    expect(text).toMatch(/## composite-builder/);
    expect(text).toMatch(/## primitive/);
  });

  it('resolves a tier name to a full-tier list', () => {
    const text = firstText(runLookupForm({ topic: 'primitive' }));
    expect(text).toMatch(/# Form entries: tier = primitive/);
    expect(text).toMatch(/dbxForgeRow/);
    expect(text).toMatch(/dbxForgeGroup/);
  });

  it('resolves the "list" alias to the full catalog', () => {
    const text = firstText(runLookupForm({ topic: 'list' }));
    expect(text).toMatch(/# Form catalog/);
    expect(text).toMatch(/## field-factory/);
    expect(text).toMatch(/## composite-builder/);
    expect(text).toMatch(/## primitive/);
    expect(text).toMatch(/## Output primitives/);
  });

  it('suggests fuzzy candidates for partial-word queries', () => {
    const text = firstText(runLookupForm({ topic: 'addr' }));
    expect(text).toMatch(/No form entry matched/);
    expect(text).toMatch(/Did you mean/);
    expect(text).toMatch(/dbxForgeAddress/);
  });

  it('falls through to catalog hint when no substring overlap exists', () => {
    const text = firstText(runLookupForm({ topic: 'zzzz-not-a-thing' }));
    expect(text).toMatch(/No form entry matched/);
    expect(text).toMatch(/browse the catalog/);
  });
});
