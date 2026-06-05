import { describe, it, expect } from 'vitest';
import { type ModelExtractionConverter } from '@dereekb/dbx-cli/manifest-extract';
import { generateSampleModel } from './model-size.sample';
import { parseModelSizeProfile } from './model-size.profile';

const ENTRY_SUB: ModelExtractionConverter = {
  converterConst: 'entrySub',
  factory: 'firestoreSubObject',
  interfaceName: undefined,
  line: 1,
  fields: [
    { key: 'm', converter: 'firestoreString()' },
    { key: 's', converter: 'firestoreNumber()' }
  ]
};

const TREE: ModelExtractionConverter = {
  converterConst: 'fooConverter',
  factory: 'snapshotConverterFunctions',
  interfaceName: 'Foo',
  line: 1,
  fields: [
    { key: 'name', converter: 'firestoreString()' },
    { key: 'count', converter: 'firestoreNumber()' },
    { key: 'active', converter: 'firestoreBoolean()' },
    { key: 'at', converter: 'firestoreDate()' },
    { key: 'tags', converter: 'firestoreModelIdArrayField' },
    { key: 'note', converter: 'optionalFirestoreString()' },
    { key: 'entries', converter: 'firestoreObjectArray({ objectField: entrySub })', nestedConverterRef: 'entrySub', nestedIsArray: true }
  ]
};

const REGISTRY = new Map<string, ModelExtractionConverter>([
  ['fooConverter', TREE],
  ['entrySub', ENTRY_SUB]
]);

describe('generateSampleModel', () => {
  it('generates correctly-typed, correctly-sized values from the profile', () => {
    const profile = parseModelSizeProfile({
      source: './x.ts',
      defaults: { string: 5, number: 100, arrayCount: 2, mapCount: 2 },
      fields: { name: 10, 'tags[]': 4, 'entries[]': 3, 'entries[].m': 7 }
    });

    const { model } = generateSampleModel({ converter: TREE, profile, registry: REGISTRY });

    expect((model['name'] as string).length).toBe(10);
    expect(typeof model['count']).toBe('number');
    expect(model['active']).toBe(true);
    expect(model['at']).toBeInstanceOf(Date);
    expect(model['note']).toBeDefined();

    const tags = model['tags'] as string[];
    expect(tags).toHaveLength(4);
    expect(new Set(tags).size).toBe(4); // distinct so unique-arrays don't collapse

    const entries = model['entries'] as Array<Record<string, unknown>>;
    expect(entries).toHaveLength(3);
    expect((entries[0]['m'] as string).length).toBe(7);
    expect(entries[0]['m']).not.toBe(entries[1]['m']); // distinct elements
    expect(typeof entries[0]['s']).toBe('number');
  });

  it('omits optional fields when includeOptional is false', () => {
    const profile = parseModelSizeProfile({ source: './x.ts', includeOptional: false });
    const { model } = generateSampleModel({ converter: TREE, profile, registry: REGISTRY });
    expect(model['note']).toBeUndefined();
  });

  it('warns and falls back when a nested ref cannot be resolved', () => {
    const profile = parseModelSizeProfile({ source: './x.ts' });
    const { model, warnings } = generateSampleModel({ converter: TREE, profile, registry: new Map([['fooConverter', TREE]]) });

    expect(Array.isArray(model['entries'])).toBe(true);
    expect(warnings.some((w) => w.includes('entrySub'))).toBe(true);
  });
});
