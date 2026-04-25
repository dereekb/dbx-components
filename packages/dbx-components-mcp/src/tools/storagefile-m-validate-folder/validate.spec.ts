import { describe, expect, it } from 'vitest';
import { validateStorageFileFolder } from './index.js';
import { API_STORAGEFILE_SUBPATH, COMPONENT_STORAGEFILE_SUBPATH, type SideInspection, type StorageFileFolderInspection, type ViolationCode } from './types.js';

const COMPONENT_DIR = 'components/demo-firebase';
const API_DIR = 'apps/demo-api';

const COMPONENT_FILES = ['storagefile.ts', 'index.ts'];
const API_FILES = ['storagefile.upload.service.ts', 'storagefile.module.ts', 'storagefile.init.ts', 'index.ts'];

function componentSide(input: { readonly files?: readonly string[]; readonly entries?: readonly string[]; readonly indexSource?: string | undefined; readonly status?: SideInspection['status'] }): SideInspection {
  return {
    side: 'component',
    rootDir: COMPONENT_DIR,
    subPath: COMPONENT_STORAGEFILE_SUBPATH,
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
    subPath: API_STORAGEFILE_SUBPATH,
    status: input.status ?? 'ok',
    files: input.files ?? API_FILES,
    entries: input.entries ?? [],
    indexSource: input.indexSource
  };
}

function inspection(component: SideInspection, api: SideInspection): StorageFileFolderInspection {
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

describe('validateStorageFileFolder — happy path', () => {
  it('passes a canonical demo-shaped layout', () => {
    const result = validateStorageFileFolder(inspection(componentSide({}), apiSide({})));
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

  it('passes when component side has no index.ts (barrel optional)', () => {
    const component = componentSide({ files: ['storagefile.ts'], indexSource: undefined });
    const result = validateStorageFileFolder(inspection(component, apiSide({})));
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
  });

  it('passes when api side splits into storagefile.<sub>.ts files plus the required three', () => {
    const files = [...API_FILES, 'storagefile.create.ts', 'storagefile.read.ts'];
    const result = validateStorageFileFolder(inspection(componentSide({}), apiSide({ files })));
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
  });
});

describe('validateStorageFileFolder — directory presence', () => {
  it('flags a missing component directory', () => {
    const component = componentSide({ status: 'dir-not-found', files: [] });
    const result = validateStorageFileFolder(inspection(component, apiSide({})));
    expect(codes(result.violations)).toContain('STORAGEFILE_FOLDER_COMPONENT_DIR_NOT_FOUND');
  });

  it('flags a missing api directory', () => {
    const api = apiSide({ status: 'dir-not-found', files: [] });
    const result = validateStorageFileFolder(inspection(componentSide({}), api));
    expect(codes(result.violations)).toContain('STORAGEFILE_FOLDER_API_DIR_NOT_FOUND');
  });

  it('flags a missing component storagefile folder', () => {
    const component = componentSide({ status: 'folder-missing', files: [] });
    const result = validateStorageFileFolder(inspection(component, apiSide({})));
    expect(codes(result.violations)).toContain('STORAGEFILE_FOLDER_COMPONENT_FOLDER_MISSING');
  });

  it('flags a missing api storagefile folder', () => {
    const api = apiSide({ status: 'folder-missing', files: [] });
    const result = validateStorageFileFolder(inspection(componentSide({}), api));
    expect(codes(result.violations)).toContain('STORAGEFILE_FOLDER_API_FOLDER_MISSING');
  });
});

describe('validateStorageFileFolder — required api files', () => {
  it('flags missing storagefile.module.ts', () => {
    const files = API_FILES.filter((f) => f !== 'storagefile.module.ts');
    const result = validateStorageFileFolder(inspection(componentSide({}), apiSide({ files })));
    expect(codes(result.violations)).toContain('STORAGEFILE_FOLDER_MODULE_FILE_MISSING');
  });

  it('flags missing storagefile.upload.service.ts', () => {
    const files = API_FILES.filter((f) => f !== 'storagefile.upload.service.ts');
    const result = validateStorageFileFolder(inspection(componentSide({}), apiSide({ files })));
    expect(codes(result.violations)).toContain('STORAGEFILE_FOLDER_UPLOAD_SERVICE_FILE_MISSING');
  });

  it('flags missing storagefile.init.ts', () => {
    const files = API_FILES.filter((f) => f !== 'storagefile.init.ts');
    const result = validateStorageFileFolder(inspection(componentSide({}), apiSide({ files })));
    expect(codes(result.violations)).toContain('STORAGEFILE_FOLDER_INIT_FILE_MISSING');
  });
});

describe('validateStorageFileFolder — file naming', () => {
  it('warns on a stray .ts file at the folder root (component side)', () => {
    const component = componentSide({ files: [...COMPONENT_FILES, 'helpers.ts'] });
    const result = validateStorageFileFolder(inspection(component, apiSide({})));
    const warnings = result.violations.filter((v) => v.code === 'STORAGEFILE_FOLDER_UNEXPECTED_FILE_NAME');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].file).toBe('helpers.ts');
    expect(warnings[0].side).toBe('component');
  });

  it('warns on a stray .ts file at the folder root (api side)', () => {
    const api = apiSide({ files: [...API_FILES, 'random.ts'] });
    const result = validateStorageFileFolder(inspection(componentSide({}), api));
    const warnings = result.violations.filter((v) => v.code === 'STORAGEFILE_FOLDER_UNEXPECTED_FILE_NAME');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].file).toBe('random.ts');
    expect(warnings[0].side).toBe('api');
  });

  it('does not warn on `index.ts` or files starting with `storagefile.`', () => {
    const api = apiSide({ files: [...API_FILES, 'storagefile.create.ts'] });
    const result = validateStorageFileFolder(inspection(componentSide({}), api));
    const warnings = result.violations.filter((v) => v.code === 'STORAGEFILE_FOLDER_UNEXPECTED_FILE_NAME');
    expect(warnings).toHaveLength(0);
  });
});

describe('validateStorageFileFolder — handlers subfolder mix', () => {
  it('warns on non-canonical files at the api root when a `handlers/` subfolder is present', () => {
    const api = apiSide({
      files: [...API_FILES, 'storagefile.upload.worker.ts'],
      entries: ['handlers']
    });
    const result = validateStorageFileFolder(inspection(componentSide({}), api));
    const warnings = result.violations.filter((v) => v.code === 'STORAGEFILE_FOLDER_HANDLERS_SUBFOLDER_MIXED');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].file).toBe('storagefile.upload.worker.ts');
  });

  it('does not warn on the canonical required files even when `handlers/` is present', () => {
    const api = apiSide({ entries: ['handlers'] });
    const result = validateStorageFileFolder(inspection(componentSide({}), api));
    const warnings = result.violations.filter((v) => v.code === 'STORAGEFILE_FOLDER_HANDLERS_SUBFOLDER_MIXED');
    expect(warnings).toHaveLength(0);
  });

  it('does not warn when `handlers/` is absent', () => {
    const api = apiSide({ files: [...API_FILES, 'storagefile.upload.worker.ts'] });
    const result = validateStorageFileFolder(inspection(componentSide({}), api));
    const warnings = result.violations.filter((v) => v.code === 'STORAGEFILE_FOLDER_HANDLERS_SUBFOLDER_MIXED');
    expect(warnings).toHaveLength(0);
  });
});

describe('validateStorageFileFolder — barrel re-exports', () => {
  it('errors when index.ts re-exports a path that has no matching .ts file or subfolder', () => {
    const indexSource = `export * from './storagefile';\nexport * from './missing';\n`;
    const component = componentSide({ files: ['storagefile.ts', 'index.ts'], indexSource });
    const result = validateStorageFileFolder(inspection(component, apiSide({})));
    const errors = result.violations.filter((v) => v.code === 'STORAGEFILE_FOLDER_BARREL_REEXPORT_MISSING');
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('./missing');
  });

  it('accepts re-exports that resolve to a sibling subfolder', () => {
    const indexSource = `export * from './storagefile.module';\nexport * from './handlers';\n`;
    const api = apiSide({ entries: ['handlers'], indexSource });
    const result = validateStorageFileFolder(inspection(componentSide({}), api));
    const errors = result.violations.filter((v) => v.code === 'STORAGEFILE_FOLDER_BARREL_REEXPORT_MISSING');
    expect(errors).toHaveLength(0);
  });

  it('accepts re-exports that resolve via a `.js` suffix', () => {
    const indexSource = `export * from './storagefile.js';\n`;
    const component = componentSide({ files: ['storagefile.ts', 'index.ts'], indexSource });
    const result = validateStorageFileFolder(inspection(component, apiSide({})));
    const errors = result.violations.filter((v) => v.code === 'STORAGEFILE_FOLDER_BARREL_REEXPORT_MISSING');
    expect(errors).toHaveLength(0);
  });

  it('does not run barrel checks when index.ts is absent', () => {
    const component = componentSide({ files: ['storagefile.ts'], indexSource: undefined });
    const result = validateStorageFileFolder(inspection(component, apiSide({})));
    const errors = result.violations.filter((v) => v.code === 'STORAGEFILE_FOLDER_BARREL_REEXPORT_MISSING');
    expect(errors).toHaveLength(0);
  });
});
