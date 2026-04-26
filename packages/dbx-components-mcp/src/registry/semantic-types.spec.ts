import { describe, expect, it } from 'vitest';
import type { SemanticTypeEntry } from '../manifest/semantic-types-schema.js';
import { createSemanticTypeRegistryFromEntries, EMPTY_SEMANTIC_TYPE_REGISTRY } from './semantic-types.js';

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

describe('createSemanticTypeRegistryFromEntries', () => {
  it('sorts entries alphabetically by name', () => {
    const registry = createSemanticTypeRegistryFromEntries({
      entries: [entryFixture({ name: 'Z' }), entryFixture({ name: 'A' }), entryFixture({ name: 'M' })],
      loadedSources: ['@dereekb/util']
    });
    expect(registry.all.map((e) => e.name)).toEqual(['A', 'M', 'Z']);
  });

  it('exposes distinct topics, packages, and baseTypes sorted', () => {
    const registry = createSemanticTypeRegistryFromEntries({
      entries: [entryFixture({ name: 'EmailAddress', topics: ['email', 'contact'], baseType: 'string', package: '@dereekb/util' }), entryFixture({ name: 'Milliseconds', topics: ['duration', 'time'], baseType: 'number', package: '@dereekb/util' }), entryFixture({ name: 'PercentDecimal', topics: ['percent'], baseType: 'number', package: '@dereekb/model' })],
      loadedSources: ['@dereekb/util', '@dereekb/model']
    });
    expect(registry.topics).toEqual(['contact', 'duration', 'email', 'percent', 'time']);
    expect(registry.packages).toEqual(['@dereekb/model', '@dereekb/util']);
    expect(registry.baseTypes).toEqual(['number', 'string']);
  });

  it('findByName returns every entry with the given name across packages', () => {
    const utilEntry = entryFixture({ name: 'Identifier', package: '@dereekb/util', topics: ['identifier'] });
    const modelEntry = entryFixture({ name: 'Identifier', package: '@dereekb/model', topics: ['identifier'] });
    const registry = createSemanticTypeRegistryFromEntries({
      entries: [utilEntry, modelEntry],
      loadedSources: ['@dereekb/util', '@dereekb/model']
    });
    const matches = registry.findByName('Identifier');
    expect(matches).toHaveLength(2);
    expect(matches.map((e) => e.package).sort()).toEqual(['@dereekb/model', '@dereekb/util']);
  });

  it('findByTopic returns every entry tagged with the topic', () => {
    const registry = createSemanticTypeRegistryFromEntries({
      entries: [entryFixture({ name: 'A', topics: ['duration'] }), entryFixture({ name: 'B', topics: ['email'] }), entryFixture({ name: 'C', topics: ['duration', 'time'] })],
      loadedSources: ['@dereekb/util']
    });
    expect(registry.findByTopic('duration').map((e) => e.name)).toEqual(['A', 'C']);
    expect(registry.findByTopic('time').map((e) => e.name)).toEqual(['C']);
    expect(registry.findByTopic('unknown')).toEqual([]);
  });

  it('findByQuery does case-insensitive substring search across name + module + definition', () => {
    const registry = createSemanticTypeRegistryFromEntries({
      entries: [entryFixture({ name: 'EmailAddress', module: 'contact/email', definition: 'export type EmailAddress = string;', topics: ['email'] }), entryFixture({ name: 'Milliseconds', module: 'date/duration', definition: 'export type Milliseconds = number;', topics: ['duration'] })],
      loadedSources: ['@dereekb/util']
    });
    expect(registry.findByQuery('email').map((e) => e.name)).toEqual(['EmailAddress']);
    expect(registry.findByQuery('DURATION').map((e) => e.name)).toEqual(['Milliseconds']);
    expect(registry.findByQuery('number').map((e) => e.name)).toEqual(['Milliseconds']);
    expect(registry.findByQuery('   ')).toEqual([]);
  });

  it('findByPackage and findByBaseType return exact-match buckets', () => {
    const registry = createSemanticTypeRegistryFromEntries({
      entries: [entryFixture({ name: 'A', package: '@dereekb/util', baseType: 'string' }), entryFixture({ name: 'B', package: '@dereekb/util', baseType: 'number' }), entryFixture({ name: 'C', package: '@dereekb/model', baseType: 'string' })],
      loadedSources: ['@dereekb/util', '@dereekb/model']
    });
    expect(registry.findByPackage('@dereekb/util').map((e) => e.name)).toEqual(['A', 'B']);
    expect(registry.findByBaseType('string').map((e) => e.name)).toEqual(['A', 'C']);
    expect(registry.findByPackage('missing')).toEqual([]);
  });
});

describe('EMPTY_SEMANTIC_TYPE_REGISTRY', () => {
  it('returns empty arrays for every accessor', () => {
    expect(EMPTY_SEMANTIC_TYPE_REGISTRY.all).toEqual([]);
    expect(EMPTY_SEMANTIC_TYPE_REGISTRY.loadedSources).toEqual([]);
    expect(EMPTY_SEMANTIC_TYPE_REGISTRY.topics).toEqual([]);
    expect(EMPTY_SEMANTIC_TYPE_REGISTRY.packages).toEqual([]);
    expect(EMPTY_SEMANTIC_TYPE_REGISTRY.baseTypes).toEqual([]);
    expect(EMPTY_SEMANTIC_TYPE_REGISTRY.findByName('any')).toEqual([]);
    expect(EMPTY_SEMANTIC_TYPE_REGISTRY.findByTopic('any')).toEqual([]);
    expect(EMPTY_SEMANTIC_TYPE_REGISTRY.findByPackage('any')).toEqual([]);
    expect(EMPTY_SEMANTIC_TYPE_REGISTRY.findByBaseType('any')).toEqual([]);
    expect(EMPTY_SEMANTIC_TYPE_REGISTRY.findByQuery('any')).toEqual([]);
  });
});
