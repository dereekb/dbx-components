import { describe, expect, it } from 'vitest';
import { validateModelFolders } from './index.js';
import type { FolderInspection, ViolationCode } from './types.js';

function okInspection(name: string, files: readonly string[]): FolderInspection {
  return { name, path: `packages/foo/src/lib/model/${name}`, status: 'ok', files };
}

function expectCodes(codes: readonly ViolationCode[], expected: readonly ViolationCode[]): void {
  for (const c of expected) {
    expect(codes, `expected code ${c} in ${JSON.stringify(codes)}`).toContain(c);
  }
}

const CANONICAL_FILES = ['profile.ts', 'profile.id.ts', 'profile.query.ts', 'profile.action.ts', 'profile.api.ts', 'index.ts'];

describe('validateModelFolders', () => {
  it('passes a canonical 6-file folder with zero errors and zero warnings', () => {
    const result = validateModelFolders([okInspection('profile', CANONICAL_FILES)]);
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

  it('passes a folder with the canonical files plus extra `<name>.*` files (no warnings)', () => {
    const result = validateModelFolders([okInspection('profile', [...CANONICAL_FILES, 'profile.util.ts', 'profile.util.spec.ts'])]);
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
  });

  it('flags a missing main model file', () => {
    const files = CANONICAL_FILES.filter((f) => f !== 'profile.ts');
    const result = validateModelFolders([okInspection('profile', files)]);
    expectCodes(
      result.violations.map((v) => v.code),
      ['FOLDER_MISSING_MAIN']
    );
  });

  it('flags a missing id file', () => {
    const files = CANONICAL_FILES.filter((f) => f !== 'profile.id.ts');
    const result = validateModelFolders([okInspection('profile', files)]);
    expectCodes(
      result.violations.map((v) => v.code),
      ['FOLDER_MISSING_ID']
    );
  });

  it('flags a missing query file', () => {
    const files = CANONICAL_FILES.filter((f) => f !== 'profile.query.ts');
    const result = validateModelFolders([okInspection('profile', files)]);
    expectCodes(
      result.violations.map((v) => v.code),
      ['FOLDER_MISSING_QUERY']
    );
  });

  it('flags a missing action file', () => {
    const files = CANONICAL_FILES.filter((f) => f !== 'profile.action.ts');
    const result = validateModelFolders([okInspection('profile', files)]);
    expectCodes(
      result.violations.map((v) => v.code),
      ['FOLDER_MISSING_ACTION']
    );
  });

  it('flags a missing api file', () => {
    const files = CANONICAL_FILES.filter((f) => f !== 'profile.api.ts');
    const result = validateModelFolders([okInspection('profile', files)]);
    expectCodes(
      result.violations.map((v) => v.code),
      ['FOLDER_MISSING_API']
    );
  });

  it('flags a missing index file', () => {
    const files = CANONICAL_FILES.filter((f) => f !== 'index.ts');
    const result = validateModelFolders([okInspection('profile', files)]);
    expectCodes(
      result.violations.map((v) => v.code),
      ['FOLDER_MISSING_INDEX']
    );
  });

  it('flags all six missing when the folder is empty', () => {
    const result = validateModelFolders([okInspection('profile', [])]);
    expectCodes(
      result.violations.map((v) => v.code),
      ['FOLDER_MISSING_MAIN', 'FOLDER_MISSING_ID', 'FOLDER_MISSING_QUERY', 'FOLDER_MISSING_ACTION', 'FOLDER_MISSING_API', 'FOLDER_MISSING_INDEX']
    );
  });

  it('warns on stray `.ts` files that do not start with `<name>.`', () => {
    const files = [...CANONICAL_FILES, 'unrelated.ts', 'helpers.ts'];
    const result = validateModelFolders([okInspection('profile', files)]);
    const warnings = result.violations.filter((v) => v.code === 'FOLDER_STRAY_FILE');
    expect(warnings).toHaveLength(2);
    expect(warnings[0].severity).toBe('warning');
    expect(warnings.map((w) => w.file)).toEqual(['unrelated.ts', 'helpers.ts']);
  });

  it('does not warn on `index.ts` (which lacks the `<name>.` prefix)', () => {
    const result = validateModelFolders([okInspection('profile', CANONICAL_FILES)]);
    const strayWarnings = result.violations.filter((v) => v.code === 'FOLDER_STRAY_FILE');
    expect(strayWarnings).toHaveLength(0);
  });

  it('reserves the `system` folder and recommends the dedicated tool', () => {
    const inspection: FolderInspection = {
      name: 'system',
      path: 'packages/foo/src/lib/model/system',
      status: 'ok',
      files: ['system.ts', 'system.action.ts', 'index.ts']
    };
    const result = validateModelFolders([inspection]);
    expect(result.errorCount).toBe(0);
    const codes = result.violations.map((v) => v.code);
    expect(codes).toContain('RESERVED_MODEL_FOLDER');
    expect(codes).not.toContain('FOLDER_MISSING_ID');
    expect(codes).not.toContain('FOLDER_MISSING_QUERY');
    expect(codes).not.toContain('FOLDER_MISSING_API');
    const warning = result.violations.find((v) => v.code === 'RESERVED_MODEL_FOLDER');
    expect(warning?.message).toContain('dbx_system_m_validate_folder');
  });

  it('reserves the `notification` folder (imported from @dereekb/firebase) and recommends the dedicated tool', () => {
    const inspection: FolderInspection = {
      name: 'notification',
      path: 'components/foo-firebase/src/lib/model/notification',
      status: 'ok',
      files: ['index.ts', 'notification.ts', 'notification.job.ts', 'notification.worker.ts']
    };
    const result = validateModelFolders([inspection]);
    expect(result.errorCount).toBe(0);
    const codes = result.violations.map((v) => v.code);
    expect(codes).toContain('RESERVED_MODEL_FOLDER');
    expect(codes).not.toContain('FOLDER_MISSING_ID');
    expect(codes).not.toContain('FOLDER_MISSING_API');
    const warning = result.violations.find((v) => v.code === 'RESERVED_MODEL_FOLDER');
    expect(warning?.message).toContain('dbx_notification_m_validate_folder');
  });

  it('reserves the `storagefile` folder (imported from @dereekb/firebase) and recommends the dedicated tool', () => {
    const inspection: FolderInspection = {
      name: 'storagefile',
      path: 'components/foo-firebase/src/lib/model/storagefile',
      status: 'ok',
      files: ['index.ts', 'storagefile.job.ts', 'storagefilegroup.ts']
    };
    const result = validateModelFolders([inspection]);
    expect(result.errorCount).toBe(0);
    const codes = result.violations.map((v) => v.code);
    expect(codes).toContain('RESERVED_MODEL_FOLDER');
    expect(codes).not.toContain('FOLDER_MISSING_MAIN');
    expect(codes).not.toContain('FOLDER_STRAY_FILE');
    const warning = result.violations.find((v) => v.code === 'RESERVED_MODEL_FOLDER');
    expect(warning?.message).toContain('dbx_storagefile_m_validate_folder');
  });

  it('flags a not-found folder', () => {
    const inspection: FolderInspection = { name: 'ghost', path: 'packages/foo/src/lib/model/ghost', status: 'not-found', files: [] };
    const result = validateModelFolders([inspection]);
    expectCodes(
      result.violations.map((v) => v.code),
      ['FOLDER_NOT_FOUND']
    );
  });

  it('flags a non-directory path', () => {
    const inspection: FolderInspection = { name: 'user.ts', path: 'packages/foo/src/lib/model/user.ts', status: 'not-directory', files: [] };
    const result = validateModelFolders([inspection]);
    expectCodes(
      result.violations.map((v) => v.code),
      ['FOLDER_NOT_DIRECTORY']
    );
  });

  it('aggregates violations across multiple folders', () => {
    const good = okInspection('profile', CANONICAL_FILES);
    const bad = okInspection('widget', ['widget.ts', 'index.ts']);
    const result = validateModelFolders([good, bad]);
    expect(result.foldersChecked).toBe(2);
    expect(result.errorCount).toBeGreaterThan(0);
    const widgetViolations = result.violations.filter((v) => v.folder === bad.path);
    expect(widgetViolations.length).toBe(4); // missing id, query, action, api
  });

  it('auto-attaches remediation hints from the rule catalog', () => {
    const files = CANONICAL_FILES.filter((f) => f !== 'profile.ts');
    const result = validateModelFolders([okInspection('profile', files)]);
    const v = result.violations.find((violation) => violation.code === 'FOLDER_MISSING_MAIN');
    expect(v).toBeDefined();
    expect(v?.remediation).toBeDefined();
    expect(v?.remediation?.fix).toContain('<name>.ts');
  });

  // MARK: Content-rule propagation
  describe('content-rule propagation (delegates to model-validate)', () => {
    const TAGGED_PROFILE_TEXT = `
/** @dbxModelGroup Profile */
export interface ProfileFirestoreCollections { profileCollection: ProfileFirestoreCollection; }
export type ProfileTypes = typeof profileIdentity;
export const profileIdentity = firestoreModelIdentity('profile', 'pr');
/** @dbxModel */
export interface Profile { /** @dbxModelVariable name */ n: string; }
export type ProfileRoles = 'owner';
export class ProfileDocument extends AbstractFirestoreDocument<Profile, ProfileDocument, typeof profileIdentity> { get modelIdentity() { return profileIdentity; } }
export const profileConverter = snapshotConverterFunctions<Profile>({ fields: { n: firestoreString() } });
export function profileCollectionReference(context: FirestoreContext): CollectionReference<Profile> { return context.collection(profileIdentity.collectionName); }
export type ProfileFirestoreCollection = FirestoreCollection<Profile, ProfileDocument>;
export function profileFirestoreCollection(firestoreContext: FirestoreContext): ProfileFirestoreCollection { return firestoreContext.firestoreCollection({ modelIdentity: profileIdentity, converter: profileConverter, collection: profileCollectionReference(firestoreContext), makeDocument: (a, b) => new ProfileDocument(a, b), firestoreContext }); }
`;

    function okInspectionWithSources(name: string, files: readonly string[], sources: readonly { filename: string; text: string }[]): FolderInspection {
      return { name, path: `packages/foo/src/lib/model/${name}`, status: 'ok', files, sources };
    }

    it('passes through with no errors when sources are properly tagged', () => {
      const result = validateModelFolders([okInspectionWithSources('profile', CANONICAL_FILES, [{ filename: 'profile.ts', text: TAGGED_PROFILE_TEXT }])]);
      expect(
        result.errorCount,
        JSON.stringify(
          result.violations.filter((v) => v.severity === 'error'),
          null,
          2
        )
      ).toBe(0);
    });

    it('surfaces MODEL_GROUP_INTERFACE_MISSING_TAG when the group container is untagged', () => {
      const text = TAGGED_PROFILE_TEXT.replace('/** @dbxModelGroup Profile */\n', '');
      const result = validateModelFolders([okInspectionWithSources('profile', CANONICAL_FILES, [{ filename: 'profile.ts', text }])]);
      const codes = result.violations.map((v) => v.code);
      expect(codes).toContain('MODEL_GROUP_INTERFACE_MISSING_TAG');
    });

    it('surfaces MODEL_IDENTITY_NOT_TAGGED when a firestoreModelIdentity exists but its interface lacks `@dbxModel`', () => {
      const text = TAGGED_PROFILE_TEXT.replace('/** @dbxModel */\nexport interface Profile {', 'export interface Profile {');
      const result = validateModelFolders([okInspectionWithSources('profile', CANONICAL_FILES, [{ filename: 'profile.ts', text }])]);
      const codes = result.violations.map((v) => v.code);
      expect(codes).toContain('MODEL_IDENTITY_NOT_TAGGED');
      expect(codes).toContain('MODEL_INTERFACE_MISSING_TAG');
      const identityErr = result.violations.find((v) => v.code === 'MODEL_IDENTITY_NOT_TAGGED');
      expect(identityErr?.folder).toBe('packages/foo/src/lib/model/profile');
      expect(identityErr?.file).toBe('profile.ts');
    });

    it('skips empty/no-source folders without crashing', () => {
      const result = validateModelFolders([okInspectionWithSources('profile', CANONICAL_FILES, [])]);
      const contentCodes = result.violations.filter((v) => v.code.startsWith('MODEL_') || v.code.startsWith('FILE_')).map((v) => v.code);
      expect(contentCodes).toHaveLength(0);
    });

    it('omits content rules entirely when the inspection has no `sources` field (back-compat)', () => {
      const result = validateModelFolders([okInspection('profile', CANONICAL_FILES)]);
      expect(result.errorCount).toBe(0);
      expect(result.warningCount).toBe(0);
    });
  });
});
