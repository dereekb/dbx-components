import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { reconcile } from './reconcile.js';
import { expectedHandlerNames } from './naming.js';
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

  it('reconciles upstream @dereekb/firebase declarations as matched (not orphan handlers)', async () => {
    const report = await validateAppModelApi({
      componentAbs: COMPONENT_ABS,
      componentDir: COMPONENT_DIR,
      apiAbs: API_ABS,
      apiDir: API_DIR
    });

    const upstreamCells: ReadonlyArray<{ readonly model: string; readonly verb: 'create' | 'read' | 'update' | 'delete' | 'query'; readonly specifier: string | undefined; readonly handlerName: string }> = [
      { model: 'oidcEntry', verb: 'create', specifier: 'client', handlerName: 'oidcEntryCreateClient' },
      { model: 'oidcEntry', verb: 'update', specifier: 'client', handlerName: 'oidcEntryUpdateClient' },
      { model: 'oidcEntry', verb: 'update', specifier: 'rotateClientSecret', handlerName: 'oidcEntryRotateClientSecret' },
      { model: 'oidcEntry', verb: 'delete', specifier: 'client', handlerName: 'oidcEntryDeleteClient' },
      { model: 'storageFile', verb: 'create', specifier: '_', handlerName: 'storageFileCreate' },
      { model: 'storageFile', verb: 'read', specifier: 'download', handlerName: 'storageFileDownload' },
      { model: 'storageFileGroup', verb: 'update', specifier: 'regenerateContent', handlerName: 'storageFileGroupRegenerateContent' },
      { model: 'notification', verb: 'update', specifier: 'send', handlerName: 'notificationSend' },
      { model: 'notificationBox', verb: 'update', specifier: '_', handlerName: 'notificationBoxUpdate' },
      { model: 'notificationUser', verb: 'update', specifier: 'resync', handlerName: 'notificationUserResync' }
    ];

    for (const cell of upstreamCells) {
      const row = report.entries.find((e) => e.model === cell.model && e.verb === cell.verb && e.specifier === cell.specifier);
      expect(row, `expected ${cell.model}.${cell.verb}.${cell.specifier ?? '_'} to be reconciled`).toBeDefined();
      expect(row?.declared, `expected upstream declaration for ${cell.model}.${cell.verb}.${cell.specifier ?? '_'}`).toBeDefined();
      expect(row?.handler?.handlerName).toBe(cell.handlerName);
    }

    // Upstream-declared cells must no longer be flagged as orphan handlers.
    // (`notification.create._` is intentionally excluded — that handler is wired in
    //  demo-api but genuinely undeclared upstream, so it remains a real orphan.)
    const reconciledModels = new Set(['oidcEntry', 'storageFile', 'storageFileGroup', 'notificationBox', 'notificationUser']);
    const stillOrphan = report.issues.filter((i) => i.code === 'ORPHAN_HANDLER' && reconciledModels.has(i.model));
    const stillOrphanLabel = stillOrphan
      .map((i) => {
        const suffix = i.specifier ? `.${i.specifier}` : '';
        return `${i.model}.${i.verb}${suffix}`;
      })
      .join(', ');
    expect(stillOrphan, `unexpected upstream orphans: ${stillOrphanLabel}`).toEqual([]);
    const notificationSendOrphan = report.issues.find((i) => i.code === 'ORPHAN_HANDLER' && i.model === 'notification' && i.specifier === 'send');
    expect(notificationSendOrphan).toBeUndefined();
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

describe('handler naming convention', () => {
  it('accepts <model><Verb> for default specifiers', () => {
    expect(expectedHandlerNames('profile', 'update', undefined)).toEqual(['profileUpdate']);
    expect(expectedHandlerNames('profile', 'update', '_')).toEqual(['profileUpdate']);
  });

  it('accepts both <model><Verb><Specifier> and <model><Specifier> forms', () => {
    expect(expectedHandlerNames('guestbookEntry', 'update', 'insert')).toEqual(['guestbookEntryUpdateInsert', 'guestbookEntryInsert']);
  });

  it('flags HANDLER_NAMING_MISMATCH when handler does not follow the convention', () => {
    const declared = [{ model: 'guestbookEntry', verb: 'update' as const, specifier: 'insert', paramsTypeName: 'InsertGuestbookEntryParams', resultTypeName: undefined, sourceFile: 'src/lib/model/guestbook/guestbookentry.api.ts', line: 42 }];
    const handlers = [{ model: 'guestbookEntry', verb: 'update' as const, specifier: 'insert', handlerName: 'insertGuestbookEntry', sourceFile: 'crud.functions.ts', line: 65 }];
    const result = reconcile({ declared, handlers });
    const naming = result.issues.find((i) => i.code === 'HANDLER_NAMING_MISMATCH');
    expect(naming).toBeDefined();
    expect(naming?.message).toContain('guestbookEntryUpdateInsert');
    expect(naming?.message).toContain('guestbookEntryInsert');
  });

  it('does not flag handlers that already follow the convention', () => {
    const declared = [
      { model: 'profile', verb: 'update' as const, specifier: 'username', paramsTypeName: 'SetProfileUsernameParams', resultTypeName: undefined, sourceFile: 'src/lib/model/profile/profile.api.ts', line: 96 },
      { model: 'profile', verb: 'update' as const, specifier: '_', paramsTypeName: 'UpdateProfileParams', resultTypeName: undefined, sourceFile: 'src/lib/model/profile/profile.api.ts', line: 95 }
    ];
    const handlers = [
      { model: 'profile', verb: 'update' as const, specifier: 'username', handlerName: 'profileUpdateUsername', sourceFile: 'crud.functions.ts', line: 66 },
      { model: 'profile', verb: 'update' as const, specifier: '_', handlerName: 'profileUpdate', sourceFile: 'crud.functions.ts', line: 65 }
    ];
    const result = reconcile({ declared, handlers });
    expect(result.issues.find((i) => i.code === 'HANDLER_NAMING_MISMATCH')).toBeUndefined();
  });

  it('accepts the verb-omitted shorthand', () => {
    const declared = [{ model: 'storageFile', verb: 'read' as const, specifier: 'download', paramsTypeName: 'DownloadStorageFileParams', resultTypeName: undefined, sourceFile: 'src/lib/model/storagefile/storagefile.api.ts', line: 50 }];
    const handlers = [{ model: 'storageFile', verb: 'read' as const, specifier: 'download', handlerName: 'storageFileDownload', sourceFile: 'crud.functions.ts', line: 52 }];
    const result = reconcile({ declared, handlers });
    expect(result.issues.find((i) => i.code === 'HANDLER_NAMING_MISMATCH')).toBeUndefined();
  });
});
