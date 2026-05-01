import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { reconcile } from './reconcile.js';
import { validateAppModelApi, formatValidationAsMarkdown } from './index.js';

const WORKSPACE_ROOT = resolve(fileURLToPath(import.meta.url), '../../../../../..');
const COMPONENT_DIR = 'components/demo-firebase';
const COMPONENT_ABS = resolve(WORKSPACE_ROOT, COMPONENT_DIR);
const API_DIR = 'apps/demo-api';
const API_ABS = resolve(WORKSPACE_ROOT, API_DIR);

describe('validateAppModelApi (demo-firebase + demo-api)', () => {
  it('reads handler map and produces non-empty entries', async () => {
    const report = await validateAppModelApi({
      componentAbs: COMPONENT_ABS,
      componentDir: COMPONENT_DIR,
      apiAbs: API_ABS,
      apiDir: API_DIR
    });
    expect(report.handlerMapStatus.kind).toBe('ok');
    expect(report.entries.length).toBeGreaterThan(0);
    expect(report.summaries.length).toBeGreaterThan(0);

    const matchedRow = report.entries.find((e) => e.model === 'profile' && e.verb === 'update' && e.specifier === 'username');
    expect(matchedRow?.declared).toBeDefined();
    expect(matchedRow?.handler?.handlerName).toBe('profileUpdateUsername');

    const markdown = formatValidationAsMarkdown(report);
    expect(markdown).toContain('# Model API validation');
    expect(markdown).toContain('`profile`');
  });

  it('filters by model', async () => {
    const report = await validateAppModelApi({
      componentAbs: COMPONENT_ABS,
      componentDir: COMPONENT_DIR,
      apiAbs: API_ABS,
      apiDir: API_DIR,
      modelFilter: 'Profile'
    });
    expect(report.summaries.every((s) => s.model.toLowerCase() === 'profile')).toBe(true);
  });
});

describe('reconcile (synthetic)', () => {
  const baseDeclared = [
    { model: 'profile', verb: 'update' as const, specifier: 'username', paramsTypeName: 'SetProfileUsernameParams', resultTypeName: undefined, sourceFile: 'src/lib/model/profile/profile.api.ts', line: 96 },
    { model: 'profile', verb: 'update' as const, specifier: '_', paramsTypeName: 'UpdateProfileParams', resultTypeName: undefined, sourceFile: 'src/lib/model/profile/profile.api.ts', line: 95 }
  ];

  it('flags MISSING_HANDLER when handler is absent', () => {
    const result = reconcile({ declared: baseDeclared, handlers: [{ model: 'profile', verb: 'update', specifier: '_', handlerName: 'profileUpdate', sourceFile: 'crud.functions.ts', line: 65 }] });
    expect(result.issues.find((i) => i.code === 'MISSING_HANDLER' && i.specifier === 'username')).toBeDefined();
    expect(result.issues.find((i) => i.code === 'MISSING_HANDLER' && i.specifier === '_')).toBeUndefined();
  });

  it('flags ORPHAN_HANDLER when handler has no declaration', () => {
    const result = reconcile({
      declared: baseDeclared,
      handlers: [
        { model: 'profile', verb: 'update', specifier: 'username', handlerName: 'profileUpdateUsername', sourceFile: 'crud.functions.ts', line: 66 },
        { model: 'profile', verb: 'update', specifier: '_', handlerName: 'profileUpdate', sourceFile: 'crud.functions.ts', line: 65 },
        { model: 'profile', verb: 'update', specifier: 'legacyMigrate', handlerName: 'profileLegacyMigrate', sourceFile: 'crud.functions.ts', line: 99 }
      ]
    });
    const orphan = result.issues.find((i) => i.code === 'ORPHAN_HANDLER');
    expect(orphan?.specifier).toBe('legacyMigrate');
    expect(result.issues.find((i) => i.code === 'MISSING_HANDLER')).toBeUndefined();
  });

  it('summarises declared / handled / matched / errors per model', () => {
    const result = reconcile({
      declared: baseDeclared,
      handlers: [{ model: 'profile', verb: 'update', specifier: 'username', handlerName: 'profileUpdateUsername', sourceFile: 'crud.functions.ts', line: 66 }]
    });
    const profile = result.summaries.find((s) => s.model === 'profile');
    expect(profile?.declaredCount).toBe(2);
    expect(profile?.handledCount).toBe(1);
    expect(profile?.matchedCount).toBe(1);
    expect(profile?.errorCount).toBe(1);
  });
});
