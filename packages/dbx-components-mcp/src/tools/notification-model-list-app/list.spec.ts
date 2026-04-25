import { describe, expect, it } from 'vitest';
import type { AppNotificationsInspection, InspectedFile } from '../notification-model-validate-app/index.js';
import { formatReportAsJson, formatReportAsMarkdown, listAppNotifications } from './index.js';

const COMPONENT_MAIN = `import { notificationTemplateTypeInfoRecord, type NotificationTemplateType, type NotificationTemplateTypeInfo } from '@dereekb/firebase';

export const TEST_NOTIFICATION_TEMPLATE_TYPE: NotificationTemplateType = 'TEST';
export const TEST_NOTIFICATION_TEMPLATE_TYPE_INFO: NotificationTemplateTypeInfo = {
  type: TEST_NOTIFICATION_TEMPLATE_TYPE,
  name: 'Test',
  description: 'A test notification.',
  notificationModelIdentity: testIdentity
};

export const DEMO_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD = notificationTemplateTypeInfoRecord([TEST_NOTIFICATION_TEMPLATE_TYPE_INFO]);
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

const API_FACTORY = `import { TEST_NOTIFICATION_TEMPLATE_TYPE } from 'demo-firebase';

export function demoTestNotificationFactory(context) {
  return { type: TEST_NOTIFICATION_TEMPLATE_TYPE, factory: async () => null };
}

export const demoNotificationTemplateServiceConfigsArrayFactory = (context) => {
  return [demoTestNotificationFactory(context)];
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

function happyInspection(): AppNotificationsInspection {
  const component: InspectedFile[] = [
    { relPath: 'src/lib/model/notification/notification.ts', text: COMPONENT_MAIN },
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

describe('listAppNotifications', () => {
  it('emits a fully populated report for a complete demo-shaped fixture', () => {
    const report = listAppNotifications(happyInspection(), { componentDir: 'components/demo-firebase', apiDir: 'apps/demo-api' });
    expect(report.aggregatorRecordName).toBe('DEMO_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD');
    expect(report.aggregatorWiredInApi).toBe(true);
    expect(report.templateConfigsArrayFactoryName).toBe('demoNotificationTemplateServiceConfigsArrayFactory');
    expect(report.templateConfigsArrayWiredInApi).toBe(true);
    expect(report.taskServiceCallCount).toBe(1);

    expect(report.templates).toHaveLength(1);
    const template = report.templates[0];
    expect(template.typeCode).toBe('TEST');
    expect(template.symbolName).toBe('TEST_NOTIFICATION_TEMPLATE_TYPE');
    expect(template.humanName).toBe('Test');
    expect(template.inInfoRecord).toBe(true);
    expect(template.hasFactory).toBe(true);
    expect(template.factoryFunctionName).toBe('demoTestNotificationFactory');

    expect(report.tasks).toHaveLength(1);
    const task = report.tasks[0];
    expect(task.typeCode).toBe('E');
    expect(task.symbolName).toBe('EXAMPLE_NOTIFICATION_TASK_TYPE');
    expect(task.dataInterfaceName).toBe('ExampleNotificationTaskData');
    expect(task.checkpoints).toEqual(['part_a', 'part_b']);
    expect(task.inAllArray).toBe(true);
    expect(task.inValidateList).toBe(true);
    expect(task.hasHandler).toBe(true);
    expect(task.handlerFlowStepCount).toBe(2);
  });

  it('flags a template without a factory', () => {
    const inspection = happyInspection();
    const apiFiles = inspection.api.files.map((f) => (f.relPath.endsWith('notification.factory.ts') ? { ...f, text: API_FACTORY.replace('return [demoTestNotificationFactory(context)];', 'return [];') } : f));
    const patched: AppNotificationsInspection = { ...inspection, api: { ...inspection.api, files: apiFiles } };
    const report = listAppNotifications(patched, { componentDir: 'components/demo-firebase', apiDir: 'apps/demo-api' });
    expect(report.templates[0].hasFactory).toBe(false);
    expect(report.templates[0].factoryFunctionName).toBeUndefined();
  });

  it('flags a task without a handler', () => {
    const inspection = happyInspection();
    const apiFiles = inspection.api.files.map((f) => (f.relPath.endsWith('notification.task.service.ts') ? { ...f, text: API_TASK_SERVICE.replace(/const exampleNotificationTaskHandler[\s\S]*?\};/, '').replace('[exampleNotificationTaskHandler]', '[]') } : f));
    const patched: AppNotificationsInspection = { ...inspection, api: { ...inspection.api, files: apiFiles } };
    const report = listAppNotifications(patched, { componentDir: 'components/demo-firebase', apiDir: 'apps/demo-api' });
    expect(report.tasks[0].hasHandler).toBe(false);
    expect(report.tasks[0].handlerFlowStepCount).toBeUndefined();
  });

  it('handles a missing aggregator record gracefully', () => {
    const inspection = happyInspection();
    const componentFiles = inspection.component.files.map((f) => (f.relPath.endsWith('notification.ts') ? { ...f, text: COMPONENT_MAIN.replace(/export const DEMO_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD[\s\S]*?;/, '') } : f));
    const patched: AppNotificationsInspection = { ...inspection, component: { ...inspection.component, files: componentFiles } };
    const report = listAppNotifications(patched, { componentDir: 'components/demo-firebase', apiDir: 'apps/demo-api' });
    expect(report.aggregatorRecordName).toBeUndefined();
    expect(report.aggregatorWiredInApi).toBe(false);
    expect(report.templates[0].inInfoRecord).toBe(false);
  });

  it('formats the report as markdown with the expected top-level headers', () => {
    const report = listAppNotifications(happyInspection(), { componentDir: 'components/demo-firebase', apiDir: 'apps/demo-api' });
    const md = formatReportAsMarkdown(report);
    expect(md).toContain('# App notifications — demo-firebase');
    expect(md).toContain('## Notification templates (1)');
    expect(md).toContain('## Notification tasks (1)');
    expect(md).toContain('### TEST — `TEST_NOTIFICATION_TEMPLATE_TYPE`');
    expect(md).toContain('### E — `EXAMPLE_NOTIFICATION_TASK_TYPE`');
    expect(md).toContain('Has factory: yes (`demoTestNotificationFactory`)');
    expect(md).toContain('Handler: yes (2 flow steps)');
  });

  it('formats the report as JSON', () => {
    const report = listAppNotifications(happyInspection(), { componentDir: 'components/demo-firebase', apiDir: 'apps/demo-api' });
    const json = formatReportAsJson(report);
    const parsed = JSON.parse(json);
    expect(parsed.templates).toHaveLength(1);
    expect(parsed.tasks).toHaveLength(1);
    expect(parsed.aggregatorRecordName).toBe('DEMO_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD');
  });

  it('emits _None found._ when no templates/tasks are declared', () => {
    const inspection: AppNotificationsInspection = {
      component: { rootDir: 'components/empty-firebase', notificationFolder: 'src/lib/model/notification', status: 'ok', files: [] },
      api: { rootDir: 'apps/empty-api', notificationFolder: 'src/app/common/model/notification', status: 'ok', files: [] }
    };
    const report = listAppNotifications(inspection, { componentDir: inspection.component.rootDir, apiDir: inspection.api.rootDir });
    const md = formatReportAsMarkdown(report);
    expect(md).toContain('## Notification templates (0)');
    expect(md).toContain('_None found._');
  });
});
