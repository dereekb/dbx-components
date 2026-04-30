import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RESERVED_MODEL_FOLDERS } from '../../tools/model-validate-folder/types.js';
import { extractModels } from './index.js';

const WORKSPACE_ROOT = resolve(__dirname, '../../../../..');
const DEMO_MODEL_ROOT = resolve(WORKSPACE_ROOT, 'components/demo-firebase/src/lib/model');
const RESERVED_NAMES = RESERVED_MODEL_FOLDERS.map((r) => r.name);

describe('extractModels (rich ts-morph extractor)', () => {
  it('extracts demo-firebase models with full FirebaseModel parity', async () => {
    const result = await extractModels({
      rootDir: DEMO_MODEL_ROOT,
      sourcePackage: 'demo-firebase',
      workspaceRoot: WORKSPACE_ROOT,
      skipReservedFolders: RESERVED_NAMES
    });
    expect(result.errors, `errors: ${JSON.stringify(result.errors, null, 2)}`).toEqual([]);
    const byName = new Map(result.models.map((m) => [m.name, m]));
    const guestbook = byName.get('Guestbook');
    expect(guestbook, 'Guestbook missing').toBeDefined();
    expect(guestbook?.identityConst).toBe('guestbookIdentity');
    expect(guestbook?.modelType).toBe('guestbook');
    expect(guestbook?.collectionPrefix).toBe('gb');
    expect(guestbook?.parentIdentityConst).toBeUndefined();
    expect(guestbook?.collectionKind).toBe('root');
    expect(guestbook?.sourcePackage).toBe('demo-firebase');
    expect(guestbook?.sourceFile).toMatch(/components\/demo-firebase\/src\/lib\/model\/guestbook\/guestbook\.ts$/);
    expect(guestbook?.fields.map((f) => f.name)).toEqual(['published', 'name', 'locked', 'lockedAt', 'cby']);
    expect(guestbook?.modelGroup).toBe('Guestbook');

    const entry = byName.get('GuestbookEntry');
    expect(entry, 'GuestbookEntry missing').toBeDefined();
    expect(entry?.parentIdentityConst).toBe('guestbookIdentity');
    expect(entry?.collectionKind).toBe('sub-collection');
    expect(entry?.modelGroup).toBe('Guestbook');
    expect(entry?.fields.find((f) => f.name === 'message')?.tsType).toBe('string');
    expect(entry?.fields.find((f) => f.name === 'message')?.longName).toBe('message');
  });

  it('skips reserved top-level folders in the model walk', async () => {
    const result = await extractModels({
      rootDir: DEMO_MODEL_ROOT,
      sourcePackage: 'demo-firebase',
      workspaceRoot: WORKSPACE_ROOT,
      skipReservedFolders: RESERVED_NAMES
    });
    for (const model of result.models) {
      for (const reserved of RESERVED_NAMES) {
        expect(model.sourceFile.includes(`/model/${reserved}/`), `${model.name} sourced from reserved folder ${reserved}`).toBe(false);
      }
    }
  });

  it('records modelGroup containers found alongside models', async () => {
    const result = await extractModels({
      rootDir: DEMO_MODEL_ROOT,
      sourcePackage: 'demo-firebase',
      workspaceRoot: WORKSPACE_ROOT,
      skipReservedFolders: RESERVED_NAMES
    });
    const groupNames = new Set(result.modelGroups.map((g) => g.name));
    expect(groupNames.has('Guestbook'), 'Guestbook group missing').toBe(true);
    const guestbookGroup = result.modelGroups.find((g) => g.name === 'Guestbook');
    expect(guestbookGroup?.containerName).toBe('GuestbookFirestoreCollections');
    expect(guestbookGroup?.modelNames).toEqual(['Guestbook', 'GuestbookEntry']);
  });
});
