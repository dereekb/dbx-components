import { describe, expect, it } from 'vitest';
import { runLookupForge } from './lookup-forge.tool.js';
import { resolveTopicAlias } from './alias-resolver.js';

function firstText(result: ReturnType<typeof runLookupForge>): string {
  expect(result.content.length).toBeGreaterThan(0);
  const first = result.content[0];
  expect(first.type).toBe('text');
  return first.text;
}

describe('dbx_form_lookup', () => {
  it('rejects missing topic via arktype validation', () => {
    const result = runLookupForge({});
    expect(result.isError).toBe(true);
    expect(firstText(result)).toMatch(/Invalid arguments/);
  });

  it('resolves a canonical slug to a single full entry', () => {
    const text = firstText(runLookupForge({ topic: 'text' }));
    expect(text).toMatch(/# dbxForgeTextField/);
    expect(text).toMatch(/\*\*slug:\*\* `text`/);
    expect(text).toMatch(/## Factory/);
    expect(text).toMatch(/## Config/);
    expect(text).toMatch(/## Example/);
  });

  it('brief depth omits factory/config/example sections and returns just the summary', () => {
    const text = firstText(runLookupForge({ topic: 'text', depth: 'brief' }));
    expect(text).toMatch(/## dbxForgeTextField/);
    expect(text).not.toMatch(/## Factory/);
    expect(text).not.toMatch(/## Config/);
    expect(text).not.toMatch(/## Example/);
  });

  it('resolves factory names (case-insensitive)', () => {
    const text = firstText(runLookupForge({ topic: 'DBXFORGETEXTFIELD' }));
    expect(text).toMatch(/# dbxForgeTextField/);
  });

  it('resolves aliases', () => {
    expect(resolveTopicAlias('datepicker')).toBe('date');
    expect(resolveTopicAlias('chips')).toBe('pickable-chip');
    const text = firstText(runLookupForge({ topic: 'datepicker' }));
    expect(text).toMatch(/# dbxForgeDateField/);
  });

  it('resolves a produces value to a grouped list spanning tiers', () => {
    const text = firstText(runLookupForge({ topic: 'RowField' }));
    expect(text).toMatch(/# Forge entries producing `RowField`/);
    expect(text).toMatch(/## composite-builder/);
    expect(text).toMatch(/## primitive/);
  });

  it('resolves a tier name to a full-tier list', () => {
    const text = firstText(runLookupForge({ topic: 'primitive' }));
    expect(text).toMatch(/# Forge entries: tier = primitive/);
    expect(text).toMatch(/dbxForgeRow/);
    expect(text).toMatch(/dbxForgeGroup/);
  });

  it('resolves the "list" alias to the full catalog', () => {
    const text = firstText(runLookupForge({ topic: 'list' }));
    expect(text).toMatch(/# Forge catalog/);
    expect(text).toMatch(/## field-factory/);
    expect(text).toMatch(/## composite-builder/);
    expect(text).toMatch(/## primitive/);
    expect(text).toMatch(/## Output primitives/);
  });

  it('suggests fuzzy candidates for partial-word queries', () => {
    const text = firstText(runLookupForge({ topic: 'addr' }));
    expect(text).toMatch(/No forge entry matched/);
    expect(text).toMatch(/Did you mean/);
    expect(text).toMatch(/dbxForgeAddress/);
  });

  it('falls through to catalog hint when no substring overlap exists', () => {
    const text = firstText(runLookupForge({ topic: 'zzzz-not-a-thing' }));
    expect(text).toMatch(/No forge entry matched/);
    expect(text).toMatch(/browse the catalog/);
  });
});
