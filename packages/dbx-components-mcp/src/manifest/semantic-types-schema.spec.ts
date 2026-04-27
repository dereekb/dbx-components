import { type } from 'arktype';
import { describe, expect, it } from 'vitest';
import { SemanticTypeEntry, SemanticTypeManifest } from './semantic-types-schema.js';

const minimalEntry = {
  name: 'EmailAddress',
  package: '@dereekb/util',
  module: 'contact/email',
  kind: 'semantic-type' as const,
  definition: 'string',
  baseType: 'string' as const,
  topics: ['email', 'contact']
};

const minimalManifest = {
  version: 1,
  source: '@dereekb/util',
  topicNamespace: 'dereekb-util',
  generatedAt: '2026-04-25T00:00:00.000Z',
  generator: '@dereekb/dbx-components-mcp@13.9.0',
  topics: [],
  entries: [minimalEntry]
};

describe('SemanticTypeEntry schema', () => {
  it('accepts a minimal valid entry with only required fields', () => {
    const parsed = SemanticTypeEntry(minimalEntry);
    expect(parsed instanceof type.errors).toBe(false);
  });

  it('accepts an entry with every optional field populated', () => {
    const full = {
      ...minimalEntry,
      unionValues: ['ms', 's'],
      typeParameters: ['T'],
      aliases: ['EmailAddressString'],
      related: ['EmailParticipant'],
      reExportedFrom: [{ package: '@dereekb/firebase', module: 'contact' }],
      guards: ['isEmailAddress'],
      factories: ['emailAddress'],
      converters: ['emailAddressFromString'],
      examples: [{ caption: 'simple', code: "const e: EmailAddress = 'a@b.com';" }, { code: "const e: EmailAddress = 'x@y.io';" }],
      notes: 'RFC-5321 compliant.',
      deprecated: false,
      since: '13.9.0',
      sourceLocation: { file: 'packages/util/src/lib/contact/email.ts', line: 6 }
    };
    const parsed = SemanticTypeEntry(full);
    expect(parsed instanceof type.errors).toBe(false);
  });

  it('rejects an entry with no topics field', () => {
    const { topics: _omit, ...entryWithoutTopics } = minimalEntry;
    const parsed = SemanticTypeEntry(entryWithoutTopics);
    expect(parsed instanceof type.errors).toBe(true);
  });

  it('rejects an entry with an empty topics array', () => {
    const parsed = SemanticTypeEntry({ ...minimalEntry, topics: [] });
    expect(parsed instanceof type.errors).toBe(true);
  });

  it('rejects an entry with an unknown kind', () => {
    const parsed = SemanticTypeEntry({ ...minimalEntry, kind: 'class' });
    expect(parsed instanceof type.errors).toBe(true);
  });

  it('rejects an entry with an unknown baseType', () => {
    const parsed = SemanticTypeEntry({ ...minimalEntry, baseType: 'tuple' });
    expect(parsed instanceof type.errors).toBe(true);
  });

  it('rejects an entry with a malformed sourceLocation', () => {
    const parsed = SemanticTypeEntry({ ...minimalEntry, sourceLocation: { file: 'a.ts' } });
    expect(parsed instanceof type.errors).toBe(true);
  });

  it('accepts deprecated as boolean true', () => {
    const parsed = SemanticTypeEntry({ ...minimalEntry, deprecated: true });
    expect(parsed instanceof type.errors).toBe(false);
  });

  it('accepts deprecated as a reason string', () => {
    const parsed = SemanticTypeEntry({ ...minimalEntry, deprecated: 'use NewType instead' });
    expect(parsed instanceof type.errors).toBe(false);
  });
});

describe('SemanticTypeManifest schema', () => {
  it('accepts a minimal valid manifest', () => {
    const parsed = SemanticTypeManifest(minimalManifest);
    expect(parsed instanceof type.errors).toBe(false);
  });

  it('rejects a manifest with version: 2', () => {
    const parsed = SemanticTypeManifest({ ...minimalManifest, version: 2 });
    expect(parsed instanceof type.errors).toBe(true);
  });

  it('rejects a manifest missing source', () => {
    const { source: _omit, ...without } = minimalManifest;
    const parsed = SemanticTypeManifest(without);
    expect(parsed instanceof type.errors).toBe(true);
  });

  it('rejects a manifest missing topicNamespace', () => {
    const { topicNamespace: _omit, ...without } = minimalManifest;
    const parsed = SemanticTypeManifest(without);
    expect(parsed instanceof type.errors).toBe(true);
  });

  it('rejects a manifest whose entries contain an invalid entry', () => {
    const parsed = SemanticTypeManifest({ ...minimalManifest, entries: [{ ...minimalEntry, topics: [] }] });
    expect(parsed instanceof type.errors).toBe(true);
  });
});
