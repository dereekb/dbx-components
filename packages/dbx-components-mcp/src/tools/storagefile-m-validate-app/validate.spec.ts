import { describe, expect, it } from 'vitest';
import { validateAppStorageFiles } from './index.js';
import type { AppStorageFilesInspection, InspectedFile, ViolationCode } from './types.js';

// MARK: Fixture — mimics the demo-firebase + demo-api shape with a single component file
// (two purposes, one with subtasks) and a three-file API (upload service, module, processing handler).
const COMPONENT_MAIN = `import { type StorageFileGroupId, type FirebaseAuthUserId, type StorageFileProcessingSubtask, type StorageFilePurpose, type UploadedFileTypeIdentifier } from '@dereekb/firebase';

// Test purpose with processing subtasks
export const USER_TEST_FILE_UPLOADED_FILE_TYPE_IDENTIFIER: UploadedFileTypeIdentifier = 'user_test_file';
export const USER_TEST_FILE_PURPOSE: StorageFilePurpose = 'test';
export const USER_TEST_FILE_PURPOSE_PART_A_SUBTASK: StorageFileProcessingSubtask = 'part_a';
export const USER_TEST_FILE_PURPOSE_PART_B_SUBTASK: StorageFileProcessingSubtask = 'part_b';
export type UserTestFileProcessingSubtask = typeof USER_TEST_FILE_PURPOSE_PART_A_SUBTASK | typeof USER_TEST_FILE_PURPOSE_PART_B_SUBTASK;
export function userTestFileGroupIds(userId: FirebaseAuthUserId): StorageFileGroupId[] { return []; }

// Avatar purpose, no processing
export const USER_AVATAR_UPLOADED_FILE_TYPE_IDENTIFIER: UploadedFileTypeIdentifier = 'user_avatar';
export const USER_AVATAR_PURPOSE: StorageFilePurpose = 'avatar';
export function userAvatarFileGroupIds(userId: FirebaseAuthUserId): StorageFileGroupId[] { return []; }
`;

const API_UPLOAD_SERVICE = `import { type StorageFileInitializeFromUploadService, type StorageFileInitializeFromUploadServiceConfig, type StorageFileInitializeFromUploadServiceInitializer, storageFileInitializeFromUploadService } from '@dereekb/firebase-server/model';
import { USER_AVATAR_UPLOADED_FILE_TYPE_IDENTIFIER, USER_TEST_FILE_UPLOADED_FILE_TYPE_IDENTIFIER } from 'demo-firebase';

export function demoStorageFileUploadServiceFactory(context): StorageFileInitializeFromUploadService {
  const userTestFileInitializer: StorageFileInitializeFromUploadServiceInitializer = {
    type: USER_TEST_FILE_UPLOADED_FILE_TYPE_IDENTIFIER,
    initialize: async () => null,
    determiner: null
  };
  const userAvatarInitializer: StorageFileInitializeFromUploadServiceInitializer = {
    type: USER_AVATAR_UPLOADED_FILE_TYPE_IDENTIFIER,
    initialize: async () => null,
    determiner: null
  };
  const userFileInitializers = [userTestFileInitializer, userAvatarInitializer];
  const systemFileInitializers: StorageFileInitializeFromUploadServiceInitializer[] = [];
  const config: StorageFileInitializeFromUploadServiceConfig = {
    initializer: [...userFileInitializers, ...systemFileInitializers]
  };
  return storageFileInitializeFromUploadService(config);
}
`;

const API_MODULE = `import { StorageFileInitializeFromUploadService } from '@dereekb/firebase-server/model';
import { demoStorageFileUploadServiceFactory } from './storagefile.upload.service';

export const providers = [
  { provide: StorageFileInitializeFromUploadService, useFactory: demoStorageFileUploadServiceFactory }
];
`;

const API_PROCESSING = `import { storageFileProcessingNotificationTaskHandler, type StorageFileProcessingPurposeSubtaskProcessorConfig } from '@dereekb/firebase-server/model';
import { USER_TEST_FILE_PURPOSE, USER_TEST_FILE_PURPOSE_PART_A_SUBTASK, USER_TEST_FILE_PURPOSE_PART_B_SUBTASK, type UserTestFileProcessingSubtask } from 'demo-firebase';

export function demoStorageFileProcessingNotificationTaskHandler(context) {
  const testFileProcessorConfig: StorageFileProcessingPurposeSubtaskProcessorConfig<unknown, UserTestFileProcessingSubtask> = {
    target: USER_TEST_FILE_PURPOSE,
    flow: [
      { subtask: USER_TEST_FILE_PURPOSE_PART_A_SUBTASK, fn: async () => null },
      { subtask: USER_TEST_FILE_PURPOSE_PART_B_SUBTASK, fn: async () => null }
    ]
  };
  const processors: StorageFileProcessingPurposeSubtaskProcessorConfig[] = [testFileProcessorConfig];
  return storageFileProcessingNotificationTaskHandler({ processors });
}
`;

function happyInspection(): AppStorageFilesInspection {
  const component: InspectedFile[] = [{ relPath: 'src/lib/model/storagefile/storagefile.ts', text: COMPONENT_MAIN }];
  const api: InspectedFile[] = [
    { relPath: 'src/app/common/model/storagefile/storagefile.upload.service.ts', text: API_UPLOAD_SERVICE },
    { relPath: 'src/app/common/model/storagefile/storagefile.module.ts', text: API_MODULE },
    { relPath: 'src/app/common/model/notification/notification.task.service.ts', text: API_PROCESSING }
  ];
  const result: AppStorageFilesInspection = {
    component: { rootDir: 'components/demo-firebase', folder: 'src/lib/model/storagefile', status: 'ok', files: component },
    api: { rootDir: 'apps/demo-api', folder: 'src/app/common/model/storagefile,src/app/common/model/notification', status: 'ok', files: api }
  };
  return result;
}

function runWith(modify: (parts: { component: InspectedFile[]; api: InspectedFile[] }) => void): ReturnType<typeof validateAppStorageFiles> {
  const inspection = happyInspection();
  const component = [...inspection.component.files];
  const api = [...inspection.api.files];
  modify({ component, api });
  const result = validateAppStorageFiles(
    {
      component: { ...inspection.component, files: component },
      api: { ...inspection.api, files: api }
    },
    { componentDir: inspection.component.rootDir, apiDir: inspection.api.rootDir }
  );
  return result;
}

function expectCodes(codes: readonly ViolationCode[], expected: readonly ViolationCode[]): void {
  for (const c of expected) {
    expect(codes, `expected code ${c} in ${JSON.stringify(codes)}`).toContain(c);
  }
}

interface ReplaceInFileOptions {
  readonly files: InspectedFile[];
  readonly relPath: string;
  readonly from: string | RegExp;
  readonly to: string;
}

function replaceInFile(options: ReplaceInFileOptions): void {
  const { files, relPath, from, to } = options;
  const i = files.findIndex((f) => f.relPath === relPath);
  const next = files[i].text.replace(from, to);
  files[i] = { ...files[i], text: next };
}

describe('validateAppStorageFiles — happy path', () => {
  it('passes a complete demo-shaped fixture (two purposes, one with subtasks, both wired)', () => {
    const result = validateAppStorageFiles(happyInspection(), { componentDir: 'components/demo-firebase', apiDir: 'apps/demo-api' });
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
});

describe('validateAppStorageFiles — purpose pairing', () => {
  it('flags STORAGEFILE_PURPOSE_MISSING_FILE_TYPE_IDENTIFIER when a purpose has no matching identifier', () => {
    const result = runWith(({ component }) => {
      replaceInFile({ files: component, relPath: 'src/lib/model/storagefile/storagefile.ts', from: "export const USER_AVATAR_UPLOADED_FILE_TYPE_IDENTIFIER: UploadedFileTypeIdentifier = 'user_avatar';", to: '' });
    });
    expectCodes(
      result.violations.map((v) => v.code),
      ['STORAGEFILE_PURPOSE_MISSING_FILE_TYPE_IDENTIFIER']
    );
  });
});

describe('validateAppStorageFiles — upload service rules', () => {
  it('flags STORAGEFILE_UPLOAD_SERVICE_FACTORY_MISSING when no upload-service call exists', () => {
    const result = runWith(({ api }) => {
      replaceInFile({ files: api, relPath: 'src/app/common/model/storagefile/storagefile.upload.service.ts', from: /return storageFileInitializeFromUploadService\(config\);/, to: 'return null;' });
    });
    expectCodes(
      result.violations.map((v) => v.code),
      ['STORAGEFILE_UPLOAD_SERVICE_FACTORY_MISSING']
    );
  });

  it('flags STORAGEFILE_UPLOAD_SERVICE_NOT_WIRED when no NestJS provider matches', () => {
    const result = runWith(({ api }) => {
      replaceInFile({ files: api, relPath: 'src/app/common/model/storagefile/storagefile.module.ts', from: 'useFactory: demoStorageFileUploadServiceFactory', to: 'useFactory: someOtherFactory' });
    });
    expectCodes(
      result.violations.map((v) => v.code),
      ['STORAGEFILE_UPLOAD_SERVICE_NOT_WIRED']
    );
  });

  it('flags STORAGEFILE_PURPOSE_NOT_IN_UPLOAD_SERVICE when a declared identifier has no initializer', () => {
    const result = runWith(({ api }) => {
      replaceInFile({ files: api, relPath: 'src/app/common/model/storagefile/storagefile.upload.service.ts', from: /const userAvatarInitializer: StorageFileInitializeFromUploadServiceInitializer = \{[\s\S]*?\};\s*/, to: '' });
      replaceInFile({ files: api, relPath: 'src/app/common/model/storagefile/storagefile.upload.service.ts', from: '[userTestFileInitializer, userAvatarInitializer]', to: '[userTestFileInitializer]' });
    });
    const codes = result.violations.map((v) => v.code);
    expectCodes(codes, ['STORAGEFILE_PURPOSE_NOT_IN_UPLOAD_SERVICE']);
    // Should NOT also fire the mismatch error when there is no literal at all.
    expect(codes).not.toContain('STORAGEFILE_UPLOAD_INITIALIZER_NAME_MISMATCH');
  });

  it('flags STORAGEFILE_UPLOAD_INITIALIZER_NAME_MISMATCH when a literal exists but its binding name does not match the call-site reference', () => {
    const HANDLER_FILE = `import { type StorageFileInitializeFromUploadServiceInitializer } from '@dereekb/firebase-server/model';
import { USER_AVATAR_UPLOADED_FILE_TYPE_IDENTIFIER } from 'demo-firebase';

export function makeUserAvatarUploadInitializer(): StorageFileInitializeFromUploadServiceInitializer {
  const wrongName: StorageFileInitializeFromUploadServiceInitializer = {
    type: USER_AVATAR_UPLOADED_FILE_TYPE_IDENTIFIER,
    initialize: async () => null,
    determiner: null
  };
  return wrongName;
}
`;
    const result = runWith(({ api }) => {
      // Drop the inline avatar initializer; replace it with a factory-returned one whose
      // inner variable name (`wrongName`) does not match the call-site binding (`userAvatarInitializer`).
      replaceInFile({ files: api, relPath: 'src/app/common/model/storagefile/storagefile.upload.service.ts', from: /const userAvatarInitializer: StorageFileInitializeFromUploadServiceInitializer = \{[\s\S]*?\};\s*/, to: 'const userAvatarInitializer = makeUserAvatarUploadInitializer();\n' });
      replaceInFile({ files: api, relPath: 'src/app/common/model/storagefile/storagefile.upload.service.ts', from: "import { USER_AVATAR_UPLOADED_FILE_TYPE_IDENTIFIER, USER_TEST_FILE_UPLOADED_FILE_TYPE_IDENTIFIER } from 'demo-firebase';", to: "import { USER_AVATAR_UPLOADED_FILE_TYPE_IDENTIFIER, USER_TEST_FILE_UPLOADED_FILE_TYPE_IDENTIFIER } from 'demo-firebase';\nimport { makeUserAvatarUploadInitializer } from './handlers/upload.user.avatar';" });
      api.push({ relPath: 'src/app/common/model/storagefile/handlers/upload.user.avatar.ts', text: HANDLER_FILE });
    });
    const codes = result.violations.map((v) => v.code);
    expectCodes(codes, ['STORAGEFILE_UPLOAD_INITIALIZER_NAME_MISMATCH']);
    // Should not double-emit the original missing-initializer error in this case.
    expect(codes).not.toContain('STORAGEFILE_PURPOSE_NOT_IN_UPLOAD_SERVICE');
    const mismatch = result.violations.find((v) => v.code === 'STORAGEFILE_UPLOAD_INITIALIZER_NAME_MISMATCH');
    expect(mismatch?.file).toBe('src/app/common/model/storagefile/handlers/upload.user.avatar.ts');
    expect(mismatch?.message).toContain('wrongName');
  });

  it('flags STORAGEFILE_UPLOAD_INITIALIZER_ORPHAN when an initializer references a phantom identifier', () => {
    const result = runWith(({ api }) => {
      replaceInFile({ files: api, relPath: 'src/app/common/model/storagefile/storagefile.upload.service.ts', from: 'type: USER_TEST_FILE_UPLOADED_FILE_TYPE_IDENTIFIER,', to: 'type: PHANTOM_UPLOADED_FILE_TYPE_IDENTIFIER,' });
    });
    expectCodes(
      result.violations.map((v) => v.code),
      ['STORAGEFILE_UPLOAD_INITIALIZER_ORPHAN']
    );
  });

  it('warns STORAGEFILE_UPLOAD_SERVICE_SPREAD_UNRESOLVED when a spread does not resolve', () => {
    const result = runWith(({ api }) => {
      replaceInFile({ files: api, relPath: 'src/app/common/model/storagefile/storagefile.upload.service.ts', from: '[...userFileInitializers, ...systemFileInitializers]', to: '[...userFileInitializers, ...mysteryInitializers]' });
    });
    const warnings = result.violations.filter((v) => v.code === 'STORAGEFILE_UPLOAD_SERVICE_SPREAD_UNRESOLVED');
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('warns STORAGEFILE_UPLOAD_SERVICE_MULTIPLE_FACTORIES when more than one upload-service call exists', () => {
    const result = runWith(({ api }) => {
      replaceInFile({ files: api, relPath: 'src/app/common/model/storagefile/storagefile.upload.service.ts', from: 'return storageFileInitializeFromUploadService(config);', to: 'storageFileInitializeFromUploadService(config); return storageFileInitializeFromUploadService(config);' });
    });
    const warnings = result.violations.filter((v) => v.code === 'STORAGEFILE_UPLOAD_SERVICE_MULTIPLE_FACTORIES');
    expect(warnings.length).toBeGreaterThan(0);
  });
});

describe('validateAppStorageFiles — processing handler rules', () => {
  it('flags STORAGEFILE_PROCESSING_HANDLER_MISSING when no handler call exists despite subtasks', () => {
    const result = runWith(({ api }) => {
      replaceInFile({ files: api, relPath: 'src/app/common/model/notification/notification.task.service.ts', from: /return storageFileProcessingNotificationTaskHandler\(\{ processors \}\);/, to: 'return null;' });
    });
    expectCodes(
      result.violations.map((v) => v.code),
      ['STORAGEFILE_PROCESSING_HANDLER_MISSING']
    );
  });

  it('flags STORAGEFILE_PROCESSING_CONFIG_MISSING when a subtask-bearing purpose has no processor config', () => {
    const result = runWith(({ api }) => {
      replaceInFile({ files: api, relPath: 'src/app/common/model/notification/notification.task.service.ts', from: 'target: USER_TEST_FILE_PURPOSE,', to: 'target: SOME_OTHER_PURPOSE,' });
    });
    expectCodes(
      result.violations.map((v) => v.code),
      ['STORAGEFILE_PROCESSING_CONFIG_MISSING']
    );
  });

  it('flags STORAGEFILE_PROCESSING_CONFIG_ORPHAN when a config target is not a declared purpose', () => {
    const result = runWith(({ api }) => {
      replaceInFile({ files: api, relPath: 'src/app/common/model/notification/notification.task.service.ts', from: 'target: USER_TEST_FILE_PURPOSE,', to: 'target: PHANTOM_PURPOSE,' });
    });
    expectCodes(
      result.violations.map((v) => v.code),
      ['STORAGEFILE_PROCESSING_CONFIG_ORPHAN']
    );
  });

  it('flags STORAGEFILE_PROCESSING_SUBTASK_NOT_HANDLED when a subtask is missing from the flow', () => {
    const result = runWith(({ api }) => {
      replaceInFile({ files: api, relPath: 'src/app/common/model/notification/notification.task.service.ts', from: '{ subtask: USER_TEST_FILE_PURPOSE_PART_B_SUBTASK, fn: async () => null }', to: '' });
    });
    expectCodes(
      result.violations.map((v) => v.code),
      ['STORAGEFILE_PROCESSING_SUBTASK_NOT_HANDLED']
    );
  });
});

describe('validateAppStorageFiles — duplicate / convention warnings', () => {
  it('warns STORAGEFILE_PURPOSE_DUPLICATE when two purpose constants share a string literal', () => {
    const result = runWith(({ component }) => {
      replaceInFile({ files: component, relPath: 'src/lib/model/storagefile/storagefile.ts', from: "export const USER_AVATAR_PURPOSE: StorageFilePurpose = 'avatar';", to: "export const USER_AVATAR_PURPOSE: StorageFilePurpose = 'test';" });
    });
    const warnings = result.violations.filter((v) => v.code === 'STORAGEFILE_PURPOSE_DUPLICATE');
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].severity).toBe('warning');
  });

  it('warns STORAGEFILE_FILE_TYPE_IDENTIFIER_DUPLICATE when two identifier constants share a string literal', () => {
    const result = runWith(({ component }) => {
      replaceInFile({ files: component, relPath: 'src/lib/model/storagefile/storagefile.ts', from: "export const USER_AVATAR_UPLOADED_FILE_TYPE_IDENTIFIER: UploadedFileTypeIdentifier = 'user_avatar';", to: "export const USER_AVATAR_UPLOADED_FILE_TYPE_IDENTIFIER: UploadedFileTypeIdentifier = 'user_test_file';" });
    });
    const warnings = result.violations.filter((v) => v.code === 'STORAGEFILE_FILE_TYPE_IDENTIFIER_DUPLICATE');
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('warns STORAGEFILE_GROUP_IDS_FUNCTION_MISSING when a purpose has no group-ids helper', () => {
    const result = runWith(({ component }) => {
      replaceInFile({ files: component, relPath: 'src/lib/model/storagefile/storagefile.ts', from: /export function userAvatarFileGroupIds[\s\S]*?\}/, to: '' });
    });
    const warnings = result.violations.filter((v) => v.code === 'STORAGEFILE_GROUP_IDS_FUNCTION_MISSING');
    expect(warnings.length).toBeGreaterThan(0);
  });
});

describe('validateAppStorageFiles — trust list', () => {
  it('does not flag STORAGEFILE_UPLOAD_INITIALIZER_ORPHAN for an identifier imported from @dereekb/*', () => {
    const result = runWith(({ api }) => {
      replaceInFile({ files: api, relPath: 'src/app/common/model/storagefile/storagefile.upload.service.ts', from: "import { USER_AVATAR_UPLOADED_FILE_TYPE_IDENTIFIER, USER_TEST_FILE_UPLOADED_FILE_TYPE_IDENTIFIER } from 'demo-firebase';", to: "import { USER_AVATAR_UPLOADED_FILE_TYPE_IDENTIFIER, USER_TEST_FILE_UPLOADED_FILE_TYPE_IDENTIFIER } from 'demo-firebase';\nimport { EXTERNAL_UPLOADED_FILE_TYPE_IDENTIFIER } from '@dereekb/firebase';" });
      replaceInFile({ files: api, relPath: 'src/app/common/model/storagefile/storagefile.upload.service.ts', from: 'type: USER_AVATAR_UPLOADED_FILE_TYPE_IDENTIFIER,', to: 'type: EXTERNAL_UPLOADED_FILE_TYPE_IDENTIFIER,' });
    });
    const orphans = result.violations.filter((v) => v.code === 'STORAGEFILE_UPLOAD_INITIALIZER_ORPHAN');
    expect(orphans).toHaveLength(0);
  });
});

describe('validateAppStorageFiles — I/O rules', () => {
  it('flags STORAGEFILE_COMPONENT_DIR_NOT_FOUND', () => {
    const inspection: AppStorageFilesInspection = {
      component: { rootDir: 'components/ghost', folder: undefined, status: 'dir-not-found', files: [] },
      api: { rootDir: 'apps/demo-api', folder: 'src/app/common/model/storagefile', status: 'ok', files: [] }
    };
    const result = validateAppStorageFiles(inspection, { componentDir: inspection.component.rootDir, apiDir: inspection.api.rootDir });
    expectCodes(
      result.violations.map((v) => v.code),
      ['STORAGEFILE_COMPONENT_DIR_NOT_FOUND']
    );
  });

  it('flags STORAGEFILE_API_FOLDER_MISSING', () => {
    const inspection: AppStorageFilesInspection = {
      component: { rootDir: 'components/demo-firebase', folder: 'src/lib/model/storagefile', status: 'ok', files: [] },
      api: { rootDir: 'apps/demo-api', folder: undefined, status: 'folder-missing', files: [] }
    };
    const result = validateAppStorageFiles(inspection, { componentDir: inspection.component.rootDir, apiDir: inspection.api.rootDir });
    expectCodes(
      result.violations.map((v) => v.code),
      ['STORAGEFILE_API_FOLDER_MISSING']
    );
  });
});
