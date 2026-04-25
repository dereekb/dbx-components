import { describe, expect, it } from 'vitest';
import { runSearchModel } from './search-model.tool.js';

function firstText(result: ReturnType<typeof runSearchModel>): string {
  expect(result.content.length).toBeGreaterThan(0);
  const first = result.content[0];
  expect(first.type).toBe('text');
  return first.text;
}

describe('dbx_model_search', () => {
  it('rejects missing query via arktype', () => {
    const result = runSearchModel({});
    expect(result.isError).toBe(true);
    expect(firstText(result)).toMatch(/Invalid arguments/);
  });

  it('returns Firebase models for a model-name query', () => {
    const text = firstText(runSearchModel({ query: 'StorageFile' }));
    expect(text).toMatch(/# Search: `StorageFile`/);
    expect(text).toMatch(/StorageFile.*firebase model/);
    expect(text).toMatch(/\*\*identity:\*\* `storageFileIdentity`/);
  });

  it('ranks collection prefix matches', () => {
    const text = firstText(runSearchModel({ query: 'nb' }));
    expect(text).toMatch(/NotificationBox.*firebase model/);
  });

  it('matches enum-name substrings', () => {
    const text = firstText(runSearchModel({ query: 'StorageFileGroup' }));
    expect(text).toMatch(/firebase model/);
  });

  it('respects the limit cap', () => {
    const text = firstText(runSearchModel({ query: 'firestore', limit: 2 }));
    const resultSections = text.match(/## `[^`]+`/g) ?? [];
    expect(resultSections.length).toBeLessThanOrEqual(2);
  });

  it('returns a friendly message when nothing matches', () => {
    const text = firstText(runSearchModel({ query: 'zzzz-nothing-here' }));
    expect(text).toMatch(/No Firebase models matched/);
  });
});
