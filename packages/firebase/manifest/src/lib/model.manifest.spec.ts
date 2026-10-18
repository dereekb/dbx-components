import { describe, expect, it } from 'vitest';
import { findCompositeKeyModelsDerivedFrom, findModelManifestEntry, flattenModelManifestFields, groupModelManifestEntries, isCompositeKeyModelDerivedFrom, MODEL_MANIFEST_UNGROUPED_LABEL, type ModelManifest, type ModelManifestEntry } from './model.manifest';
import { decodeModelManifestKey, decodeModelManifestKeySegments, ModelManifestKeyDecodeError, MODEL_MANIFEST_KEY_DECODE_ERROR_CODE } from './model.manifest.decode';
import { findModelManifestEnum, findReferencedModelManifestEnums, resolveModelManifestEnumList, resolveModelManifestEnumLookup, type ModelManifestEnums } from './model.manifest.enum';

const PROFILE: ModelManifestEntry = {
  modelType: 'profile',
  modelName: 'Profile',
  modelGroup: 'Profile',
  identityConst: 'profileIdentity',
  collectionPrefix: 'pr',
  sourcePackage: 'demo-firebase',
  sourceFile: 'profile.ts',
  fields: [
    { name: 'un', longName: 'username', optional: false },
    {
      name: 'r',
      longName: 'resume',
      optional: true,
      nestedFields: [
        { name: 's', longName: 'state', optional: false, enumRef: 'ResumeState' },
        { name: 'h', longName: 'history', optional: true, nestedFields: [{ name: 'o', longName: 'owner', optional: false, enumRef: 'OwnerKind' }] }
      ]
    }
  ]
};

const PROFILE_ITEM: ModelManifestEntry = {
  modelType: 'profileItem',
  modelName: 'ProfileItem',
  modelGroup: 'Profile',
  identityConst: 'profileItemIdentity',
  collectionPrefix: 'pi',
  parentIdentityConst: 'profileIdentity',
  exampleKey: 'pr/<profileId>/pi/<profileItemId>',
  sourcePackage: 'demo-firebase',
  sourceFile: 'profile.item.ts',
  fields: [{ name: 's', longName: 'state', optional: false, enumRef: 'ResumeState' }]
};

const BOX: ModelManifestEntry = {
  modelType: 'notificationBox',
  modelName: 'NotificationBox',
  identityConst: 'notificationBoxIdentity',
  collectionPrefix: 'nb',
  sourcePackage: '@dereekb/firebase',
  sourceFile: 'box.ts',
  fields: [],
  compositeKey: { from: '*', encoding: 'two-way' }
};

const SUMMARY: ModelManifestEntry = {
  modelType: 'profileSummary',
  modelName: 'ProfileSummary',
  modelGroup: 'Summary',
  identityConst: 'profileSummaryIdentity',
  collectionPrefix: 'ps',
  sourcePackage: 'demo-firebase',
  sourceFile: 'summary.ts',
  fields: [],
  compositeKey: { from: ['Profile'], encoding: 'one-way' }
};

const MANIFEST: ModelManifest = [PROFILE, PROFILE_ITEM, BOX, SUMMARY];

const ENUMS: ModelManifestEnums = {
  ResumeState: { name: 'ResumeState', values: [{ name: 'DRAFT', value: 0 }] },
  OwnerKind: { name: 'OwnerKind', values: [{ name: 'USER', value: 'u' }] }
};

describe('findModelManifestEntry()', () => {
  it('should match by modelType, identity const, or collection prefix', () => {
    expect(findModelManifestEntry('profile', MANIFEST)).toBe(PROFILE);
    expect(findModelManifestEntry('profileIdentity', MANIFEST)).toBe(PROFILE);
    expect(findModelManifestEntry('pr', MANIFEST)).toBe(PROFILE);
    expect(findModelManifestEntry('nope', MANIFEST)).toBeUndefined();
  });

  it('should return the first entry that matches any form', () => {
    const shadow: ModelManifestEntry = { ...PROFILE_ITEM, modelType: 'pr' };
    expect(findModelManifestEntry('pr', [PROFILE, shadow])).toBe(PROFILE);
    expect(findModelManifestEntry('pr', [shadow, PROFILE])).toBe(shadow);
  });
});

describe('composite keys', () => {
  it('should derive wildcard and named composite models, never from itself', () => {
    expect(findCompositeKeyModelsDerivedFrom(PROFILE, MANIFEST)).toEqual([BOX, SUMMARY]);
    expect(findCompositeKeyModelsDerivedFrom(PROFILE_ITEM, MANIFEST)).toEqual([BOX]);
    expect(isCompositeKeyModelDerivedFrom(BOX, BOX)).toBe(false);
  });
});

describe('flattenModelManifestFields()', () => {
  it('should flatten pre-order with short and long paths', () => {
    const flat = flattenModelManifestFields(PROFILE.fields).map((x) => [x.path, x.longPath, x.depth]);
    expect(flat).toEqual([
      ['un', 'username', 0],
      ['r', 'resume', 0],
      ['r.s', 'resume.state', 1],
      ['r.h', 'resume.history', 1],
      ['r.h.o', 'resume.history.owner', 2]
    ]);
  });
});

describe('groupModelManifestEntries()', () => {
  it('should sort groups by size then name, bucketing ungrouped models', () => {
    const groups = groupModelManifestEntries(MANIFEST).map((x) => [x.modelGroup, x.entries.map((e) => e.modelType)]);
    expect(groups).toEqual([
      ['Profile', ['profile', 'profileItem']],
      [MODEL_MANIFEST_UNGROUPED_LABEL, ['notificationBox']],
      ['Summary', ['profileSummary']]
    ]);
  });
});

describe('enums', () => {
  it('should match own keys only', () => {
    expect(findModelManifestEnum(ENUMS, 'ResumeState')).toBe(ENUMS['ResumeState']);
    expect(findModelManifestEnum(ENUMS, 'constructor')).toBeUndefined();
    expect(findModelManifestEnum(ENUMS, '__proto__')).toBeUndefined();
  });

  it('should resolve lookups with misses and the hint', () => {
    expect(resolveModelManifestEnumLookup({ names: ['OwnerKind', 'toString'], enums: ENUMS, notFoundHint: 'hint' })).toEqual({ enums: [ENUMS['OwnerKind']], notFound: ['toString'], hint: 'hint' });
    expect(resolveModelManifestEnumLookup({ names: ['OwnerKind'], enums: ENUMS })).toEqual({ enums: [ENUMS['OwnerKind']] });
  });

  it('should list sorted names', () => {
    expect(resolveModelManifestEnumList(ENUMS)).toEqual({ names: ['OwnerKind', 'ResumeState'], total: 2 });
  });

  it('should collect referenced enums deduped, recursing into nested fields', () => {
    const fields = [...PROFILE.fields, ...PROFILE_ITEM.fields, { name: 'x', longName: 'x', optional: false, enumRef: 'Missing' }];
    expect(findReferencedModelManifestEnums({ fields, enums: ENUMS }).map((x) => x.name)).toEqual(['ResumeState', 'OwnerKind']);
  });
});

describe('decodeModelManifestKeySegments()', () => {
  it('should decode a subcollection key', () => {
    const decoded = decodeModelManifestKeySegments(' pr/a/pi/b ', MANIFEST);
    expect(decoded.key).toBe('pr/a/pi/b');
    expect(decoded.valid).toBe(true);
    expect(decoded.leaf).toEqual({ prefix: 'pi', id: 'b', modelType: 'profileItem', modelName: 'ProfileItem', modelGroup: 'Profile', identityConst: 'profileItemIdentity', parentIdentityConst: 'profileIdentity', sourcePackage: 'demo-firebase', sourceFile: 'profile.item.ts' });
    expect(decoded.ancestors.map((x) => x.prefix)).toEqual(['pr']);
  });

  it('should omit undefined keys and report unresolved prefixes', () => {
    const decoded = decodeModelManifestKeySegments('nb/x/zz/y', MANIFEST);
    expect(Object.keys(decoded.ancestors[0])).not.toContain('modelGroup');
    expect(decoded.leaf).toEqual({ prefix: 'zz', id: 'y' });
    expect(decoded.unresolvedPrefixes).toEqual(['zz']);
    expect(decoded.valid).toBe(false);
  });

  it('should report each issue code', () => {
    expect(decodeModelManifestKeySegments('pi/b', MANIFEST).issues.map((x) => x.code)).toEqual(['MISSING_PARENT']);
    expect(decodeModelManifestKeySegments('pr/a/nb/b', MANIFEST).issues.map((x) => x.code)).toEqual(['NESTED_ROOT_COLLECTION']);
    expect(decodeModelManifestKeySegments('nb/a/pi/b', MANIFEST).issues.map((x) => x.code)).toEqual(['WRONG_PARENT']);
  });

  it('should throw a coded error for an empty key', () => {
    let error: unknown;

    try {
      decodeModelManifestKeySegments('  ', MANIFEST);
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(ModelManifestKeyDecodeError);
    const decodeError = error as ModelManifestKeyDecodeError;
    expect(decodeError.code).toBe(MODEL_MANIFEST_KEY_DECODE_ERROR_CODE);
    expect(decodeError.reason).toBe('empty');
    expect(decodeError.message).toBe('Key is empty. Provide a Firestore key like `prefix/id`.');
    expect(decodeError.suggestion).toBeUndefined();
  });

  it('should throw a coded error for an uneven key', () => {
    let error: unknown;

    try {
      decodeModelManifestKeySegments('pr/a/pi', MANIFEST);
    } catch (e) {
      error = e;
    }

    const decodeError = error as ModelManifestKeyDecodeError;
    expect(decodeError.reason).toBe('uneven_segments');
    expect(decodeError.key).toBe('pr/a/pi');
    expect(decodeError.segmentCount).toBe(3);
    expect(decodeError.message).toBe("Invalid Firestore key 'pr/a/pi'. Expected an even number of segments (`prefix/id` pairs). Got 3 segment(s).");
    expect(decodeError.suggestion).toContain('parentPrefix/parentId/childPrefix/childId');
  });
});

describe('decodeModelManifestKey()', () => {
  it('should publish one-way and two-way derived keys', () => {
    const decoded = decodeModelManifestKey('pr/abc', MANIFEST);
    expect(decoded.derivedKeys).toEqual([
      { key: 'nb/pr_abc', modelType: 'notificationBox', modelName: 'NotificationBox', collectionPrefix: 'nb', encoding: 'two-way' },
      { key: 'ps/prabc', modelType: 'profileSummary', modelName: 'ProfileSummary', collectionPrefix: 'ps', encoding: 'one-way' }
    ]);
    expect(decoded.compositeSource).toBeUndefined();
  });

  it('should decode the compositeSource of a two-way leaf', () => {
    const decoded = decodeModelManifestKey('nb/pr_abc', MANIFEST);
    expect(decoded.compositeSource?.leaf.modelType).toBe('profile');
    expect(decoded.compositeSource?.key).toBe('pr/abc');
  });

  it('should publish nothing for an invalid key', () => {
    const decoded = decodeModelManifestKey('pi/b', MANIFEST);
    expect(decoded.derivedKeys).toEqual([]);
    expect(decoded.compositeSource).toBeUndefined();
  });
});
