import { describe, expect, it } from 'vitest';
import { validateAppNotifications } from './index.js';
import type { AppNotificationsInspection, InspectedFile, ViolationCode } from './types.js';

// MARK: Fixture — mimics the demo-firebase + demo-api shape with a two-file component
// (aggregator + spread sub-array) and a two-file API (factory + module).
const COMPONENT_MAIN = `import { notificationTemplateTypeInfoRecord, type NotificationTemplateType, type NotificationTemplateTypeInfo } from '@dereekb/firebase';
import { ALL_GUESTBOOK_NOTIFICATION_TEMPLATE_TYPE_INFOS } from './notification.guestbook';

// MARK: Test Notification
export const TEST_NOTIFICATIONS_TEMPLATE_TYPE: NotificationTemplateType = 'TEST';

export const TEST_NOTIFICATIONS_TEMPLATE_TYPE_INFO: NotificationTemplateTypeInfo = {
  type: TEST_NOTIFICATIONS_TEMPLATE_TYPE,
  name: 'Test',
  description: 'A test notification.',
  notificationMIdentity: testIdentity
};

// MARK: All Notifications
export const DEMO_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD = notificationTemplateTypeInfoRecord([TEST_NOTIFICATIONS_TEMPLATE_TYPE_INFO, ...ALL_GUESTBOOK_NOTIFICATION_TEMPLATE_TYPE_INFOS]);
`;

const COMPONENT_GUESTBOOK = `import { type NotificationTemplateType, type NotificationTemplateTypeInfo } from '@dereekb/firebase';

// MARK: Guestbook Created
export const GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE: NotificationTemplateType = 'GBE_C';

export const GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE_INFO: NotificationTemplateTypeInfo = {
  type: GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE,
  name: 'Guestbook Entry Created',
  description: 'A new guestbook entry was created.',
  notificationMIdentity: guestbookIdentity
};

// MARK: All Guestbook
export const ALL_GUESTBOOK_NOTIFICATION_TEMPLATE_TYPE_INFOS: NotificationTemplateTypeInfo[] = [GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE_INFO];
`;

const COMPONENT_TASK = `import { type NotificationTaskType } from '@dereekb/firebase';

// MARK: Example Task
export const EXAMPLE_NOTIFICATION_TASK_TYPE: NotificationTaskType = 'E';

export type ExampleNotificationTaskCheckpoint = 'part_a' | 'part_b';

export interface ExampleNotificationTaskData {
  readonly uid: string;
}

// MARK: All Tasks
export const ALL_NOTIFICATION_TASK_TYPES: NotificationTaskType[] = [EXAMPLE_NOTIFICATION_TASK_TYPE];
`;

const API_ACTION_MODULE = `import { appNotificationTemplateTypeInfoRecordService } from '@dereekb/firebase';
import { DEMO_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD } from 'demo-firebase';

export const demoFirebaseServerActionsContextFactory = (context) => {
  return {
    appNotificationTemplateTypeInfoRecordService: appNotificationTemplateTypeInfoRecordService(DEMO_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD)
  };
};
`;

const API_FACTORY = `import { TEST_NOTIFICATIONS_TEMPLATE_TYPE, GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE } from 'demo-firebase';

export function demoTestNotificationFactory(context) {
  return { type: TEST_NOTIFICATIONS_TEMPLATE_TYPE, factory: async () => null };
}

export function demoGuestbookCreatedNotificationFactory(context) {
  return { type: GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE, factory: async () => null };
}

// MARK: All
export const demoNotificationTemplateServiceConfigsArrayFactory = (context) => {
  return [demoTestNotificationFactory(context), demoGuestbookCreatedNotificationFactory(context)];
};
`;

const API_TASK_SERVICE = `import { type NotificationTaskService, type NotificationTaskServiceTaskHandlerConfig, notificationTaskService } from '@dereekb/firebase-server/model';
import { ALL_NOTIFICATION_TASK_TYPES, EXAMPLE_NOTIFICATION_TASK_TYPE, type ExampleNotificationTaskData, type ExampleNotificationTaskCheckpoint } from 'demo-firebase';

export function demoNotificationTaskServiceFactory(context): NotificationTaskService {
  const exampleNotificationTaskHandler: NotificationTaskServiceTaskHandlerConfig<ExampleNotificationTaskData, ExampleNotificationTaskCheckpoint> = {
    type: EXAMPLE_NOTIFICATION_TASK_TYPE,
    flow: [{ checkpoint: 'part_a', fn: async () => null }]
  };
  const handlers: NotificationTaskServiceTaskHandlerConfig<any>[] = [exampleNotificationTaskHandler];
  return notificationTaskService({ validate: [...ALL_NOTIFICATION_TASK_TYPES], handlers });
}
`;

const API_NOTIFICATION_MODULE = `import { NOTIFICATION_TEMPLATE_SERVICE_CONFIGS_ARRAY_TOKEN } from '@dereekb/firebase-server/model';
import { demoNotificationTemplateServiceConfigsArrayFactory } from './notification.factory';

export const providers = [
  { provide: NOTIFICATION_TEMPLATE_SERVICE_CONFIGS_ARRAY_TOKEN, useFactory: demoNotificationTemplateServiceConfigsArrayFactory }
];
`;

function happyInspection(): AppNotificationsInspection {
  const component: InspectedFile[] = [
    { relPath: 'src/lib/model/notification/notification.ts', text: COMPONENT_MAIN },
    { relPath: 'src/lib/model/notification/notification.guestbook.ts', text: COMPONENT_GUESTBOOK },
    { relPath: 'src/lib/model/notification/notification.task.ts', text: COMPONENT_TASK }
  ];
  const api: InspectedFile[] = [
    { relPath: 'src/app/common/firebase/action.module.ts', text: API_ACTION_MODULE },
    { relPath: 'src/app/common/model/notification/notification.factory.ts', text: API_FACTORY },
    { relPath: 'src/app/common/model/notification/notification.task.service.ts', text: API_TASK_SERVICE },
    { relPath: 'src/app/common/model/notification/notification.module.ts', text: API_NOTIFICATION_MODULE }
  ];
  const result: AppNotificationsInspection = {
    component: { rootDir: 'components/demo-firebase', notificationFolder: 'src/lib/model/notification', status: 'ok', files: component },
    api: { rootDir: 'apps/demo-api', notificationFolder: 'src/app/common/model/notification,src/app/common/firebase', status: 'ok', files: api }
  };
  return result;
}

function runWith(modify: (parts: { component: InspectedFile[]; api: InspectedFile[] }) => void): ReturnType<typeof validateAppNotifications> {
  const inspection = happyInspection();
  const component = [...inspection.component.files];
  const api = [...inspection.api.files];
  modify({ component, api });
  const result = validateAppNotifications({ component: { ...inspection.component, files: component }, api: { ...inspection.api, files: api } }, { componentDir: inspection.component.rootDir, apiDir: inspection.api.rootDir });
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

describe('validateAppNotifications — happy path', () => {
  it('passes a complete demo-shaped fixture (spread aggregate + direct info, wired both sides)', () => {
    const result = validateAppNotifications(happyInspection(), { componentDir: 'components/demo-firebase', apiDir: 'apps/demo-api' });
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

describe('validateAppNotifications — template metadata rules', () => {
  it('flags NOTIF_TEMPLATE_INFO_MISSING when a type constant has no matching info', () => {
    const result = runWith(({ component }) => {
      replaceInFile({ files: component, relPath: 'src/lib/model/notification/notification.ts', from: /export const TEST_NOTIFICATIONS_TEMPLATE_TYPE_INFO: NotificationTemplateTypeInfo = \{[\s\S]*?\};/, to: '' });
    });
    expectCodes(
      result.violations.map((v) => v.code),
      ['NOTIF_TEMPLATE_INFO_MISSING']
    );
  });

  it('flags NOTIF_TEMPLATE_INFO_NOT_IN_RECORD when an info is declared but absent from the aggregator', () => {
    const result = runWith(({ component }) => {
      replaceInFile({ files: component, relPath: 'src/lib/model/notification/notification.ts', from: 'notificationTemplateTypeInfoRecord([TEST_NOTIFICATIONS_TEMPLATE_TYPE_INFO, ...ALL_GUESTBOOK_NOTIFICATION_TEMPLATE_TYPE_INFOS])', to: 'notificationTemplateTypeInfoRecord([...ALL_GUESTBOOK_NOTIFICATION_TEMPLATE_TYPE_INFOS])' });
    });
    expectCodes(
      result.violations.map((v) => v.code),
      ['NOTIF_TEMPLATE_INFO_NOT_IN_RECORD']
    );
  });

  it('flags NOTIF_TEMPLATE_RECORD_NOT_WIRED when the aggregator is not passed to appNotificationTemplateTypeInfoRecordService', () => {
    const result = runWith(({ api }) => {
      replaceInFile({ files: api, relPath: 'src/app/common/firebase/action.module.ts', from: /appNotificationTemplateTypeInfoRecordService\(DEMO_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD\)/, to: 'null' });
    });
    expectCodes(
      result.violations.map((v) => v.code),
      ['NOTIF_TEMPLATE_RECORD_NOT_WIRED']
    );
  });

  it('flags NOTIF_TEMPLATE_SPREAD_UNRESOLVED when a spread in the record does not resolve', () => {
    const result = runWith(({ component }) => {
      replaceInFile({ files: component, relPath: 'src/lib/model/notification/notification.guestbook.ts', from: 'export const ALL_GUESTBOOK_NOTIFICATION_TEMPLATE_TYPE_INFOS:', to: 'export const ALL_GUESTBOOK_RENAMED_NOTIFICATION_TEMPLATE_TYPE_INFOS:' });
    });
    expectCodes(
      result.violations.map((v) => v.code),
      ['NOTIF_TEMPLATE_SPREAD_UNRESOLVED']
    );
  });
});

describe('validateAppNotifications — template handler factory rules', () => {
  it('flags NOTIF_TEMPLATE_FACTORY_MISSING when a declared template has no handler factory', () => {
    const result = runWith(({ api }) => {
      replaceInFile({ files: api, relPath: 'src/app/common/model/notification/notification.factory.ts', from: 'return [demoTestNotificationFactory(context), demoGuestbookCreatedNotificationFactory(context)];', to: 'return [demoTestNotificationFactory(context)];' });
    });
    expectCodes(
      result.violations.map((v) => v.code),
      ['NOTIF_TEMPLATE_FACTORY_MISSING']
    );
  });

  it('flags NOTIF_TEMPLATE_FACTORY_NOT_WIRED when the configs-array factory is not bound to the token', () => {
    const result = runWith(({ api }) => {
      replaceInFile({ files: api, relPath: 'src/app/common/model/notification/notification.module.ts', from: 'useFactory: demoNotificationTemplateServiceConfigsArrayFactory', to: 'useFactory: someOtherFactory' });
    });
    expectCodes(
      result.violations.map((v) => v.code),
      ['NOTIF_TEMPLATE_FACTORY_NOT_WIRED']
    );
  });

  it('flags NOTIF_TEMPLATE_FACTORY_ORPHAN when a handler references a phantom type identifier', () => {
    const result = runWith(({ api }) => {
      replaceInFile({ files: api, relPath: 'src/app/common/model/notification/notification.factory.ts', from: 'return { type: TEST_NOTIFICATIONS_TEMPLATE_TYPE, factory: async () => null };', to: 'return { type: PHANTOM_NOTIFICATION_TEMPLATE_TYPE, factory: async () => null };' });
    });
    expectCodes(
      result.violations.map((v) => v.code),
      ['NOTIF_TEMPLATE_FACTORY_ORPHAN']
    );
  });

  it('flags NOTIF_TEMPLATE_FACTORY_ARRAY_MISSING when the configs-array factory function is gone', () => {
    const result = runWith(({ api }) => {
      replaceInFile({ files: api, relPath: 'src/app/common/model/notification/notification.factory.ts', from: /export const demoNotificationTemplateServiceConfigsArrayFactory = [\s\S]*?};/, to: '' });
    });
    expectCodes(
      result.violations.map((v) => v.code),
      ['NOTIF_TEMPLATE_FACTORY_ARRAY_MISSING']
    );
  });
});

describe('validateAppNotifications — task rules', () => {
  it('flags NOTIF_TASK_NOT_IN_ALL_ARRAY when a declared task is not in any ALL_* array', () => {
    const result = runWith(({ component }) => {
      replaceInFile({ files: component, relPath: 'src/lib/model/notification/notification.task.ts', from: 'export const ALL_NOTIFICATION_TASK_TYPES: NotificationTaskType[] = [EXAMPLE_NOTIFICATION_TASK_TYPE];', to: 'export const ALL_NOTIFICATION_TASK_TYPES: NotificationTaskType[] = [];' });
    });
    expectCodes(
      result.violations.map((v) => v.code),
      ['NOTIF_TASK_NOT_IN_ALL_ARRAY']
    );
  });

  it('flags NOTIF_TASK_NOT_REGISTERED_IN_SERVICE when a declared task has no handler config in the API', () => {
    const result = runWith(({ api }) => {
      replaceInFile({ files: api, relPath: 'src/app/common/model/notification/notification.task.service.ts', from: /const exampleNotificationTaskHandler: NotificationTaskServiceTaskHandlerConfig[\s\S]*?\};/, to: '' });
      replaceInFile({ files: api, relPath: 'src/app/common/model/notification/notification.task.service.ts', from: '[exampleNotificationTaskHandler]', to: '[]' });
    });
    const codes = result.violations.map((v) => v.code);
    expectCodes(codes, ['NOTIF_TASK_NOT_REGISTERED_IN_SERVICE']);
    // No literal at all → mismatch should NOT also fire.
    expect(codes).not.toContain('NOTIF_TASK_HANDLER_NAME_MISMATCH');
  });

  it('flags NOTIF_TASK_HANDLER_NAME_MISMATCH when a handler literal exists but no array element resolves to its binding', () => {
    const result = runWith(({ api }) => {
      // Keep the inline handler literal but reference an unrelated identifier
      // in the handlers array. The trace cannot bridge the call-site name to
      // the handler's bindingName, so mismatch should fire instead of the
      // "no literal at all" missing-handler error.
      replaceInFile({ files: api, relPath: 'src/app/common/model/notification/notification.task.service.ts', from: '[exampleNotificationTaskHandler]', to: '[exampleNotificationTaskHandlerTypo]' });
    });
    const codes = result.violations.map((v) => v.code);
    expectCodes(codes, ['NOTIF_TASK_HANDLER_NAME_MISMATCH']);
    expect(codes).not.toContain('NOTIF_TASK_NOT_REGISTERED_IN_SERVICE');
    const mismatch = result.violations.find((v) => v.code === 'NOTIF_TASK_HANDLER_NAME_MISMATCH');
    expect(mismatch?.file).toBe('src/app/common/model/notification/notification.task.service.ts');
    expect(mismatch?.message).toContain('exampleNotificationTaskHandler');
  });

  it('passes when a factory-shipped handler binds its inner variable to the same name as the call-site identifier', () => {
    const HANDLER_FILE = `import { type NotificationTaskServiceTaskHandlerConfig } from '@dereekb/firebase-server/model';
import { EXAMPLE_NOTIFICATION_TASK_TYPE, type ExampleNotificationTaskData, type ExampleNotificationTaskCheckpoint } from 'demo-firebase';

export function demoExampleHandledNotificationTaskHandler(context) {
  const exampleHandledHandler: NotificationTaskServiceTaskHandlerConfig<ExampleNotificationTaskData, ExampleNotificationTaskCheckpoint> = {
    type: EXAMPLE_NOTIFICATION_TASK_TYPE,
    flow: [{ checkpoint: 'part_a', fn: async () => null }]
  };
  return exampleHandledHandler;
}
`;
    const result = runWith(({ api }) => {
      replaceInFile({ files: api, relPath: 'src/app/common/model/notification/notification.task.service.ts', from: /const exampleNotificationTaskHandler: NotificationTaskServiceTaskHandlerConfig[\s\S]*?\};/, to: 'const exampleHandledHandler = demoExampleHandledNotificationTaskHandler(context);' });
      replaceInFile({
        files: api,
        relPath: 'src/app/common/model/notification/notification.task.service.ts',
        from: "import { ALL_NOTIFICATION_TASK_TYPES, EXAMPLE_NOTIFICATION_TASK_TYPE, type ExampleNotificationTaskData, type ExampleNotificationTaskCheckpoint } from 'demo-firebase';",
        to: "import { ALL_NOTIFICATION_TASK_TYPES, EXAMPLE_NOTIFICATION_TASK_TYPE, type ExampleNotificationTaskData, type ExampleNotificationTaskCheckpoint } from 'demo-firebase';\nimport { demoExampleHandledNotificationTaskHandler } from './handlers/task.handler.example.handled';"
      });
      replaceInFile({ files: api, relPath: 'src/app/common/model/notification/notification.task.service.ts', from: '[exampleNotificationTaskHandler]', to: '[exampleHandledHandler]' });
      api.push({ relPath: 'src/app/common/model/notification/handlers/task.handler.example.handled.ts', text: HANDLER_FILE });
    });
    const codes = result.violations.map((v) => v.code);
    expect(codes).not.toContain('NOTIF_TASK_HANDLER_NAME_MISMATCH');
    expect(codes).not.toContain('NOTIF_TASK_NOT_REGISTERED_IN_SERVICE');
  });

  it('warns NOTIF_TASK_HANDLER_SPREAD_UNRESOLVED when an unknown identifier appears in handlers and is not trust-listed', () => {
    const result = runWith(({ api }) => {
      replaceInFile({ files: api, relPath: 'src/app/common/model/notification/notification.task.service.ts', from: '[exampleNotificationTaskHandler]', to: '[exampleNotificationTaskHandler, mysteryHandler]' });
    });
    const codes = result.violations.map((v) => v.code);
    expectCodes(codes, ['NOTIF_TASK_HANDLER_SPREAD_UNRESOLVED']);
    const warn = result.violations.find((v) => v.code === 'NOTIF_TASK_HANDLER_SPREAD_UNRESOLVED');
    expect(warn?.message).toContain('mysteryHandler');
  });

  it('flags NOTIF_TASK_HANDLER_ORPHAN when a handler references a phantom type identifier', () => {
    const result = runWith(({ api }) => {
      replaceInFile({ files: api, relPath: 'src/app/common/model/notification/notification.task.service.ts', from: 'type: EXAMPLE_NOTIFICATION_TASK_TYPE', to: 'type: PHANTOM_NOTIFICATION_TASK_TYPE' });
    });
    expectCodes(
      result.violations.map((v) => v.code),
      ['NOTIF_TASK_HANDLER_ORPHAN']
    );
  });

  it('flags NOTIF_TASK_SERVICE_FACTORY_MISSING when the API has no notificationTaskService call', () => {
    const result = runWith(({ api }) => {
      replaceInFile({ files: api, relPath: 'src/app/common/model/notification/notification.task.service.ts', from: /return notificationTaskService\([\s\S]*?\);/, to: 'return null;' });
    });
    expectCodes(
      result.violations.map((v) => v.code),
      ['NOTIF_TASK_SERVICE_FACTORY_MISSING']
    );
  });
});

describe('validateAppNotifications — warnings', () => {
  it('warns NOTIF_TEMPLATE_TYPE_CODE_DUPLICATE when two template consts share a string value', () => {
    const result = runWith(({ component }) => {
      replaceInFile({ files: component, relPath: 'src/lib/model/notification/notification.guestbook.ts', from: "'GBE_C'", to: "'TEST'" });
    });
    const warnings = result.violations.filter((v) => v.code === 'NOTIF_TEMPLATE_TYPE_CODE_DUPLICATE');
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0].severity).toBe('warning');
  });

  it('warns NOTIF_TEMPLATE_INFO_MISSING_NAME_OR_DESCRIPTION when an info is missing name', () => {
    const result = runWith(({ component }) => {
      replaceInFile({ files: component, relPath: 'src/lib/model/notification/notification.ts', from: "name: 'Test',", to: '' });
    });
    const warnings = result.violations.filter((v) => v.code === 'NOTIF_TEMPLATE_INFO_MISSING_NAME_OR_DESCRIPTION');
    expect(warnings).toHaveLength(1);
  });

  it('warns NOTIF_TEMPLATE_FACTORY_SPREAD_UNRESOLVED when a spread call is not a declared function', () => {
    const result = runWith(({ api }) => {
      replaceInFile({ files: api, relPath: 'src/app/common/model/notification/notification.factory.ts', from: 'return [demoTestNotificationFactory(context), demoGuestbookCreatedNotificationFactory(context)];', to: 'return [demoTestNotificationFactory(context), ...unknownSubFactory(context)];' });
    });
    const warnings = result.violations.filter((v) => v.code === 'NOTIF_TEMPLATE_FACTORY_SPREAD_UNRESOLVED');
    expect(warnings.length).toBeGreaterThan(0);
  });
});

describe('validateAppNotifications — trust list', () => {
  it('does not warn NOTIF_TEMPLATE_FACTORY_ORPHAN for a type imported from @dereekb/*', () => {
    const result = runWith(({ api }) => {
      replaceInFile({ files: api, relPath: 'src/app/common/model/notification/notification.factory.ts', from: "import { TEST_NOTIFICATIONS_TEMPLATE_TYPE, GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE } from 'demo-firebase';", to: `import { TEST_NOTIFICATIONS_TEMPLATE_TYPE, GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE } from 'demo-firebase';\nimport { STORAGE_FILE_PROCESSING_TEMPLATE_TYPE } from '@dereekb/firebase';` });
      replaceInFile({ files: api, relPath: 'src/app/common/model/notification/notification.factory.ts', from: 'return [demoTestNotificationFactory(context), demoGuestbookCreatedNotificationFactory(context)];', to: 'return [demoTestNotificationFactory(context), demoGuestbookCreatedNotificationFactory(context), externalFactory(context)];' });
      // The `externalFactory` call referencing an external template type identifier should not produce an orphan.
      replaceInFile({ files: api, relPath: 'src/app/common/model/notification/notification.factory.ts', from: 'export function demoGuestbookCreatedNotificationFactory(context) {', to: 'export function externalFactory(context) { return { type: STORAGE_FILE_PROCESSING_TEMPLATE_TYPE, factory: async () => null }; }\nexport function demoGuestbookCreatedNotificationFactory(context) {' });
    });
    const orphans = result.violations.filter((v) => v.code === 'NOTIF_TEMPLATE_FACTORY_ORPHAN');
    expect(orphans).toHaveLength(0);
  });
});

describe('validateAppNotifications — I/O rules', () => {
  it('flags NOTIF_COMPONENT_DIR_NOT_FOUND', () => {
    const inspection: AppNotificationsInspection = {
      component: { rootDir: 'components/ghost', notificationFolder: undefined, status: 'dir-not-found', files: [] },
      api: { rootDir: 'apps/demo-api', notificationFolder: 'src/app/common/model/notification', status: 'ok', files: [] }
    };
    const result = validateAppNotifications(inspection, { componentDir: inspection.component.rootDir, apiDir: inspection.api.rootDir });
    expectCodes(
      result.violations.map((v) => v.code),
      ['NOTIF_COMPONENT_DIR_NOT_FOUND']
    );
  });

  it('flags NOTIF_API_NOTIFICATION_FOLDER_MISSING', () => {
    const inspection: AppNotificationsInspection = {
      component: { rootDir: 'components/demo-firebase', notificationFolder: 'src/lib/model/notification', status: 'ok', files: [] },
      api: { rootDir: 'apps/demo-api', notificationFolder: undefined, status: 'notification-folder-missing', files: [] }
    };
    const result = validateAppNotifications(inspection, { componentDir: inspection.component.rootDir, apiDir: inspection.api.rootDir });
    expectCodes(
      result.violations.map((v) => v.code),
      ['NOTIF_API_NOTIFICATION_FOLDER_MISSING']
    );
  });
});
