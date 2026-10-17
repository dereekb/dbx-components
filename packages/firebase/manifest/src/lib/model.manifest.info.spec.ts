import { describe, expect, it } from 'vitest';
import { type ModelManifest } from './model.manifest';
import { type ModelManifestEnums } from './model.manifest.enum';
import { buildModelManifestCatalog, MODEL_MANIFEST_CATALOG_SUMMARY_MAX_LENGTH, searchModelManifestCatalog } from './model.manifest.catalog';
import { MAX_MODEL_MANIFEST_INFO_LOOKUP_NAMES, MODEL_MANIFEST_INFO_INVALID_INPUT_ERROR_CODE, ModelManifestInfoInputError, resolveModelManifestInfoOutput, type ModelManifestInfoHints, type ModelManifestInfoInput } from './model.manifest.info';
import { buildModelManifestEnumUsageIndex } from './model.manifest.usage';

const MODELS: ModelManifest = [
  {
    modelType: 'guestbook',
    modelName: 'Guestbook',
    modelGroup: 'Guestbook',
    identityConst: 'guestbookIdentity',
    collectionPrefix: 'gb',
    description: 'A guestbook that people sign. Has entries.',
    sourcePackage: 'demo-firebase',
    sourceFile: 'guestbook.ts',
    fields: [
      { name: 'name', longName: 'name', optional: false, description: 'The guestbook name.' },
      { name: 'cat', longName: 'createdAt', optional: false, tsType: 'Date' }
    ]
  },
  {
    modelType: 'profile',
    modelName: 'Profile',
    modelGroup: 'Profile',
    identityConst: 'profileIdentity',
    collectionPrefix: 'pr',
    sourcePackage: 'demo-firebase',
    sourceFile: 'profile.ts',
    fields: [
      { name: 'cat', longName: 'createdAt', optional: false, tsType: 'Date' },
      { name: 'resume', longName: 'resume', optional: true, enumRef: 'ProfileResumeState', nestedFields: [{ name: 'state', longName: 'state', optional: false, tsType: 'ProfileResumeState', enumRef: 'ProfileResumeState' }] }
    ]
  },
  {
    modelType: 'notification',
    modelName: 'Notification',
    modelGroup: 'Notification',
    identityConst: 'notificationIdentity',
    collectionPrefix: 'nbn',
    sourcePackage: '@dereekb/firebase',
    sourceFile: 'notification.ts',
    fields: [
      { name: 'ts', longName: 'textSendState', optional: false, enumRef: 'NotificationSendState' },
      { name: 'es', longName: 'emailSendState', optional: false, enumRef: 'NotificationSendState' }
    ]
  }
];

const ENUMS: ModelManifestEnums = {
  ProfileResumeState: { name: 'ProfileResumeState', description: 'State of a profile resume.', values: [{ name: 'DRAFT', value: 0 }] },
  NotificationSendState: { name: 'NotificationSendState', description: `${'Send state words '.repeat(30)}end.`, values: [{ name: 'QUEUED', value: 0, description: 'Waiting to send.' }] }
};

const HINTS: ModelManifestInfoHints = { overview: 'overview hint', partial: 'partial hint', noMatch: 'no match hint', modelNotFound: 'model hint', enumNotFound: 'enum hint' };

const CATALOG = buildModelManifestCatalog({ models: MODELS, enums: ENUMS });

function resolve(input: ModelManifestInfoInput) {
  return resolveModelManifestInfoOutput({ catalog: CATALOG, input, hints: HINTS });
}

describe('buildModelManifestEnumUsageIndex()', () => {
  it('should list nested usages in manifest order', () => {
    const index = buildModelManifestEnumUsageIndex(MODELS);
    expect(index.get('ProfileResumeState')).toEqual([
      { modelType: 'profile', field: 'resume', longName: 'resume' },
      { modelType: 'profile', field: 'resume.state', longName: 'resume.state' }
    ]);
    expect(index.get('NotificationSendState')?.map((x) => x.field)).toEqual(['ts', 'es']);
  });
});

describe('searchModelManifestCatalog()', () => {
  it('should rank a model above its own fields', () => {
    const { hits } = searchModelManifestCatalog({ catalog: CATALOG, query: 'guestbook' });
    expect(hits[0]).toEqual({ kind: 'model', modelType: 'guestbook', modelName: 'Guestbook', collectionPrefix: 'gb', modelGroup: 'Guestbook', summary: 'A guestbook that people sign.' });
  });

  it('should put an exact enum name first', () => {
    const { hits } = searchModelManifestCatalog({ catalog: CATALOG, query: 'ProfileResumeState' });
    expect(hits[0]).toMatchObject({ kind: 'enum', enum: 'ProfileResumeState', valueCount: 1 });
  });

  it('should break ties in catalog order', () => {
    const { hits } = searchModelManifestCatalog({ catalog: CATALOG, query: 'createdAt' });
    expect(hits.map((x) => (x.kind === 'field' ? x.modelType : x.kind))).toEqual(['guestbook', 'profile']);
  });

  it('should filter by kind and list a kind without a query', () => {
    expect(searchModelManifestCatalog({ catalog: CATALOG, query: 'profile', kind: 'field' }).hits.every((x) => x.kind === 'field')).toBe(true);
    expect(searchModelManifestCatalog({ catalog: CATALOG, kind: 'enum' }).hits.map((x) => x.kind === 'enum' && x.enum)).toEqual(['NotificationSendState', 'ProfileResumeState']);
    expect(searchModelManifestCatalog({ catalog: CATALOG, query: '' }).total).toBe(0);
  });

  it('should page with offset and limit', () => {
    const all = searchModelManifestCatalog({ catalog: CATALOG, kind: 'field', limit: 50 });
    const page = searchModelManifestCatalog({ catalog: CATALOG, kind: 'field', limit: 2, offset: 2.7 });
    expect(page.offset).toBe(2);
    expect(page.hits).toEqual(all.hits.slice(2, 4));
    expect(page.total).toBe(all.total);
  });

  it('should fall back to any with partial', () => {
    const result = searchModelManifestCatalog({ catalog: CATALOG, query: 'guestbook zebra' });
    expect(result.partial).toBe(true);
    expect(result.total).toBeGreaterThan(0);
  });

  it('should drop stop words and match state with status', () => {
    expect(searchModelManifestCatalog({ catalog: CATALOG, query: 'the guestbook' }).partial).toBe(false);
    expect(searchModelManifestCatalog({ catalog: CATALOG, query: 'resume status' }).hits.length).toBeGreaterThan(0);
  });

  it('should cap summaries', () => {
    const hit = searchModelManifestCatalog({ catalog: CATALOG, query: 'NotificationSendState' }).hits[0];
    expect(hit.summary?.length).toBeLessThanOrEqual(MODEL_MANIFEST_CATALOG_SUMMARY_MAX_LENGTH);
  });
});

describe('resolveModelManifestInfoOutput()', () => {
  it('should return the overview with no arguments', () => {
    expect(resolve({})).toEqual({
      mode: 'overview',
      totalModels: 3,
      totalEnums: 2,
      groups: [
        { modelGroup: 'Guestbook', modelTypes: ['guestbook'] },
        { modelGroup: 'Notification', modelTypes: ['notification'] },
        { modelGroup: 'Profile', modelTypes: ['profile'] }
      ],
      enumNames: ['NotificationSendState', 'ProfileResumeState'],
      hint: 'overview hint'
    });
  });

  it('should search with nextOffset and hints', () => {
    const output = resolve({ query: 'createdAt', limit: 1 });
    expect(output).toMatchObject({ mode: 'search', total: 2, nextOffset: 1 });
    expect(resolve({ query: 'zebra' })).toEqual({ mode: 'search', total: 0, hint: 'no match hint', hits: [] });
    expect(resolve({ query: 'guestbook zebra' })).toMatchObject({ partial: true, hint: 'partial hint' });
  });

  it('should look up models verbatim with their referenced enums, deduping names', () => {
    const output = resolve({ model: ['profile', 'pr', 'profile', 'nope'] });
    expect(output).toEqual({ mode: 'model', models: [MODELS[1]], enums: [ENUMS['ProfileResumeState']], notFound: ['nope'], hint: 'model hint' });
  });

  it('should look up enums with usedBy', () => {
    const output = resolve({ enum: 'NotificationSendState' });
    expect(output).toEqual({ mode: 'enum', enums: [{ ...ENUMS['NotificationSendState'], usedBy: CATALOG.enumUsage.get('NotificationSendState') }] });
    expect(resolve({ enum: ['constructor'] })).toEqual({ mode: 'enum', enums: [], notFound: ['constructor'], hint: 'enum hint' });
  });

  it('should reject invalid combinations', () => {
    const invalid: ModelManifestInfoInput[] = [
      { query: 'a', model: 'b' },
      { model: 'a', enum: 'b' },
      { model: 'a', kind: 'model' },
      { enum: 'a', limit: 1 },
      { limit: 1 },
      { offset: 1 },
      { model: '' },
      { enum: [] },
      { model: Array.from({ length: MAX_MODEL_MANIFEST_INFO_LOOKUP_NAMES + 1 }, (_, i) => `m${i}`) },
      { kind: 'nope' as never }
    ];

    for (const input of invalid) {
      let error: unknown;

      try {
        resolve(input);
      } catch (e) {
        error = e;
      }

      expect(error).toBeInstanceOf(ModelManifestInfoInputError);
      expect((error as ModelManifestInfoInputError).code).toBe(MODEL_MANIFEST_INFO_INVALID_INPUT_ERROR_CODE);
    }
  });

  it('should accept the 20-name cap', () => {
    const output = resolve({ model: Array.from({ length: MAX_MODEL_MANIFEST_INFO_LOOKUP_NAMES }, (_, i) => `m${i}`) });
    expect(output.mode).toBe('model');
  });
});
