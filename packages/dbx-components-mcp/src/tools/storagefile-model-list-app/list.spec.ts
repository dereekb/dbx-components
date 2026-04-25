import { describe, expect, it } from 'vitest';
import { formatReportAsJson, formatReportAsMarkdown, listAppStorageFiles } from './index.js';
import type { AppStorageFilesInspection, InspectedFile } from '../storagefile-model-validate-app/index.js';

const COMPONENT_MAIN = `import { type StorageFileGroupId, type FirebaseAuthUserId, type StorageFileProcessingSubtask, type StorageFilePurpose, type UploadedFileTypeIdentifier } from '@dereekb/firebase';

export const USER_TEST_FILE_UPLOADED_FILE_TYPE_IDENTIFIER: UploadedFileTypeIdentifier = 'user_test_file';
export const USER_TEST_FILE_PURPOSE: StorageFilePurpose = 'test';
export const USER_TEST_FILE_PURPOSE_PART_A_SUBTASK: StorageFileProcessingSubtask = 'part_a';
export type UserTestFileProcessingSubtask = typeof USER_TEST_FILE_PURPOSE_PART_A_SUBTASK;
export function userTestFileGroupIds(userId: FirebaseAuthUserId): StorageFileGroupId[] { return []; }

export const USER_AVATAR_UPLOADED_FILE_TYPE_IDENTIFIER: UploadedFileTypeIdentifier = 'user_avatar';
export const USER_AVATAR_PURPOSE: StorageFilePurpose = 'avatar';
export function userAvatarFileGroupIds(userId: FirebaseAuthUserId): StorageFileGroupId[] { return []; }
`;

const API_UPLOAD_SERVICE = `import { type StorageFileInitializeFromUploadService, type StorageFileInitializeFromUploadServiceConfig, type StorageFileInitializeFromUploadServiceInitializer, storageFileInitializeFromUploadService } from '@dereekb/firebase-server/model';
import { USER_AVATAR_UPLOADED_FILE_TYPE_IDENTIFIER, USER_TEST_FILE_UPLOADED_FILE_TYPE_IDENTIFIER } from 'demo-firebase';

export function demoStorageFileUploadServiceFactory(context): StorageFileInitializeFromUploadService {
  const userTestFileInitializer: StorageFileInitializeFromUploadServiceInitializer = { type: USER_TEST_FILE_UPLOADED_FILE_TYPE_IDENTIFIER, initialize: async () => null, determiner: null };
  const userAvatarInitializer: StorageFileInitializeFromUploadServiceInitializer = { type: USER_AVATAR_UPLOADED_FILE_TYPE_IDENTIFIER, initialize: async () => null, determiner: null };
  const userFileInitializers = [userTestFileInitializer, userAvatarInitializer];
  const config: StorageFileInitializeFromUploadServiceConfig = { initializer: [...userFileInitializers] };
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
import { USER_TEST_FILE_PURPOSE, USER_TEST_FILE_PURPOSE_PART_A_SUBTASK, type UserTestFileProcessingSubtask } from 'demo-firebase';

export function demoStorageFileProcessingNotificationTaskHandler(context) {
  const testFileProcessorConfig: StorageFileProcessingPurposeSubtaskProcessorConfig<unknown, UserTestFileProcessingSubtask> = {
    target: USER_TEST_FILE_PURPOSE,
    flow: [{ subtask: USER_TEST_FILE_PURPOSE_PART_A_SUBTASK, fn: async () => null }]
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
    component: { rootDir: 'components/demo-firebase', storagefileFolder: 'src/lib/model/storagefile', status: 'ok', files: component },
    api: { rootDir: 'apps/demo-api', storagefileFolder: 'src/app/common/model/storagefile,src/app/common/model/notification', status: 'ok', files: api }
  };
  return result;
}

describe('listAppStorageFiles — happy path', () => {
  it('reports both purposes with full registration flags', () => {
    const report = listAppStorageFiles(happyInspection(), { componentDir: 'components/demo-firebase', apiDir: 'apps/demo-api' });
    expect(report.purposes).toHaveLength(2);
    const test = report.purposes.find((p) => p.purposeSymbolName === 'USER_TEST_FILE_PURPOSE');
    const avatar = report.purposes.find((p) => p.purposeSymbolName === 'USER_AVATAR_PURPOSE');
    expect(test).toBeDefined();
    expect(test?.purposeCode).toBe('test');
    expect(test?.fileTypeIdentifierCode).toBe('USER_TEST_FILE_UPLOADED_FILE_TYPE_IDENTIFIER');
    expect(test?.fileTypeIdentifier).toBe('user_test_file');
    expect(test?.fileGroupIdsFunctionName).toBe('userTestFileGroupIds');
    expect(test?.subtasks).toEqual(['USER_TEST_FILE_PURPOSE_PART_A_SUBTASK']);
    expect(test?.hasUploadInitializer).toBe(true);
    expect(test?.hasProcessingConfig).toBe(true);
    expect(avatar?.hasUploadInitializer).toBe(true);
    expect(avatar?.hasProcessingConfig).toBe(false);
    expect(avatar?.subtasks).toEqual([]);
    expect(report.uploadServiceFactoryName).toBe('demoStorageFileUploadServiceFactory');
    expect(report.uploadServiceWiredInApi).toBe(true);
    expect(report.processingHandlerWiredInApi).toBe(true);
  });
});

describe('listAppStorageFiles — missing factory', () => {
  it('reports uploadServiceFactoryName=undefined when no upload-service call exists', () => {
    const inspection = happyInspection();
    const api = [...inspection.api.files];
    const i = api.findIndex((f) => f.relPath === 'src/app/common/model/storagefile/storagefile.upload.service.ts');
    api[i] = { ...api[i], text: api[i].text.replace(/return storageFileInitializeFromUploadService\(config\);/, 'return null;') };
    const report = listAppStorageFiles({ ...inspection, api: { ...inspection.api, files: api } }, { componentDir: 'components/demo-firebase', apiDir: 'apps/demo-api' });
    expect(report.uploadServiceFactoryName).toBeUndefined();
    expect(report.uploadServiceWiredInApi).toBe(false);
    expect(report.purposes.every((p) => !p.hasUploadInitializer)).toBe(true);
  });
});

describe('listAppStorageFiles — missing handler', () => {
  it('reports processingHandlerWiredInApi=false when no handler call exists', () => {
    const inspection = happyInspection();
    const api = [...inspection.api.files];
    const i = api.findIndex((f) => f.relPath === 'src/app/common/model/notification/notification.task.service.ts');
    api[i] = { ...api[i], text: api[i].text.replace(/return storageFileProcessingNotificationTaskHandler\(\{ processors \}\);/, 'return null;') };
    const report = listAppStorageFiles({ ...inspection, api: { ...inspection.api, files: api } }, { componentDir: 'components/demo-firebase', apiDir: 'apps/demo-api' });
    expect(report.processingHandlerWiredInApi).toBe(false);
  });
});

describe('listAppStorageFiles — markdown formatter', () => {
  it('renders header lines + per-purpose blocks', () => {
    const report = listAppStorageFiles(happyInspection(), { componentDir: 'components/demo-firebase', apiDir: 'apps/demo-api' });
    const md = formatReportAsMarkdown(report);
    expect(md).toContain('# App storagefiles — demo-firebase');
    expect(md).toContain('## Purposes (2)');
    expect(md).toContain('### test — `USER_TEST_FILE_PURPOSE`');
    expect(md).toContain('Has processing config: yes');
    expect(md).toContain('Has upload initializer: yes');
  });
});

describe('listAppStorageFiles — JSON formatter', () => {
  it('emits a JSON document with the expected top-level keys', () => {
    const report = listAppStorageFiles(happyInspection(), { componentDir: 'components/demo-firebase', apiDir: 'apps/demo-api' });
    const json = formatReportAsJson(report);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed['componentDir']).toBe('components/demo-firebase');
    expect(parsed['apiDir']).toBe('apps/demo-api');
    expect(parsed['uploadServiceFactoryName']).toBe('demoStorageFileUploadServiceFactory');
    expect(Array.isArray(parsed['purposes'])).toBe(true);
  });
});

describe('listAppStorageFiles — empty case', () => {
  it('returns an empty purposes array when component has no purpose constants', () => {
    const inspection: AppStorageFilesInspection = {
      component: { rootDir: 'components/demo-firebase', storagefileFolder: 'src/lib/model/storagefile', status: 'ok', files: [{ relPath: 'src/lib/model/storagefile/empty.ts', text: 'export const x = 1;\n' }] },
      api: { rootDir: 'apps/demo-api', storagefileFolder: 'src/app/common/model/storagefile', status: 'ok', files: [] }
    };
    const report = listAppStorageFiles(inspection, { componentDir: 'components/demo-firebase', apiDir: 'apps/demo-api' });
    expect(report.purposes).toHaveLength(0);
    expect(report.uploadServiceFactoryName).toBeUndefined();
  });
});
