import { describe, expect, it } from 'vitest';
import { listAppNotifications } from '../notification-m-list-app/index.js';
import { validateAppNotifications, type AppNotificationsInspection, type InspectedFile } from '../notification-m-validate-app/index.js';
import { buildNotificationManifest, NOTIFICATION_MANIFEST_VERSION, type NotificationManifest } from './index.js';

// MARK: Fixture — demo-shaped component + API, with one template that declares its delivery methods
const COMPONENT_MAIN = `import { NotificationDeliveryMethod, notificationTemplateTypeInfoRecord, type NotificationTemplateType, type NotificationTemplateTypeInfo } from '@dereekb/firebase';

export const TEST_NOTIFICATION_TEMPLATE_TYPE: NotificationTemplateType = 'TEST';

export const TEST_NOTIFICATION_TEMPLATE_TYPE_INFO: NotificationTemplateTypeInfo = {
  type: TEST_NOTIFICATION_TEMPLATE_TYPE,
  name: 'Test',
  description: 'A test notification.',
  notificationModelIdentity: testIdentity
};

export const INVITE_NOTIFICATION_TEMPLATE_TYPE: NotificationTemplateType = 'INV';

export const INVITE_NOTIFICATION_TEMPLATE_TYPE_INFO: NotificationTemplateTypeInfo = {
  type: INVITE_NOTIFICATION_TEMPLATE_TYPE,
  name: 'Invite',
  description: 'An invite notification.',
  notificationModelIdentity: testIdentity,
  targetModelIdentity: calendarIdentity,
  userConfigurableDeliveryMethods: [NotificationDeliveryMethod.NOTIFICATION_SUMMARY],
  forcedDeliveryMethods: [NotificationDeliveryMethod.EMAIL]
};

export const DEMO_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD = notificationTemplateTypeInfoRecord([TEST_NOTIFICATION_TEMPLATE_TYPE_INFO, INVITE_NOTIFICATION_TEMPLATE_TYPE_INFO]);
`;

const COMPONENT_TASK = `import { type NotificationTaskType } from '@dereekb/firebase';
export const EXAMPLE_NOTIFICATION_TASK_TYPE: NotificationTaskType = 'E';
export type ExampleNotificationTaskCheckpoint = 'part_a' | 'part_b';
export interface ExampleNotificationTaskData { readonly uid: string; }
export const ALL_NOTIFICATION_TASK_TYPES: NotificationTaskType[] = [EXAMPLE_NOTIFICATION_TASK_TYPE];
`;

const API_ACTION_MODULE = `import { appNotificationTemplateTypeInfoRecordService } from '@dereekb/firebase';
import { DEMO_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD } from 'demo-firebase';
export const demoFirebaseServerActionsContextFactory = () => ({
  appNotificationTemplateTypeInfoRecordService: appNotificationTemplateTypeInfoRecordService(DEMO_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD)
});
`;

const API_FACTORY = `import { TEST_NOTIFICATION_TEMPLATE_TYPE, INVITE_NOTIFICATION_TEMPLATE_TYPE } from 'demo-firebase';
export function demoTestNotificationFactory(context) {
  return {
    type: TEST_NOTIFICATION_TEMPLATE_TYPE,
    factory: async () => {
      const textContent = { subject: 'Test' };
      return async () => ({ inputContext: {}, flatContent: {}, textContent });
    }
  };
}
export function demoInviteNotificationFactory(context) {
  return {
    type: INVITE_NOTIFICATION_TEMPLATE_TYPE,
    factory: async () => async () => ({ inputContext: {}, flatContent: {}, emailContent: { calendarAttachmentFactory: null } })
  };
}
export const demoNotificationTemplateServiceConfigsArrayFactory = (context) => {
  return [demoTestNotificationFactory(context), demoInviteNotificationFactory(context)];
};
`;

const API_TASK_SERVICE = `import { type NotificationTaskService, type NotificationTaskServiceTaskHandlerConfig, notificationTaskService } from '@dereekb/firebase-server/model';
import { ALL_NOTIFICATION_TASK_TYPES, EXAMPLE_NOTIFICATION_TASK_TYPE, type ExampleNotificationTaskData, type ExampleNotificationTaskCheckpoint } from 'demo-firebase';
export function demoNotificationTaskServiceFactory(context): NotificationTaskService {
  const exampleNotificationTaskHandler: NotificationTaskServiceTaskHandlerConfig<ExampleNotificationTaskData, ExampleNotificationTaskCheckpoint> = {
    type: EXAMPLE_NOTIFICATION_TASK_TYPE,
    flow: [{ checkpoint: 'part_a', fn: async () => null }, { checkpoint: 'part_b', fn: async () => null }]
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

const COMPONENT_TASKBOT = `import { type, type Type } from 'arktype';
import { type NotificationTaskBotScriptConfig, type NotificationTaskBotScriptGroup, type NotificationTaskBotScriptType, notificationTaskBotScriptConfigRecord } from '@dereekb/firebase';
export const DEMO_PING_NOTIFICATION_TASK_BOT_GROUP: NotificationTaskBotScriptGroup = { key: 'ping_reminders', name: 'Ping Reminders' };
export const DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_TYPE: NotificationTaskBotScriptType = 'demo_ping';
export const DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE: NotificationTaskBotScriptType = 'demo_ping_required';
export const demoPingEntryDataType = type({ 'c?': 'number' }) as Type<{ c?: number }>;
export const DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG: NotificationTaskBotScriptConfig = { scriptType: DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_TYPE, name: 'Demo Ping', description: 'Pings.', group: DEMO_PING_NOTIFICATION_TASK_BOT_GROUP, allowOwnerOptOut: true, dataType: demoPingEntryDataType };
export const DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG: NotificationTaskBotScriptConfig = { scriptType: DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE, name: 'Demo Required Ping', description: 'Pings, required.', group: DEMO_PING_NOTIFICATION_TASK_BOT_GROUP };
export const DEMO_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS: NotificationTaskBotScriptConfig[] = [DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG, DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG];
export const DEMO_FIREBASE_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD = notificationTaskBotScriptConfigRecord(DEMO_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS);
`;

const API_TASKBOT_HANDLER = `import { type NotificationTaskBotScriptType } from '@dereekb/firebase';
import { type NotificationTaskBotScriptProcessorConfig, notificationTaskBotRunNotificationTaskHandler } from '@dereekb/firebase-server/model';
import { DEMO_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS, DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_TYPE, DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE } from 'demo-firebase';
export function demoPingNotificationTaskBotScriptProcessor(context, target: NotificationTaskBotScriptType = DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_TYPE): NotificationTaskBotScriptProcessorConfig {
  return { target, flow: [], cleanup: () => ({}) };
}
export function demoNotificationTaskBotRunNotificationTaskHandler(context) {
  return notificationTaskBotRunNotificationTaskHandler({
    processors: [demoPingNotificationTaskBotScriptProcessor(context), demoPingNotificationTaskBotScriptProcessor(context, DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE)],
    validate: DEMO_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS.map((x) => x.scriptType),
    notificationTaskBotContext: context
  });
}
`;

const API_SCHEDULE = `export const notificationHourlyUpdateSchedule = onScheduleWithNestApplication(async (request) => {
  await request.nest.notificationActions.repairAllNotificationTaskBots();
});
`;

const COMPONENT_DIR = 'components/demo-firebase';
const API_DIR = 'apps/demo-api';
const NOW = new Date('2026-01-02T03:04:05.000Z');
const FACTORY_PATH = 'src/app/common/model/notification/notification.factory.ts';
const COMPONENT_MAIN_PATH = 'src/lib/model/notification/notification.ts';
const ACTION_MODULE_PATH = 'src/app/common/firebase/action.module.ts';
const TASK_SERVICE_PATH = 'src/app/common/model/notification/notification.task.service.ts';
const TASKBOT_HANDLER_PATH = 'src/app/common/model/notification/handlers/taskbot/task.handler.taskbot.ts';
const EMPTY_TASK_BOT_SECTION = { inUse: false, registries: [], registryWirings: [], handlers: [], taskTypesInTaskServiceValidate: false, repairCalls: [], scripts: [] };

function happyInspection(): AppNotificationsInspection {
  const component: InspectedFile[] = [
    { relPath: COMPONENT_MAIN_PATH, text: COMPONENT_MAIN },
    { relPath: 'src/lib/model/notification/notification.task.ts', text: COMPONENT_TASK }
  ];
  const api: InspectedFile[] = [
    { relPath: ACTION_MODULE_PATH, text: API_ACTION_MODULE },
    { relPath: FACTORY_PATH, text: API_FACTORY },
    { relPath: TASK_SERVICE_PATH, text: API_TASK_SERVICE },
    { relPath: 'src/app/common/model/notification/notification.module.ts', text: API_NOTIFICATION_MODULE }
  ];
  const result: AppNotificationsInspection = {
    component: { rootDir: COMPONENT_DIR, folder: 'src/lib/model/notification', status: 'ok', files: component },
    api: { rootDir: API_DIR, folder: 'src/app/common/model/notification,src/app/common/firebase', status: 'ok', files: api }
  };
  return result;
}

function patchInspection(inspection: AppNotificationsInspection, relPath: string, patch: (text: string) => string): AppNotificationsInspection {
  const patchFiles = (files: readonly InspectedFile[]) => files.map((f) => (f.relPath === relPath ? { ...f, text: patch(f.text) } : f));
  const result: AppNotificationsInspection = {
    component: { ...inspection.component, files: patchFiles(inspection.component.files) },
    api: { ...inspection.api, files: patchFiles(inspection.api.files) }
  };
  return result;
}

/**
 * {@link happyInspection} plus a demo-shaped NotificationTaskBot wiring: a script registry wired in the action module,
 * an NTBR handler in the task service's `handlers` (and the NotificationTaskBot task types in its `validate`), and the
 * repair sweep.
 *
 * @returns The inspection.
 */
function taskBotInspection(): AppNotificationsInspection {
  let inspection = happyInspection();
  inspection = patchInspection(inspection, ACTION_MODULE_PATH, (text) =>
    text
      .replace("import { appNotificationTemplateTypeInfoRecordService } from '@dereekb/firebase';", "import { appNotificationTaskBotScriptConfigService, appNotificationTemplateTypeInfoRecordService } from '@dereekb/firebase';")
      .replace("import { DEMO_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD } from 'demo-firebase';", "import { DEMO_FIREBASE_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD, DEMO_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD } from 'demo-firebase';")
      .replace(
        'appNotificationTemplateTypeInfoRecordService(DEMO_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD)',
        'appNotificationTemplateTypeInfoRecordService(DEMO_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD),\n  appNotificationTaskBotScriptConfigService: appNotificationTaskBotScriptConfigService(DEMO_FIREBASE_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD)'
      )
  );
  inspection = patchInspection(inspection, TASK_SERVICE_PATH, (text) =>
    text
      .replace('import { type NotificationTaskService,', "import { ALL_NOTIFICATION_TASK_BOT_NOTIFICATION_TASK_TYPES } from '@dereekb/firebase';\nimport { demoNotificationTaskBotRunNotificationTaskHandler } from './handlers/taskbot/task.handler.taskbot';\nimport { type NotificationTaskService,")
      .replace('[exampleNotificationTaskHandler]', '[exampleNotificationTaskHandler, demoNotificationTaskBotRunNotificationTaskHandler(context)]')
      .replace('validate: [...ALL_NOTIFICATION_TASK_TYPES]', 'validate: [...ALL_NOTIFICATION_TASK_TYPES, ...ALL_NOTIFICATION_TASK_BOT_NOTIFICATION_TASK_TYPES]')
  );
  const result: AppNotificationsInspection = {
    component: { ...inspection.component, files: [...inspection.component.files, { relPath: 'src/lib/model/notification/notification.taskbot.ts', text: COMPONENT_TASKBOT }] },
    api: {
      ...inspection.api,
      files: [...inspection.api.files, { relPath: TASKBOT_HANDLER_PATH, text: API_TASKBOT_HANDLER }, { relPath: 'src/app/function/notification/notification.schedule.ts', text: API_SCHEDULE }]
    }
  };
  return result;
}

function buildManifest(inspection: AppNotificationsInspection): NotificationManifest {
  return buildNotificationManifest({ app: { name: 'demo-api' }, inspection, componentDir: COMPONENT_DIR, apiDir: API_DIR }, NOW).manifest;
}

describe('buildNotificationManifest', () => {
  it('builds a clean manifest for a fully wired fixture', () => {
    const manifest = buildManifest(happyInspection());
    expect(manifest.version).toBe(NOTIFICATION_MANIFEST_VERSION);
    expect(manifest.version).toBe(1);
    expect(manifest.generatedAt).toBe('2026-01-02T03:04:05.000Z');
    expect(manifest.app).toEqual({ name: 'demo-api' });
    expect(manifest.componentDir).toBe(COMPONENT_DIR);
    expect(manifest.apiDir).toBe(API_DIR);
    expect(manifest.errorCount, JSON.stringify(manifest.findings, null, 2)).toBe(0);
    expect(manifest.warningCount).toBe(0);
    expect(manifest.findings).toEqual([]);
    expect(manifest.templates.map((t) => t.typeCode)).toEqual(['TEST', 'INV']);
    expect(manifest.templates[0].notificationModelIdentity).toBe('testIdentity');
    expect(manifest.tasks.map((t) => t.typeCode)).toEqual(['E']);
    expect(manifest.taskBot).toEqual(EMPTY_TASK_BOT_SECTION);
  });

  it('includes the NotificationTaskBot section', () => {
    const manifest = buildManifest(taskBotInspection());
    expect(manifest.errorCount, JSON.stringify(manifest.findings, null, 2)).toBe(0);
    expect(manifest.warningCount, JSON.stringify(manifest.findings, null, 2)).toBe(0);
    const { taskBot } = manifest;
    expect(taskBot.inUse).toBe(true);
    expect(taskBot.scripts.map((s) => s.scriptType)).toEqual(['demo_ping', 'demo_ping_required']);
    expect(taskBot.scripts.map((s) => s.dataTypeSource)).toEqual(['declared', 'none']);
    expect(taskBot.registries[0].wired).toBe(true);
    expect(taskBot.handlers[0].reachable).toBe(true);
    expect(taskBot.repairCalls).toHaveLength(1);
  });

  it('writes the keys in the documented order', () => {
    const manifest = buildManifest(happyInspection());
    expect(Object.keys(manifest)).toEqual(['version', 'generatedAt', 'app', 'componentDir', 'apiDir', 'aggregatorRecordName', 'aggregatorWiredInApi', 'templateConfigsArrayFactoryName', 'templateConfigsArrayWiredInApi', 'taskServiceCallCount', 'templates', 'tasks', 'taskBot', 'errorCount', 'warningCount', 'findings']);
  });

  it('includes the delivery-method fields for each template', () => {
    const manifest = buildManifest(happyInspection());
    const [test, invite] = manifest.templates;
    expect(test.userConfigurableDeliveryMethodsSource).toBe('default');
    expect(test.userConfigurableDeliveryMethods).toBeUndefined();
    expect(test.factoryContentDeliveryMethods).toEqual(['TEXT']);
    expect(invite.userConfigurableDeliveryMethodsSource).toBe('declared');
    expect(invite.userConfigurableDeliveryMethods).toEqual(['NOTIFICATION_SUMMARY']);
    expect(invite.factoryContentDeliveryMethods).toEqual(['EMAIL']);
    expect(test.forcedDeliveryMethodsSource).toBe('default');
    expect(test.forcedDeliveryMethods).toBeUndefined();
    expect(invite.forcedDeliveryMethodsSource).toBe('declared');
    expect(invite.forcedDeliveryMethods).toEqual(['EMAIL']);
  });

  it.each([
    ['a template without a factory', () => patchInspection(happyInspection(), FACTORY_PATH, (text) => text.replace('return [demoTestNotificationFactory(context), demoInviteNotificationFactory(context)];', 'return [demoTestNotificationFactory(context)];')), 'NOTIF_TEMPLATE_FACTORY_MISSING'],
    ['a bot script without a processor', () => patchInspection(taskBotInspection(), TASKBOT_HANDLER_PATH, (text) => text.replace(', demoPingNotificationTaskBotScriptProcessor(context, DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE)]', ']')), 'NOTIF_TASK_BOT_SCRIPT_WITHOUT_PROCESSOR']
  ])('agrees with the list and validate entry points (%s)', (_label, makeInspection, expectedCode) => {
    const inspection = makeInspection();
    const { manifest, validation } = buildNotificationManifest({ app: { name: 'demo-api' }, inspection, componentDir: COMPONENT_DIR, apiDir: API_DIR }, NOW);
    const { version: _version, generatedAt: _generatedAt, app: _app, errorCount, warningCount, findings, ...report } = manifest;
    expect(report).toEqual(listAppNotifications(inspection, { componentDir: COMPONENT_DIR, apiDir: API_DIR }));

    const validated = validateAppNotifications(inspection, { componentDir: COMPONENT_DIR, apiDir: API_DIR });
    expect(validation).toEqual(validated);
    expect(errorCount).toBe(validated.errorCount);
    expect(warningCount).toBe(validated.warningCount);
    expect(findings).toEqual(validated.violations.map(({ remediation: _remediation, ...finding }) => finding));
    expect(findings.some((f) => f.code === expectedCode && f.severity === 'error')).toBe(true);
  });

  it('marks the bot script without a processor in the NotificationTaskBot section', () => {
    const inspection = patchInspection(taskBotInspection(), TASKBOT_HANDLER_PATH, (text) => text.replace(', demoPingNotificationTaskBotScriptProcessor(context, DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE)]', ']'));
    const manifest = buildManifest(inspection);
    expect(manifest.taskBot.scripts.find((s) => s.scriptType === 'demo_ping_required')?.hasProcessor).toBe(false);
  });

  it('reports an error finding when a template has no factory', () => {
    const inspection = patchInspection(happyInspection(), FACTORY_PATH, (text) => text.replace('return [demoTestNotificationFactory(context), demoInviteNotificationFactory(context)];', 'return [demoTestNotificationFactory(context)];'));
    const manifest = buildManifest(inspection);
    expect(manifest.errorCount).toBeGreaterThanOrEqual(1);
    expect(manifest.findings.some((f) => f.code === 'NOTIF_TEMPLATE_FACTORY_MISSING' && f.severity === 'error')).toBe(true);
    const invite = manifest.templates.find((t) => t.typeCode === 'INV');
    expect(invite?.hasFactory).toBe(false);
    expect(invite?.factoryContentDeliveryMethods).toEqual([]);
  });

  it('keeps warnings as findings without counting them as errors', () => {
    const inspection = patchInspection(happyInspection(), COMPONENT_MAIN_PATH, (text) => text.replace("  description: 'A test notification.',\n", ''));
    const manifest = buildManifest(inspection);
    expect(manifest.errorCount).toBe(0);
    expect(manifest.warningCount).toBe(1);
    expect(manifest.findings).toEqual([expect.objectContaining({ code: 'NOTIF_TEMPLATE_INFO_MISSING_NAME_OR_DESCRIPTION', severity: 'warning', side: 'component' })]);
    expect('remediation' in manifest.findings[0]).toBe(false);
  });
});
