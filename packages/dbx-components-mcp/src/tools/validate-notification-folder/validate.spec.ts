import { describe, expect, it } from 'vitest';
import { validateNotificationFolder } from './index.js';
import { API_NOTIFICATION_SUBPATH, COMPONENT_NOTIFICATION_SUBPATH, type NotificationFolderInspection, type SideInspection, type ViolationCode } from './types.js';

const COMPONENT_DIR = 'components/demo-firebase';
const API_DIR = 'apps/demo-api';

const COMPONENT_FILES = ['notification.ts', 'notification.task.ts', 'index.ts'];
const API_FILES = ['notification.module.ts', 'notification.task.service.ts', 'notification.send.service.ts', 'notification.send.mailgun.service.ts', 'notification.action.context.ts', 'notification.factory.ts', 'notification.init.ts', 'notification.mailgun.ts', 'index.ts'];

function componentSide(input: { readonly files?: readonly string[]; readonly entries?: readonly string[]; readonly indexSource?: string | undefined; readonly status?: SideInspection['status'] }): SideInspection {
  return {
    side: 'component',
    rootDir: COMPONENT_DIR,
    subPath: COMPONENT_NOTIFICATION_SUBPATH,
    status: input.status ?? 'ok',
    files: input.files ?? COMPONENT_FILES,
    entries: input.entries ?? [],
    indexSource: input.indexSource
  };
}

function apiSide(input: { readonly files?: readonly string[]; readonly entries?: readonly string[]; readonly indexSource?: string | undefined; readonly status?: SideInspection['status'] }): SideInspection {
  return {
    side: 'api',
    rootDir: API_DIR,
    subPath: API_NOTIFICATION_SUBPATH,
    status: input.status ?? 'ok',
    files: input.files ?? API_FILES,
    entries: input.entries ?? [],
    indexSource: input.indexSource
  };
}

function inspection(component: SideInspection, api: SideInspection): NotificationFolderInspection {
  return {
    componentDir: COMPONENT_DIR,
    apiDir: API_DIR,
    component,
    api
  };
}

function codes(violations: readonly { readonly code: ViolationCode }[]): readonly ViolationCode[] {
  return violations.map((v) => v.code);
}

describe('validateNotificationFolder — happy path', () => {
  it('passes a canonical demo-shaped layout', () => {
    const result = validateNotificationFolder(inspection(componentSide({}), apiSide({})));
    expect(
      result.errorCount,
      JSON.stringify(
        result.violations.filter((v) => v.severity === 'error'),
        null,
        2
      )
    ).toBe(0);
    expect(result.warningCount).toBe(0);
  });

  it('passes a minimal API set (only the three required files)', () => {
    const minimalApi = ['notification.module.ts', 'notification.task.service.ts', 'notification.send.service.ts'];
    const result = validateNotificationFolder(inspection(componentSide({}), apiSide({ files: minimalApi })));
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
  });

  it('passes when component side has no index.ts (barrel optional)', () => {
    const component = componentSide({ files: ['notification.ts', 'notification.task.ts'], indexSource: undefined });
    const result = validateNotificationFolder(inspection(component, apiSide({})));
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
  });
});

describe('validateNotificationFolder — directory presence', () => {
  it('flags a missing component directory', () => {
    const component = componentSide({ status: 'dir-not-found', files: [] });
    const result = validateNotificationFolder(inspection(component, apiSide({})));
    expect(codes(result.violations)).toContain('NOTIF_FOLDER_COMPONENT_DIR_NOT_FOUND');
  });

  it('flags a missing api directory', () => {
    const api = apiSide({ status: 'dir-not-found', files: [] });
    const result = validateNotificationFolder(inspection(componentSide({}), api));
    expect(codes(result.violations)).toContain('NOTIF_FOLDER_API_DIR_NOT_FOUND');
  });

  it('flags a missing component notification folder', () => {
    const component = componentSide({ status: 'folder-missing', files: [] });
    const result = validateNotificationFolder(inspection(component, apiSide({})));
    expect(codes(result.violations)).toContain('NOTIF_FOLDER_COMPONENT_FOLDER_MISSING');
  });

  it('flags a missing api notification folder', () => {
    const api = apiSide({ status: 'folder-missing', files: [] });
    const result = validateNotificationFolder(inspection(componentSide({}), api));
    expect(codes(result.violations)).toContain('NOTIF_FOLDER_API_FOLDER_MISSING');
  });
});

describe('validateNotificationFolder — required api files', () => {
  it('flags missing notification.module.ts', () => {
    const files = API_FILES.filter((f) => f !== 'notification.module.ts');
    const result = validateNotificationFolder(inspection(componentSide({}), apiSide({ files })));
    expect(codes(result.violations)).toContain('NOTIF_FOLDER_MODULE_FILE_MISSING');
  });

  it('flags missing notification.task.service.ts', () => {
    const files = API_FILES.filter((f) => f !== 'notification.task.service.ts');
    const result = validateNotificationFolder(inspection(componentSide({}), apiSide({ files })));
    expect(codes(result.violations)).toContain('NOTIF_FOLDER_TASK_SERVICE_FILE_MISSING');
  });

  it('flags missing notification.send.service.ts', () => {
    const files = API_FILES.filter((f) => f !== 'notification.send.service.ts');
    const result = validateNotificationFolder(inspection(componentSide({}), apiSide({ files })));
    expect(codes(result.violations)).toContain('NOTIF_FOLDER_SEND_SERVICE_FILE_MISSING');
  });
});

describe('validateNotificationFolder — file naming', () => {
  it('warns on a stray .ts file at the folder root (component side)', () => {
    const component = componentSide({ files: [...COMPONENT_FILES, 'helpers.ts'] });
    const result = validateNotificationFolder(inspection(component, apiSide({})));
    const warnings = result.violations.filter((v) => v.code === 'NOTIF_FOLDER_UNEXPECTED_FILE_NAME');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].file).toBe('helpers.ts');
    expect(warnings[0].side).toBe('component');
  });

  it('warns on a stray .ts file at the folder root (api side)', () => {
    const api = apiSide({ files: [...API_FILES, 'random.ts'] });
    const result = validateNotificationFolder(inspection(componentSide({}), api));
    const warnings = result.violations.filter((v) => v.code === 'NOTIF_FOLDER_UNEXPECTED_FILE_NAME');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].file).toBe('random.ts');
    expect(warnings[0].side).toBe('api');
  });

  it('does not warn on `index.ts` or files starting with `notification.`', () => {
    const api = apiSide({ files: [...API_FILES, 'notification.send.mailgun.service.ts'] });
    const result = validateNotificationFolder(inspection(componentSide({}), api));
    const warnings = result.violations.filter((v) => v.code === 'NOTIF_FOLDER_UNEXPECTED_FILE_NAME');
    expect(warnings).toHaveLength(0);
  });
});

describe('validateNotificationFolder — handlers subfolder mix', () => {
  it('warns on non-canonical files at the api root when a `handlers/` subfolder is present', () => {
    const api = apiSide({
      files: [...API_FILES, 'notification.task.handler.profile.ts'],
      entries: ['handlers']
    });
    const result = validateNotificationFolder(inspection(componentSide({}), api));
    const warnings = result.violations.filter((v) => v.code === 'NOTIF_FOLDER_HANDLERS_SUBFOLDER_MIXED');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].file).toBe('notification.task.handler.profile.ts');
  });

  it('does not warn on the canonical convention files even when `handlers/` is present', () => {
    const api = apiSide({ entries: ['handlers'] });
    const result = validateNotificationFolder(inspection(componentSide({}), api));
    const warnings = result.violations.filter((v) => v.code === 'NOTIF_FOLDER_HANDLERS_SUBFOLDER_MIXED');
    expect(warnings).toHaveLength(0);
  });

  it('does not warn when `handlers/` is absent', () => {
    const api = apiSide({ files: [...API_FILES, 'notification.task.handler.profile.ts'] });
    const result = validateNotificationFolder(inspection(componentSide({}), api));
    const warnings = result.violations.filter((v) => v.code === 'NOTIF_FOLDER_HANDLERS_SUBFOLDER_MIXED');
    expect(warnings).toHaveLength(0);
  });
});

describe('validateNotificationFolder — barrel re-exports', () => {
  it('errors when index.ts re-exports a path that has no matching .ts file or subfolder', () => {
    const indexSource = `export * from './notification';\nexport * from './missing';\n`;
    const component = componentSide({ files: ['notification.ts', 'index.ts'], indexSource });
    const result = validateNotificationFolder(inspection(component, apiSide({})));
    const errors = result.violations.filter((v) => v.code === 'NOTIF_FOLDER_BARREL_REEXPORT_MISSING');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('./missing');
  });

  it('accepts re-exports that resolve to a sibling subfolder', () => {
    const indexSource = `export * from './notification.module';\nexport * from './handlers';\n`;
    const api = apiSide({ entries: ['handlers'], indexSource });
    const result = validateNotificationFolder(inspection(componentSide({}), api));
    const errors = result.violations.filter((v) => v.code === 'NOTIF_FOLDER_BARREL_REEXPORT_MISSING');
    expect(errors).toHaveLength(0);
  });

  it('accepts re-exports that resolve via a `.js` suffix', () => {
    const indexSource = `export * from './notification.js';\n`;
    const component = componentSide({ files: ['notification.ts', 'index.ts'], indexSource });
    const result = validateNotificationFolder(inspection(component, apiSide({})));
    const errors = result.violations.filter((v) => v.code === 'NOTIF_FOLDER_BARREL_REEXPORT_MISSING');
    expect(errors).toHaveLength(0);
  });

  it('does not run barrel checks when index.ts is absent', () => {
    const component = componentSide({ files: ['notification.ts'], indexSource: undefined });
    const result = validateNotificationFolder(inspection(component, apiSide({})));
    const errors = result.violations.filter((v) => v.code === 'NOTIF_FOLDER_BARREL_REEXPORT_MISSING');
    expect(errors).toHaveLength(0);
  });
});
