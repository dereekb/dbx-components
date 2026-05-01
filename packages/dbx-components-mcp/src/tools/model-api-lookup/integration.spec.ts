import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { lookupModelApi, formatLookupAsMarkdown } from './index.js';

const WORKSPACE_ROOT = resolve(fileURLToPath(import.meta.url), '../../../../../..');
const COMPONENT_DIR = 'components/demo-firebase';
const COMPONENT_ABS = resolve(WORKSPACE_ROOT, COMPONENT_DIR);
const API_DIR = 'apps/demo-api';
const API_ABS = resolve(WORKSPACE_ROOT, API_DIR);

describe('lookupModelApi (demo-firebase + demo-api)', () => {
  it('attaches action / factory JSDoc to Profile entries', async () => {
    const report = await lookupModelApi({
      componentAbs: COMPONENT_ABS,
      componentDir: COMPONENT_DIR,
      apiAbs: API_ABS,
      apiDir: API_DIR,
      modelFilter: 'Profile'
    });

    expect(report.groupName).toBe('Profile');
    expect(report.sourceFile).toBe('src/lib/model/profile/profile.api.ts');
    expect(report.actionLookupStatus.kind).toBe('ok');

    const updateUsername = report.entries.find((e) => e.verb === 'update' && e.specifier === 'username');
    expect(updateUsername).toBeDefined();
    expect(updateUsername?.paramsTypeName).toBe('SetProfileUsernameParams');
    expect(updateUsername?.action?.methodName).toBe('setProfileUsername');
    expect(updateUsername?.action?.className).toBe('ProfileServerActions');
    expect(updateUsername?.factory?.factoryName).toBe('setProfileUsernameFactory');
    expect(updateUsername?.factory?.jsDoc).toMatch(/sets a profile's username within a transaction/i);
  });

  it('resolves identity to model and surfaces params field JSDoc', async () => {
    const report = await lookupModelApi({
      componentAbs: COMPONENT_ABS,
      componentDir: COMPONENT_DIR,
      apiAbs: API_ABS,
      apiDir: API_DIR,
      modelFilter: 'profile'
    });

    const resetPassword = report.entries.find((e) => e.verb === 'update' && e.specifier === 'resetPassword');
    expect(resetPassword?.paramsTypeName).toBe('ResetProfilePasswordParams');
    expect(resetPassword?.paramsJsDoc).toMatch(/Params for initiating or completing a password reset/i);
    const requestResetField = resetPassword?.paramsFields.find((f) => f.name === 'requestReset');
    expect(requestResetField?.jsDoc).toMatch(/initiates a new password reset/i);
  });

  it('runs without apiDir and skips action lookup', async () => {
    const report = await lookupModelApi({
      componentAbs: COMPONENT_ABS,
      componentDir: COMPONENT_DIR,
      modelFilter: 'Guestbook'
    });

    expect(report.groupName).toBe('Guestbook');
    expect(report.actionLookupStatus.kind).toBe('skipped');
    const guestbookCreate = report.entries.find((e) => e.model === 'guestbook' && e.verb === 'create');
    expect(guestbookCreate?.action).toBeUndefined();
    expect(guestbookCreate?.factory).toBeUndefined();
    expect(guestbookCreate?.paramsTypeName).toBe('CreateGuestbookParams');
  });

  it('renders markdown that includes the action factory JSDoc', async () => {
    const report = await lookupModelApi({
      componentAbs: COMPONENT_ABS,
      componentDir: COMPONENT_DIR,
      apiAbs: API_ABS,
      apiDir: API_DIR,
      modelFilter: 'Profile'
    });
    const markdown = formatLookupAsMarkdown(report);
    expect(markdown).toContain('# Model API lookup');
    expect(markdown).toContain('setProfileUsernameFactory');
    expect(markdown).toContain("sets a profile's username within a transaction");
  });
});
