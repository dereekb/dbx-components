import { describe, expect, it } from 'vitest';
import type { notificationManifest, notificationValidateApp } from '@dereekb/dbx-cli/validate';
import { cliNotificationManifestFromManifest, cliNotificationManifestNamespace, countNotificationManifestGenerationErrors, formatNotificationManifestFinding, renderCliNotificationManifestSource, renderNotificationManifest } from './render';

const FIXED_NOW = new Date('2026-05-25T00:00:00.000Z');
const COMPONENT_DIR = 'components/demo-firebase';
const API_DIR = 'apps/demo-api';
const FACTORY_PATH = 'src/app/common/model/notification/notification.factory.ts';

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
export type ExampleNotificationTaskCheckpoint = 'part_a';
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
  return { type: TEST_NOTIFICATION_TEMPLATE_TYPE, factory: async () => async () => ({ textContent: { subject: 'Test' } }) };
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

function inspection(apiFactory: string = API_FACTORY): notificationValidateApp.AppNotificationsInspection {
  const result: notificationValidateApp.AppNotificationsInspection = {
    component: {
      rootDir: COMPONENT_DIR,
      folder: 'src/lib/model/notification',
      status: 'ok',
      files: [
        { relPath: 'src/lib/model/notification/notification.task.ts', text: COMPONENT_TASK },
        { relPath: 'src/lib/model/notification/notification.ts', text: COMPONENT_MAIN }
      ]
    },
    api: {
      rootDir: API_DIR,
      folder: 'src/app/common/model/notification,src/app/common/firebase',
      status: 'ok',
      files: [
        { relPath: 'src/app/common/firebase/action.module.ts', text: API_ACTION_MODULE },
        { relPath: FACTORY_PATH, text: apiFactory },
        { relPath: 'src/app/common/model/notification/notification.module.ts', text: API_NOTIFICATION_MODULE },
        { relPath: 'src/app/common/model/notification/notification.task.service.ts', text: API_TASK_SERVICE }
      ]
    }
  };
  return result;
}

function render(apiFactory?: string): notificationManifest.BuildNotificationManifestResult {
  return renderNotificationManifest({ app: { name: 'demo-api' }, inspection: inspection(apiFactory), componentDir: COMPONENT_DIR, apiDir: API_DIR }, FIXED_NOW);
}

describe('renderNotificationManifest', () => {
  it('renders a stable manifest for a demo-shaped fixture', () => {
    const { manifest, validation } = render();
    expect(validation.errorCount).toBe(0);
    expect(manifest).toEqual({
      version: 1,
      generatedAt: '2026-05-25T00:00:00.000Z',
      app: { name: 'demo-api' },
      componentDir: COMPONENT_DIR,
      apiDir: API_DIR,
      aggregatorRecordName: 'DEMO_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD',
      aggregatorWiredInApi: true,
      templateConfigsArrayFactoryName: 'demoNotificationTemplateServiceConfigsArrayFactory',
      templateConfigsArrayWiredInApi: true,
      taskServiceCallCount: 1,
      templates: [
        {
          typeCode: 'TEST',
          symbolName: 'TEST_NOTIFICATION_TEMPLATE_TYPE',
          infoSymbolName: 'TEST_NOTIFICATION_TEMPLATE_TYPE_INFO',
          humanName: 'Test',
          description: 'A test notification.',
          notificationModelIdentity: 'testIdentity',
          targetModelIdentity: undefined,
          userConfigurableDeliveryMethods: undefined,
          userConfigurableDeliveryMethodsSource: 'default',
          factoryContentDeliveryMethods: ['TEXT'],
          inInfoRecord: true,
          hasFactory: true,
          factoryFunctionName: 'demoTestNotificationFactory',
          sourceFile: 'src/lib/model/notification/notification.ts'
        }
      ],
      tasks: [
        {
          typeCode: 'E',
          symbolName: 'EXAMPLE_NOTIFICATION_TASK_TYPE',
          dataInterfaceName: 'ExampleNotificationTaskData',
          checkpoints: ['part_a'],
          inAllArray: true,
          inValidateList: true,
          hasHandler: true,
          handlerFlowStepCount: 1,
          sourceFile: 'src/lib/model/notification/notification.task.ts'
        }
      ],
      errorCount: 0,
      warningCount: 0,
      findings: []
    });
  });

  it('reports an error finding (and no remediation) when a template has no factory', () => {
    const { manifest, validation } = render(API_FACTORY.replace('return [demoTestNotificationFactory(context)];', 'return [];'));
    expect(manifest.errorCount).toBeGreaterThanOrEqual(1);
    expect(manifest.findings).toContainEqual(expect.objectContaining({ code: 'NOTIF_TEMPLATE_FACTORY_MISSING', severity: 'error', side: 'api', file: FACTORY_PATH }));
    expect(validation.violations.find((v) => v.code === 'NOTIF_TEMPLATE_FACTORY_MISSING')?.remediation?.fix).toBeTruthy();
    expect(countNotificationManifestGenerationErrors({ findings: manifest.findings, strict: false })).toBe(manifest.errorCount);
  });
});

describe('cliNotificationManifestFromManifest', () => {
  it('maps the tasks and templates to the CLI manifest', () => {
    const { manifest } = render();
    const cliManifest = cliNotificationManifestFromManifest(manifest);

    expect(cliManifest.tasks).toEqual([expect.objectContaining({ type: 'E', symbolName: 'EXAMPLE_NOTIFICATION_TASK_TYPE', dataInterfaceName: 'ExampleNotificationTaskData', checkpoints: ['part_a'], hasHandler: true })]);
    expect(cliManifest.templates).toEqual([expect.objectContaining({ type: 'TEST', symbolName: 'TEST_NOTIFICATION_TEMPLATE_TYPE', factoryFunctionName: 'demoTestNotificationFactory', factoryContentDeliveryMethods: ['t'] })]);
  });

  it('skips entries without a type code', () => {
    const { manifest } = render();
    const cliManifest = cliNotificationManifestFromManifest({ templates: [], tasks: [...manifest.tasks, { ...manifest.tasks[0], typeCode: undefined }] });
    expect(cliManifest.tasks.map((x) => x.type)).toEqual(['E']);
  });
});

describe('renderCliNotificationManifestSource', () => {
  it('renders the stamp and manifest constants with the project namespace', () => {
    const { manifest } = render();
    const source = renderCliNotificationManifestSource({ manifest: cliNotificationManifestFromManifest(manifest), projectName: 'demo-cli', namespace: cliNotificationManifestNamespace('demo-cli'), generatorVersion: '1.2.3' });

    expect(source).toContain('npx nx run demo-cli:generate-notification-manifest');
    expect(source).toContain("import { type CliGeneratedManifestStamp, type CliNotificationManifest } from '@dereekb/dbx-cli';");
    expect(source).toContain('export const DEMO_CLI_NOTIFICATION_MANIFEST_STAMP: CliGeneratedManifestStamp = { generatorVersion: "1.2.3" };');
    expect(source).toContain('export const DEMO_CLI_NOTIFICATION_MANIFEST: CliNotificationManifest = {');
    expect(source).toContain('"checkpoints": [\n');
  });

  it('defaults the namespace to CLI', () => {
    expect(cliNotificationManifestNamespace(undefined)).toBe('CLI');
  });
});

describe('formatNotificationManifestFinding', () => {
  it('prefixes error-severity findings with `error:` and adds the catalog fix', () => {
    const line = formatNotificationManifestFinding({ code: 'NOTIF_TEMPLATE_FACTORY_MISSING', severity: 'error', side: 'api', file: FACTORY_PATH, message: 'No factory.', remediation: { fix: 'Add the factory.' } });
    expect(line).toBe(`[generate-notification-manifest] error: NOTIF_TEMPLATE_FACTORY_MISSING (api: ${FACTORY_PATH}): No factory.\n  fix: Add the factory.`);
  });

  it('prefixes warning-severity findings with `warning:` without a fix line', () => {
    const line = formatNotificationManifestFinding({ code: 'NOTIF_TEMPLATE_INFO_MISSING_NAME_OR_DESCRIPTION', severity: 'warning', side: 'component', file: undefined, message: 'No description.', remediation: { fix: 'Add one.' } });
    expect(line).toBe('[generate-notification-manifest] warning: NOTIF_TEMPLATE_INFO_MISSING_NAME_OR_DESCRIPTION (component): No description.');
  });
});

describe('countNotificationManifestGenerationErrors', () => {
  const findings: readonly Pick<notificationManifest.NotificationManifestFinding, 'code' | 'severity'>[] = [
    { code: 'NOTIF_TEMPLATE_FACTORY_MISSING', severity: 'error' },
    { code: 'NOTIF_TEMPLATE_INFO_MISSING_NAME_OR_DESCRIPTION', severity: 'warning' },
    { code: 'NOTIF_TEMPLATE_FACTORY_UNLISTED_DELIVERY_METHOD', severity: 'warning' }
  ];
  const warnings = findings.filter((f) => f.severity === 'warning');

  it('counts only error-severity findings by default (exit-on-error)', () => {
    expect(countNotificationManifestGenerationErrors({ findings, strict: false })).toBe(1);
  });

  it('counts every finding under --strict', () => {
    expect(countNotificationManifestGenerationErrors({ findings, strict: true })).toBe(3);
  });

  it('returns 0 when only warnings are present and not strict (manifest is written)', () => {
    expect(countNotificationManifestGenerationErrors({ findings: warnings, strict: false })).toBe(0);
  });

  it('drops allowlisted warning codes from the count under --strict', () => {
    expect(countNotificationManifestGenerationErrors({ findings: warnings, strict: true, allowWarning: ['NOTIF_TEMPLATE_INFO_MISSING_NAME_OR_DESCRIPTION'] })).toBe(1);
  });

  it('never allowlists an error-severity finding', () => {
    expect(countNotificationManifestGenerationErrors({ findings, strict: false, allowWarning: ['NOTIF_TEMPLATE_FACTORY_MISSING'] })).toBe(1);
  });

  it('fails when non-allowlisted warnings exceed --max-warnings', () => {
    expect(countNotificationManifestGenerationErrors({ findings: warnings, strict: false, maxWarnings: 2 })).toBe(0);
    expect(countNotificationManifestGenerationErrors({ findings: warnings, strict: false, maxWarnings: 1 })).toBe(2);
    expect(countNotificationManifestGenerationErrors({ findings: warnings, strict: false, maxWarnings: 1, allowWarning: ['NOTIF_TEMPLATE_FACTORY_UNLISTED_DELIVERY_METHOD'] })).toBe(0);
  });
});
