import { describe, expect, it } from 'vitest';
import type { SemanticTypeEntry } from '../manifest/semantic-types-schema.js';
import { createSemanticTypeRegistryFromEntries } from '../registry/semantic-types.js';
import { createSemanticTypeSearchTool } from './search-semantic-type.tool.js';

function entryFixture(overrides: Partial<SemanticTypeEntry> = {}): SemanticTypeEntry {
  const base: SemanticTypeEntry = {
    name: 'EmailAddress',
    package: '@dereekb/util',
    module: 'contact/email',
    kind: 'semantic-type',
    definition: 'export type EmailAddress = string;',
    baseType: 'string',
    topics: ['email', 'contact']
  };
  return { ...base, ...overrides };
}

function buildRegistry(entries: readonly SemanticTypeEntry[]) {
  return createSemanticTypeRegistryFromEntries({
    entries,
    loadedSources: ['@dereekb/util', '@dereekb/model']
  });
}

function getText(result: { readonly content: readonly { readonly type: 'text'; readonly text: string }[] }): string {
  return result.content.map((c) => c.text).join('\n');
}

describe('createSemanticTypeSearchTool', () => {
  it('rejects calls with no filters', async () => {
    const tool = createSemanticTypeSearchTool({ registry: buildRegistry([entryFixture()]) });
    const result = await tool.run({});
    expect(result.isError).toBe(true);
    expect(getText(result)).toContain('At least one filter');
  });

  it('filters by topic', async () => {
    const tool = createSemanticTypeSearchTool({
      registry: buildRegistry([entryFixture({ name: 'EmailAddress', topics: ['email'], definition: 'export type EmailAddress = string;' }), entryFixture({ name: 'Milliseconds', topics: ['duration'], baseType: 'number', definition: 'export type Milliseconds = number;' })])
    });
    const result = await tool.run({ topic: 'duration' });
    const text = getText(result);
    expect(text).toContain('Milliseconds');
    expect(text).not.toContain('EmailAddress');
  });

  it('filters by baseType', async () => {
    const tool = createSemanticTypeSearchTool({
      registry: buildRegistry([entryFixture({ name: 'EmailAddress', baseType: 'string', definition: 'export type EmailAddress = string;' }), entryFixture({ name: 'Milliseconds', baseType: 'number', topics: ['duration'], definition: 'export type Milliseconds = number;' })])
    });
    const result = await tool.run({ baseType: 'number' });
    const text = getText(result);
    expect(text).toContain('Milliseconds');
    expect(text).not.toContain('EmailAddress');
  });

  it('filters by package', async () => {
    const tool = createSemanticTypeSearchTool({
      registry: buildRegistry([entryFixture({ name: 'A', package: '@dereekb/util' }), entryFixture({ name: 'B', package: '@dereekb/model', topics: ['identifier'] })])
    });
    const result = await tool.run({ package: '@dereekb/model' });
    const text = getText(result);
    expect(text).toContain('B');
    expect(text).not.toContain('## `A`');
  });

  it('filters by query (case-insensitive substring across name/module/definition)', async () => {
    const tool = createSemanticTypeSearchTool({
      registry: buildRegistry([entryFixture({ name: 'EmailAddress', module: 'contact/email', definition: 'export type EmailAddress = string;' }), entryFixture({ name: 'Milliseconds', module: 'date/duration', definition: 'export type Milliseconds = number;', topics: ['duration'] })])
    });
    const result = await tool.run({ query: 'DURATION' });
    const text = getText(result);
    expect(text).toContain('Milliseconds');
    expect(text).not.toContain('EmailAddress');
  });

  it('ANDs multiple filters', async () => {
    const tool = createSemanticTypeSearchTool({
      registry: buildRegistry([entryFixture({ name: 'EmailAddress', package: '@dereekb/util', baseType: 'string', topics: ['email'] }), entryFixture({ name: 'PhoneNumber', package: '@dereekb/util', baseType: 'string', topics: ['phone'] }), entryFixture({ name: 'Milliseconds', package: '@dereekb/util', baseType: 'number', topics: ['duration'] })])
    });
    const result = await tool.run({ package: '@dereekb/util', baseType: 'string' });
    const text = getText(result);
    expect(text).toContain('EmailAddress');
    expect(text).toContain('PhoneNumber');
    expect(text).not.toContain('Milliseconds');
  });

  it('caps results at limit', async () => {
    const tool = createSemanticTypeSearchTool({
      registry: buildRegistry([entryFixture({ name: 'A', topics: ['identifier'] }), entryFixture({ name: 'B', topics: ['identifier'] }), entryFixture({ name: 'C', topics: ['identifier'] })])
    });
    const result = await tool.run({ topic: 'identifier', limit: 2 });
    const text = getText(result);
    expect(text).toContain('## `A`');
    expect(text).toContain('## `B`');
    expect(text).not.toContain('## `C`');
  });

  it('returns no-results message when nothing matches', async () => {
    const tool = createSemanticTypeSearchTool({ registry: buildRegistry([entryFixture({ topics: ['email'] })]) });
    const result = await tool.run({ topic: 'currency' });
    const text = getText(result);
    expect(text).toContain('No semantic types matched');
  });
});
