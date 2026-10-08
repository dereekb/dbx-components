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
  userConfigurableDeliveryMethods: [NotificationDeliveryMethod.EMAIL]
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

const COMPONENT_DIR = 'components/demo-firebase';
const API_DIR = 'apps/demo-api';
const NOW = new Date('2026-01-02T03:04:05.000Z');
const FACTORY_PATH = 'src/app/common/model/notification/notification.factory.ts';
const COMPONENT_MAIN_PATH = 'src/lib/model/notification/notification.ts';

function happyInspection(): AppNotificationsInspection {
  const component: InspectedFile[] = [
    { relPath: COMPONENT_MAIN_PATH, text: COMPONENT_MAIN },
    { relPath: 'src/lib/model/notification/notification.task.ts', text: COMPONENT_TASK }
  ];
  const api: InspectedFile[] = [
    { relPath: 'src/app/common/firebase/action.module.ts', text: API_ACTION_MODULE },
    { relPath: FACTORY_PATH, text: API_FACTORY },
    { relPath: 'src/app/common/model/notification/notification.task.service.ts', text: API_TASK_SERVICE },
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
  });

  it('writes the keys in the documented order', () => {
    const manifest = buildManifest(happyInspection());
    expect(Object.keys(manifest)).toEqual(['version', 'generatedAt', 'app', 'componentDir', 'apiDir', 'aggregatorRecordName', 'aggregatorWiredInApi', 'templateConfigsArrayFactoryName', 'templateConfigsArrayWiredInApi', 'taskServiceCallCount', 'templates', 'tasks', 'errorCount', 'warningCount', 'findings']);
  });

  it('includes the delivery-method fields for each template', () => {
    const manifest = buildManifest(happyInspection());
    const [test, invite] = manifest.templates;
    expect(test.userConfigurableDeliveryMethodsSource).toBe('default');
    expect(test.userConfigurableDeliveryMethods).toBeUndefined();
    expect(test.factoryContentDeliveryMethods).toEqual(['TEXT']);
    expect(invite.userConfigurableDeliveryMethodsSource).toBe('declared');
    expect(invite.userConfigurableDeliveryMethods).toEqual(['EMAIL']);
    expect(invite.factoryContentDeliveryMethods).toEqual(['EMAIL']);
  });

  it('agrees with the list and validate entry points', () => {
    const inspection = patchInspection(happyInspection(), FACTORY_PATH, (text) => text.replace('return [demoTestNotificationFactory(context), demoInviteNotificationFactory(context)];', 'return [demoTestNotificationFactory(context)];'));
    const { manifest, validation } = buildNotificationManifest({ app: { name: 'demo-api' }, inspection, componentDir: COMPONENT_DIR, apiDir: API_DIR }, NOW);
    const { version: _version, generatedAt: _generatedAt, app: _app, errorCount, warningCount, findings, ...report } = manifest;
    expect(report).toEqual(listAppNotifications(inspection, { componentDir: COMPONENT_DIR, apiDir: API_DIR }));

    const validated = validateAppNotifications(inspection, { componentDir: COMPONENT_DIR, apiDir: API_DIR });
    expect(validation).toEqual(validated);
    expect(errorCount).toBe(validated.errorCount);
    expect(warningCount).toBe(validated.warningCount);
    expect(findings).toEqual(validated.violations.map(({ remediation: _remediation, ...finding }) => finding));
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
