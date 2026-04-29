import { describe, expect, it } from 'vitest';
import { validateSystemFolders } from './index.js';
import type { SystemFolderInspection, ViolationCode } from './types.js';

const HAPPY_PATH_SOURCE = `import { firestoreDate, firestoreNumber, firestoreString, firestoreSubObject, optionalFirestoreBoolean, type SystemStateStoredData, type SystemStateStoredDataConverterMap, type SystemStateStoredDataFieldConverterConfig } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';

// MARK: Region Entities
export const REGION_ENTITIES_SYSTEM_STATE_TYPE = 'regionentities';

export interface RegionEntitiesSystemData extends SystemStateStoredData {
  rn: number;
  lat: Date;
}

export const regionEntitiesSystemDataConverter: SystemStateStoredDataFieldConverterConfig<RegionEntitiesSystemData> = firestoreSubObject<RegionEntitiesSystemData>({
  objectField: {
    fields: {
      rn: firestoreNumber({ default: 0 }),
      lat: firestoreDate({ saveDefaultAsNow: true })
    }
  }
});

// MARK: Scheduled Tasks
export const SCHEDULED_SYSTEM_TASKS_SYSTEM_STATE_TYPE = 'systemtask';

export interface ScheduledSystemTasksSystemData extends SystemStateStoredData {
  keepHourlyTasksPaused?: Maybe<boolean>;
}

export const scheduledSystemTasksSystemDataConverter: SystemStateStoredDataFieldConverterConfig<ScheduledSystemTasksSystemData> = firestoreSubObject<ScheduledSystemTasksSystemData>({
  objectField: {
    fields: {
      keepHourlyTasksPaused: optionalFirestoreBoolean()
    }
  }
});

// MARK: Converter Map
export const appSystemStateStoredDataConverterMap: SystemStateStoredDataConverterMap = {
  [REGION_ENTITIES_SYSTEM_STATE_TYPE]: regionEntitiesSystemDataConverter,
  [SCHEDULED_SYSTEM_TASKS_SYSTEM_STATE_TYPE]: scheduledSystemTasksSystemDataConverter
};
`;

const CANONICAL_FILES = ['system.ts', 'system.action.ts', 'index.ts'];

function systemInspection(files: readonly string[], systemSource: string | undefined): SystemFolderInspection {
  return {
    name: 'system',
    path: 'components/foo-firebase/src/lib/model/system',
    status: 'ok',
    files,
    systemSource
  };
}

function codesOf(codes: readonly ViolationCode[], expected: readonly ViolationCode[]): void {
  for (const c of expected) {
    expect(codes, `expected code ${c} in ${JSON.stringify(codes)}`).toContain(c);
  }
}

describe('validateSystemFolders — layout', () => {
  it('passes a canonical system folder (system.ts + system.action.ts + index.ts + valid triples)', () => {
    const result = validateSystemFolders([systemInspection(CANONICAL_FILES, HAPPY_PATH_SOURCE)]);
    expect(result.foldersChecked).toBe(1);
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

  it('passes with just system.ts and index.ts (action file is optional)', () => {
    const result = validateSystemFolders([systemInspection(['system.ts', 'index.ts'], HAPPY_PATH_SOURCE)]);
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
  });

  it('passes when system.api.ts is present (no violation for it)', () => {
    const files = [...CANONICAL_FILES, 'system.api.ts'];
    const result = validateSystemFolders([systemInspection(files, HAPPY_PATH_SOURCE)]);
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
  });

  it('flags a missing main system.ts file', () => {
    const result = validateSystemFolders([systemInspection(['index.ts', 'system.action.ts'], undefined)]);
    codesOf(
      result.violations.map((v) => v.code),
      ['SYSTEM_FOLDER_MISSING_MAIN']
    );
  });

  it('flags a missing index.ts file', () => {
    const result = validateSystemFolders([systemInspection(['system.ts'], HAPPY_PATH_SOURCE)]);
    codesOf(
      result.violations.map((v) => v.code),
      ['SYSTEM_FOLDER_MISSING_INDEX']
    );
  });

  it('flags disallowed system.id.ts', () => {
    const files = [...CANONICAL_FILES, 'system.id.ts'];
    const result = validateSystemFolders([systemInspection(files, HAPPY_PATH_SOURCE)]);
    const disallowed = result.violations.filter((v) => v.code === 'SYSTEM_FOLDER_DISALLOWED_FILE');
    expect(disallowed).toHaveLength(1);
    expect(disallowed[0].file).toBe('system.id.ts');
  });

  it('flags disallowed system.query.ts', () => {
    const files = [...CANONICAL_FILES, 'system.query.ts'];
    const result = validateSystemFolders([systemInspection(files, HAPPY_PATH_SOURCE)]);
    const disallowed = result.violations.filter((v) => v.code === 'SYSTEM_FOLDER_DISALLOWED_FILE');
    expect(disallowed).toHaveLength(1);
    expect(disallowed[0].file).toBe('system.query.ts');
  });

  it('warns on stray `.ts` files that do not start with `system.`', () => {
    const files = [...CANONICAL_FILES, 'helpers.ts'];
    const result = validateSystemFolders([systemInspection(files, HAPPY_PATH_SOURCE)]);
    const warnings = result.violations.filter((v) => v.code === 'SYSTEM_FOLDER_STRAY_FILE');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].severity).toBe('warning');
    expect(warnings[0].file).toBe('helpers.ts');
  });

  it('does not warn on `index.ts`, `system.*.ts`, or the main `system.ts`', () => {
    const files = [...CANONICAL_FILES, 'system.api.ts', 'system.util.ts'];
    const result = validateSystemFolders([systemInspection(files, HAPPY_PATH_SOURCE)]);
    const strayWarnings = result.violations.filter((v) => v.code === 'SYSTEM_FOLDER_STRAY_FILE');
    expect(strayWarnings).toHaveLength(0);
  });

  it('flags a not-found folder', () => {
    const inspection: SystemFolderInspection = {
      name: 'system',
      path: 'components/ghost/system',
      status: 'not-found',
      files: [],
      systemSource: undefined
    };
    const result = validateSystemFolders([inspection]);
    codesOf(
      result.violations.map((v) => v.code),
      ['SYSTEM_FOLDER_NOT_FOUND']
    );
  });

  it('flags a non-directory path', () => {
    const inspection: SystemFolderInspection = {
      name: 'system.ts',
      path: 'components/foo/system.ts',
      status: 'not-directory',
      files: [],
      systemSource: undefined
    };
    const result = validateSystemFolders([inspection]);
    codesOf(
      result.violations.map((v) => v.code),
      ['SYSTEM_FOLDER_NOT_DIRECTORY']
    );
  });
});

describe('validateSystemFolders — content', () => {
  it('errors when the converter map is missing', () => {
    const source = HAPPY_PATH_SOURCE.replace(/export const appSystemStateStoredDataConverterMap[\s\S]*?};\n/, '');
    const result = validateSystemFolders([systemInspection(CANONICAL_FILES, source)]);
    codesOf(
      result.violations.map((v) => v.code),
      ['SYSTEM_MISSING_CONVERTER_MAP']
    );
  });

  it('warns when the converter map is not the last top-level export', () => {
    const source =
      HAPPY_PATH_SOURCE +
      `
export const trailingSentinel = true;
`;
    const result = validateSystemFolders([systemInspection(CANONICAL_FILES, source)]);
    const warnings = result.violations.filter((v) => v.code === 'SYSTEM_CONVERTER_MAP_NOT_LAST');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].severity).toBe('warning');
  });

  it('errors when an interface has no matching converter', () => {
    const source = HAPPY_PATH_SOURCE.replace(/export const regionEntitiesSystemDataConverter[\s\S]*?}\);\n/, '');
    const result = validateSystemFolders([systemInspection(CANONICAL_FILES, source)]);
    const missing = result.violations.filter((v) => v.code === 'SYSTEM_MISSING_CONVERTER');
    expect(missing).toHaveLength(1);
    expect(missing[0].message).toContain('regionEntitiesSystemDataConverter');
  });

  it('errors when an interface has no matching _SYSTEM_STATE_TYPE constant', () => {
    const source = HAPPY_PATH_SOURCE.replace("export const REGION_ENTITIES_SYSTEM_STATE_TYPE = 'regionentities';\n", '');
    const result = validateSystemFolders([systemInspection(CANONICAL_FILES, source)]);
    const missing = result.violations.filter((v) => v.code === 'SYSTEM_MISSING_TYPE_CONSTANT');
    expect(missing).toHaveLength(1);
    expect(missing[0].message).toContain('RegionEntitiesSystemData');
    expect(missing[0].message).toContain('REGION_ENTITIES_SYSTEM_STATE_TYPE');
  });

  it('errors on an orphan _SYSTEM_STATE_TYPE constant (no matching interface)', () => {
    const source =
      HAPPY_PATH_SOURCE +
      `
export const ORPHAN_STATE_SYSTEM_STATE_TYPE = 'orphan';
`;
    const result = validateSystemFolders([systemInspection(CANONICAL_FILES, source)]);
    const orphans = result.violations.filter((v) => v.code === 'SYSTEM_ORPHAN_TYPE_CONSTANT');
    expect(orphans).toHaveLength(1);
    expect(orphans[0].message).toContain('ORPHAN_STATE_SYSTEM_STATE_TYPE');
  });

  it('errors on an orphan converter (no matching interface)', () => {
    const source =
      HAPPY_PATH_SOURCE +
      `
interface OrphanSystemData { k: string; }
export const orphanSystemDataConverter: SystemStateStoredDataFieldConverterConfig<OrphanSystemData> = firestoreSubObject<OrphanSystemData>({
  objectField: { fields: { k: firestoreString() } }
});
`;
    const result = validateSystemFolders([systemInspection(CANONICAL_FILES, source)]);
    const orphans = result.violations.filter((v) => v.code === 'SYSTEM_ORPHAN_CONVERTER');
    expect(orphans).toHaveLength(1);
    expect(orphans[0].message).toContain('orphanSystemDataConverter');
  });

  it('errors when a type constant is not referenced as a key in the converter map', () => {
    const source = HAPPY_PATH_SOURCE.replace('[SCHEDULED_SYSTEM_TASKS_SYSTEM_STATE_TYPE]: scheduledSystemTasksSystemDataConverter\n', '');
    const result = validateSystemFolders([systemInspection(CANONICAL_FILES, source)]);
    const missing = result.violations.filter((v) => v.code === 'SYSTEM_TYPE_NOT_IN_MAP');
    expect(missing).toHaveLength(1);
    expect(missing[0].message).toContain('SCHEDULED_SYSTEM_TASKS_SYSTEM_STATE_TYPE');
  });

  it('warns on a bare string literal used as a converter-map key', () => {
    const source = HAPPY_PATH_SOURCE.replace('[SCHEDULED_SYSTEM_TASKS_SYSTEM_STATE_TYPE]: scheduledSystemTasksSystemDataConverter', 'systemtask: scheduledSystemTasksSystemDataConverter');
    const result = validateSystemFolders([systemInspection(CANONICAL_FILES, source)]);
    const warnings = result.violations.filter((v) => v.code === 'SYSTEM_UNKNOWN_MAP_KEY');
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].severity).toBe('warning');
  });

  it('accepts imported identifiers used as converter-map keys (e.g. Zoho token from @dereekb/firebase-server/zoho)', () => {
    const source = `import { firestoreDate, firestoreNumber, firestoreSubObject, type SystemStateStoredData, type SystemStateStoredDataConverterMap, type SystemStateStoredDataFieldConverterConfig } from '@dereekb/firebase';
import { ZOHO_ACCESS_TOKEN_SYSTEM_STATE_TYPE, zohoAccessTokenSystemStateDataConverter } from '@dereekb/firebase-server/zoho';

export const REGION_ENTITIES_SYSTEM_STATE_TYPE = 'regionentities';

export interface RegionEntitiesSystemData extends SystemStateStoredData {
  rn: number;
  lat: Date;
}

export const regionEntitiesSystemDataConverter: SystemStateStoredDataFieldConverterConfig<RegionEntitiesSystemData> = firestoreSubObject<RegionEntitiesSystemData>({
  objectField: {
    fields: {
      rn: firestoreNumber({ default: 0 }),
      lat: firestoreDate({ saveDefaultAsNow: true })
    }
  }
});

export const appSystemStateStoredDataConverterMap: SystemStateStoredDataConverterMap = {
  [REGION_ENTITIES_SYSTEM_STATE_TYPE]: regionEntitiesSystemDataConverter,
  [ZOHO_ACCESS_TOKEN_SYSTEM_STATE_TYPE]: zohoAccessTokenSystemStateDataConverter
};
`;
    const result = validateSystemFolders([systemInspection(CANONICAL_FILES, source)]);
    expect(result.errorCount).toBe(0);
    const warnings = result.violations.filter((v) => v.code === 'SYSTEM_UNKNOWN_MAP_KEY');
    expect(warnings).toHaveLength(0);
  });

  it('aggregates violations across multiple folders', () => {
    const good = systemInspection(CANONICAL_FILES, HAPPY_PATH_SOURCE);
    const bad: SystemFolderInspection = {
      name: 'system',
      path: 'components/bar-firebase/src/lib/model/system',
      status: 'ok',
      files: ['system.ts', 'index.ts'],
      systemSource: `import { type SystemStateStoredData } from '@dereekb/firebase';
export interface LonelySystemData extends SystemStateStoredData { k: string; }
`
    };
    const result = validateSystemFolders([good, bad]);
    expect(result.foldersChecked).toBe(2);
    expect(result.errorCount).toBeGreaterThan(0);
    const badViolations = result.violations.filter((v) => v.folder === bad.path);
    expect(badViolations.length).toBeGreaterThan(0);
  });

  it('auto-attaches remediation hints from the rule catalog', () => {
    const inspection: SystemFolderInspection = { name: 'system', path: 'components/foo-firebase/src/lib/model/system', status: 'ok', files: ['system.ts'], systemSource: undefined };
    const result = validateSystemFolders([inspection]);
    const v = result.violations.find((violation) => violation.code === 'SYSTEM_FOLDER_MISSING_INDEX');
    expect(v).toBeDefined();
    expect(v?.remediation).toBeDefined();
    expect(v?.remediation?.fix).toContain('index.ts');
  });
});
