import { describe, expect, it } from 'vitest';
import type { SemanticTypeEntry } from '../manifest/semantic-types-schema.js';
import { createSemanticTypeRegistryFromEntries, EMPTY_SEMANTIC_TYPE_REGISTRY } from '../registry/semantic-types.js';
import { createSemanticTypeLookupTool } from './lookup-semantic-type.tool.js';

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

function getText(result: { readonly content: readonly { readonly type: 'text'; readonly text: string }[] }): string {
  return result.content.map((c) => c.text).join('\n');
}

describe('createSemanticTypeLookupTool', () => {
  it('returns full markdown for a single match by default', async () => {
    const tool = createSemanticTypeLookupTool({
      registry: createSemanticTypeRegistryFromEntries({
        entries: [
          entryFixture({
            examples: [{ caption: 'Direct assignment', code: "const e: EmailAddress = 'foo@bar.com';" }],
            guards: ['isEmailAddress']
          })
        ],
        loadedSources: ['@dereekb/util']
      })
    });

    const result = await tool.run({ name: 'EmailAddress' });
    const text = getText(result);
    expect(text).toContain('## `EmailAddress`');
    expect(text).toContain('### Guards');
    expect(text).toContain('isEmailAddress');
    expect(text).toContain('### Examples');
  });

  it('returns brief shape when depth=brief', async () => {
    const tool = createSemanticTypeLookupTool({
      registry: createSemanticTypeRegistryFromEntries({
        entries: [
          entryFixture({
            guards: ['isEmailAddress']
          })
        ],
        loadedSources: ['@dereekb/util']
      })
    });

    const result = await tool.run({ name: 'EmailAddress', depth: 'brief' });
    const text = getText(result);
    expect(text).toContain('## `EmailAddress`');
    expect(text).not.toContain('### Guards');
  });

  it('renders cross-package collisions as a multi-entry block', async () => {
    const tool = createSemanticTypeLookupTool({
      registry: createSemanticTypeRegistryFromEntries({
        entries: [entryFixture({ package: '@dereekb/util', topics: ['identifier'], name: 'Identifier' }), entryFixture({ package: '@dereekb/model', topics: ['identifier'], name: 'Identifier' })],
        loadedSources: ['@dereekb/util', '@dereekb/model']
      })
    });

    const result = await tool.run({ name: 'Identifier' });
    const text = getText(result);
    expect(text).toContain('multiple matches');
    expect(text).toContain('@dereekb/util');
    expect(text).toContain('@dereekb/model');
  });

  it('returns the catalog summary when name="catalog"', async () => {
    const tool = createSemanticTypeLookupTool({
      registry: createSemanticTypeRegistryFromEntries({
        entries: [entryFixture({ name: 'EmailAddress', topics: ['email'], package: '@dereekb/util', baseType: 'string' })],
        loadedSources: ['@dereekb/util']
      })
    });

    const result = await tool.run({ name: 'catalog' });
    const text = getText(result);
    expect(text).toContain('# Semantic-types registry');
    expect(text).toContain('**entries:** 1');
    expect(text).toContain('@dereekb/util');
  });

  it('returns an empty-registry hint when no sources have loaded', async () => {
    const tool = createSemanticTypeLookupTool({ registry: EMPTY_SEMANTIC_TYPE_REGISTRY });
    const result = await tool.run({ name: 'EmailAddress' });
    const text = getText(result);
    expect(text).toContain('the registry is currently empty');
    expect(text).toContain('@semanticType');
  });

  it('suggests dbx_semantic_type_search when no entry matches', async () => {
    const tool = createSemanticTypeLookupTool({
      registry: createSemanticTypeRegistryFromEntries({
        entries: [entryFixture({ name: 'EmailAddress' })],
        loadedSources: ['@dereekb/util']
      })
    });

    const result = await tool.run({ name: 'NonExistent' });
    const text = getText(result);
    expect(text).toContain('dbx_semantic_type_search');
    expect(text).toContain('NonExistent');
  });

  it('returns isError=true for invalid arguments', async () => {
    const tool = createSemanticTypeLookupTool({ registry: EMPTY_SEMANTIC_TYPE_REGISTRY });
    const result = await tool.run({});
    expect(result.isError).toBe(true);
  });
});
