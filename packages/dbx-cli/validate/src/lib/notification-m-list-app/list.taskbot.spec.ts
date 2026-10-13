import { describe, expect, it } from 'vitest';
import type { AppNotificationsInspection, InspectedFile } from '../notification-m-validate-app/index.js';
import { formatReportAsJson, formatReportAsMarkdown, listAppNotifications } from './index.js';
import type { AppNotificationsReport, TaskBotScriptSummary } from './types.js';

// MARK: Fixture — a demo-shaped NotificationTaskBot app
const COMPONENT_TASKBOT = `import { type, type Type } from 'arktype';
import { type NotificationTaskBotScriptConfig, type NotificationTaskBotScriptGroup, type NotificationTaskBotScriptType, notificationTaskBotScriptConfigRecord } from '@dereekb/firebase';

export const DEMO_PING_NOTIFICATION_TASK_BOT_GROUP: NotificationTaskBotScriptGroup = { key: 'ping_reminders', name: 'Ping Reminders' };

export const DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_TYPE: NotificationTaskBotScriptType = 'demo_ping';

export const DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE: NotificationTaskBotScriptType = 'demo_ping_required';

export const demoPingEntryDataType = type({ 'c?': 'number' }) as Type<{ c?: number }>;

export const DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG: NotificationTaskBotScriptConfig = {
  scriptType: DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_TYPE,
  name: 'Demo Ping',
  description: 'Pings.',
  group: DEMO_PING_NOTIFICATION_TASK_BOT_GROUP,
  allowOwnerOptOut: true,
  dataType: demoPingEntryDataType
};

export const DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG: NotificationTaskBotScriptConfig = {
  scriptType: DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE,
  name: 'Demo Required Ping',
  description: 'Pings, required.',
  group: DEMO_PING_NOTIFICATION_TASK_BOT_GROUP
};

export const DEMO_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS: NotificationTaskBotScriptConfig[] = [DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG, DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG];

export const DEMO_FIREBASE_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD = notificationTaskBotScriptConfigRecord(DEMO_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS);
`;

const COMPONENT_TASK = `import { type NotificationTaskType } from '@dereekb/firebase';

export const EXAMPLE_NOTIFICATION_TASK_TYPE: NotificationTaskType = 'E';

export interface ExampleNotificationTaskData {
  readonly uid: string;
}

export const ALL_NOTIFICATION_TASK_TYPES: NotificationTaskType[] = [EXAMPLE_NOTIFICATION_TASK_TYPE];
`;

const API_ACTION_MODULE = `import { appNotificationTaskBotScriptConfigService } from '@dereekb/firebase';
import { DEMO_FIREBASE_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD } from 'demo-firebase';

export const demoFirebaseServerActionsContextFactory = (context) => {
  return {
    appNotificationTaskBotScriptConfigService: appNotificationTaskBotScriptConfigService(DEMO_FIREBASE_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD)
  };
};
`;

const API_TASK_SERVICE = `import { ALL_NOTIFICATION_TASK_BOT_NOTIFICATION_TASK_TYPES } from '@dereekb/firebase';
import { type NotificationTaskService, type NotificationTaskServiceTaskHandlerConfig, notificationTaskService } from '@dereekb/firebase-server/model';
import { ALL_NOTIFICATION_TASK_TYPES, EXAMPLE_NOTIFICATION_TASK_TYPE, type ExampleNotificationTaskData } from 'demo-firebase';
import { demoNotificationTaskBotRunNotificationTaskHandler } from './handlers/taskbot/task.handler.taskbot';

export function demoNotificationTaskServiceFactory(context): NotificationTaskService {
  const exampleNotificationTaskHandler: NotificationTaskServiceTaskHandlerConfig<ExampleNotificationTaskData> = {
    type: EXAMPLE_NOTIFICATION_TASK_TYPE,
    flow: [{ fn: async () => null }]
  };
  const notificationTaskBotHandler = demoNotificationTaskBotRunNotificationTaskHandler(context);
  const handlers: NotificationTaskServiceTaskHandlerConfig<any>[] = [exampleNotificationTaskHandler, notificationTaskBotHandler];
  return notificationTaskService({ validate: [...ALL_NOTIFICATION_TASK_TYPES, ...ALL_NOTIFICATION_TASK_BOT_NOTIFICATION_TASK_TYPES], handlers });
}
`;

const API_TASKBOT_HANDLER = `import { type NotificationTaskBotScriptType } from '@dereekb/firebase';
import { type NotificationTaskBotScriptProcessorConfig, notificationTaskBotRunNotificationTaskHandler } from '@dereekb/firebase-server/model';
import { DEMO_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS, DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_TYPE, DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE } from 'demo-firebase';

export function demoPingNotificationTaskBotScriptProcessor(context, target: NotificationTaskBotScriptType = DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_TYPE): NotificationTaskBotScriptProcessorConfig {
  return {
    target,
    flow: [],
    cleanup: () => ({})
  };
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
  await request.nest.notificationActions.sendQueuedNotifications({});
  await request.nest.notificationActions.repairAllNotificationTaskBots();
});
`;

const TASKBOT_FILE = 'src/lib/model/notification/notification.taskbot.ts';
const GROUP_FILE = 'src/lib/model/notification/notification.taskbot.group.ts';
const ACTION_MODULE_FILE = 'src/app/common/firebase/action.module.ts';
const TASK_SERVICE_FILE = 'src/app/common/model/notification/notification.task.service.ts';
const HANDLER_FILE = 'src/app/common/model/notification/handlers/taskbot/task.handler.taskbot.ts';
const SCHEDULE_FILE = 'src/app/function/notification/notification.schedule.ts';

const REQUIRED_CONFIG = `export const DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG: NotificationTaskBotScriptConfig = {
  scriptType: DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE,
  name: 'Demo Required Ping',
  description: 'Pings, required.',
  group: DEMO_PING_NOTIFICATION_TASK_BOT_GROUP
};`;

const REQUIRED_PROCESSOR = ', demoPingNotificationTaskBotScriptProcessor(context, DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE)]';
const HANDLER_VALIDATE = 'validate: DEMO_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS.map((x) => x.scriptType)';
const WIRING_CALL = 'appNotificationTaskBotScriptConfigService(DEMO_FIREBASE_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD)';
const RECORD_DECLARATION = 'export const DEMO_FIREBASE_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD = notificationTaskBotScriptConfigRecord(DEMO_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS);';
const GROUP_DECLARATION = "export const DEMO_PING_NOTIFICATION_TASK_BOT_GROUP: NotificationTaskBotScriptGroup = { key: 'ping_reminders', name: 'Ping Reminders' };";

const EMPTY_TASK_BOT_SECTION = { inUse: false, registries: [], registryWirings: [], handlers: [], taskTypesInTaskServiceValidate: false, repairCalls: [], scripts: [] };

interface FixtureParts {
  readonly component: InspectedFile[];
  readonly api: InspectedFile[];
}

function happyParts(): FixtureParts {
  return {
    component: [
      { relPath: TASKBOT_FILE, text: COMPONENT_TASKBOT },
      { relPath: 'src/lib/model/notification/notification.task.ts', text: COMPONENT_TASK }
    ],
    api: [
      { relPath: ACTION_MODULE_FILE, text: API_ACTION_MODULE },
      { relPath: TASK_SERVICE_FILE, text: API_TASK_SERVICE },
      { relPath: HANDLER_FILE, text: API_TASKBOT_HANDLER },
      { relPath: SCHEDULE_FILE, text: API_SCHEDULE }
    ]
  };
}

function listWith(modify?: (parts: FixtureParts) => void): AppNotificationsReport {
  const parts = happyParts();
  modify?.(parts);
  const inspection: AppNotificationsInspection = {
    component: { rootDir: 'components/demo-firebase', folder: 'src/lib/model/notification', status: 'ok', files: parts.component },
    api: { rootDir: 'apps/demo-api', folder: 'src/app/common/model/notification', status: 'ok', files: parts.api }
  };
  return listAppNotifications(inspection, { componentDir: 'components/demo-firebase', apiDir: 'apps/demo-api' });
}

function replaceInFile(files: InspectedFile[], relPath: string, from: string, to: string): void {
  const i = files.findIndex((f) => f.relPath === relPath);
  if (i < 0 || !files[i].text.includes(from)) {
    throw new Error(`replaceInFile: \`${from}\` not found in ${relPath}`);
  }
  files[i] = { ...files[i], text: files[i].text.replace(from, to) };
}

function removeFile(files: InspectedFile[], relPath: string): void {
  const i = files.findIndex((f) => f.relPath === relPath);
  if (i < 0) {
    throw new Error(`removeFile: ${relPath} not found`);
  }
  files.splice(i, 1);
}

function scriptOf(report: AppNotificationsReport, scriptType: string): TaskBotScriptSummary | undefined {
  return report.taskBot.scripts.find((s) => s.scriptType === scriptType);
}

describe('dbx_notification_m_list_app NotificationTaskBot section', () => {
  it('lists the demo-shaped wiring in JSON', () => {
    const { taskBot } = listWith();
    expect(taskBot.inUse).toBe(true);
    expect(taskBot.registries).toEqual([expect.objectContaining({ symbolName: 'DEMO_FIREBASE_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD', side: 'component', wired: true })]);
    expect(taskBot.registries[0].scriptTypes.map((r) => r.code)).toEqual(['demo_ping', 'demo_ping_required']);
    expect(taskBot.registryWirings[0].kind).toBe('identifier');
    expect(taskBot.handlers).toEqual([expect.objectContaining({ reachable: true, processorsResolved: true, validateStatus: 'resolved', validateUsesRegistry: false })]);
    expect(taskBot.handlers[0].processors).toHaveLength(2);
    expect(taskBot.taskTypesInTaskServiceValidate).toBe(true);
    expect(taskBot.repairCalls).toEqual([expect.objectContaining({ sourceFile: SCHEDULE_FILE })]);
    expect(taskBot.scripts).toHaveLength(2);
    expect(scriptOf({ taskBot } as AppNotificationsReport, 'demo_ping')).toEqual(
      expect.objectContaining({
        symbolName: 'DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_TYPE',
        side: 'component',
        sourceFile: TASKBOT_FILE,
        configSymbolName: 'DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG',
        humanName: 'Demo Ping',
        description: 'Pings.',
        groupKey: 'ping_reminders',
        allowOwnerOptOut: true,
        dataTypeSource: 'declared',
        inRegistry: true,
        inHandlerValidate: true,
        hasProcessor: true,
        processorLabels: ['demoPingNotificationTaskBotScriptProcessor(context)']
      })
    );
    expect(scriptOf({ taskBot } as AppNotificationsReport, 'demo_ping_required')).toEqual(expect.objectContaining({ groupKey: 'ping_reminders', allowOwnerOptOut: undefined, dataTypeSource: 'none', inRegistry: true, inHandlerValidate: true, hasProcessor: true }));
  });

  it('renders the section in markdown', () => {
    const md = formatReportAsMarkdown(listWith());
    expect(md).toContain('## NotificationTaskBot\n');
    expect(md).toContain('- Script registry: `DEMO_FIREBASE_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD`');
    expect(md).toContain('Wired via `appNotificationTaskBotScriptConfigService`: yes');
    expect(md).toContain('Reachable from `notificationTaskService({ handlers })`: yes');
    expect(md).toContain('`demoPingNotificationTaskBotScriptProcessor(context)` → `demo_ping`');
    expect(md).toContain('- `validate`: `demo_ping`, `demo_ping_required`');
    expect(md).toContain('Repair sweep (`repairAllNotificationTaskBots()`): yes');
    expect(md).toContain('## NotificationTaskBot scripts (2)');
    expect(md).toContain('### demo_ping — `DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_TYPE`');
    expect(md).toContain('- Group: `ping_reminders`');
    expect(md).toContain('- Data type: yes');
    expect(md).toContain('- Data type: none — ℹ️');
    expect(md).toContain('- Owner can opt out: yes');
    expect(md).toContain('- Owner can opt out: no');
  });

  it.each([
    ['`dataType: undefined`', REQUIRED_CONFIG.replace("description: 'Pings, required.',", "description: 'Pings, required.',\n  dataType: undefined,"), 'none'],
    ['`dataType: null`', REQUIRED_CONFIG.replace("description: 'Pings, required.',", "description: 'Pings, required.',\n  dataType: null,"), 'none'],
    ['a shorthand `dataType`', `const dataType = demoPingEntryDataType;\n${REQUIRED_CONFIG.replace("description: 'Pings, required.',", "description: 'Pings, required.',\n  dataType,")}`, 'declared'],
    ['a spread without `dataType`', 'export const DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG: NotificationTaskBotScriptConfig = { ...DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG, scriptType: DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE };', 'unresolved'],
    ['a spread with `dataType`', 'export const DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG: NotificationTaskBotScriptConfig = { ...DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG, scriptType: DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE, dataType: demoPingEntryDataType };', 'declared']
  ])('reads %s as dataTypeSource %s', (_label, requiredConfig, expected) => {
    const report = listWith((p) => replaceInFile(p.component, TASKBOT_FILE, REQUIRED_CONFIG, requiredConfig));
    expect(scriptOf(report, 'demo_ping_required')?.dataTypeSource).toBe(expected);
  });

  it('marks a script without a processor', () => {
    const report = listWith((p) => replaceInFile(p.api, HANDLER_FILE, REQUIRED_PROCESSOR, ']'));
    expect(scriptOf(report, 'demo_ping_required')).toEqual(expect.objectContaining({ hasProcessor: false, processorLabels: [] }));
    expect(formatReportAsMarkdown(report)).toContain('- Processor: no');
  });

  it('marks an NTBR handler the task service does not reach, and still reads its processors', () => {
    const report = listWith((p) => replaceInFile(p.api, TASK_SERVICE_FILE, ', notificationTaskBotHandler]', ']'));
    expect(report.taskBot.handlers[0].reachable).toBe(false);
    expect(report.taskBot.scripts.every((s) => s.hasProcessor)).toBe(true);
    expect(formatReportAsMarkdown(report)).toContain('Reachable from `notificationTaskService({ handlers })`: no');
  });

  it('reads a handler validate that defers to the registry', () => {
    const report = listWith((p) => replaceInFile(p.api, HANDLER_FILE, HANDLER_VALIDATE, 'validate: context.appNotificationTaskBotScriptConfigService.getAllKnownScriptTypes()'));
    expect(report.taskBot.handlers[0].validateUsesRegistry).toBe(true);
    expect(report.taskBot.scripts.map((s) => s.inHandlerValidate)).toEqual([true, true]);
    expect(formatReportAsMarkdown(report)).toContain('the script registry (`getAllKnownScriptTypes()`)');
  });

  it('leaves inHandlerValidate unset when the handler has no validate', () => {
    const report = listWith((p) => replaceInFile(p.api, HANDLER_FILE, `${HANDLER_VALIDATE},\n`, ''));
    expect(report.taskBot.handlers[0].validateStatus).toBe('absent');
    expect(report.taskBot.scripts.map((s) => s.inHandlerValidate)).toEqual([undefined, undefined]);
    const md = formatReportAsMarkdown(report);
    expect(md).not.toContain('In handler `validate`');
    expect(md).toContain('  - `validate`: _not set_');
  });

  it('adds a row for a script only the handler validate names', () => {
    const report = listWith((p) => replaceInFile(p.api, HANDLER_FILE, HANDLER_VALIDATE, "validate: [...DEMO_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS.map((x) => x.scriptType), 'demo_extra']"));
    expect(report.taskBot.scripts).toHaveLength(3);
    expect(scriptOf(report, 'demo_extra')).toEqual(expect.objectContaining({ scriptType: 'demo_extra', symbolName: undefined, hasConfig: false, inRegistry: false, inHandlerValidate: true, hasProcessor: false }));
    const md = formatReportAsMarkdown(report);
    expect(md).toContain('### demo_extra\n');
    expect(md).toContain('- Config: _Missing._');
  });

  it('marks a config left out of the registry', () => {
    const report = listWith((p) => replaceInFile(p.component, TASKBOT_FILE, '[DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG, DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG]', '[DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG]'));
    expect(scriptOf(report, 'demo_ping_required')).toEqual(expect.objectContaining({ inRegistry: false, hasConfig: true }));
  });

  it('lists an inline record in the wiring', () => {
    const report = listWith((p) => {
      replaceInFile(p.component, TASKBOT_FILE, RECORD_DECLARATION, '');
      replaceInFile(p.api, ACTION_MODULE_FILE, WIRING_CALL, 'appNotificationTaskBotScriptConfigService(notificationTaskBotScriptConfigRecord(DEMO_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS))');
    });
    expect(report.taskBot.registries).toEqual([expect.objectContaining({ symbolName: undefined, side: 'api', wired: true })]);
    expect(report.taskBot.registryWirings[0].kind).toBe('inline');
    expect(report.taskBot.scripts.every((s) => s.inRegistry)).toBe(true);
  });

  it('lists a wiring with no argument', () => {
    const report = listWith((p) => replaceInFile(p.api, ACTION_MODULE_FILE, WIRING_CALL, 'appNotificationTaskBotScriptConfigService()'));
    expect(report.taskBot.registries[0].wired).toBe(false);
    expect(report.taskBot.registryWirings[0].kind).toBe('empty');
    expect(formatReportAsMarkdown(report)).toContain('_no argument_');
  });

  it('reports a missing repair sweep', () => {
    const report = listWith((p) => removeFile(p.api, SCHEDULE_FILE));
    expect(report.taskBot.repairCalls).toEqual([]);
    expect(formatReportAsMarkdown(report)).toContain('Repair sweep (`repairAllNotificationTaskBots()`): no');
  });

  it('reads an inline group key', () => {
    const report = listWith((p) => replaceInFile(p.component, TASKBOT_FILE, 'group: DEMO_PING_NOTIFICATION_TASK_BOT_GROUP,\n  allowOwnerOptOut: true', "group: { key: 'inline_group', name: 'Inline' },\n  allowOwnerOptOut: true"));
    expect(scriptOf(report, 'demo_ping')?.groupKey).toBe('inline_group');
  });

  it('reads a group declared in another component file', () => {
    const report = listWith((p) => {
      replaceInFile(p.component, TASKBOT_FILE, GROUP_DECLARATION, '');
      p.component.push({ relPath: GROUP_FILE, text: `import { type NotificationTaskBotScriptGroup } from '@dereekb/firebase';\n\n${GROUP_DECLARATION}\n` });
    });
    expect(report.taskBot.scripts.map((s) => s.groupKey)).toEqual(['ping_reminders', 'ping_reminders']);
  });

  it('shows an empty, not-in-use section for an app without bots', () => {
    const report = listWith((p) => {
      removeFile(p.component, TASKBOT_FILE);
      removeFile(p.api, HANDLER_FILE);
      removeFile(p.api, ACTION_MODULE_FILE);
      removeFile(p.api, SCHEDULE_FILE);
      replaceInFile(p.api, TASK_SERVICE_FILE, ', ...ALL_NOTIFICATION_TASK_BOT_NOTIFICATION_TASK_TYPES', '');
      replaceInFile(p.api, TASK_SERVICE_FILE, ', notificationTaskBotHandler]', ']');
      replaceInFile(p.api, TASK_SERVICE_FILE, 'const notificationTaskBotHandler = demoNotificationTaskBotRunNotificationTaskHandler(context);', '');
    });
    expect(report.taskBot).toEqual(EMPTY_TASK_BOT_SECTION);
    const md = formatReportAsMarkdown(report);
    expect(md).toContain('## NotificationTaskBot\n\n_Not in use._');
    expect(md).not.toContain('## NotificationTaskBot scripts');
  });

  it('writes the section into the JSON format', () => {
    const json = JSON.parse(formatReportAsJson(listWith())) as AppNotificationsReport;
    expect(json.taskBot.scripts[1].dataTypeSource).toBe('none');
  });
});
