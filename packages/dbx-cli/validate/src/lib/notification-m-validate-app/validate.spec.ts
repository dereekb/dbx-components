import { describe, expect, it } from 'vitest';
import { extractAppNotifications, validateAppNotifications } from './index.js';
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
  notificationModelIdentity: testIdentity
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
  notificationModelIdentity: guestbookIdentity
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
    component: { rootDir: 'components/demo-firebase', folder: 'src/lib/model/notification', status: 'ok', files: component },
    api: { rootDir: 'apps/demo-api', folder: 'src/app/common/model/notification,src/app/common/firebase', status: 'ok', files: api }
  };
  return result;
}

function inspectionWith(modify: (parts: { component: InspectedFile[]; api: InspectedFile[] }) => void): AppNotificationsInspection {
  const inspection = happyInspection();
  const component = [...inspection.component.files];
  const api = [...inspection.api.files];
  modify({ component, api });
  const result: AppNotificationsInspection = { component: { ...inspection.component, files: component }, api: { ...inspection.api, files: api } };
  return result;
}

function runWith(modify: (parts: { component: InspectedFile[]; api: InspectedFile[] }) => void): ReturnType<typeof validateAppNotifications> {
  const inspection = inspectionWith(modify);
  const result = validateAppNotifications(inspection, { componentDir: inspection.component.rootDir, apiDir: inspection.api.rootDir });
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
  const text = i < 0 ? undefined : files[i].text;
  if (text === undefined || !(typeof from === 'string' ? text.includes(from) : from.test(text))) {
    throw new Error(`replaceInFile: \`${String(from)}\` not found in ${relPath}`);
  }
  files[i] = { ...files[i], text: text.replace(from, to) };
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
      replaceInFile({
        files: component,
        relPath: 'src/lib/model/notification/notification.ts',
        from: 'notificationTemplateTypeInfoRecord([TEST_NOTIFICATIONS_TEMPLATE_TYPE_INFO, ...ALL_GUESTBOOK_NOTIFICATION_TEMPLATE_TYPE_INFOS])',
        to: 'notificationTemplateTypeInfoRecord([...ALL_GUESTBOOK_NOTIFICATION_TEMPLATE_TYPE_INFOS])'
      });
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

  it('flags NOTIF_TASK_IN_VALIDATE_WITHOUT_HANDLER as an error when a validate type has no handler', () => {
    const servicePath = 'src/app/common/model/notification/notification.task.service.ts';
    const result = runWith(({ api }) => {
      replaceInFile({ files: api, relPath: servicePath, from: 'export function demoNotificationTaskServiceFactory', to: "const OTHER_NOTIFICATION_TASK_TYPE = 'O';\n\nexport function demoNotificationTaskServiceFactory" });
      replaceInFile({ files: api, relPath: servicePath, from: 'validate: [...ALL_NOTIFICATION_TASK_TYPES]', to: 'validate: [...ALL_NOTIFICATION_TASK_TYPES, OTHER_NOTIFICATION_TASK_TYPE]' });
    });
    const violation = result.violations.find((v) => v.code === 'NOTIF_TASK_IN_VALIDATE_WITHOUT_HANDLER');
    expect(violation?.severity).toBe('error');
    expect(violation?.message).toContain('OTHER_NOTIFICATION_TASK_TYPE');
    expect(result.errorCount).toBeGreaterThanOrEqual(1);
  });

  it('passes the happy fixture with validate naming ALL_NOTIFICATION_TASK_TYPES directly', () => {
    const result = runWith(({ api }) => {
      replaceInFile({ files: api, relPath: 'src/app/common/model/notification/notification.task.service.ts', from: 'validate: [...ALL_NOTIFICATION_TASK_TYPES]', to: 'validate: ALL_NOTIFICATION_TASK_TYPES' });
    });
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
  });

  it('flags NOTIF_TASK_IN_VALIDATE_WITHOUT_HANDLER for a task type in a validate aggregate named directly', () => {
    const result = runWith(({ component, api }) => {
      addSecondTaskType(component);
      replaceInFile({ files: api, relPath: 'src/app/common/model/notification/notification.task.service.ts', from: 'validate: [...ALL_NOTIFICATION_TASK_TYPES]', to: 'validate: ALL_NOTIFICATION_TASK_TYPES' });
    });
    const violation = result.violations.find((v) => v.code === 'NOTIF_TASK_IN_VALIDATE_WITHOUT_HANDLER');
    expect(violation?.severity).toBe('error');
    expect(violation?.message).toContain('SECOND_NOTIFICATION_TASK_TYPE');
  });
});

// MARK: factory-of-array tracer regression suite — exercises the
// `collectHandlerBindingsFromValue` ArrayLiteralExpression branch added to
// support handler factories that return `NotificationTaskServiceTaskHandlerConfig[]`.
const SECOND_TASK_TYPE_PATCH = `export const EXAMPLE_NOTIFICATION_TASK_TYPE: NotificationTaskType = 'E';
export const SECOND_NOTIFICATION_TASK_TYPE: NotificationTaskType = 'S';

export type SecondNotificationTaskCheckpoint = 'part_x';

export interface SecondNotificationTaskData {
  readonly id: string;
}`;

function addSecondTaskType(component: InspectedFile[]): void {
  replaceInFile({ files: component, relPath: 'src/lib/model/notification/notification.task.ts', from: "export const EXAMPLE_NOTIFICATION_TASK_TYPE: NotificationTaskType = 'E';", to: SECOND_TASK_TYPE_PATCH });
  replaceInFile({
    files: component,
    relPath: 'src/lib/model/notification/notification.task.ts',
    from: 'export const ALL_NOTIFICATION_TASK_TYPES: NotificationTaskType[] = [EXAMPLE_NOTIFICATION_TASK_TYPE];',
    to: 'export const ALL_NOTIFICATION_TASK_TYPES: NotificationTaskType[] = [EXAMPLE_NOTIFICATION_TASK_TYPE, SECOND_NOTIFICATION_TASK_TYPE];'
  });
}

function swapServiceHandlerForFactorySpread(api: InspectedFile[], options: { readonly factoryImport: string; readonly factoryCall: string; readonly spreadVar: string }): void {
  const servicePath = 'src/app/common/model/notification/notification.task.service.ts';
  replaceInFile({ files: api, relPath: servicePath, from: /const exampleNotificationTaskHandler: NotificationTaskServiceTaskHandlerConfig[\s\S]*?\};/, to: `const ${options.spreadVar} = ${options.factoryCall};` });
  replaceInFile({
    files: api,
    relPath: servicePath,
    from: "import { ALL_NOTIFICATION_TASK_TYPES, EXAMPLE_NOTIFICATION_TASK_TYPE, type ExampleNotificationTaskData, type ExampleNotificationTaskCheckpoint } from 'demo-firebase';",
    to: `import { ALL_NOTIFICATION_TASK_TYPES, EXAMPLE_NOTIFICATION_TASK_TYPE } from 'demo-firebase';\n${options.factoryImport}`
  });
  replaceInFile({ files: api, relPath: servicePath, from: '[exampleNotificationTaskHandler]', to: `[...${options.spreadVar}]` });
}

describe('validateAppNotifications — factory-of-array task handler tracing', () => {
  it('resolves a single-handler factory that returns [singleHandler] (most common HelloSubs shape)', () => {
    const HANDLER_FILE = `import { type NotificationTaskServiceTaskHandlerConfig } from '@dereekb/firebase-server/model';
import { EXAMPLE_NOTIFICATION_TASK_TYPE, type ExampleNotificationTaskData, type ExampleNotificationTaskCheckpoint } from 'demo-firebase';

export function demoExampleTaskHandlers(context): NotificationTaskServiceTaskHandlerConfig<any>[] {
  const exampleHandler: NotificationTaskServiceTaskHandlerConfig<ExampleNotificationTaskData, ExampleNotificationTaskCheckpoint> = {
    type: EXAMPLE_NOTIFICATION_TASK_TYPE,
    flow: [{ checkpoint: 'part_a', fn: async () => null }]
  };
  return [exampleHandler];
}
`;
    const result = runWith(({ api }) => {
      swapServiceHandlerForFactorySpread(api, {
        factoryImport: "import { demoExampleTaskHandlers } from './handlers/task.handler.example';",
        factoryCall: 'demoExampleTaskHandlers(context)',
        spreadVar: 'exampleHandlers'
      });
      api.push({ relPath: 'src/app/common/model/notification/handlers/task.handler.example.ts', text: HANDLER_FILE });
    });
    const codes = result.violations.map((v) => v.code);
    expect(codes, JSON.stringify(result.violations, null, 2)).not.toContain('NOTIF_TASK_HANDLER_NAME_MISMATCH');
    expect(codes).not.toContain('NOTIF_TASK_NOT_REGISTERED_IN_SERVICE');
  });

  it('resolves a multi-handler factory that returns [a, b] from the same closure', () => {
    const HANDLER_FILE = `import { type NotificationTaskServiceTaskHandlerConfig } from '@dereekb/firebase-server/model';
import { EXAMPLE_NOTIFICATION_TASK_TYPE, SECOND_NOTIFICATION_TASK_TYPE, type ExampleNotificationTaskData, type ExampleNotificationTaskCheckpoint, type SecondNotificationTaskData, type SecondNotificationTaskCheckpoint } from 'demo-firebase';

export function demoMultiTaskHandlers(context): NotificationTaskServiceTaskHandlerConfig<any>[] {
  const exampleHandler: NotificationTaskServiceTaskHandlerConfig<ExampleNotificationTaskData, ExampleNotificationTaskCheckpoint> = {
    type: EXAMPLE_NOTIFICATION_TASK_TYPE,
    flow: [{ checkpoint: 'part_a', fn: async () => null }]
  };
  const secondHandler: NotificationTaskServiceTaskHandlerConfig<SecondNotificationTaskData, SecondNotificationTaskCheckpoint> = {
    type: SECOND_NOTIFICATION_TASK_TYPE,
    flow: [{ checkpoint: 'part_x', fn: async () => null }]
  };
  return [exampleHandler, secondHandler];
}
`;
    const result = runWith(({ component, api }) => {
      addSecondTaskType(component);
      swapServiceHandlerForFactorySpread(api, {
        factoryImport: "import { demoMultiTaskHandlers } from './handlers/task.handler.multi';",
        factoryCall: 'demoMultiTaskHandlers(context)',
        spreadVar: 'multiHandlers'
      });
      api.push({ relPath: 'src/app/common/model/notification/handlers/task.handler.multi.ts', text: HANDLER_FILE });
    });
    const codes = result.violations.map((v) => v.code);
    expect(codes, JSON.stringify(result.violations, null, 2)).not.toContain('NOTIF_TASK_HANDLER_NAME_MISMATCH');
    expect(codes).not.toContain('NOTIF_TASK_NOT_REGISTERED_IN_SERVICE');
  });

  it('resolves a factory whose return array contains a nested factory call', () => {
    const HANDLER_FILE = `import { type NotificationTaskServiceTaskHandlerConfig } from '@dereekb/firebase-server/model';
import { EXAMPLE_NOTIFICATION_TASK_TYPE, SECOND_NOTIFICATION_TASK_TYPE, type ExampleNotificationTaskData, type ExampleNotificationTaskCheckpoint, type SecondNotificationTaskData, type SecondNotificationTaskCheckpoint } from 'demo-firebase';

export function demoInnerSecondHandler(context) {
  const innerHandler: NotificationTaskServiceTaskHandlerConfig<SecondNotificationTaskData, SecondNotificationTaskCheckpoint> = {
    type: SECOND_NOTIFICATION_TASK_TYPE,
    flow: [{ checkpoint: 'part_x', fn: async () => null }]
  };
  return innerHandler;
}

export function demoNestedTaskHandlers(context): NotificationTaskServiceTaskHandlerConfig<any>[] {
  const localHandler: NotificationTaskServiceTaskHandlerConfig<ExampleNotificationTaskData, ExampleNotificationTaskCheckpoint> = {
    type: EXAMPLE_NOTIFICATION_TASK_TYPE,
    flow: [{ checkpoint: 'part_a', fn: async () => null }]
  };
  return [demoInnerSecondHandler(context), localHandler];
}
`;
    const result = runWith(({ component, api }) => {
      addSecondTaskType(component);
      swapServiceHandlerForFactorySpread(api, {
        factoryImport: "import { demoNestedTaskHandlers } from './handlers/task.handler.nested';",
        factoryCall: 'demoNestedTaskHandlers(context)',
        spreadVar: 'nestedHandlers'
      });
      api.push({ relPath: 'src/app/common/model/notification/handlers/task.handler.nested.ts', text: HANDLER_FILE });
    });
    const codes = result.violations.map((v) => v.code);
    expect(codes, JSON.stringify(result.violations, null, 2)).not.toContain('NOTIF_TASK_HANDLER_NAME_MISMATCH');
    expect(codes).not.toContain('NOTIF_TASK_NOT_REGISTERED_IN_SERVICE');
  });

  it('resolves a factory whose return array contains a spread of another factory', () => {
    const HANDLER_FILE = `import { type NotificationTaskServiceTaskHandlerConfig } from '@dereekb/firebase-server/model';
import { EXAMPLE_NOTIFICATION_TASK_TYPE, SECOND_NOTIFICATION_TASK_TYPE, type ExampleNotificationTaskData, type ExampleNotificationTaskCheckpoint, type SecondNotificationTaskData, type SecondNotificationTaskCheckpoint } from 'demo-firebase';

export function demoSubSecondHandlers(context): NotificationTaskServiceTaskHandlerConfig<any>[] {
  const subHandler: NotificationTaskServiceTaskHandlerConfig<SecondNotificationTaskData, SecondNotificationTaskCheckpoint> = {
    type: SECOND_NOTIFICATION_TASK_TYPE,
    flow: [{ checkpoint: 'part_x', fn: async () => null }]
  };
  return [subHandler];
}

export function demoSpreadTaskHandlers(context): NotificationTaskServiceTaskHandlerConfig<any>[] {
  const localHandler: NotificationTaskServiceTaskHandlerConfig<ExampleNotificationTaskData, ExampleNotificationTaskCheckpoint> = {
    type: EXAMPLE_NOTIFICATION_TASK_TYPE,
    flow: [{ checkpoint: 'part_a', fn: async () => null }]
  };
  return [...demoSubSecondHandlers(context), localHandler];
}
`;
    const result = runWith(({ component, api }) => {
      addSecondTaskType(component);
      swapServiceHandlerForFactorySpread(api, {
        factoryImport: "import { demoSpreadTaskHandlers } from './handlers/task.handler.spread';",
        factoryCall: 'demoSpreadTaskHandlers(context)',
        spreadVar: 'spreadHandlers'
      });
      api.push({ relPath: 'src/app/common/model/notification/handlers/task.handler.spread.ts', text: HANDLER_FILE });
    });
    const codes = result.violations.map((v) => v.code);
    expect(codes, JSON.stringify(result.violations, null, 2)).not.toContain('NOTIF_TASK_HANDLER_NAME_MISMATCH');
    expect(codes).not.toContain('NOTIF_TASK_NOT_REGISTERED_IN_SERVICE');
  });

  it('still resolves a factory returning a single handler object (regression guard for the identifier path)', () => {
    // Mirrors the legacy `return fooHandler` shape already covered above; kept here so the
    // factory-of-array suite asserts the singular-return path stays green alongside the new
    // array-return paths.
    const HANDLER_FILE = `import { type NotificationTaskServiceTaskHandlerConfig } from '@dereekb/firebase-server/model';
import { EXAMPLE_NOTIFICATION_TASK_TYPE, type ExampleNotificationTaskData, type ExampleNotificationTaskCheckpoint } from 'demo-firebase';

export function demoSingleObjectTaskHandler(context) {
  const exampleHandler: NotificationTaskServiceTaskHandlerConfig<ExampleNotificationTaskData, ExampleNotificationTaskCheckpoint> = {
    type: EXAMPLE_NOTIFICATION_TASK_TYPE,
    flow: [{ checkpoint: 'part_a', fn: async () => null }]
  };
  return exampleHandler;
}
`;
    const result = runWith(({ api }) => {
      replaceInFile({ files: api, relPath: 'src/app/common/model/notification/notification.task.service.ts', from: /const exampleNotificationTaskHandler: NotificationTaskServiceTaskHandlerConfig[\s\S]*?\};/, to: 'const exampleHandler = demoSingleObjectTaskHandler(context);' });
      replaceInFile({
        files: api,
        relPath: 'src/app/common/model/notification/notification.task.service.ts',
        from: "import { ALL_NOTIFICATION_TASK_TYPES, EXAMPLE_NOTIFICATION_TASK_TYPE, type ExampleNotificationTaskData, type ExampleNotificationTaskCheckpoint } from 'demo-firebase';",
        to: "import { ALL_NOTIFICATION_TASK_TYPES, EXAMPLE_NOTIFICATION_TASK_TYPE } from 'demo-firebase';\nimport { demoSingleObjectTaskHandler } from './handlers/task.handler.single';"
      });
      replaceInFile({ files: api, relPath: 'src/app/common/model/notification/notification.task.service.ts', from: '[exampleNotificationTaskHandler]', to: '[exampleHandler]' });
      api.push({ relPath: 'src/app/common/model/notification/handlers/task.handler.single.ts', text: HANDLER_FILE });
    });
    const codes = result.violations.map((v) => v.code);
    expect(codes, JSON.stringify(result.violations, null, 2)).not.toContain('NOTIF_TASK_HANDLER_NAME_MISMATCH');
    expect(codes).not.toContain('NOTIF_TASK_NOT_REGISTERED_IN_SERVICE');
  });

  it('resolves a factory that returns an intermediate typed-array variable (exact HelloSubs shape)', () => {
    const HANDLER_FILE = `import { type NotificationTaskServiceTaskHandlerConfig } from '@dereekb/firebase-server/model';
import { EXAMPLE_NOTIFICATION_TASK_TYPE, type ExampleNotificationTaskData, type ExampleNotificationTaskCheckpoint } from 'demo-firebase';

export function demoIntermediateTaskHandlers(context): NotificationTaskServiceTaskHandlerConfig<any>[] {
  const exampleHandler: NotificationTaskServiceTaskHandlerConfig<ExampleNotificationTaskData, ExampleNotificationTaskCheckpoint> = {
    type: EXAMPLE_NOTIFICATION_TASK_TYPE,
    flow: [{ checkpoint: 'part_a', fn: async () => null }]
  };
  const intermediate: NotificationTaskServiceTaskHandlerConfig<any>[] = [exampleHandler];
  return intermediate;
}
`;
    const result = runWith(({ api }) => {
      swapServiceHandlerForFactorySpread(api, {
        factoryImport: "import { demoIntermediateTaskHandlers } from './handlers/task.handler.intermediate';",
        factoryCall: 'demoIntermediateTaskHandlers(context)',
        spreadVar: 'intermediateHandlers'
      });
      api.push({ relPath: 'src/app/common/model/notification/handlers/task.handler.intermediate.ts', text: HANDLER_FILE });
    });
    const codes = result.violations.map((v) => v.code);
    expect(codes, JSON.stringify(result.violations, null, 2)).not.toContain('NOTIF_TASK_HANDLER_NAME_MISMATCH');
    expect(codes).not.toContain('NOTIF_TASK_NOT_REGISTERED_IN_SERVICE');
  });

  it('does not crash for a factory that returns []', () => {
    const HANDLER_FILE = `import { type NotificationTaskServiceTaskHandlerConfig } from '@dereekb/firebase-server/model';

export function demoEmptyTaskHandlers(context): NotificationTaskServiceTaskHandlerConfig<any>[] {
  return [];
}
`;
    const result = runWith(({ api }) => {
      swapServiceHandlerForFactorySpread(api, {
        factoryImport: "import { demoEmptyTaskHandlers } from './handlers/task.handler.empty';",
        factoryCall: 'demoEmptyTaskHandlers(context)',
        spreadVar: 'emptyHandlers'
      });
      api.push({ relPath: 'src/app/common/model/notification/handlers/task.handler.empty.ts', text: HANDLER_FILE });
    });
    const codes = result.violations.map((v) => v.code);
    // Inline handler is gone and the factory yields no resolvable binding —
    // the validator should report the declared task type as unregistered.
    expectCodes(codes, ['NOTIF_TASK_NOT_REGISTERED_IN_SERVICE']);
    expect(codes).not.toContain('NOTIF_TASK_HANDLER_NAME_MISMATCH');
  });

  it('does not resolve inline object literal elements inside a factory array return', () => {
    // Out of scope for the tracer: inline objects in a return array aren't named, typed
    // variable declarations, so `extractTaskHandlerEntries` won't record them and the
    // tracer must not pretend they are reachable bindings.
    const HANDLER_FILE = `import { type NotificationTaskServiceTaskHandlerConfig } from '@dereekb/firebase-server/model';
import { EXAMPLE_NOTIFICATION_TASK_TYPE } from 'demo-firebase';

export function demoInlineTaskHandlers(context): NotificationTaskServiceTaskHandlerConfig<any>[] {
  return [{ type: EXAMPLE_NOTIFICATION_TASK_TYPE, flow: [{ checkpoint: 'part_a', fn: async () => null }] }];
}
`;
    const result = runWith(({ api }) => {
      swapServiceHandlerForFactorySpread(api, {
        factoryImport: "import { demoInlineTaskHandlers } from './handlers/task.handler.inline';",
        factoryCall: 'demoInlineTaskHandlers(context)',
        spreadVar: 'inlineHandlers'
      });
      api.push({ relPath: 'src/app/common/model/notification/handlers/task.handler.inline.ts', text: HANDLER_FILE });
    });
    const codes = result.violations.map((v) => v.code);
    expectCodes(codes, ['NOTIF_TASK_NOT_REGISTERED_IN_SERVICE']);
    expect(codes).not.toContain('NOTIF_TASK_HANDLER_NAME_MISMATCH');
  });

  it('resolves two factories in one file that each return their own `handlers` local', () => {
    const HANDLER_FILE = `import { type NotificationTaskServiceTaskHandlerConfig } from '@dereekb/firebase-server/model';
import { EXAMPLE_NOTIFICATION_TASK_TYPE, SECOND_NOTIFICATION_TASK_TYPE, type ExampleNotificationTaskData, type ExampleNotificationTaskCheckpoint, type SecondNotificationTaskData, type SecondNotificationTaskCheckpoint } from 'demo-firebase';

export function demoExampleTaskHandlers(context): NotificationTaskServiceTaskHandlerConfig<any>[] {
  const exampleHandler: NotificationTaskServiceTaskHandlerConfig<ExampleNotificationTaskData, ExampleNotificationTaskCheckpoint> = {
    type: EXAMPLE_NOTIFICATION_TASK_TYPE,
    flow: [{ checkpoint: 'part_a', fn: async () => null }]
  };
  const handlers = [exampleHandler];
  return handlers;
}

export function demoSecondTaskHandlers(context): NotificationTaskServiceTaskHandlerConfig<any>[] {
  const secondHandler: NotificationTaskServiceTaskHandlerConfig<SecondNotificationTaskData, SecondNotificationTaskCheckpoint> = {
    type: SECOND_NOTIFICATION_TASK_TYPE,
    flow: [{ checkpoint: 'part_x', fn: async () => null }]
  };
  const handlers = [secondHandler];
  return handlers;
}
`;
    const modify = ({ component, api }: { component: InspectedFile[]; api: InspectedFile[] }) => {
      addSecondTaskType(component);
      swapServiceHandlerForFactorySpread(api, {
        factoryImport: "import { demoExampleTaskHandlers, demoSecondTaskHandlers } from './handlers/task.handler.lists';",
        factoryCall: 'demoExampleTaskHandlers(context)',
        spreadVar: 'exampleHandlers'
      });
      replaceInFile({ files: api, relPath: 'src/app/common/model/notification/notification.task.service.ts', from: '[...exampleHandlers]', to: '[...exampleHandlers, ...demoSecondTaskHandlers(context)]' });
      api.push({ relPath: 'src/app/common/model/notification/handlers/task.handler.lists.ts', text: HANDLER_FILE });
    };
    const result = runWith(modify);
    const codes = result.violations.map((v) => v.code);
    expect(codes, JSON.stringify(result.violations, null, 2)).not.toContain('NOTIF_TASK_HANDLER_NAME_MISMATCH');
    expect(codes).not.toContain('NOTIF_TASK_NOT_REGISTERED_IN_SERVICE');
    expect(codes).not.toContain('NOTIF_TASK_HANDLER_SPREAD_UNRESOLVED');
    const [call] = extractAppNotifications(inspectionWith(modify)).taskServiceCalls;
    expect(call.resolvedHandlerBindings).toEqual(['exampleHandler', 'secondHandler']);
    expect(call.unresolvedHandlerBindings).toEqual([]);
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

// MARK: delivery methods — static counterpart of the send pipeline's unlisted-delivery-method warning
const COMPONENT_MAIN_PATH = 'src/lib/model/notification/notification.ts';
const API_FACTORY_PATH = 'src/app/common/model/notification/notification.factory.ts';
const TEST_FACTORY_RETURN = 'return { type: TEST_NOTIFICATIONS_TEMPLATE_TYPE, factory: async () => null };';

interface DeliveryMethodsFixtureOptions {
  /**
   * Source text for the TEST info's `userConfigurableDeliveryMethods` property, or `undefined` to leave it out.
   */
  readonly deliveryMethods?: string;
  /**
   * Extra source for the TEST info's properties (e.g. `forcedDeliveryMethods: [...]`), added after the other properties.
   */
  readonly extraInfoProperties?: string;
  /**
   * Replacement for the TEST factory's `return` statement.
   */
  readonly factoryReturn?: string;
  /**
   * Extra source prepended to the API factory file.
   */
  readonly factoryPrelude?: string;
}

function deliveryMethodsInspection(options: DeliveryMethodsFixtureOptions): AppNotificationsInspection {
  const inspection = happyInspection();
  const component = [...inspection.component.files];
  const api = [...inspection.api.files];
  if (options.deliveryMethods !== undefined || options.extraInfoProperties !== undefined) {
    const properties = [...(options.deliveryMethods === undefined ? [] : [`userConfigurableDeliveryMethods: ${options.deliveryMethods}`]), ...(options.extraInfoProperties === undefined ? [] : [options.extraInfoProperties])];
    replaceInFile({ files: component, relPath: COMPONENT_MAIN_PATH, from: 'notificationModelIdentity: testIdentity\n', to: `notificationModelIdentity: testIdentity,\n  ${properties.join(',\n  ')}\n` });
  }
  if (options.factoryReturn !== undefined) {
    replaceInFile({ files: api, relPath: API_FACTORY_PATH, from: TEST_FACTORY_RETURN, to: options.factoryReturn });
  }
  if (options.factoryPrelude !== undefined) {
    replaceInFile({ files: api, relPath: API_FACTORY_PATH, from: 'export function demoTestNotificationFactory', to: `${options.factoryPrelude}\nexport function demoTestNotificationFactory` });
  }
  const result: AppNotificationsInspection = { component: { ...inspection.component, files: component }, api: { ...inspection.api, files: api } };
  return result;
}

function unlistedDeliveryMethodViolations(options: DeliveryMethodsFixtureOptions) {
  const result = validateAppNotifications(deliveryMethodsInspection(options), { componentDir: 'components/demo-firebase', apiDir: 'apps/demo-api' });
  return result.violations.filter((v) => v.code === 'NOTIF_TEMPLATE_FACTORY_UNLISTED_DELIVERY_METHOD');
}

function testInfo(options: DeliveryMethodsFixtureOptions) {
  return extractAppNotifications(deliveryMethodsInspection(options)).templateTypeInfos.find((i) => i.symbolName === 'TEST_NOTIFICATIONS_TEMPLATE_TYPE_INFO');
}

function testHandler(options: DeliveryMethodsFixtureOptions) {
  return extractAppNotifications(deliveryMethodsInspection(options)).templateHandlerEntries.find((e) => e.typeIdentifier === 'TEST_NOTIFICATIONS_TEMPLATE_TYPE');
}

const TEXT_CONTENT_RETURN = "return { type: TEST_NOTIFICATIONS_TEMPLATE_TYPE, factory: async () => async () => ({ inputContext: {}, flatContent: {}, textContent: { subject: 'Hi' } }) };";
const EMAIL_CONTENT_RETURN = "return { type: TEST_NOTIFICATIONS_TEMPLATE_TYPE, factory: async () => async () => ({ inputContext: {}, flatContent: {}, emailContent: { subject: 'Hi' } }) };";

describe('validateAppNotifications — delivery methods', () => {
  it('warns NOTIF_TEMPLATE_FACTORY_UNLISTED_DELIVERY_METHOD when the factory returns text content for an email-only template', () => {
    const violations = unlistedDeliveryMethodViolations({ deliveryMethods: '[NotificationDeliveryMethod.EMAIL]', factoryReturn: TEXT_CONTENT_RETURN });
    expect(violations).toHaveLength(1);
    expect(violations[0].severity).toBe('warning');
    expect(violations[0].side).toBe('api');
    expect(violations[0].file).toBe(API_FACTORY_PATH);
    expect(violations[0].message).toContain('TEXT');
    expect(violations[0].message).toContain('demoTestNotificationFactory');
  });

  it('does not warn when the factory only returns content for a listed method', () => {
    expect(unlistedDeliveryMethodViolations({ deliveryMethods: '[NotificationDeliveryMethod.EMAIL]', factoryReturn: EMAIL_CONTENT_RETURN })).toHaveLength(0);
    expect(testHandler({ factoryReturn: EMAIL_CONTENT_RETURN })?.contentDeliveryMethods).toEqual(['EMAIL']);
  });

  it('does not warn when the info leaves userConfigurableDeliveryMethods out (runtime defaults apply)', () => {
    expect(unlistedDeliveryMethodViolations({ factoryReturn: TEXT_CONTENT_RETURN })).toHaveLength(0);
    const info = testInfo({});
    expect(info?.userConfigurableDeliveryMethodsSource).toBe('default');
    expect(info?.userConfigurableDeliveryMethods).toBeUndefined();
  });

  it("reads the runtime-code string form (['e']) as a declared list", () => {
    const info = testInfo({ deliveryMethods: "['e']" });
    expect(info?.userConfigurableDeliveryMethodsSource).toBe('declared');
    expect(info?.userConfigurableDeliveryMethods).toEqual(['EMAIL']);
    expect(unlistedDeliveryMethodViolations({ deliveryMethods: "['e']", factoryReturn: TEXT_CONTENT_RETURN })).toHaveLength(1);
  });

  it('reads a list behind a local identifier as declared', () => {
    const inspection = deliveryMethodsInspection({ deliveryMethods: 'LOCAL_EMAIL_ONLY' });
    const component = inspection.component.files.map((f) => (f.relPath === COMPONENT_MAIN_PATH ? { ...f, text: `const LOCAL_EMAIL_ONLY = [NotificationDeliveryMethod.EMAIL, NotificationDeliveryMethod.PUSH];\n${f.text}` } : f));
    const info = extractAppNotifications({ ...inspection, component: { ...inspection.component, files: component } }).templateTypeInfos.find((i) => i.symbolName === 'TEST_NOTIFICATIONS_TEMPLATE_TYPE_INFO');
    expect(info?.userConfigurableDeliveryMethodsSource).toBe('declared');
    expect(info?.userConfigurableDeliveryMethods).toEqual(['EMAIL', 'PUSH']);
  });

  it('reports an imported identifier as unresolved and does not warn', () => {
    const info = testInfo({ deliveryMethods: 'EMAIL_ONLY' });
    expect(info?.userConfigurableDeliveryMethodsSource).toBe('unresolved');
    expect(info?.userConfigurableDeliveryMethods).toBeUndefined();
    expect(unlistedDeliveryMethodViolations({ deliveryMethods: 'EMAIL_ONLY', factoryReturn: TEXT_CONTENT_RETURN })).toHaveLength(0);
  });

  it('does not count content explicitly set to undefined', () => {
    const factoryReturn = 'return { type: TEST_NOTIFICATIONS_TEMPLATE_TYPE, factory: async () => async () => ({ inputContext: {}, flatContent: {}, textContent: undefined }) };';
    expect(testHandler({ factoryReturn })?.contentDeliveryMethods).toEqual([]);
    expect(unlistedDeliveryMethodViolations({ deliveryMethods: '[NotificationDeliveryMethod.EMAIL]', factoryReturn })).toHaveLength(0);
  });

  it('follows factory: <topLevelFn> one hop', () => {
    const options: DeliveryMethodsFixtureOptions = {
      deliveryMethods: '[NotificationDeliveryMethod.EMAIL]',
      factoryReturn: 'return { type: TEST_NOTIFICATIONS_TEMPLATE_TYPE, factory: demoTestMessageFactory };',
      factoryPrelude: "export async function demoTestMessageFactory() {\n  const textContent = { subject: 'Hi' };\n  return async () => ({ inputContext: {}, flatContent: {}, textContent });\n}\n"
    };
    expect(testHandler(options)?.contentDeliveryMethods).toEqual(['TEXT']);
    expect(unlistedDeliveryMethodViolations(options)).toHaveLength(1);
  });

  it('keeps the canonical EMAIL, TEXT, NOTIFICATION_SUMMARY order', () => {
    const factoryReturn = 'return { type: TEST_NOTIFICATIONS_TEMPLATE_TYPE, factory: async () => async () => ({ notificationSummaryContent: {}, textContent: {}, emailContent: {} }) };';
    expect(testHandler({ factoryReturn })?.contentDeliveryMethods).toEqual(['EMAIL', 'TEXT', 'NOTIFICATION_SUMMARY']);
  });
});

function forcedDeliveryMethodViolations(options: DeliveryMethodsFixtureOptions) {
  const result = validateAppNotifications(deliveryMethodsInspection(options), { componentDir: 'components/demo-firebase', apiDir: 'apps/demo-api' });
  return result.violations.filter((v) => v.code === 'NOTIF_TEMPLATE_FORCED_TEXT_DELIVERY_METHOD' || v.code === 'NOTIF_TEMPLATE_FORCED_DELIVERY_METHOD_EXPLICIT_OPT_IN');
}

describe('validateAppNotifications — forced delivery methods', () => {
  it('reads forcedDeliveryMethods and onlySendToExplicitlyEnabledRecipients', () => {
    const info = testInfo({ extraInfoProperties: 'forcedDeliveryMethods: [NotificationDeliveryMethod.EMAIL],\n  onlySendToExplicitlyEnabledRecipients: false' });
    expect(info?.forcedDeliveryMethodsSource).toBe('declared');
    expect(info?.forcedDeliveryMethods).toEqual(['EMAIL']);
    expect(info?.onlySendToExplicitlyEnabledRecipients).toBe(false);
  });

  it('reports a missing forcedDeliveryMethods as default', () => {
    const info = testInfo({});
    expect(info?.forcedDeliveryMethodsSource).toBe('default');
    expect(info?.forcedDeliveryMethods).toBeUndefined();
    expect(info?.onlySendToExplicitlyEnabledRecipients).toBeUndefined();
  });

  it('flags NOTIF_TEMPLATE_FORCED_TEXT_DELIVERY_METHOD when texts are forced', () => {
    const violations = forcedDeliveryMethodViolations({ extraInfoProperties: 'forcedDeliveryMethods: [NotificationDeliveryMethod.TEXT]' });
    expect(violations.map((v) => v.code)).toEqual(['NOTIF_TEMPLATE_FORCED_TEXT_DELIVERY_METHOD']);
    expect(violations[0].severity).toBe('error');
    expect(violations[0].side).toBe('component');
    expect(violations[0].file).toBe(COMPONENT_MAIN_PATH);
  });

  it('flags NOTIF_TEMPLATE_FORCED_DELIVERY_METHOD_EXPLICIT_OPT_IN when a method is forced on an opt-in only type', () => {
    const violations = forcedDeliveryMethodViolations({ extraInfoProperties: 'forcedDeliveryMethods: [NotificationDeliveryMethod.EMAIL],\n  onlySendToExplicitlyEnabledRecipients: true' });
    expect(violations.map((v) => v.code)).toEqual(['NOTIF_TEMPLATE_FORCED_DELIVERY_METHOD_EXPLICIT_OPT_IN']);
    expect(violations[0].severity).toBe('error');
  });

  it('does not flag a forced email without opt-in', () => {
    expect(forcedDeliveryMethodViolations({ extraInfoProperties: 'forcedDeliveryMethods: [NotificationDeliveryMethod.EMAIL]' })).toHaveLength(0);
  });

  it('does not flag an unresolved forcedDeliveryMethods list', () => {
    const options: DeliveryMethodsFixtureOptions = { extraInfoProperties: 'forcedDeliveryMethods: FORCED_METHODS,\n  onlySendToExplicitlyEnabledRecipients: true' };
    expect(testInfo(options)?.forcedDeliveryMethodsSource).toBe('unresolved');
    expect(forcedDeliveryMethodViolations(options)).toHaveLength(0);
  });

  it('counts forced methods as listed for NOTIF_TEMPLATE_FACTORY_UNLISTED_DELIVERY_METHOD', () => {
    expect(unlistedDeliveryMethodViolations({ deliveryMethods: '[NotificationDeliveryMethod.NOTIFICATION_SUMMARY]', extraInfoProperties: 'forcedDeliveryMethods: [NotificationDeliveryMethod.EMAIL]', factoryReturn: EMAIL_CONTENT_RETURN })).toHaveLength(0);
    expect(unlistedDeliveryMethodViolations({ deliveryMethods: '[NotificationDeliveryMethod.NOTIFICATION_SUMMARY]', factoryReturn: EMAIL_CONTENT_RETURN })).toHaveLength(1);
  });

  it('skips NOTIF_TEMPLATE_FACTORY_UNLISTED_DELIVERY_METHOD when forcedDeliveryMethods is unresolved', () => {
    expect(unlistedDeliveryMethodViolations({ deliveryMethods: '[NotificationDeliveryMethod.NOTIFICATION_SUMMARY]', extraInfoProperties: 'forcedDeliveryMethods: FORCED_METHODS', factoryReturn: EMAIL_CONTENT_RETURN })).toHaveLength(0);
    expect(unlistedDeliveryMethodViolations({ extraInfoProperties: 'forcedDeliveryMethods: FORCED_METHODS', factoryReturn: TEXT_CONTENT_RETURN })).toHaveLength(0);
  });

  it('only lists the forced methods for NOTIF_TEMPLATE_FACTORY_UNLISTED_DELIVERY_METHOD when the info leaves userConfigurableDeliveryMethods out', () => {
    const extraInfoProperties = 'forcedDeliveryMethods: [NotificationDeliveryMethod.EMAIL]';
    const violations = unlistedDeliveryMethodViolations({ extraInfoProperties, factoryReturn: TEXT_CONTENT_RETURN });

    expect(violations).toHaveLength(1);
    expect(violations[0].message).toContain('only lists EMAIL in `forcedDeliveryMethods`');
    expect(unlistedDeliveryMethodViolations({ extraInfoProperties, factoryReturn: EMAIL_CONTENT_RETURN })).toHaveLength(0);
  });
});

describe('validateAppNotifications — trust list', () => {
  it('does not warn NOTIF_TEMPLATE_FACTORY_ORPHAN for a type imported from @dereekb/*', () => {
    const result = runWith(({ api }) => {
      replaceInFile({
        files: api,
        relPath: 'src/app/common/model/notification/notification.factory.ts',
        from: "import { TEST_NOTIFICATIONS_TEMPLATE_TYPE, GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE } from 'demo-firebase';",
        to: `import { TEST_NOTIFICATIONS_TEMPLATE_TYPE, GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE } from 'demo-firebase';\nimport { STORAGE_FILE_PROCESSING_TEMPLATE_TYPE } from '@dereekb/firebase';`
      });
      replaceInFile({
        files: api,
        relPath: 'src/app/common/model/notification/notification.factory.ts',
        from: 'return [demoTestNotificationFactory(context), demoGuestbookCreatedNotificationFactory(context)];',
        to: 'return [demoTestNotificationFactory(context), demoGuestbookCreatedNotificationFactory(context), externalFactory(context)];'
      });
      // The `externalFactory` call referencing an external template type identifier should not produce an orphan.
      replaceInFile({
        files: api,
        relPath: 'src/app/common/model/notification/notification.factory.ts',
        from: 'export function demoGuestbookCreatedNotificationFactory(context) {',
        to: 'export function externalFactory(context) { return { type: STORAGE_FILE_PROCESSING_TEMPLATE_TYPE, factory: async () => null }; }\nexport function demoGuestbookCreatedNotificationFactory(context) {'
      });
    });
    const orphans = result.violations.filter((v) => v.code === 'NOTIF_TEMPLATE_FACTORY_ORPHAN');
    expect(orphans).toHaveLength(0);
  });
});

describe('validateAppNotifications — I/O rules', () => {
  it('flags NOTIF_COMPONENT_DIR_NOT_FOUND', () => {
    const inspection: AppNotificationsInspection = {
      component: { rootDir: 'components/ghost', folder: undefined, status: 'dir-not-found', files: [] },
      api: { rootDir: 'apps/demo-api', folder: 'src/app/common/model/notification', status: 'ok', files: [] }
    };
    const result = validateAppNotifications(inspection, { componentDir: inspection.component.rootDir, apiDir: inspection.api.rootDir });
    expectCodes(
      result.violations.map((v) => v.code),
      ['NOTIF_COMPONENT_DIR_NOT_FOUND']
    );
  });

  it('flags NOTIF_API_NOTIFICATION_FOLDER_MISSING', () => {
    const inspection: AppNotificationsInspection = {
      component: { rootDir: 'components/demo-firebase', folder: 'src/lib/model/notification', status: 'ok', files: [] },
      api: { rootDir: 'apps/demo-api', folder: undefined, status: 'folder-missing', files: [] }
    };
    const result = validateAppNotifications(inspection, { componentDir: inspection.component.rootDir, apiDir: inspection.api.rootDir });
    expectCodes(
      result.violations.map((v) => v.code),
      ['NOTIF_API_NOTIFICATION_FOLDER_MISSING']
    );
  });

  it('auto-attaches remediation hints from the rule catalog', () => {
    const inspection: AppNotificationsInspection = {
      component: { rootDir: 'components/ghost', folder: undefined, status: 'dir-not-found', files: [] },
      api: { rootDir: 'apps/demo-api', folder: 'src/app/common/model/notification', status: 'ok', files: [] }
    };
    const result = validateAppNotifications(inspection, { componentDir: inspection.component.rootDir, apiDir: inspection.api.rootDir });
    const v = result.violations.find((violation) => violation.code === 'NOTIF_COMPONENT_DIR_NOT_FOUND');
    expect(v).toBeDefined();
    expect(v?.remediation).toBeDefined();
    expect(v?.remediation?.fix).toBeTruthy();
  });
});

// MARK: Aliased and namespaced @dereekb factory calls
const ACTION_MODULE_PATH = 'src/app/common/firebase/action.module.ts';
const TASK_SERVICE_PATH = 'src/app/common/model/notification/notification.task.service.ts';

type NotificationFixtureParts = { component: InspectedFile[]; api: InspectedFile[] };
type NotificationFixtureVariant = readonly [string, (parts: NotificationFixtureParts) => void];

function aliasTemplateInfoRecord({ component }: NotificationFixtureParts): void {
  replaceInFile({ files: component, relPath: COMPONENT_MAIN_PATH, from: 'import { notificationTemplateTypeInfoRecord, type ', to: 'import { notificationTemplateTypeInfoRecord as infoRecord, type ' });
  replaceInFile({ files: component, relPath: COMPONENT_MAIN_PATH, from: '= notificationTemplateTypeInfoRecord([', to: '= infoRecord([' });
}

function namespaceTemplateInfoRecord({ component }: NotificationFixtureParts): void {
  replaceInFile({ files: component, relPath: COMPONENT_MAIN_PATH, from: 'import { notificationTemplateTypeInfoRecord, type ', to: "import * as firebaseModel from '@dereekb/firebase';\nimport { type " });
  replaceInFile({ files: component, relPath: COMPONENT_MAIN_PATH, from: '= notificationTemplateTypeInfoRecord([', to: '= firebaseModel.notificationTemplateTypeInfoRecord([' });
}

function aliasTemplateInfoRecordService({ api }: NotificationFixtureParts): void {
  replaceInFile({ files: api, relPath: ACTION_MODULE_PATH, from: "import { appNotificationTemplateTypeInfoRecordService } from '@dereekb/firebase';", to: "import { appNotificationTemplateTypeInfoRecordService as recordService } from '@dereekb/firebase';" });
  replaceInFile({ files: api, relPath: ACTION_MODULE_PATH, from: 'appNotificationTemplateTypeInfoRecordService: appNotificationTemplateTypeInfoRecordService(', to: 'appNotificationTemplateTypeInfoRecordService: recordService(' });
}

function namespaceTemplateInfoRecordService({ api }: NotificationFixtureParts): void {
  replaceInFile({ files: api, relPath: ACTION_MODULE_PATH, from: "import { appNotificationTemplateTypeInfoRecordService } from '@dereekb/firebase';", to: "import * as firebaseModel from '@dereekb/firebase';" });
  replaceInFile({ files: api, relPath: ACTION_MODULE_PATH, from: 'appNotificationTemplateTypeInfoRecordService: appNotificationTemplateTypeInfoRecordService(', to: 'appNotificationTemplateTypeInfoRecordService: firebaseModel.appNotificationTemplateTypeInfoRecordService(' });
}

function aliasTaskService({ api }: NotificationFixtureParts): void {
  replaceInFile({ files: api, relPath: TASK_SERVICE_PATH, from: ", notificationTaskService } from '@dereekb/firebase-server/model';", to: ", notificationTaskService as createNotificationTaskService } from '@dereekb/firebase-server/model';" });
  replaceInFile({ files: api, relPath: TASK_SERVICE_PATH, from: 'return notificationTaskService(', to: 'return createNotificationTaskService(' });
}

function namespaceTaskService({ api }: NotificationFixtureParts): void {
  replaceInFile({ files: api, relPath: TASK_SERVICE_PATH, from: ", notificationTaskService } from '@dereekb/firebase-server/model';", to: " } from '@dereekb/firebase-server/model';\nimport * as serverModel from '@dereekb/firebase-server/model';" });
  replaceInFile({ files: api, relPath: TASK_SERVICE_PATH, from: 'return notificationTaskService(', to: 'return serverModel.notificationTaskService(' });
}

describe('validateAppNotifications — aliased and namespaced @dereekb factory calls', () => {
  const recordVariants: readonly NotificationFixtureVariant[] = [
    ['an aliased notificationTemplateTypeInfoRecord', aliasTemplateInfoRecord],
    ['a namespaced notificationTemplateTypeInfoRecord', namespaceTemplateInfoRecord]
  ];
  const serviceVariants: readonly NotificationFixtureVariant[] = [
    ['an aliased appNotificationTemplateTypeInfoRecordService', aliasTemplateInfoRecordService],
    ['a namespaced appNotificationTemplateTypeInfoRecordService', namespaceTemplateInfoRecordService]
  ];
  const taskServiceVariants: readonly NotificationFixtureVariant[] = [
    ['an aliased notificationTaskService', aliasTaskService],
    ['a namespaced notificationTaskService', namespaceTaskService]
  ];
  const variants: readonly NotificationFixtureVariant[] = [
    ...recordVariants,
    ...serviceVariants,
    ...taskServiceVariants,
    [
      'all three factories namespaced together',
      (parts) => {
        namespaceTemplateInfoRecord(parts);
        namespaceTemplateInfoRecordService(parts);
        namespaceTaskService(parts);
      }
    ]
  ];

  it.each(variants)('passes with %s', (_label, modify) => {
    expect(runWith(modify).violations).toEqual([]);
    const extracted = extractAppNotifications(inspectionWith(modify));
    expect(extracted.templateInfoRecord?.symbolName).toBe('DEMO_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD');
    expect(extracted.templateInfoRecord?.resolvedInfoIdentifiers).toEqual(expect.arrayContaining(['TEST_NOTIFICATIONS_TEMPLATE_TYPE_INFO', 'GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE_INFO']));
    expect(extracted.templateInfoRecordWiring?.recordIdentifier).toBe('DEMO_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD');
    expect(extracted.taskServiceCalls).toHaveLength(1);
    expect(extracted.taskServiceCalls[0].spreadValidateIdentifiers).toEqual(['ALL_NOTIFICATION_TASK_TYPES']);
    expect(extracted.taskServiceCalls[0].resolvedHandlerBindings).toContain('exampleNotificationTaskHandler');
  });

  it.each(recordVariants)('reads the record built with %s', (_label, modify) => {
    const result = runWith((parts) => {
      modify(parts);
      replaceInFile({ files: parts.component, relPath: COMPONENT_MAIN_PATH, from: '([TEST_NOTIFICATIONS_TEMPLATE_TYPE_INFO, ...ALL_GUESTBOOK_NOTIFICATION_TEMPLATE_TYPE_INFOS])', to: '([...ALL_GUESTBOOK_NOTIFICATION_TEMPLATE_TYPE_INFOS])' });
    });
    const notInRecord = result.violations.filter((v) => v.code === 'NOTIF_TEMPLATE_INFO_NOT_IN_RECORD');
    expect(notInRecord.map((v) => v.message).join('\n')).toContain('TEST_NOTIFICATIONS_TEMPLATE_TYPE_INFO');
    expect(result.violations.map((v) => v.code)).not.toContain('NOTIF_TEMPLATE_RECORD_MISSING');
  });

  it.each(serviceVariants)('reads the wiring of %s', (_label, modify) => {
    const result = runWith((parts) => {
      modify(parts);
      replaceInFile({ files: parts.api, relPath: ACTION_MODULE_PATH, from: '(DEMO_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD)', to: '(OTHER_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD)' });
    });
    const notWired = result.violations.filter((v) => v.code === 'NOTIF_TEMPLATE_RECORD_NOT_WIRED');
    expect(notWired).toHaveLength(1);
    expect(notWired[0].message).toContain('API wires `appNotificationTemplateTypeInfoRecordService(OTHER_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD)`');
  });

  it.each(taskServiceVariants)('checks validate and handlers of %s', (_label, modify) => {
    const result = runWith((parts) => {
      modify(parts);
      replaceInFile({ files: parts.api, relPath: TASK_SERVICE_PATH, from: 'export function demoNotificationTaskServiceFactory', to: "const OTHER_NOTIFICATION_TASK_TYPE = 'O';\n\nexport function demoNotificationTaskServiceFactory" });
      replaceInFile({ files: parts.api, relPath: TASK_SERVICE_PATH, from: 'validate: [...ALL_NOTIFICATION_TASK_TYPES]', to: 'validate: [...ALL_NOTIFICATION_TASK_TYPES, OTHER_NOTIFICATION_TASK_TYPE]' });
    });
    const codes = result.violations.map((v) => v.code);
    const violation = result.violations.find((v) => v.code === 'NOTIF_TASK_IN_VALIDATE_WITHOUT_HANDLER');
    expect(violation?.message).toContain('OTHER_NOTIFICATION_TASK_TYPE');
    expect(codes).not.toContain('NOTIF_TASK_SERVICE_FACTORY_MISSING');
  });

  it('reads a record namespace past a same-named parameter in another function of the file', () => {
    const modify = (parts: NotificationFixtureParts) => {
      namespaceTemplateInfoRecord(parts);
      replaceInFile({ files: parts.component, relPath: COMPONENT_MAIN_PATH, from: '...ALL_GUESTBOOK_NOTIFICATION_TEMPLATE_TYPE_INFOS]);\n', to: '...ALL_GUESTBOOK_NOTIFICATION_TEMPLATE_TYPE_INFOS]);\n\nexport function demoShadowFirebaseModel(firebaseModel: unknown) {\n  return firebaseModel;\n}\n' });
    };
    expect(runWith(modify).violations).toEqual([]);
    expect(extractAppNotifications(inspectionWith(modify)).templateInfoRecord?.symbolName).toBe('DEMO_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD');
  });

  // Forms that stay unrecognized are pinned at the extraction level: the call is not extracted, so the
  // "missing" / "not wired" rules then report exactly as they do for any unrecognized call.
  const pins: readonly (readonly [string, (parts: NotificationFixtureParts) => void, (extracted: ReturnType<typeof extractAppNotifications>) => void])[] = [
    [
      'a task-service alias the file redeclares as a parameter',
      (parts) => {
        aliasTaskService(parts);
        replaceInFile({ files: parts.api, relPath: TASK_SERVICE_PATH, from: 'demoNotificationTaskServiceFactory(context)', to: 'demoNotificationTaskServiceFactory(context, createNotificationTaskService = context.createNotificationTaskService)' });
      },
      (extracted) => expect(extracted.taskServiceCalls).toEqual([])
    ],
    [
      'a task-service call through a namespace of a non-@dereekb module',
      ({ api }) => {
        replaceInFile({ files: api, relPath: TASK_SERVICE_PATH, from: ", notificationTaskService } from '@dereekb/firebase-server/model';", to: " } from '@dereekb/firebase-server/model';\nimport * as lib from 'some-app-lib';" });
        replaceInFile({ files: api, relPath: TASK_SERVICE_PATH, from: 'return notificationTaskService(', to: 'return lib.notificationTaskService(' });
      },
      (extracted) => expect(extracted.taskServiceCalls).toEqual([])
    ],
    [
      'a record-service alias the file redeclares as a parameter',
      (parts) => {
        aliasTemplateInfoRecordService(parts);
        replaceInFile({ files: parts.api, relPath: ACTION_MODULE_PATH, from: 'demoFirebaseServerActionsContextFactory = (context) => {', to: 'demoFirebaseServerActionsContextFactory = (context, recordService = context.recordService) => {' });
      },
      (extracted) => expect(extracted.templateInfoRecordWiring).toBeUndefined()
    ]
  ];

  it.each(pins)('does not resolve %s', (_label, modify, expectExtraction) => {
    expectExtraction(extractAppNotifications(inspectionWith(modify)));
  });
});

// MARK: values the handlers trace can't see through
const TASK_SERVICE_HANDLERS = 'const handlers: NotificationTaskServiceTaskHandlerConfig<any>[] = [exampleNotificationTaskHandler];';
const TASK_SERVICE_FACTORY_START = 'export function demoNotificationTaskServiceFactory';

interface OpaqueHandlerCase {
  /**
   * Declarations added above the task service factory.
   */
  readonly prelude?: string;
  /**
   * A local declared just before `handlers`.
   */
  readonly local?: string;
  /**
   * The element added to `handlers` after `exampleNotificationTaskHandler`.
   */
  readonly element: string;
}

function addHandlerElement(api: InspectedFile[], handlerCase: OpaqueHandlerCase): void {
  const { prelude, local, element } = handlerCase;
  if (prelude !== undefined) {
    replaceInFile({ files: api, relPath: TASK_SERVICE_PATH, from: TASK_SERVICE_FACTORY_START, to: `${prelude}\n\n${TASK_SERVICE_FACTORY_START}` });
  }
  const localLine = local === undefined ? '' : `${local}\n  `;
  replaceInFile({ files: api, relPath: TASK_SERVICE_PATH, from: TASK_SERVICE_HANDLERS, to: `${localLine}const handlers: NotificationTaskServiceTaskHandlerConfig<any>[] = [exampleNotificationTaskHandler, ${element}];` });
}

describe('validateAppNotifications — values the handlers trace cannot see through', () => {
  // `exampleNotificationTaskHandler` stays in `handlers`, so the rest of the fixture is clean.
  it.each<[string, OpaqueHandlerCase, string]>([
    ['a local built by a call through a property access', { local: 'const registryHandler = context.handlerRegistry.build(context);', element: 'registryHandler' }, 'context.handlerRegistry.build(context)'],
    ['a local holding a conditional', { local: 'const registryHandler = context.useV2 ? context.v2Handler : context.v1Handler;', element: 'registryHandler' }, 'context.useV2 ? context.v2Handler : context.v1Handler'],
    ['a factory returning a call of a call', { prelude: "function demoRegistryTaskHandler(context) {\n  return context.handlerRegistry.lookup('example')(context);\n}", local: 'const registryHandler = demoRegistryTaskHandler(context);', element: 'registryHandler' }, "context.handlerRegistry.lookup('example')(context)"],
    ['a spread factory returning an array of an opaque call', { prelude: 'function demoRegistryTaskHandlers(context) {\n  return [context.handlerRegistry.build(context)];\n}', element: '...demoRegistryTaskHandlers(context)' }, 'context.handlerRegistry.build(context)']
  ])('does not warn NOTIF_TASK_HANDLER_SPREAD_UNRESOLVED for %s', (_label, handlerCase, opaqueValue) => {
    const modify = ({ api }: NotificationFixtureParts) => addHandlerElement(api, handlerCase);
    const [call] = extractAppNotifications(inspectionWith(modify)).taskServiceCalls;
    expect(call.opaqueHandlerValues).toEqual([opaqueValue]);
    expect(call.unresolvedHandlerBindings).toEqual([]);
    expect(call.resolvedHandlerBindings).toEqual(['exampleNotificationTaskHandler']);
    expect(runWith(modify).violations).toEqual([]);
  });

  it('still warns for an unresolved identifier returned next to an opaque value', () => {
    const modify = ({ api }: NotificationFixtureParts) => addHandlerElement(api, { prelude: 'function demoRegistryTaskHandlers(context) {\n  return [context.handlerRegistry.build(context), mysteryHandler];\n}', element: '...demoRegistryTaskHandlers(context)' });
    const [call] = extractAppNotifications(inspectionWith(modify)).taskServiceCalls;
    expect(call.unresolvedHandlerBindings).toEqual(['mysteryHandler']);
    const warnings = runWith(modify).violations.filter((v) => v.code === 'NOTIF_TASK_HANDLER_SPREAD_UNRESOLVED');
    expect(warnings).toHaveLength(1);
    expect(warnings[0].message).toContain('`mysteryHandler`');
  });
});

// MARK: Task types validate lists through nested component aggregates
const COMPONENT_TASK_PATH = 'src/lib/model/notification/notification.task.ts';
const APP_TASK_AGGREGATE_ELEMENTS = '= [EXAMPLE_NOTIFICATION_TASK_TYPE]';
const OTHER_TASK_TYPE_DECLARATION = "const OTHER_NOTIFICATION_TASK_TYPE = 'O';";

interface TaskAggregateFileOptions {
  /**
   * `nested` gives `notification.nested.task.ts` declaring `ALL_NESTED_NOTIFICATION_TASK_TYPES`.
   */
  readonly stem: string;
  readonly elements: string;
  readonly declarations?: string;
}

// Pushes a component file declaring `ALL_<STEM>_NOTIFICATION_TASK_TYPES = [elements]` and returns the aggregate's name.
function pushTaskAggregateFile(parts: NotificationFixtureParts, options: TaskAggregateFileOptions): string {
  const { stem, elements, declarations = '' } = options;
  const aggregate = `ALL_${stem.toUpperCase()}_NOTIFICATION_TASK_TYPES`;
  parts.component.push({ relPath: `src/lib/model/notification/notification.${stem}.task.ts`, text: `import { type NotificationTaskType } from '@dereekb/firebase';\n${declarations}\nexport const ${aggregate}: NotificationTaskType[] = [${elements}];\n` });
  return aggregate;
}

// Appends `elements` to the app's ALL_NOTIFICATION_TASK_TYPES, which `validate` spreads.
function addToAppTaskAggregate(parts: NotificationFixtureParts, elements: string): void {
  replaceInFile({ files: parts.component, relPath: COMPONENT_TASK_PATH, from: APP_TASK_AGGREGATE_ELEMENTS, to: `= [EXAMPLE_NOTIFICATION_TASK_TYPE, ${elements}]` });
}

// Puts OTHER_NOTIFICATION_TASK_TYPE (not a declared NotificationTaskType, so only this rule can see it, like the
// task-rules case) `depth` aggregates below `validate`; depth 1 is ALL_NOTIFICATION_TASK_TYPES itself.
function placeOtherTaskType(parts: NotificationFixtureParts, depth: number): void {
  let element = 'OTHER_NOTIFICATION_TASK_TYPE';
  let declarations = OTHER_TASK_TYPE_DECLARATION;
  for (let level = depth; level > 1; level -= 1) {
    element = `...${pushTaskAggregateFile(parts, { stem: `level${level}`, elements: element, declarations })}`;
    declarations = '';
  }
  if (depth === 1) {
    replaceInFile({ files: parts.component, relPath: COMPONENT_TASK_PATH, from: '// MARK: All Tasks', to: `${OTHER_TASK_TYPE_DECLARATION}\n\n// MARK: All Tasks` });
  }
  addToAppTaskAggregate(parts, element);
}

// Declares NESTED_NOTIFICATION_TASK_TYPE ('N') in ALL_NESTED_NOTIFICATION_TASK_TYPES, spreads that into
// ALL_NOTIFICATION_TASK_TYPES, and with `withHandler` adds a typed handler config for it to `handlers`.
function nestDeclaredTaskType(parts: NotificationFixtureParts, withHandler: boolean): void {
  const aggregate = pushTaskAggregateFile(parts, { stem: 'nested', elements: 'NESTED_NOTIFICATION_TASK_TYPE', declarations: "export const NESTED_NOTIFICATION_TASK_TYPE: NotificationTaskType = 'N';" });
  addToAppTaskAggregate(parts, `...${aggregate}`);
  if (withHandler) {
    addHandlerElement(parts.api, { local: "const nestedNotificationTaskHandler: NotificationTaskServiceTaskHandlerConfig<any> = { type: NESTED_NOTIFICATION_TASK_TYPE, flow: [{ checkpoint: 'part_a', fn: async () => null }] };", element: 'nestedNotificationTaskHandler' });
  }
}

describe('validateAppNotifications — NOTIF_TASK_IN_VALIDATE_WITHOUT_HANDLER through nested component aggregates', () => {
  const CODE: ViolationCode = 'NOTIF_TASK_IN_VALIDATE_WITHOUT_HANDLER';
  const codesOf = (modify: (parts: NotificationFixtureParts) => void) => runWith(modify).violations.map((v) => v.code);
  const nestedIdentifiersOf = (modify: (parts: NotificationFixtureParts) => void) => extractAppNotifications(inspectionWith(modify)).taskServiceCalls[0].nestedValidateIdentifiers;

  it('passes when a handled task type sits in a component aggregate nested in ALL_NOTIFICATION_TASK_TYPES', () => {
    expect(runWith((p) => nestDeclaredTaskType(p, true)).violations).toEqual([]);
  });

  it('reports a nested component task type without a handler, like one listed directly', () => {
    expectCodes(
      codesOf((p) => nestDeclaredTaskType(p, false)),
      ['NOTIF_TASK_NOT_REGISTERED_IN_SERVICE', CODE]
    );
  });

  it.each([1, 2, 3])('reports a task type %i aggregate(s) below validate that no handler declares', (depth) => {
    const result = runWith((p) => placeOtherTaskType(p, depth));
    expect(result.violations.map((v) => v.code)).toEqual([CODE]);
    expect(result.violations[0]).toMatchObject({ severity: 'error', side: 'api', file: TASK_SERVICE_PATH });
    expect(result.violations[0].message).toContain('`OTHER_NOTIFICATION_TASK_TYPE`');
  });

  it('reports a name once when two nested aggregates reach it', () => {
    const modify = (p: NotificationFixtureParts) => {
      const shared = pushTaskAggregateFile(p, { stem: 'shared', elements: 'OTHER_NOTIFICATION_TASK_TYPE', declarations: OTHER_TASK_TYPE_DECLARATION });
      const left = pushTaskAggregateFile(p, { stem: 'left', elements: `...${shared}` });
      const right = pushTaskAggregateFile(p, { stem: 'right', elements: `...${shared}, OTHER_NOTIFICATION_TASK_TYPE` });
      addToAppTaskAggregate(p, `...${left}, ...${right}`);
    };
    expect(codesOf(modify)).toEqual([CODE]);
    expect(nestedIdentifiersOf(modify)).toEqual(['OTHER_NOTIFICATION_TASK_TYPE', 'OTHER_NOTIFICATION_TASK_TYPE', 'EXAMPLE_NOTIFICATION_TASK_TYPE']);
  });

  it('terminates on component aggregates that spread each other', () => {
    const modify = (p: NotificationFixtureParts) => {
      const cycle = pushTaskAggregateFile(p, { stem: 'cycle', elements: '...ALL_NOTIFICATION_TASK_TYPES, OTHER_NOTIFICATION_TASK_TYPE', declarations: OTHER_TASK_TYPE_DECLARATION });
      addToAppTaskAggregate(p, `...${cycle}`);
    };
    expect(codesOf(modify)).toEqual([CODE]);
    expect(nestedIdentifiersOf(modify)).toEqual(['OTHER_NOTIFICATION_TASK_TYPE', 'EXAMPLE_NOTIFICATION_TASK_TYPE']);
  });

  it('leaves a trusted upstream constant nested two levels deep to NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED', () => {
    const modify = (p: NotificationFixtureParts) => {
      const storageFile = pushTaskAggregateFile(p, { stem: 'storagefile', elements: 'STORAGE_FILE_PROCESSING_NOTIFICATION_TASK_TYPE', declarations: "import { STORAGE_FILE_PROCESSING_NOTIFICATION_TASK_TYPE } from '@dereekb/firebase';" });
      addToAppTaskAggregate(p, `...${storageFile}`);
    };
    expect(codesOf(modify)).toEqual(['NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED']);
  });

  it('ignores a component aggregate validate never reaches', () => {
    const result = runWith((p) => {
      pushTaskAggregateFile(p, { stem: 'unreached', elements: 'OTHER_NOTIFICATION_TASK_TYPE', declarations: OTHER_TASK_TYPE_DECLARATION });
    });
    expect(result.violations).toEqual([]);
  });

  it('records nestedValidateIdentifiers depth first, spreads before own elements', () => {
    expect(nestedIdentifiersOf(() => undefined)).toEqual(['EXAMPLE_NOTIFICATION_TASK_TYPE']);
    expect(nestedIdentifiersOf((p) => nestDeclaredTaskType(p, false))).toEqual(['NESTED_NOTIFICATION_TASK_TYPE', 'EXAMPLE_NOTIFICATION_TASK_TYPE']);
    const [direct] = extractAppNotifications(inspectionWith(({ api }) => replaceInFile({ files: api, relPath: TASK_SERVICE_PATH, from: 'validate: [...ALL_NOTIFICATION_TASK_TYPES]', to: 'validate: [EXAMPLE_NOTIFICATION_TASK_TYPE]' }))).taskServiceCalls;
    expect(direct.validateIdentifiers).toEqual(['EXAMPLE_NOTIFICATION_TASK_TYPE']);
    expect(direct.nestedValidateIdentifiers).toEqual([]);
  });
});

// MARK: Aliased and namespaced @dereekb type annotations
const COMPONENT_GUESTBOOK_PATH = 'src/lib/model/notification/notification.guestbook.ts';
const COMPONENT_OTHER_TASK_PATH = 'src/lib/model/notification/notification.task.other.ts';

/**
 * Rewrites the template constant and info annotations of a component file to the given type names.
 *
 * @param files - The component files.
 * @param relPath - The file to rewrite.
 * @param names - The `NotificationTemplateType` and `NotificationTemplateTypeInfo` replacements.
 * @param names.templateType - The `NotificationTemplateType` replacement.
 * @param names.templateTypeInfo - The `NotificationTemplateTypeInfo` replacement.
 */
function rewriteTemplateAnnotations(files: InspectedFile[], relPath: string, names: { readonly templateType: string; readonly templateTypeInfo: string }): void {
  replaceInFile({ files, relPath, from: '_TEMPLATE_TYPE: NotificationTemplateType =', to: `_TEMPLATE_TYPE: ${names.templateType} =` });
  replaceInFile({ files, relPath, from: '_TEMPLATE_TYPE_INFO: NotificationTemplateTypeInfo =', to: `_TEMPLATE_TYPE_INFO: ${names.templateTypeInfo} =` });
}

/**
 * Rewrites both `NotificationTaskServiceTaskHandlerConfig` annotations of the task service file to the given type name.
 *
 * @param api - The API files.
 * @param name - The `NotificationTaskServiceTaskHandlerConfig` replacement.
 */
function rewriteHandlerConfigAnnotations(api: InspectedFile[], name: string): void {
  replaceInFile({ files: api, relPath: TASK_SERVICE_PATH, from: 'exampleNotificationTaskHandler: NotificationTaskServiceTaskHandlerConfig<', to: `exampleNotificationTaskHandler: ${name}<` });
  replaceInFile({ files: api, relPath: TASK_SERVICE_PATH, from: 'handlers: NotificationTaskServiceTaskHandlerConfig<any>[]', to: `handlers: ${name}<any>[]` });
}

function aliasTemplateAnnotations({ component }: NotificationFixtureParts): void {
  const names = { templateType: 'TemplateType', templateTypeInfo: 'TemplateTypeInfo' };
  for (const relPath of [COMPONENT_MAIN_PATH, COMPONENT_GUESTBOOK_PATH]) {
    replaceInFile({ files: component, relPath, from: 'type NotificationTemplateType, type NotificationTemplateTypeInfo }', to: 'type NotificationTemplateType as TemplateType, type NotificationTemplateTypeInfo as TemplateTypeInfo }' });
    rewriteTemplateAnnotations(component, relPath, names);
  }
  replaceInFile({ files: component, relPath: COMPONENT_GUESTBOOK_PATH, from: ': NotificationTemplateTypeInfo[] =', to: ': TemplateTypeInfo[] =' });
}

function namespaceTemplateAnnotations({ component }: NotificationFixtureParts): void {
  const names = { templateType: 'firebaseModel.NotificationTemplateType', templateTypeInfo: 'firebaseModel.NotificationTemplateTypeInfo' };
  replaceInFile({ files: component, relPath: COMPONENT_MAIN_PATH, from: 'import { notificationTemplateTypeInfoRecord, type NotificationTemplateType, type NotificationTemplateTypeInfo }', to: "import type * as firebaseModel from '@dereekb/firebase';\nimport { notificationTemplateTypeInfoRecord }" });
  replaceInFile({ files: component, relPath: COMPONENT_GUESTBOOK_PATH, from: 'import { type NotificationTemplateType, type NotificationTemplateTypeInfo }', to: 'import type * as firebaseModel' });
  rewriteTemplateAnnotations(component, COMPONENT_MAIN_PATH, names);
  rewriteTemplateAnnotations(component, COMPONENT_GUESTBOOK_PATH, names);
  replaceInFile({ files: component, relPath: COMPONENT_GUESTBOOK_PATH, from: ': NotificationTemplateTypeInfo[] =', to: ': firebaseModel.NotificationTemplateTypeInfo[] =' });
}

function aliasTaskAnnotations({ component }: NotificationFixtureParts): void {
  replaceInFile({ files: component, relPath: COMPONENT_TASK_PATH, from: 'import { type NotificationTaskType }', to: 'import { type NotificationTaskType as TaskType }' });
  replaceInFile({ files: component, relPath: COMPONENT_TASK_PATH, from: ': NotificationTaskType =', to: ': TaskType =' });
  replaceInFile({ files: component, relPath: COMPONENT_TASK_PATH, from: ': NotificationTaskType[] =', to: ': TaskType[] =' });
}

function namespaceTaskAnnotations({ component }: NotificationFixtureParts): void {
  replaceInFile({ files: component, relPath: COMPONENT_TASK_PATH, from: 'import { type NotificationTaskType }', to: 'import type * as firebaseModel' });
  replaceInFile({ files: component, relPath: COMPONENT_TASK_PATH, from: ': NotificationTaskType =', to: ': firebaseModel.NotificationTaskType =' });
  replaceInFile({ files: component, relPath: COMPONENT_TASK_PATH, from: ': NotificationTaskType[] =', to: ': firebaseModel.NotificationTaskType[] =' });
}

function aliasHandlerConfigAnnotations({ api }: NotificationFixtureParts): void {
  replaceInFile({ files: api, relPath: TASK_SERVICE_PATH, from: 'type NotificationTaskServiceTaskHandlerConfig, notificationTaskService }', to: 'type NotificationTaskServiceTaskHandlerConfig as HandlerConfig, notificationTaskService }' });
  rewriteHandlerConfigAnnotations(api, 'HandlerConfig');
}

function namespaceHandlerConfigAnnotations({ api }: NotificationFixtureParts): void {
  replaceInFile({
    files: api,
    relPath: TASK_SERVICE_PATH,
    from: 'import { type NotificationTaskService, type NotificationTaskServiceTaskHandlerConfig, notificationTaskService }',
    to: "import type * as serverModel from '@dereekb/firebase-server/model';\nimport { type NotificationTaskService, notificationTaskService }"
  });
  rewriteHandlerConfigAnnotations(api, 'serverModel.NotificationTaskServiceTaskHandlerConfig');
}

describe('validateAppNotifications — aliased and namespaced @dereekb type annotations', () => {
  const variants: readonly NotificationFixtureVariant[] = [
    ['aliased template annotations', aliasTemplateAnnotations],
    ['namespaced template annotations', namespaceTemplateAnnotations],
    ['aliased task-type annotations', aliasTaskAnnotations],
    ['namespaced task-type annotations', namespaceTaskAnnotations],
    ['an aliased handler config annotation', aliasHandlerConfigAnnotations],
    ['a namespaced handler config annotation', namespaceHandlerConfigAnnotations],
    ['a readonly template info aggregate', ({ component }) => replaceInFile({ files: component, relPath: COMPONENT_GUESTBOOK_PATH, from: ': NotificationTemplateTypeInfo[] =', to: ': readonly NotificationTemplateTypeInfo[] =' })],
    ['an Array<> template info aggregate', ({ component }) => replaceInFile({ files: component, relPath: COMPONENT_GUESTBOOK_PATH, from: ': NotificationTemplateTypeInfo[] =', to: ': Array<NotificationTemplateTypeInfo> =' })],
    [
      'every annotation aliased or namespaced',
      (parts) => {
        aliasTemplateAnnotations(parts);
        namespaceTaskAnnotations(parts);
        aliasHandlerConfigAnnotations(parts);
      }
    ]
  ];

  it('reads a handler-config alias past a same-named type parameter in another function', () => {
    const modify = (parts: NotificationFixtureParts) => {
      aliasHandlerConfigAnnotations(parts);
      replaceInFile({ files: parts.api, relPath: TASK_SERVICE_PATH, from: 'export function demoNotificationTaskServiceFactory', to: 'export function identityOf<HandlerConfig>(x: HandlerConfig): HandlerConfig {\n  return x;\n}\n\nexport function demoNotificationTaskServiceFactory' });
    };
    expect(runWith(modify).violations).toEqual([]);
    expect(extractAppNotifications(inspectionWith(modify)).taskHandlerEntries.map((x) => x.bindingName)).toEqual(['exampleNotificationTaskHandler']);
  });

  it.each(variants)('passes with %s', (_label, modify) => {
    expect(runWith(modify).violations).toEqual([]);
    const extracted = extractAppNotifications(inspectionWith(modify));
    expect(extracted.templateTypeConstants.map((x) => x.symbolName)).toEqual(['TEST_NOTIFICATIONS_TEMPLATE_TYPE', 'GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE']);
    expect(extracted.templateTypeInfos.map((x) => x.symbolName)).toEqual(['TEST_NOTIFICATIONS_TEMPLATE_TYPE_INFO', 'GUESTBOOK_ENTRY_CREATED_NOTIFICATION_TEMPLATE_TYPE_INFO']);
    expect(extracted.templateInfoAggregates.map((x) => x.symbolName)).toEqual(['ALL_GUESTBOOK_NOTIFICATION_TEMPLATE_TYPE_INFOS']);
    expect(extracted.taskTypeConstants.map((x) => x.symbolName)).toEqual(['EXAMPLE_NOTIFICATION_TASK_TYPE']);
    expect(extracted.taskHandlerEntries.map((x) => [x.bindingName, x.dataTypeArgument, x.checkpointTypeArgument])).toEqual([['exampleNotificationTaskHandler', 'ExampleNotificationTaskData', 'ExampleNotificationTaskCheckpoint']]);
    expect(extracted.taskServiceCalls[0].resolvedHandlerBindings).toEqual(['exampleNotificationTaskHandler']);
    expect(extracted.taskServiceCalls[0].unresolvedHandlerBindings).toEqual([]);
  });

  it.each([
    ['through a namespace', 'firebaseModel.NotificationTaskType[]'],
    ['as readonly', 'readonly NotificationTaskType[]']
  ])('reads a task-type aggregate typed %s under a name outside the ALL_* convention', (_label, annotation) => {
    const modify = ({ component, api }: NotificationFixtureParts) => {
      replaceInFile({ files: component, relPath: COMPONENT_TASK_PATH, from: "import { type NotificationTaskType } from '@dereekb/firebase';", to: "import { type NotificationTaskType } from '@dereekb/firebase';\nimport type * as firebaseModel from '@dereekb/firebase';" });
      replaceInFile({ files: component, relPath: COMPONENT_TASK_PATH, from: 'export const ALL_NOTIFICATION_TASK_TYPES: NotificationTaskType[] =', to: `export const DEMO_TASK_TYPES: ${annotation} =` });
      replaceInFile({ files: api, relPath: TASK_SERVICE_PATH, from: 'import { ALL_NOTIFICATION_TASK_TYPES,', to: 'import { DEMO_TASK_TYPES,' });
      replaceInFile({ files: api, relPath: TASK_SERVICE_PATH, from: '[...ALL_NOTIFICATION_TASK_TYPES]', to: '[...DEMO_TASK_TYPES]' });
    };
    expect(runWith(modify).violations).toEqual([]);
    expect(extractAppNotifications(inspectionWith(modify)).taskAllTypesAggregates.map((x) => x.symbolName)).toEqual(['DEMO_TASK_TYPES']);
  });

  it('reads a second task type typed through an alias in its own file', () => {
    const modify = ({ component, api }: NotificationFixtureParts) => {
      component.push({ relPath: COMPONENT_OTHER_TASK_PATH, text: "import { type NotificationTaskType as TaskType } from '@dereekb/firebase';\n\nexport const OTHER_NOTIFICATION_TASK_TYPE: TaskType = 'O';\n" });
      replaceInFile({ files: component, relPath: COMPONENT_TASK_PATH, from: "import { type NotificationTaskType } from '@dereekb/firebase';", to: "import { type NotificationTaskType } from '@dereekb/firebase';\nimport { OTHER_NOTIFICATION_TASK_TYPE } from './notification.task.other';" });
      replaceInFile({ files: component, relPath: COMPONENT_TASK_PATH, from: APP_TASK_AGGREGATE_ELEMENTS, to: '= [EXAMPLE_NOTIFICATION_TASK_TYPE, OTHER_NOTIFICATION_TASK_TYPE]' });
      replaceInFile({ files: api, relPath: TASK_SERVICE_PATH, from: 'EXAMPLE_NOTIFICATION_TASK_TYPE, ', to: 'EXAMPLE_NOTIFICATION_TASK_TYPE, OTHER_NOTIFICATION_TASK_TYPE, ' });
      replaceInFile({ files: api, relPath: TASK_SERVICE_PATH, from: '  const handlers:', to: '  const otherNotificationTaskHandler: NotificationTaskServiceTaskHandlerConfig<ExampleNotificationTaskData> = { type: OTHER_NOTIFICATION_TASK_TYPE, flow: [{ fn: async () => null }] };\n  const handlers:' });
      replaceInFile({ files: api, relPath: TASK_SERVICE_PATH, from: '= [exampleNotificationTaskHandler];', to: '= [exampleNotificationTaskHandler, otherNotificationTaskHandler];' });
    };
    expect(runWith(modify).violations).toEqual([]);
    expect(extractAppNotifications(inspectionWith(modify)).taskTypeConstants.map((x) => x.symbolName)).toEqual(['EXAMPLE_NOTIFICATION_TASK_TYPE', 'OTHER_NOTIFICATION_TASK_TYPE']);
  });

  it('checks the template infos against constants typed through an alias', () => {
    const result = runWith((parts) => {
      aliasTemplateAnnotations(parts);
      replaceInFile({ files: parts.component, relPath: COMPONENT_MAIN_PATH, from: '  type: TEST_NOTIFICATIONS_TEMPLATE_TYPE,', to: '  type: PHANTOM_TEMPLATE_TYPE,' });
    });
    const codes = result.violations.map((v) => v.code);
    expect(result.violations.find((v) => v.code === 'NOTIF_TEMPLATE_INFO_TYPE_MISMATCH')?.message).toContain('PHANTOM_TEMPLATE_TYPE');
    expect(result.violations.find((v) => v.code === 'NOTIF_TEMPLATE_INFO_MISSING')?.message).toContain('TEST_NOTIFICATIONS_TEMPLATE_TYPE');
    expect(codes).not.toContain('NOTIF_TEMPLATE_SPREAD_UNRESOLVED');
  });

  it('checks the handlers of task types typed through an alias', () => {
    const result = runWith((parts) => {
      aliasTaskAnnotations(parts);
      replaceInFile({ files: parts.api, relPath: TASK_SERVICE_PATH, from: '= [exampleNotificationTaskHandler];', to: '= [];' });
    });
    expectCodes(
      result.violations.map((v) => v.code),
      ['NOTIF_TASK_HANDLER_NAME_MISMATCH']
    );
  });

  it('checks validate against handler configs typed through an alias', () => {
    const result = runWith((parts) => {
      aliasHandlerConfigAnnotations(parts);
      replaceInFile({ files: parts.api, relPath: TASK_SERVICE_PATH, from: 'export function demoNotificationTaskServiceFactory', to: `${OTHER_TASK_TYPE_DECLARATION}\n\nexport function demoNotificationTaskServiceFactory` });
      replaceInFile({ files: parts.api, relPath: TASK_SERVICE_PATH, from: 'validate: [...ALL_NOTIFICATION_TASK_TYPES]', to: 'validate: [...ALL_NOTIFICATION_TASK_TYPES, OTHER_NOTIFICATION_TASK_TYPE]' });
    });
    const codes = result.violations.map((v) => v.code);
    const withoutHandler = result.violations.filter((v) => v.code === 'NOTIF_TASK_IN_VALIDATE_WITHOUT_HANDLER');
    expect(withoutHandler).toHaveLength(1);
    expect(withoutHandler[0].message).toContain('OTHER_NOTIFICATION_TASK_TYPE');
    expect(codes).not.toContain('NOTIF_TASK_NOT_REGISTERED_IN_SERVICE');
    expect(codes).not.toContain('NOTIF_TASK_HANDLER_SPREAD_UNRESOLVED');
  });

  // The rules then report these declarations as they do for any unrecognized annotation.
  const pins: readonly (readonly [string, (parts: NotificationFixtureParts) => void, (extracted: ReturnType<typeof extractAppNotifications>) => void])[] = [
    [
      'a handler-config alias from a module outside @dereekb/*',
      ({ api }) => {
        replaceInFile({
          files: api,
          relPath: TASK_SERVICE_PATH,
          from: 'import { type NotificationTaskService, type NotificationTaskServiceTaskHandlerConfig, notificationTaskService }',
          to: "import { type NotificationTaskServiceTaskHandlerConfig as HandlerConfig } from 'some-app-lib';\nimport { type NotificationTaskService, notificationTaskService }"
        });
        rewriteHandlerConfigAnnotations(api, 'HandlerConfig');
      },
      (extracted) => {
        expect(extracted.taskHandlerEntries).toEqual([]);
        expect(extracted.taskServiceCalls[0].unresolvedHandlerBindings).toContain('exampleNotificationTaskHandler');
      }
    ],
    [
      'task types through a namespace of a module outside @dereekb/*',
      ({ component }) => {
        replaceInFile({ files: component, relPath: COMPONENT_TASK_PATH, from: "import { type NotificationTaskType } from '@dereekb/firebase';", to: "import type * as lib from 'some-app-lib';" });
        replaceInFile({ files: component, relPath: COMPONENT_TASK_PATH, from: ': NotificationTaskType =', to: ': lib.NotificationTaskType =' });
        replaceInFile({ files: component, relPath: COMPONENT_TASK_PATH, from: ': NotificationTaskType[] =', to: ': lib.NotificationTaskType[] =' });
      },
      (extracted) => expect(extracted.taskTypeConstants).toEqual([])
    ]
  ];

  it.each(pins)('does not resolve %s', (_label, modify, check) => {
    check(extractAppNotifications(inspectionWith(modify)));
  });
});

// MARK: handlers that reach a local or function twice
const EXAMPLE_HANDLERS_PATH = 'src/app/common/model/notification/handlers/task.handler.example.ts';

describe('validateAppNotifications — a handler reached twice', () => {
  it('resolves a typed handler config two factories share', () => {
    const HANDLER_FILE = `import { type NotificationTaskServiceTaskHandlerConfig } from '@dereekb/firebase-server/model';
import { EXAMPLE_NOTIFICATION_TASK_TYPE, type ExampleNotificationTaskData, type ExampleNotificationTaskCheckpoint } from 'demo-firebase';

const exampleHandler: NotificationTaskServiceTaskHandlerConfig<ExampleNotificationTaskData, ExampleNotificationTaskCheckpoint> = {
  type: EXAMPLE_NOTIFICATION_TASK_TYPE,
  flow: [{ checkpoint: 'part_a', fn: async () => null }]
};

export function demoExampleTaskHandlers(context): NotificationTaskServiceTaskHandlerConfig<any>[] {
  return [exampleHandler];
}

export function demoMoreExampleTaskHandlers(context): NotificationTaskServiceTaskHandlerConfig<any>[] {
  return [exampleHandler];
}
`;
    const modify = ({ api }: NotificationFixtureParts) => {
      swapServiceHandlerForFactorySpread(api, { factoryImport: "import { demoExampleTaskHandlers, demoMoreExampleTaskHandlers } from './handlers/task.handler.example';", factoryCall: 'demoExampleTaskHandlers(context)', spreadVar: 'exampleHandlers' });
      replaceInFile({ files: api, relPath: TASK_SERVICE_PATH, from: '[...exampleHandlers]', to: '[...exampleHandlers, ...demoMoreExampleTaskHandlers(context)]' });
      api.push({ relPath: EXAMPLE_HANDLERS_PATH, text: HANDLER_FILE });
    };
    const [call] = extractAppNotifications(inspectionWith(modify)).taskServiceCalls;
    expect(call.resolvedHandlerBindings).toEqual(['exampleHandler']);
    expect(call.unresolvedHandlerBindings).toEqual([]);
    expect(runWith(modify).violations).toEqual([]);
  });

  it('warns once per name for a wrapper it cannot follow, reached twice', () => {
    const modify = ({ api }: NotificationFixtureParts) =>
      addHandlerElement(api, {
        prelude: 'function demoMysteryTaskHandler(context) {\n  return mysteryFactory(context);\n}',
        local: 'const mysteryHandler = demoMysteryTaskHandler(context);\n  const mysteryHandlerAgain = demoMysteryTaskHandler(context);',
        element: 'mysteryHandler, mysteryHandlerAgain'
      });
    const names = ['mysteryFactory', 'demoMysteryTaskHandler', 'mysteryHandler', 'mysteryHandlerAgain'];
    const [call] = extractAppNotifications(inspectionWith(modify)).taskServiceCalls;
    expect(call.unresolvedHandlerBindings).toEqual(names);
    const warnings = runWith(modify).violations.filter((v) => v.code === 'NOTIF_TASK_HANDLER_SPREAD_UNRESOLVED');
    expect(warnings.map((v) => v.message.match(/Identifier `([^`]+)`/)?.[1])).toEqual(names);
  });
});
