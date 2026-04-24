import { describe, expect, it } from 'vitest';
import { runLookup } from './lookup.tool.js';
import { resolveTopicAlias } from './alias-resolver.js';

function firstText(result: ReturnType<typeof runLookup>): string {
  expect(result.content.length).toBeGreaterThan(0);
  const first = result.content[0];
  expect(first.type).toBe('text');
  return first.text;
}

describe('dbx_lookup', () => {
  it('rejects missing topic via arktype validation', () => {
    const result = runLookup({});
    expect(result.isError).toBe(true);
    expect(firstText(result)).toMatch(/Invalid arguments/);
  });

  it('resolves a canonical slug to a single full entry', () => {
    const text = firstText(runLookup({ topic: 'text' }));
    expect(text).toMatch(/# dbxForgeTextField/);
    expect(text).toMatch(/\*\*slug:\*\* `text`/);
    expect(text).toMatch(/## Factory/);
    expect(text).toMatch(/## Config/);
    expect(text).toMatch(/## Example/);
  });

  it('brief depth omits factory/config/example sections and returns just the summary', () => {
    const text = firstText(runLookup({ topic: 'text', depth: 'brief' }));
    expect(text).toMatch(/## dbxForgeTextField/);
    expect(text).not.toMatch(/## Factory/);
    expect(text).not.toMatch(/## Config/);
    expect(text).not.toMatch(/## Example/);
  });

  it('resolves factory names (case-insensitive)', () => {
    const text = firstText(runLookup({ topic: 'DBXFORGETEXTFIELD' }));
    expect(text).toMatch(/# dbxForgeTextField/);
  });

  it('resolves aliases', () => {
    expect(resolveTopicAlias('datepicker')).toBe('date');
    expect(resolveTopicAlias('chips')).toBe('pickable-chip');
    const text = firstText(runLookup({ topic: 'datepicker' }));
    expect(text).toMatch(/# dbxForgeDateField/);
  });

  it('resolves a produces value to a grouped list spanning tiers', () => {
    const text = firstText(runLookup({ topic: 'RowField' }));
    expect(text).toMatch(/# Forge entries producing `RowField`/);
    expect(text).toMatch(/## composite-builder/);
    expect(text).toMatch(/## primitive/);
  });

  it('resolves a tier name to a full-tier list', () => {
    const text = firstText(runLookup({ topic: 'primitive' }));
    expect(text).toMatch(/# Forge entries: tier = primitive/);
    expect(text).toMatch(/dbxForgeRow/);
    expect(text).toMatch(/dbxForgeGroup/);
  });

  it('resolves the "list" alias to the full catalog', () => {
    const text = firstText(runLookup({ topic: 'list' }));
    expect(text).toMatch(/# Forge catalog/);
    expect(text).toMatch(/## field-factory/);
    expect(text).toMatch(/## composite-builder/);
    expect(text).toMatch(/## primitive/);
    expect(text).toMatch(/## Output primitives/);
  });

  it('suggests fuzzy candidates for partial-word queries', () => {
    const text = firstText(runLookup({ topic: 'addr' }));
    expect(text).toMatch(/No forge entry matched/);
    expect(text).toMatch(/Did you mean/);
    expect(text).toMatch(/dbxForgeAddress/);
  });

  it('falls through to catalog hint when no substring overlap exists', () => {
    const text = firstText(runLookup({ topic: 'zzzz-not-a-thing' }));
    expect(text).toMatch(/No forge entry matched/);
    expect(text).toMatch(/browse the catalog/);
  });

  it('resolves a Firebase model by interface name', () => {
    const text = firstText(runLookup({ topic: 'StorageFile' }));
    expect(text).toMatch(/# StorageFile/);
    expect(text).toMatch(/\*\*Identity:\*\* `storageFileIdentity`/);
    expect(text).toMatch(/prefix `sf`/);
    expect(text).toMatch(/## Fields/);
    expect(text).toMatch(/## Enums/);
  });

  it('resolves a Firebase model by collection prefix', () => {
    const text = firstText(runLookup({ topic: 'nb' }));
    expect(text).toMatch(/# NotificationBox/);
  });

  it('resolves the firebase catalog via "models" alias', () => {
    const text = firstText(runLookup({ topic: 'models' }));
    expect(text).toMatch(/# Firebase model catalog/);
    expect(text).toMatch(/## Root collections/);
    expect(text).toMatch(/## Subcollections/);
    expect(text).toMatch(/\*\*StorageFile\*\*/);
  });
});
