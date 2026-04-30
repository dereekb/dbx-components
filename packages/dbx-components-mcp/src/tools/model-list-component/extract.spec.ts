import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractComponentModels } from './extract.js';

const REPO_ROOT = resolve(__dirname, '../../../../..');
const DEMO_COMPONENT = resolve(REPO_ROOT, 'components/demo-firebase');

describe('extractComponentModels', () => {
  it('lists demo-firebase models grouped by folder', async () => {
    const outcome = await extractComponentModels(DEMO_COMPONENT);
    const folders = outcome.models.map((m) => m.folder);
    expect(folders).toContain('guestbook');
    expect(folders).toContain('profile');
    const guestbook = outcome.models.find((m) => m.folder === 'guestbook');
    expect(guestbook?.modelName).toBe('Guestbook');
    expect(guestbook?.identityConst).toBe('guestbookIdentity');
    expect(guestbook?.collectionName).toBe('guestbook');
    expect(guestbook?.collectionPrefix).toBe('gb');
    expect(guestbook?.parentIdentityConst).toBeUndefined();
    expect(guestbook?.sourceFile).toMatch(/^src\/lib\/model\/guestbook\/guestbook\.ts$/);
  });

  it('skips reserved folders', async () => {
    const outcome = await extractComponentModels(DEMO_COMPONENT);
    const skippedNames = new Set(outcome.skipped.map((s) => s.folder));
    expect(skippedNames.has('notification')).toBe(true);
    expect(skippedNames.has('storagefile')).toBe(true);
    expect(skippedNames.has('system')).toBe(true);
  });
});
