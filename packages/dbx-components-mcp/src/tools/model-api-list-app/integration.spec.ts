import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { listAppModelApi } from './index.js';

const COMPONENT_DIR = 'components/demo-firebase';
const WORKSPACE_ROOT = resolve(fileURLToPath(import.meta.url), '../../../../../..');
const COMPONENT_ABS = resolve(WORKSPACE_ROOT, COMPONENT_DIR);

describe('listAppModelApi (demo-firebase)', () => {
  it('extracts profile and guestbook CRUD entries from the real package', async () => {
    const report = await listAppModelApi(COMPONENT_ABS, { componentDir: COMPONENT_DIR });

    expect(report.entries.length).toBeGreaterThan(0);
    expect(report.files.map((f) => f.sourceFile).sort()).toEqual(['src/lib/model/guestbook/guestbook.api.ts', 'src/lib/model/profile/profile.api.ts', 'src/lib/model/system/system.api.ts'].sort());

    const profileFile = report.files.find((f) => f.sourceFile.endsWith('profile/profile.api.ts'));
    expect(profileFile?.groupName).toBe('Profile');
    expect(profileFile?.modelKeys).toContain('profile');

    const guestbookEntries = report.entries.filter((e) => e.sourceFile.endsWith('guestbook/guestbook.api.ts'));
    const guestbookCreate = guestbookEntries.find((e) => e.model === 'guestbook' && e.verb === 'create');
    expect(guestbookCreate?.paramsTypeName).toBe('CreateGuestbookParams');

    const profileUsername = report.entries.find((e) => e.model === 'profile' && e.verb === 'update' && e.specifier === 'username');
    expect(profileUsername?.paramsTypeName).toBe('SetProfileUsernameParams');
  });

  it('respects a model filter', async () => {
    const report = await listAppModelApi(COMPONENT_ABS, { componentDir: COMPONENT_DIR, modelFilter: 'Profile' });
    expect(report.modelFilter).toBe('Profile');
    expect(report.entries.every((e) => e.sourceFile.includes('profile/'))).toBe(true);
    expect(report.entries.length).toBeGreaterThan(0);
  });
});
