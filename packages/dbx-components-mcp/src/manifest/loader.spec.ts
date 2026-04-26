import { describe, expect, it } from 'vitest';
import { loadSemanticTypeManifests, type LoaderWarning, type ManifestReadFile, type ManifestSource } from './loader.js';
import { type SemanticTypeEntry, type SemanticTypeManifest } from './semantic-types-schema.js';

// MARK: Test factories
function entryFixture(overrides: Partial<SemanticTypeEntry> = {}): SemanticTypeEntry {
  const base: SemanticTypeEntry = {
    name: 'EmailAddress',
    package: '@dereekb/util',
    module: 'contact/email',
    kind: 'semantic-type',
    definition: 'string',
    baseType: 'string',
    topics: ['email', 'contact']
  };
  return { ...base, ...overrides };
}

function manifestFixture(overrides: Partial<SemanticTypeManifest> = {}): SemanticTypeManifest {
  const base: SemanticTypeManifest = {
    version: 1,
    source: '@dereekb/util',
    topicNamespace: 'dereekb-util',
    generatedAt: '2026-04-25T00:00:00.000Z',
    generator: '@dereekb/dbx-components-mcp@13.9.0',
    topics: [],
    entries: [entryFixture()]
  };
  return { ...base, ...overrides };
}

function makeReader(files: Record<string, string>): ManifestReadFile {
  return async (path) => {
    const content = files[path];
    if (content === undefined) {
      throw new Error(`fixture: no entry for path ${path}`);
    }
    return content;
  };
}

function externalSource(path: string, opts: { readonly strict?: boolean } = {}): ManifestSource {
  return { origin: 'external', path, strict: opts.strict };
}

function bundledSource(path: string, opts: { readonly strict?: boolean } = {}): ManifestSource {
  return { origin: 'bundled', path, strict: opts.strict };
}

function warningKinds(warnings: readonly LoaderWarning[]): readonly string[] {
  return warnings.map((w) => w.kind);
}

// MARK: Single manifest
describe('loadSemanticTypeManifests – single manifest', () => {
  it('returns entries and topic index from a single valid manifest', async () => {
    const manifest = manifestFixture({
      entries: [entryFixture(), entryFixture({ name: 'Milliseconds', module: 'date/duration', topics: ['time', 'duration'] })]
    });
    const reader = makeReader({ '/m/util.json': JSON.stringify(manifest) });

    const result = await loadSemanticTypeManifests({
      sources: [bundledSource('/m/util.json')],
      readFile: reader
    });

    expect(result.entries.size).toBe(2);
    expect(result.entries.has('@dereekb/util::EmailAddress')).toBe(true);
    expect(result.entries.has('@dereekb/util::Milliseconds')).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.loadedSources).toEqual(['@dereekb/util']);
    expect(result.topicsIndex.get('email')).toEqual(['@dereekb/util::EmailAddress']);
    expect(result.topicsIndex.get('duration')).toEqual(['@dereekb/util::Milliseconds']);
  });

  it('sorts topic-index buckets alphabetically by entry key', async () => {
    const manifest = manifestFixture({
      entries: [entryFixture({ name: 'Z', module: 'a', topics: ['identifier'] }), entryFixture({ name: 'A', module: 'a', topics: ['identifier'] }), entryFixture({ name: 'M', module: 'a', topics: ['identifier'] })]
    });
    const reader = makeReader({ '/m/util.json': JSON.stringify(manifest) });

    const result = await loadSemanticTypeManifests({
      sources: [bundledSource('/m/util.json')],
      readFile: reader
    });

    expect(result.topicsIndex.get('identifier')).toEqual(['@dereekb/util::A', '@dereekb/util::M', '@dereekb/util::Z']);
  });
});

// MARK: Multi-manifest merging
describe('loadSemanticTypeManifests – merging', () => {
  it('merges entries from two manifests and lists both sources', async () => {
    const utilManifest = manifestFixture();
    const subsManifest = manifestFixture({
      source: 'hellosubs',
      topicNamespace: 'hellosubs',
      entries: [entryFixture({ name: 'SchoolId', package: '@hellosubs/shared', module: 'school', topics: ['identifier'] })]
    });
    const reader = makeReader({
      '/m/util.json': JSON.stringify(utilManifest),
      '/m/subs.json': JSON.stringify(subsManifest)
    });

    const result = await loadSemanticTypeManifests({
      sources: [bundledSource('/m/util.json'), externalSource('/m/subs.json')],
      readFile: reader
    });

    expect(result.entries.size).toBe(2);
    expect(result.entries.has('@dereekb/util::EmailAddress')).toBe(true);
    expect(result.entries.has('@hellosubs/shared::SchoolId')).toBe(true);
    expect(result.loadedSources).toEqual(['@dereekb/util', 'hellosubs']);
    expect(result.warnings).toEqual([]);
  });

  it('reports entry-collision when two manifests share a (package, name); last loaded wins', async () => {
    const first = manifestFixture({
      source: '@dereekb/util',
      entries: [entryFixture({ notes: 'first' })]
    });
    const second = manifestFixture({
      source: '@dereekb/util-mirror',
      topicNamespace: 'dereekb-util-mirror',
      entries: [entryFixture({ notes: 'second' })]
    });
    const reader = makeReader({
      '/m/first.json': JSON.stringify(first),
      '/m/second.json': JSON.stringify(second)
    });

    const result = await loadSemanticTypeManifests({
      sources: [bundledSource('/m/first.json'), externalSource('/m/second.json')],
      readFile: reader
    });

    expect(result.entries.get('@dereekb/util::EmailAddress')?.notes).toBe('second');
    const collision = result.warnings.find((w) => w.kind === 'entry-collision');
    expect(collision).toEqual({
      kind: 'entry-collision',
      entryKey: '@dereekb/util::EmailAddress',
      winningSource: '@dereekb/util-mirror',
      losingSource: '@dereekb/util'
    });
  });

  it('drops the second manifest when two share a source label and emits source-label-collision', async () => {
    const first = manifestFixture({ entries: [entryFixture({ notes: 'first' })] });
    const second = manifestFixture({
      entries: [entryFixture({ name: 'Milliseconds', module: 'date/duration', topics: ['time', 'duration'], notes: 'second' })]
    });
    const reader = makeReader({
      '/m/first.json': JSON.stringify(first),
      '/m/second.json': JSON.stringify(second)
    });

    const result = await loadSemanticTypeManifests({
      sources: [bundledSource('/m/first.json'), externalSource('/m/second.json')],
      readFile: reader
    });

    expect(result.entries.size).toBe(1);
    expect(result.entries.has('@dereekb/util::EmailAddress')).toBe(true);
    expect(result.entries.has('@dereekb/util::Milliseconds')).toBe(false);
    expect(result.loadedSources).toEqual(['@dereekb/util']);
    const collision = result.warnings.find((w) => w.kind === 'source-label-collision');
    expect(collision).toEqual({
      kind: 'source-label-collision',
      source: '@dereekb/util',
      existingPath: '/m/first.json',
      droppedPath: '/m/second.json'
    });
  });
});

// MARK: Topic validation
describe('loadSemanticTypeManifests – topic validation', () => {
  it('drops unknown bare topics, emits topic-unknown-core, keeps entry', async () => {
    const manifest = manifestFixture({
      entries: [entryFixture({ topics: ['email', 'fake-topic'] })]
    });
    const reader = makeReader({ '/m/util.json': JSON.stringify(manifest) });

    const result = await loadSemanticTypeManifests({
      sources: [bundledSource('/m/util.json')],
      readFile: reader
    });

    expect(result.entries.size).toBe(1);
    expect(result.entries.get('@dereekb/util::EmailAddress')?.topics).toEqual(['email']);
    expect(result.warnings).toEqual([{ kind: 'topic-unknown-core', entryKey: '@dereekb/util::EmailAddress', topic: 'fake-topic' }]);
  });

  it('drops mismatched namespaced topics, emits topic-namespace-mismatch, keeps entry', async () => {
    const manifest = manifestFixture({
      source: 'hellosubs',
      topicNamespace: 'hellosubs',
      entries: [entryFixture({ name: 'SchoolId', package: '@hellosubs/shared', module: 'school', topics: ['identifier', 'foodflip:meal'] })]
    });
    const reader = makeReader({ '/m/subs.json': JSON.stringify(manifest) });

    const result = await loadSemanticTypeManifests({
      sources: [externalSource('/m/subs.json')],
      readFile: reader
    });

    expect(result.entries.get('@hellosubs/shared::SchoolId')?.topics).toEqual(['identifier']);
    expect(result.warnings).toEqual([
      {
        kind: 'topic-namespace-mismatch',
        entryKey: '@hellosubs/shared::SchoolId',
        topic: 'foodflip:meal',
        expectedNamespace: 'hellosubs'
      }
    ]);
  });

  it('keeps namespaced topics whose prefix matches the manifest topicNamespace', async () => {
    const manifest = manifestFixture({
      entries: [entryFixture({ topics: ['email', 'dereekb-util:contact'] })]
    });
    const reader = makeReader({ '/m/util.json': JSON.stringify(manifest) });

    const result = await loadSemanticTypeManifests({
      sources: [bundledSource('/m/util.json')],
      readFile: reader
    });

    expect(result.entries.get('@dereekb/util::EmailAddress')?.topics).toEqual(['email', 'dereekb-util:contact']);
    expect(result.warnings).toEqual([]);
    expect(result.topicsIndex.get('dereekb-util:contact')).toEqual(['@dereekb/util::EmailAddress']);
  });
});

// MARK: Strict failures
describe('loadSemanticTypeManifests – strict failures throw', () => {
  it('throws when a strict source is missing', async () => {
    const reader = makeReader({});
    await expect(loadSemanticTypeManifests({ sources: [bundledSource('/m/missing.json')], readFile: reader })).rejects.toThrow(/manifest-missing/);
  });

  it('throws when a strict source has malformed JSON', async () => {
    const reader = makeReader({ '/m/bad.json': '{ not valid json' });
    await expect(loadSemanticTypeManifests({ sources: [bundledSource('/m/bad.json')], readFile: reader })).rejects.toThrow(/manifest-parse-failed/);
  });

  it('throws when a strict source has an unsupported version', async () => {
    const manifest = { ...manifestFixture(), version: 2 };
    const reader = makeReader({ '/m/v2.json': JSON.stringify(manifest) });
    await expect(loadSemanticTypeManifests({ sources: [bundledSource('/m/v2.json')], readFile: reader })).rejects.toThrow(/manifest-version-unsupported/);
  });

  it('throws when a strict source fails schema validation', async () => {
    const manifest = manifestFixture({ entries: [{ ...entryFixture(), topics: [] }] });
    const reader = makeReader({ '/m/bad.json': JSON.stringify(manifest) });
    await expect(loadSemanticTypeManifests({ sources: [bundledSource('/m/bad.json')], readFile: reader })).rejects.toThrow(/manifest-schema-failed/);
  });

  it('throws when an external source is explicitly marked strict', async () => {
    const reader = makeReader({});
    await expect(loadSemanticTypeManifests({ sources: [externalSource('/m/missing.json', { strict: true })], readFile: reader })).rejects.toThrow(/manifest-missing/);
  });
});

// MARK: Non-strict failures warn-and-skip
describe('loadSemanticTypeManifests – non-strict failures warn', () => {
  it('emits manifest-missing for a missing external source and continues with the rest', async () => {
    const goodManifest = manifestFixture();
    const reader = makeReader({ '/m/good.json': JSON.stringify(goodManifest) });

    const result = await loadSemanticTypeManifests({
      sources: [externalSource('/m/missing.json'), bundledSource('/m/good.json')],
      readFile: reader
    });

    expect(result.entries.size).toBe(1);
    expect(warningKinds(result.warnings)).toEqual(['manifest-missing']);
  });

  it('emits manifest-parse-failed for malformed external JSON', async () => {
    const goodManifest = manifestFixture();
    const reader = makeReader({
      '/m/bad.json': '{ not valid json',
      '/m/good.json': JSON.stringify(goodManifest)
    });

    const result = await loadSemanticTypeManifests({
      sources: [externalSource('/m/bad.json'), bundledSource('/m/good.json')],
      readFile: reader
    });

    expect(result.entries.size).toBe(1);
    expect(warningKinds(result.warnings)).toEqual(['manifest-parse-failed']);
  });

  it('emits manifest-version-unsupported for non-strict version mismatch', async () => {
    const futureManifest = { ...manifestFixture(), version: 99 };
    const goodManifest = manifestFixture();
    const reader = makeReader({
      '/m/future.json': JSON.stringify(futureManifest),
      '/m/good.json': JSON.stringify(goodManifest)
    });

    const result = await loadSemanticTypeManifests({
      sources: [externalSource('/m/future.json'), bundledSource('/m/good.json')],
      readFile: reader
    });

    const versionWarning = result.warnings.find((w) => w.kind === 'manifest-version-unsupported');
    expect(versionWarning).toEqual({
      kind: 'manifest-version-unsupported',
      path: '/m/future.json',
      version: 99
    });
  });

  it('emits manifest-schema-failed for non-strict schema mismatch', async () => {
    const badManifest = manifestFixture({ entries: [{ ...entryFixture(), topics: [] }] });
    const goodManifest = manifestFixture({ source: '@dereekb/util-2', topicNamespace: 'dereekb-util-2' });
    const reader = makeReader({
      '/m/bad.json': JSON.stringify(badManifest),
      '/m/good.json': JSON.stringify(goodManifest)
    });

    const result = await loadSemanticTypeManifests({
      sources: [externalSource('/m/bad.json'), bundledSource('/m/good.json')],
      readFile: reader
    });

    expect(warningKinds(result.warnings)).toEqual(['manifest-schema-failed']);
  });
});

// MARK: Zero-success guard
describe('loadSemanticTypeManifests – zero-success', () => {
  it('throws when every source fails, even non-strict ones', async () => {
    const reader = makeReader({});
    await expect(
      loadSemanticTypeManifests({
        sources: [externalSource('/m/missing-1.json'), externalSource('/m/missing-2.json')],
        readFile: reader
      })
    ).rejects.toThrow(/zero manifests loaded successfully/);
  });
});

// MARK: Determinism
describe('loadSemanticTypeManifests – warning ordering', () => {
  it('returns warnings in deterministic order regardless of source order', async () => {
    const goodManifest = manifestFixture({ source: '@dereekb/util-x', topicNamespace: 'dereekb-util-x' });
    const namespacedBad = manifestFixture({
      source: 'hellosubs',
      topicNamespace: 'hellosubs',
      entries: [entryFixture({ name: 'SchoolId', package: '@hellosubs/shared', module: 'school', topics: ['identifier', 'wrong:thing'] })]
    });
    const unknownBad = manifestFixture({
      source: 'foodflip',
      topicNamespace: 'foodflip',
      entries: [entryFixture({ name: 'MealCode', package: '@foodflip/shared', module: 'meal', topics: ['identifier', 'fake'] })]
    });
    const reader = makeReader({
      '/m/good.json': JSON.stringify(goodManifest),
      '/m/namespaced.json': JSON.stringify(namespacedBad),
      '/m/unknown.json': JSON.stringify(unknownBad)
    });

    const orderA = await loadSemanticTypeManifests({
      sources: [bundledSource('/m/good.json'), externalSource('/m/namespaced.json'), externalSource('/m/unknown.json')],
      readFile: reader
    });
    const orderB = await loadSemanticTypeManifests({
      sources: [externalSource('/m/unknown.json'), externalSource('/m/namespaced.json'), bundledSource('/m/good.json')],
      readFile: reader
    });

    expect(orderA.warnings).toEqual(orderB.warnings);
    // sanity: both kinds present, sorted alphabetically by kind
    const kinds = warningKinds(orderA.warnings);
    expect(kinds).toEqual([...kinds].sort());
  });
});
