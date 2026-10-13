import { describe, expect, it } from 'vitest';
import { extractAppNotifications, validateAppNotifications } from './index.js';
import { selectTaskBotRunHandlerCalls } from './select.taskbot.js';
import type { AppNotificationsInspection, AppNotificationsWorkspaceFiles, InspectedFile, ValidationResult, ViolationCode } from './types.js';

// MARK: Fixture — a demo-shaped NotificationTaskBot app
const COMPONENT_TASKBOT = `import { type NotificationTaskBotScriptConfig, type NotificationTaskBotScriptType, notificationTaskBotScriptConfigRecord } from '@dereekb/firebase';

export const DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_TYPE: NotificationTaskBotScriptType = 'demo_ping';

export const DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE: NotificationTaskBotScriptType = 'demo_ping_required';

export const DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG: NotificationTaskBotScriptConfig = {
  scriptType: DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_TYPE,
  name: 'Demo Ping',
  description: 'Pings.'
};

export const DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG: NotificationTaskBotScriptConfig = {
  scriptType: DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE,
  name: 'Demo Required Ping',
  description: 'Pings, required.'
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

const NTB_FACTORY_IMPORT = "import { type NotificationTaskBotScriptProcessorConfig, notificationTaskBotRunNotificationTaskHandler } from '@dereekb/firebase-server/model';";
const NTB_FACTORY_RETURN = 'return notificationTaskBotRunNotificationTaskHandler(';

const API_TASKBOT_HANDLER = `import { type NotificationTaskBotScriptType } from '@dereekb/firebase';
${NTB_FACTORY_IMPORT}
import { DEMO_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS, DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_TYPE, DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE } from 'demo-firebase';

export function demoPingNotificationTaskBotScriptProcessor(context, target: NotificationTaskBotScriptType = DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_TYPE): NotificationTaskBotScriptProcessorConfig {
  const { profileCollection } = context;
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

const RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /ntb/{notificationTaskBot} {
      allow get, list: if userClaimsIsSysAdmin();
    }
  }
}
`;

const INDEXES = JSON.stringify({ indexes: [], fieldOverrides: [] });

const COMPONENT_TASK_FILE = 'src/lib/model/notification/notification.task.ts';
const TASKBOT_FILE = 'src/lib/model/notification/notification.taskbot.ts';
const ACTION_MODULE_FILE = 'src/app/common/firebase/action.module.ts';
const TASK_SERVICE_FILE = 'src/app/common/model/notification/notification.task.service.ts';
const HANDLER_FILE = 'src/app/common/model/notification/handlers/taskbot/task.handler.taskbot.ts';
const SCHEDULE_FILE = 'src/app/function/notification/notification.schedule.ts';

interface FixtureParts {
  readonly component: InspectedFile[];
  readonly api: InspectedFile[];
  workspace: { firestoreRules?: { path: string; text: string | undefined }; firestoreIndexes?: { path: string; text: string | undefined } } | undefined;
}

function happyParts(): FixtureParts {
  return {
    component: [
      { relPath: TASKBOT_FILE, text: COMPONENT_TASKBOT },
      { relPath: COMPONENT_TASK_FILE, text: COMPONENT_TASK }
    ],
    api: [
      { relPath: ACTION_MODULE_FILE, text: API_ACTION_MODULE },
      { relPath: TASK_SERVICE_FILE, text: API_TASK_SERVICE },
      { relPath: HANDLER_FILE, text: API_TASKBOT_HANDLER },
      { relPath: SCHEDULE_FILE, text: API_SCHEDULE }
    ],
    workspace: {
      firestoreRules: { path: 'firestore.rules', text: RULES },
      firestoreIndexes: { path: 'firestore.indexes.json', text: INDEXES }
    }
  };
}

function inspectionOf(modify?: (parts: FixtureParts) => void): AppNotificationsInspection {
  const parts = happyParts();
  modify?.(parts);
  return {
    component: { rootDir: 'components/demo-firebase', folder: 'src/lib/model/notification', status: 'ok', files: parts.component },
    api: { rootDir: 'apps/demo-api', folder: 'src/app/common/model/notification', status: 'ok', files: parts.api },
    workspace: parts.workspace as AppNotificationsWorkspaceFiles | undefined
  };
}

function runWith(modify?: (parts: FixtureParts) => void): ValidationResult {
  return validateAppNotifications(inspectionOf(modify), { componentDir: 'components/demo-firebase', apiDir: 'apps/demo-api' });
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

function taskBotCodes(result: ValidationResult): ViolationCode[] {
  return result.violations.map((v) => v.code).filter((c) => c.startsWith('NOTIF_TASK_BOT_'));
}

function findingsOf(result: ValidationResult, code: ViolationCode) {
  return result.violations.filter((v) => v.code === code);
}

// Moves the NotificationTaskBot task types from `validate` into the component's `ALL_NOTIFICATION_TASK_TYPES`.
function nestTaskBotTaskTypes(parts: FixtureParts): void {
  replaceInFile(parts.component, COMPONENT_TASK_FILE, "import { type NotificationTaskType } from '@dereekb/firebase';", "import { ALL_NOTIFICATION_TASK_BOT_NOTIFICATION_TASK_TYPES, type NotificationTaskType } from '@dereekb/firebase';");
  replaceInFile(parts.component, COMPONENT_TASK_FILE, '[EXAMPLE_NOTIFICATION_TASK_TYPE]', '[EXAMPLE_NOTIFICATION_TASK_TYPE, ...ALL_NOTIFICATION_TASK_BOT_NOTIFICATION_TASK_TYPES]');
  replaceInFile(parts.api, TASK_SERVICE_FILE, ', ...ALL_NOTIFICATION_TASK_BOT_NOTIFICATION_TASK_TYPES', '');
}

// Moves the NotificationTaskBot task types into the component's `ALL_NOTIFICATION_TASK_TYPES`, then names it as `validate`.
function nameValidateAggregateHoldingTaskBotTypes(parts: FixtureParts): void {
  nestTaskBotTaskTypes(parts);
  replaceInFile(parts.api, TASK_SERVICE_FILE, 'validate: [...ALL_NOTIFICATION_TASK_TYPES]', 'validate: ALL_NOTIFICATION_TASK_TYPES');
}

function aliasRunHandlerFactory(parts: FixtureParts): void {
  replaceInFile(parts.api, HANDLER_FILE, NTB_FACTORY_IMPORT, "import { type NotificationTaskBotScriptProcessorConfig, notificationTaskBotRunNotificationTaskHandler as runHandler } from '@dereekb/firebase-server/model';");
  replaceInFile(parts.api, HANDLER_FILE, NTB_FACTORY_RETURN, 'return runHandler(');
}

function namespaceRunHandlerFactory(parts: FixtureParts): void {
  replaceInFile(parts.api, HANDLER_FILE, NTB_FACTORY_IMPORT, "import { type NotificationTaskBotScriptProcessorConfig } from '@dereekb/firebase-server/model';\nimport * as serverModel from '@dereekb/firebase-server/model';");
  replaceInFile(parts.api, HANDLER_FILE, NTB_FACTORY_RETURN, 'return serverModel.notificationTaskBotRunNotificationTaskHandler(');
}

function localConstRunHandlerFactory(parts: FixtureParts): void {
  replaceInFile(parts.api, HANDLER_FILE, NTB_FACTORY_RETURN, 'const run = notificationTaskBotRunNotificationTaskHandler;\n  return run(');
}

function localConstScriptConfigRecord(parts: FixtureParts): void {
  replaceInFile(parts.component, TASKBOT_FILE, 'export const DEMO_FIREBASE_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD = notificationTaskBotScriptConfigRecord(', 'const makeRecord = notificationTaskBotScriptConfigRecord;\n\nexport const DEMO_FIREBASE_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD = makeRecord(');
}

function namespaceScriptConfigRecord(parts: FixtureParts): void {
  replaceInFile(parts.component, TASKBOT_FILE, 'type NotificationTaskBotScriptType, notificationTaskBotScriptConfigRecord } from', 'type NotificationTaskBotScriptType } from');
  replaceInFile(parts.component, TASKBOT_FILE, "from '@dereekb/firebase';", "from '@dereekb/firebase';\nimport * as firebaseModel from '@dereekb/firebase';");
  replaceInFile(parts.component, TASKBOT_FILE, '= notificationTaskBotScriptConfigRecord(DEMO_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS)', '= firebaseModel.notificationTaskBotScriptConfigRecord(DEMO_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS)');
}

function aliasTaskService(parts: FixtureParts): void {
  replaceInFile(parts.api, TASK_SERVICE_FILE, ", notificationTaskService } from '@dereekb/firebase-server/model';", ", notificationTaskService as createNotificationTaskService } from '@dereekb/firebase-server/model';");
  replaceInFile(parts.api, TASK_SERVICE_FILE, 'return notificationTaskService(', 'return createNotificationTaskService(');
}

function namespaceTaskService(parts: FixtureParts): void {
  replaceInFile(parts.api, TASK_SERVICE_FILE, ", notificationTaskService } from '@dereekb/firebase-server/model';", " } from '@dereekb/firebase-server/model';\nimport * as serverModel from '@dereekb/firebase-server/model';");
  replaceInFile(parts.api, TASK_SERVICE_FILE, 'return notificationTaskService(', 'return serverModel.notificationTaskService(');
}

describe('NotificationTaskBot checks — happy path and gating', () => {
  it('passes the demo-shaped fixture with no findings', () => {
    const result = runWith();
    expect(result.violations).toEqual([]);
  });

  it('runs no NotificationTaskBot check for an app without bots', () => {
    const result = runWith((p) => {
      removeFile(p.component, TASKBOT_FILE);
      removeFile(p.api, HANDLER_FILE);
      removeFile(p.api, ACTION_MODULE_FILE);
      replaceInFile(p.api, TASK_SERVICE_FILE, ', ...ALL_NOTIFICATION_TASK_BOT_NOTIFICATION_TASK_TYPES', '');
      replaceInFile(p.api, TASK_SERVICE_FILE, ', notificationTaskBotHandler]', ']');
      replaceInFile(p.api, TASK_SERVICE_FILE, 'const notificationTaskBotHandler = demoNotificationTaskBotRunNotificationTaskHandler(context);', '');
      p.workspace = { firestoreRules: { path: 'firestore.rules', text: 'service cloud.firestore {}' } };
    });
    expect(taskBotCodes(result)).toEqual([]);
  });

  it('does not treat an empty appNotificationTaskBotScriptConfigService() call as using bots', () => {
    const result = runWith((p) => {
      removeFile(p.component, TASKBOT_FILE);
      removeFile(p.api, HANDLER_FILE);
      replaceInFile(p.api, ACTION_MODULE_FILE, 'appNotificationTaskBotScriptConfigService(DEMO_FIREBASE_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD)', 'appNotificationTaskBotScriptConfigService()');
      replaceInFile(p.api, TASK_SERVICE_FILE, ', ...ALL_NOTIFICATION_TASK_BOT_NOTIFICATION_TASK_TYPES', '');
      replaceInFile(p.api, TASK_SERVICE_FILE, ', notificationTaskBotHandler]', ']');
      replaceInFile(p.api, TASK_SERVICE_FILE, 'const notificationTaskBotHandler = demoNotificationTaskBotRunNotificationTaskHandler(context);', '');
    });
    expect(taskBotCodes(result)).toEqual([]);
  });
});

describe('NotificationTaskBot checks — registry', () => {
  it('reports NOTIF_TASK_BOT_REGISTRY_MISSING when no record is declared', () => {
    const result = runWith((p) => {
      replaceInFile(p.component, TASKBOT_FILE, 'export const DEMO_FIREBASE_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD = notificationTaskBotScriptConfigRecord(DEMO_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS);', '');
    });
    const codes = taskBotCodes(result);
    expect(codes).toContain('NOTIF_TASK_BOT_REGISTRY_MISSING');
    expect(codes).not.toContain('NOTIF_TASK_BOT_PROCESSOR_NOT_REGISTERED');
    expect(findingsOf(result, 'NOTIF_TASK_BOT_REGISTRY_MISSING')[0].severity).toBe('error');
  });

  it.each([
    ['the wiring is removed', 'appNotificationTaskBotScriptConfigService: appNotificationTaskBotScriptConfigService(DEMO_FIREBASE_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD)', 'other: 1', 'no `appNotificationTaskBotScriptConfigService(...)` call'],
    ['the wiring has no argument', 'appNotificationTaskBotScriptConfigService(DEMO_FIREBASE_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD)', 'appNotificationTaskBotScriptConfigService()', 'no argument'],
    ['the wiring passes another identifier', 'appNotificationTaskBotScriptConfigService(DEMO_FIREBASE_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD)', 'appNotificationTaskBotScriptConfigService(SOME_OTHER_RECORD)', 'SOME_OTHER_RECORD']
  ])('reports NOTIF_TASK_BOT_REGISTRY_NOT_WIRED when %s', (_label, from, to, messagePart) => {
    const result = runWith((p) => replaceInFile(p.api, ACTION_MODULE_FILE, from, to));
    const found = findingsOf(result, 'NOTIF_TASK_BOT_REGISTRY_NOT_WIRED');
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain(messagePart);
    expect(found[0].severity).toBe('error');
  });

  it('accepts an inline record in the wiring', () => {
    const result = runWith((p) => {
      replaceInFile(p.component, TASKBOT_FILE, 'export const DEMO_FIREBASE_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD = notificationTaskBotScriptConfigRecord(DEMO_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS);', '');
      replaceInFile(p.api, ACTION_MODULE_FILE, 'appNotificationTaskBotScriptConfigService(DEMO_FIREBASE_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD)', 'appNotificationTaskBotScriptConfigService(notificationTaskBotScriptConfigRecord(DEMO_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS))');
    });
    expect(taskBotCodes(result)).toEqual([]);
  });

  it('accepts a record declared on the API side', () => {
    const result = runWith((p) => {
      replaceInFile(p.component, TASKBOT_FILE, 'export const DEMO_FIREBASE_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD = notificationTaskBotScriptConfigRecord(DEMO_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS);', '');
      replaceInFile(p.api, ACTION_MODULE_FILE, 'export const demoFirebaseServerActionsContextFactory', 'export const DEMO_FIREBASE_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD = notificationTaskBotScriptConfigRecord(DEMO_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS);\nexport const demoFirebaseServerActionsContextFactory');
    });
    expect(taskBotCodes(result)).toEqual([]);
  });
});

describe('NotificationTaskBot checks — handler', () => {
  it('reports NOTIF_TASK_BOT_HANDLER_NOT_REGISTERED when the handler is dropped from handlers', () => {
    const result = runWith((p) => replaceInFile(p.api, TASK_SERVICE_FILE, ', notificationTaskBotHandler]', ']'));
    const found = findingsOf(result, 'NOTIF_TASK_BOT_HANDLER_NOT_REGISTERED');
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('is not reachable');
    expect(found[0].message).toContain('throws at startup');
    expect(result.violations.map((v) => v.code)).not.toContain('NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED');
  });

  it("skips NOTIF_TASK_BOT_HANDLER_NOT_REGISTERED when handlers hold a value the scanner can't follow", () => {
    const result = runWith((p) => {
      replaceInFile(p.api, TASK_SERVICE_FILE, ', notificationTaskBotHandler]', ', ...filterMaybeArrayValues([notificationTaskBotHandler])]');
      replaceInFile(p.api, TASK_SERVICE_FILE, "import { ALL_NOTIFICATION_TASK_BOT_NOTIFICATION_TASK_TYPES } from '@dereekb/firebase';", "import { ALL_NOTIFICATION_TASK_BOT_NOTIFICATION_TASK_TYPES } from '@dereekb/firebase';\nimport { filterMaybeArrayValues } from '@dereekb/util';");
    });
    expect(taskBotCodes(result)).toEqual([]);
  });

  it('reports NOTIF_TASK_BOT_HANDLER_NOT_REGISTERED with the startup throw when the NTBR handler file is gone', () => {
    const result = runWith((p) => {
      removeFile(p.api, HANDLER_FILE);
      replaceInFile(p.api, TASK_SERVICE_FILE, ', notificationTaskBotHandler]', ']');
    });
    const found = findingsOf(result, 'NOTIF_TASK_BOT_HANDLER_NOT_REGISTERED');
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('no `notificationTaskBotRunNotificationTaskHandler(...)` call exists');
    expect(found[0].message).toContain('throws at startup');
  });

  it('reports NOTIF_TASK_BOT_HANDLER_NOT_REGISTERED when there is no task service', () => {
    const result = runWith((p) => removeFile(p.api, TASK_SERVICE_FILE));
    expect(findingsOf(result, 'NOTIF_TASK_BOT_HANDLER_NOT_REGISTERED')[0].message).toContain('no `notificationTaskService(...)` call');
  });

  it('warns NOTIF_TASK_BOT_TASK_TYPES_NOT_IN_VALIDATE when validate drops the NTB task types', () => {
    const result = runWith((p) => replaceInFile(p.api, TASK_SERVICE_FILE, ', ...ALL_NOTIFICATION_TASK_BOT_NOTIFICATION_TASK_TYPES', ''));
    expect(taskBotCodes(result)).toEqual(['NOTIF_TASK_BOT_TASK_TYPES_NOT_IN_VALIDATE']);
    expect(findingsOf(result, 'NOTIF_TASK_BOT_TASK_TYPES_NOT_IN_VALIDATE')[0].severity).toBe('warning');
    expect(result.violations.map((v) => v.code)).not.toContain('NOTIF_TASK_UPSTREAM_TASK_TYPES_NOT_IN_VALIDATE');
  });

  it('skips NOTIF_TASK_BOT_TASK_TYPES_NOT_IN_VALIDATE when validate spreads an aggregate the scanner does not know', () => {
    const result = runWith((p) => {
      replaceInFile(p.api, TASK_SERVICE_FILE, '...ALL_NOTIFICATION_TASK_BOT_NOTIFICATION_TASK_TYPES]', '...SHARED_NOTIFICATION_TASK_TYPES]');
      replaceInFile(p.api, TASK_SERVICE_FILE, "import { ALL_NOTIFICATION_TASK_BOT_NOTIFICATION_TASK_TYPES } from '@dereekb/firebase';", "import { SHARED_NOTIFICATION_TASK_TYPES } from 'some-shared-lib';");
    });
    expect(taskBotCodes(result)).toEqual([]);
  });

  it('does not warn NOTIF_TASK_BOT_TASK_TYPES_NOT_IN_VALIDATE when the NTB aggregate is nested in the app aggregate', () => {
    const result = runWith(nestTaskBotTaskTypes);
    expect(taskBotCodes(result)).toEqual([]);
    expect(extractAppNotifications(inspectionOf(nestTaskBotTaskTypes)).taskServiceCalls[0].nestedUpstreamValidateListings.map((x) => x.identifier)).toEqual(['ALL_NOTIFICATION_TASK_BOT_NOTIFICATION_TASK_TYPES']);
  });

  it('says the service throws at startup when the nested task types lose their handler', () => {
    const result = runWith((p) => {
      nestTaskBotTaskTypes(p);
      replaceInFile(p.api, TASK_SERVICE_FILE, ', notificationTaskBotHandler]', ']');
    });
    const found = findingsOf(result, 'NOTIF_TASK_BOT_HANDLER_NOT_REGISTERED');
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('also throws at startup');
  });

  it('runs the NotificationTaskBot checks when the nested task types are the only bot signal', () => {
    const result = runWith((p) => {
      removeFile(p.component, TASKBOT_FILE);
      removeFile(p.api, HANDLER_FILE);
      removeFile(p.api, ACTION_MODULE_FILE);
      replaceInFile(p.api, TASK_SERVICE_FILE, ', notificationTaskBotHandler]', ']');
      replaceInFile(p.api, TASK_SERVICE_FILE, 'const notificationTaskBotHandler = demoNotificationTaskBotRunNotificationTaskHandler(context);', '');
      nestTaskBotTaskTypes(p);
    });
    expect(taskBotCodes(result)).toEqual(['NOTIF_TASK_BOT_HANDLER_NOT_REGISTERED']);
  });

  it('counts the NTB task types held by a validate aggregate named directly', () => {
    expect(taskBotCodes(runWith(nameValidateAggregateHoldingTaskBotTypes))).toEqual([]);
  });

  it('warns NOTIF_TASK_BOT_TASK_TYPES_NOT_IN_VALIDATE when the validate aggregate named directly leaves them out', () => {
    const result = runWith((p) => replaceInFile(p.api, TASK_SERVICE_FILE, 'validate: [...ALL_NOTIFICATION_TASK_TYPES, ...ALL_NOTIFICATION_TASK_BOT_NOTIFICATION_TASK_TYPES]', 'validate: ALL_NOTIFICATION_TASK_TYPES'));
    expect(taskBotCodes(result)).toEqual(['NOTIF_TASK_BOT_TASK_TYPES_NOT_IN_VALIDATE']);
    expect(result.violations.map((v) => v.code)).not.toContain('NOTIF_TASK_UPSTREAM_TASK_TYPES_NOT_IN_VALIDATE');
    const [found] = findingsOf(result, 'NOTIF_TASK_BOT_TASK_TYPES_NOT_IN_VALIDATE');
    expect(found.message).toContain('its `validate` (`ALL_NOTIFICATION_TASK_TYPES`, src/lib/model/notification/notification.task.ts:9) does not list `...ALL_NOTIFICATION_TASK_BOT_NOTIFICATION_TASK_TYPES`');
    expect(found.message).toContain('or write `validate: [...ALL_NOTIFICATION_TASK_TYPES, ...ALL_NOTIFICATION_TASK_BOT_NOTIFICATION_TASK_TYPES]`');
  });

  it("says the service throws at startup when the named aggregate's NTB task types lose their handler", () => {
    const result = runWith((p) => {
      nameValidateAggregateHoldingTaskBotTypes(p);
      replaceInFile(p.api, TASK_SERVICE_FILE, ', notificationTaskBotHandler]', ']');
    });
    const found = findingsOf(result, 'NOTIF_TASK_BOT_HANDLER_NOT_REGISTERED');
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('also throws at startup');
  });

  it('runs the NotificationTaskBot checks when a validate aggregate named directly is the only bot signal', () => {
    const result = runWith((p) => {
      removeFile(p.component, TASKBOT_FILE);
      removeFile(p.api, HANDLER_FILE);
      removeFile(p.api, ACTION_MODULE_FILE);
      replaceInFile(p.api, TASK_SERVICE_FILE, ', notificationTaskBotHandler]', ']');
      replaceInFile(p.api, TASK_SERVICE_FILE, 'const notificationTaskBotHandler = demoNotificationTaskBotRunNotificationTaskHandler(context);', '');
      nameValidateAggregateHoldingTaskBotTypes(p);
    });
    expect(taskBotCodes(result)).toEqual(['NOTIF_TASK_BOT_HANDLER_NOT_REGISTERED']);
  });

  it('does not warn NOTIF_TASK_BOT_TASK_TYPES_NOT_IN_VALIDATE when the task service has no validate', () => {
    const result = runWith((p) => replaceInFile(p.api, TASK_SERVICE_FILE, 'validate: [...ALL_NOTIFICATION_TASK_TYPES, ...ALL_NOTIFICATION_TASK_BOT_NOTIFICATION_TASK_TYPES], ', ''));
    expect(taskBotCodes(result)).toEqual([]);
  });

  it.each([
    [
      'inline in handlers',
      (p: FixtureParts) =>
        replaceInFile(
          p.api,
          TASK_SERVICE_FILE,
          ', notificationTaskBotHandler]',
          ', notificationTaskBotRunNotificationTaskHandler({ processors: [demoPingNotificationTaskBotScriptProcessor(context), demoPingNotificationTaskBotScriptProcessor(context, DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE)], notificationTaskBotContext: context })]'
        )
    ],
    [
      'a spread of a function returning an array',
      (p: FixtureParts) => {
        replaceInFile(p.api, TASK_SERVICE_FILE, ', notificationTaskBotHandler]', ', ...taskBotHandlers(context)]');
        replaceInFile(p.api, HANDLER_FILE, 'export function demoNotificationTaskBotRunNotificationTaskHandler', 'export function taskBotHandlers(context) {\n  return [demoNotificationTaskBotRunNotificationTaskHandler(context)];\n}\n\nexport function demoNotificationTaskBotRunNotificationTaskHandler');
      }
    ]
  ])('accepts the NTBR handler written %s', (_label, modify) => {
    expect(taskBotCodes(runWith(modify))).toEqual([]);
  });
});

describe('NotificationTaskBot checks — registry ↔ processors', () => {
  it('reports NOTIF_TASK_BOT_SCRIPT_WITHOUT_PROCESSOR when a processor is dropped', () => {
    const result = runWith((p) => replaceInFile(p.api, HANDLER_FILE, ', demoPingNotificationTaskBotScriptProcessor(context, DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE)]', ']'));
    const found = findingsOf(result, 'NOTIF_TASK_BOT_SCRIPT_WITHOUT_PROCESSOR');
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE');
    expect(found[0].message).toContain('registered in `DEMO_FIREBASE_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD` and listed in the handler');
    expect(found[0].severity).toBe('error');
  });

  it('reports NOTIF_TASK_BOT_SCRIPT_WITHOUT_PROCESSOR for a script only listed in the handler validate', () => {
    const result = runWith((p) => replaceInFile(p.api, HANDLER_FILE, 'validate: DEMO_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS.map((x) => x.scriptType)', "validate: [DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_TYPE, DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE, 'demo_extra']"));
    const found = findingsOf(result, 'NOTIF_TASK_BOT_SCRIPT_WITHOUT_PROCESSOR');
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain("'demo_extra'");
    expect(found[0].message).toContain("is listed in the handler's `validate`");
  });

  it('reports NOTIF_TASK_BOT_PROCESSOR_NOT_REGISTERED when a config leaves the registry', () => {
    const result = runWith((p) => replaceInFile(p.component, TASKBOT_FILE, '[DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG, DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG]', '[DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG]'));
    const codes = taskBotCodes(result);
    expect(codes).toEqual(['NOTIF_TASK_BOT_PROCESSOR_NOT_REGISTERED']);
    expect(findingsOf(result, 'NOTIF_TASK_BOT_PROCESSOR_NOT_REGISTERED')[0].message).toContain('DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE');
  });

  it('warns NOTIF_TASK_BOT_SCRIPT_TRACE_UNRESOLVED and skips the processor check for an unresolved target', () => {
    const result = runWith((p) => {
      replaceInFile(p.api, HANDLER_FILE, ', demoPingNotificationTaskBotScriptProcessor(context, DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE)]', ', { target: computeTarget(), flow: [] }]');
    });
    expect(taskBotCodes(result)).toEqual(['NOTIF_TASK_BOT_SCRIPT_TRACE_UNRESOLVED']);
  });

  it('warns NOTIF_TASK_BOT_SCRIPT_TRACE_UNRESOLVED and skips the registration check for an unknown registry entry', () => {
    const result = runWith((p) => replaceInFile(p.component, TASKBOT_FILE, '[DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG, DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG]', '[DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG, UNKNOWN_CONFIG]'));
    const codes = taskBotCodes(result);
    expect(codes).toContain('NOTIF_TASK_BOT_SCRIPT_TRACE_UNRESOLVED');
    expect(codes).not.toContain('NOTIF_TASK_BOT_PROCESSOR_NOT_REGISTERED');
  });

  it('warns NOTIF_TASK_BOT_SCRIPT_TRACE_UNRESOLVED for an unreadable handler validate', () => {
    const result = runWith((p) => replaceInFile(p.api, HANDLER_FILE, 'validate: DEMO_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS.map((x) => x.scriptType)', 'validate: computeTypes()'));
    expect(taskBotCodes(result)).toEqual(['NOTIF_TASK_BOT_SCRIPT_TRACE_UNRESOLVED']);
  });

  it('warns NOTIF_TASK_BOT_PROCESSOR_DUPLICATE_TARGET for a duplicate processor', () => {
    const result = runWith((p) => replaceInFile(p.api, HANDLER_FILE, 'processors: [demoPingNotificationTaskBotScriptProcessor(context), ', 'processors: [demoPingNotificationTaskBotScriptProcessor(context), demoPingNotificationTaskBotScriptProcessor(context), '));
    expect(taskBotCodes(result)).toEqual(['NOTIF_TASK_BOT_PROCESSOR_DUPLICATE_TARGET']);
  });

  it.each([
    [
      'an inline-object processor and a typed-const processor',
      (p: FixtureParts) => {
        replaceInFile(
          p.api,
          HANDLER_FILE,
          'processors: [demoPingNotificationTaskBotScriptProcessor(context), demoPingNotificationTaskBotScriptProcessor(context, DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE)]',
          'processors: [{ target: DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_TYPE, flow: [] }, requiredProcessor]'
        );
        replaceInFile(
          p.api,
          HANDLER_FILE,
          'export function demoNotificationTaskBotRunNotificationTaskHandler',
          'export const requiredProcessor: NotificationTaskBotScriptProcessorConfig = { target: DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE, flow: [] };\n\nexport function demoNotificationTaskBotRunNotificationTaskHandler'
        );
      }
    ],
    ['a target read through a config', (p: FixtureParts) => replaceInFile(p.api, HANDLER_FILE, 'demoPingNotificationTaskBotScriptProcessor(context, DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE)]', '{ target: DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG.scriptType, flow: [] }]')],
    ['validate via getAllKnownScriptTypes()', (p: FixtureParts) => replaceInFile(p.api, HANDLER_FILE, 'validate: DEMO_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS.map((x) => x.scriptType)', 'validate: context.appNotificationTaskBotScriptConfigService.getAllKnownScriptTypes()')],
    ['validate as an array of constants', (p: FixtureParts) => replaceInFile(p.api, HANDLER_FILE, 'validate: DEMO_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS.map((x) => x.scriptType)', 'validate: [DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_TYPE, DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE]')]
  ])('accepts %s', (_label, modify) => {
    expect(taskBotCodes(runWith(modify))).toEqual([]);
  });
});

describe('NotificationTaskBot checks — repair, rules and index', () => {
  it('warns NOTIF_TASK_BOT_REPAIR_NOT_SCHEDULED when the schedule is gone', () => {
    const result = runWith((p) => removeFile(p.api, SCHEDULE_FILE));
    expect(taskBotCodes(result)).toEqual(['NOTIF_TASK_BOT_REPAIR_NOT_SCHEDULED']);
    expect(findingsOf(result, 'NOTIF_TASK_BOT_REPAIR_NOT_SCHEDULED')[0].message).toContain('src/app/function/notification/');
  });

  it.each([
    ['has no ntb match', 'service cloud.firestore {}', 'has no `match /ntb/'],
    ['has only a commented-out ntb match', '// match /ntb/{notificationTaskBot} {}\n/* match /ntb/{id} {} */', 'has no `match /ntb/'],
    ['could not be read', undefined, 'could not be read']
  ])('warns NOTIF_TASK_BOT_FIRESTORE_RULE_MISSING when the rules file %s', (_label, text, messagePart) => {
    const result = runWith((p) => {
      p.workspace = { ...p.workspace, firestoreRules: { path: 'firestore.rules', text } };
    });
    const found = findingsOf(result, 'NOTIF_TASK_BOT_FIRESTORE_RULE_MISSING');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ side: 'both', file: 'firestore.rules', severity: 'warning' });
    expect(found[0].message).toContain(messagePart);
  });

  it('accepts a collection-group ntb match', () => {
    const result = runWith((p) => {
      p.workspace = { ...p.workspace, firestoreRules: { path: 'firestore.rules', text: 'match /{path=**}/ntb/{id} { allow get: if false; }' } };
    });
    expect(taskBotCodes(result)).toEqual([]);
  });

  it('skips the rule and index checks without workspace files', () => {
    const result = runWith((p) => {
      p.workspace = undefined;
    });
    expect(taskBotCodes(result)).toEqual([]);
  });

  it.each([
    ['an exempting ntb.nat override', { fieldOverrides: [{ collectionGroup: 'ntb', fieldPath: 'nat', indexes: [] }] }, ['NOTIF_TASK_BOT_NAT_INDEX_MISSING']],
    ['an ntb.nat override that keeps COLLECTION / ASCENDING', { fieldOverrides: [{ collectionGroup: 'ntb', fieldPath: 'nat', indexes: [{ queryScope: 'COLLECTION', order: 'ASCENDING' }] }] }, []]
  ])('checks the nat index for %s', (_label, indexes, expected) => {
    const result = runWith((p) => {
      p.workspace = { ...p.workspace, firestoreIndexes: { path: 'firestore.indexes.json', text: JSON.stringify(indexes) } };
    });
    expect(taskBotCodes(result)).toEqual(expected);
  });

  it('reports nothing for an invalid indexes file', () => {
    const result = runWith((p) => {
      p.workspace = { ...p.workspace, firestoreIndexes: { path: 'firestore.indexes.json', text: '{ not json' } };
    });
    expect(taskBotCodes(result)).toEqual([]);
  });
});

describe('NotificationTaskBot checks — aliased, namespaced and const-held factories', () => {
  const variants: [string, (parts: FixtureParts) => void][] = [
    ['an aliased factory import', aliasRunHandlerFactory],
    ['a namespace factory call', namespaceRunHandlerFactory],
    ['a factory held in a local const', localConstRunHandlerFactory]
  ];

  it.each(variants)('passes with %s', (_label, modify) => {
    expect(runWith(modify).violations).toEqual([]);
  });

  it.each(variants)('reports NOTIF_TASK_BOT_HANDLER_NOT_REGISTERED when the handler built with %s leaves handlers', (_label, modify) => {
    const result = runWith((p) => {
      modify(p);
      replaceInFile(p.api, TASK_SERVICE_FILE, ', notificationTaskBotHandler]', ']');
    });
    const found = findingsOf(result, 'NOTIF_TASK_BOT_HANDLER_NOT_REGISTERED');
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain(`the NTBR handler built at ${HANDLER_FILE}:`);
  });

  it.each(variants)('checks the processors of the handler built with %s', (_label, modify) => {
    const result = runWith((p) => {
      modify(p);
      replaceInFile(p.api, HANDLER_FILE, ', demoPingNotificationTaskBotScriptProcessor(context, DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE)]', ']');
    });
    const found = findingsOf(result, 'NOTIF_TASK_BOT_SCRIPT_WITHOUT_PROCESSOR');
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE');
  });

  it.each<[string, (parts: FixtureParts) => void]>([
    ['a namespaced script-config record', namespaceScriptConfigRecord],
    [
      'an aliased script-config service',
      (p) => {
        replaceInFile(p.api, ACTION_MODULE_FILE, "import { appNotificationTaskBotScriptConfigService } from '@dereekb/firebase';", "import { appNotificationTaskBotScriptConfigService as scriptConfigService } from '@dereekb/firebase';");
        replaceInFile(p.api, ACTION_MODULE_FILE, 'appNotificationTaskBotScriptConfigService: appNotificationTaskBotScriptConfigService(', 'appNotificationTaskBotScriptConfigService: scriptConfigService(');
      }
    ],
    [
      'an aliased repair factory',
      (p) => {
        replaceInFile(p.api, SCHEDULE_FILE, 'export const notificationHourlyUpdateSchedule', "import { repairAllNotificationTaskBotsFactory as repairBots } from '@dereekb/firebase-server/model';\n\nexport const notificationHourlyUpdateSchedule");
        replaceInFile(p.api, SCHEDULE_FILE, 'await request.nest.notificationActions.repairAllNotificationTaskBots();', 'await repairBots(request.nest.notificationActions)();');
      }
    ],
    [
      'a namespaced record and a namespaced NTBR handler together',
      (p) => {
        namespaceScriptConfigRecord(p);
        namespaceRunHandlerFactory(p);
      }
    ],
    ['a script-config record factory held in a local const', localConstScriptConfigRecord],
    [
      'a script-config service held in a local const',
      (p) => {
        replaceInFile(p.api, ACTION_MODULE_FILE, 'export const demoFirebaseServerActionsContextFactory', 'const scriptConfigService = appNotificationTaskBotScriptConfigService;\n\nexport const demoFirebaseServerActionsContextFactory');
        replaceInFile(p.api, ACTION_MODULE_FILE, 'appNotificationTaskBotScriptConfigService: appNotificationTaskBotScriptConfigService(', 'appNotificationTaskBotScriptConfigService: scriptConfigService(');
      }
    ],
    [
      'a repair factory held in a local const',
      (p) => {
        replaceInFile(p.api, SCHEDULE_FILE, 'export const notificationHourlyUpdateSchedule', "import { repairAllNotificationTaskBotsFactory } from '@dereekb/firebase-server/model';\n\nconst repairBots = repairAllNotificationTaskBotsFactory;\n\nexport const notificationHourlyUpdateSchedule");
        replaceInFile(p.api, SCHEDULE_FILE, 'await request.nest.notificationActions.repairAllNotificationTaskBots();', 'await repairBots(request.nest.notificationActions)();');
      }
    ],
    [
      'a const-held record and a const-held NTBR handler together',
      (p) => {
        localConstScriptConfigRecord(p);
        localConstRunHandlerFactory(p);
      }
    ],
    ['an aliased task service', aliasTaskService],
    ['a namespaced task service', namespaceTaskService]
  ])('accepts %s', (_label, modify) => {
    expect(taskBotCodes(runWith(modify))).toEqual([]);
  });

  // The validate-level cases alone don't prove the pairing: an unpaired call still gets its processors checked.
  it("pairs the trace's const-held NTBR call with the run handler scan", () => {
    const { reachable } = selectTaskBotRunHandlerCalls(extractAppNotifications(inspectionOf(localConstRunHandlerFactory)));
    expect(reachable).toHaveLength(1);
    expect(reachable[0]).toEqual(expect.objectContaining({ sourceFile: HANDLER_FILE, processorsResolved: true }));
    expect(reachable[0].processors).toHaveLength(2);
  });

  it.each<[string, (parts: FixtureParts) => void]>([
    ['an aliased task service', aliasTaskService],
    ['a namespaced task service', namespaceTaskService]
  ])('reports the unreachable NTBR handler, not a missing task service, for %s', (_label, modify) => {
    const result = runWith((p) => {
      modify(p);
      replaceInFile(p.api, TASK_SERVICE_FILE, ', notificationTaskBotHandler]', ']');
    });
    const found = findingsOf(result, 'NOTIF_TASK_BOT_HANDLER_NOT_REGISTERED');
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain(`the NTBR handler built at ${HANDLER_FILE}:`);
    expect(found[0].message).not.toContain('no `notificationTaskService(...)` call was found');
  });
});

// MARK: Aliased and namespaced type annotations
const SCRIPT_NAMES = ['DEMO_PING', 'DEMO_PING_REQUIRED'];

/**
 * Rewrites the script type, script config and config array annotations of the component taskbot file.
 *
 * @param parts - The fixture parts.
 * @param names - The replacements.
 * @param names.scriptType - The `NotificationTaskBotScriptType` replacement.
 * @param names.scriptConfig - The `NotificationTaskBotScriptConfig` replacement.
 * @param names.scriptConfigArray - The `NotificationTaskBotScriptConfig[]` replacement.
 */
function rewriteScriptAnnotations(parts: FixtureParts, names: { readonly scriptType: string; readonly scriptConfig: string; readonly scriptConfigArray: string }): void {
  for (const name of SCRIPT_NAMES) {
    replaceInFile(parts.component, TASKBOT_FILE, `${name}_NOTIFICATION_TASK_BOT_SCRIPT_TYPE: NotificationTaskBotScriptType =`, `${name}_NOTIFICATION_TASK_BOT_SCRIPT_TYPE: ${names.scriptType} =`);
    replaceInFile(parts.component, TASKBOT_FILE, `${name}_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG: NotificationTaskBotScriptConfig =`, `${name}_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG: ${names.scriptConfig} =`);
  }
  replaceInFile(parts.component, TASKBOT_FILE, ': NotificationTaskBotScriptConfig[] =', `: ${names.scriptConfigArray} =`);
}

function aliasScriptAnnotations(parts: FixtureParts): void {
  replaceInFile(parts.component, TASKBOT_FILE, 'type NotificationTaskBotScriptConfig, type NotificationTaskBotScriptType,', 'type NotificationTaskBotScriptConfig as ScriptConfig, type NotificationTaskBotScriptType as ScriptType,');
  rewriteScriptAnnotations(parts, { scriptType: 'ScriptType', scriptConfig: 'ScriptConfig', scriptConfigArray: 'ScriptConfig[]' });
}

function namespaceScriptAnnotations(parts: FixtureParts): void {
  replaceInFile(parts.component, TASKBOT_FILE, 'import { type NotificationTaskBotScriptConfig, type NotificationTaskBotScriptType, notificationTaskBotScriptConfigRecord }', "import type * as firebaseModel from '@dereekb/firebase';\nimport { notificationTaskBotScriptConfigRecord }");
  rewriteScriptAnnotations(parts, { scriptType: 'firebaseModel.NotificationTaskBotScriptType', scriptConfig: 'firebaseModel.NotificationTaskBotScriptConfig', scriptConfigArray: 'ReadonlyArray<firebaseModel.NotificationTaskBotScriptConfig>' });
}

function aliasScriptGroupInAnotherFile(parts: FixtureParts): void {
  parts.component.push({ relPath: 'src/lib/model/notification/notification.taskbot.group.ts', text: "import { type NotificationTaskBotScriptGroup as ScriptGroup } from '@dereekb/firebase';\n\nexport const DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_GROUP: ScriptGroup = { key: 'demo_pings', name: 'Demo pings' };\n" });
  replaceInFile(parts.component, TASKBOT_FILE, "notificationTaskBotScriptConfigRecord } from '@dereekb/firebase';", "notificationTaskBotScriptConfigRecord } from '@dereekb/firebase';\nimport { DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_GROUP } from './notification.taskbot.group';");
  replaceInFile(parts.component, TASKBOT_FILE, "  name: 'Demo Ping',", "  name: 'Demo Ping',\n  group: DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_GROUP,\n  allowOwnerOptOut: true,");
}

describe('NotificationTaskBot checks — aliased and namespaced type annotations', () => {
  const variants: readonly (readonly [string, (parts: FixtureParts) => void])[] = [
    ['aliased script annotations', aliasScriptAnnotations],
    ['namespaced script annotations', namespaceScriptAnnotations]
  ];

  it.each(variants)('passes with %s', (_label, modify) => {
    expect(runWith(modify).violations).toEqual([]);
    const { taskBot } = extractAppNotifications(inspectionOf(modify));
    expect(taskBot.scriptTypeConstants.map((x) => x.symbolName)).toEqual(['DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_TYPE', 'DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE']);
    expect(taskBot.scriptConfigs.map((x) => x.scriptType?.code)).toEqual(['demo_ping', 'demo_ping_required']);
    expect(taskBot.registries[0].unresolvedReferences).toEqual([]);
  });

  it.each(variants)('checks the processors against the configs typed with %s', (_label, modify) => {
    const result = runWith((parts) => {
      modify(parts);
      replaceInFile(parts.api, HANDLER_FILE, ', demoPingNotificationTaskBotScriptProcessor(context, DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE)]', ']');
    });
    expect(taskBotCodes(result)).toEqual(['NOTIF_TASK_BOT_SCRIPT_WITHOUT_PROCESSOR']);
    expect(findingsOf(result, 'NOTIF_TASK_BOT_SCRIPT_WITHOUT_PROCESSOR')[0].message).toContain('DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE');
  });

  it('reads the group key of a group typed through an alias in another file', () => {
    expect(runWith(aliasScriptGroupInAnotherFile).violations).toEqual([]);
    const config = extractAppNotifications(inspectionOf(aliasScriptGroupInAnotherFile)).taskBot.scriptConfigs.find((x) => x.symbolName === 'DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG');
    expect(config?.groupKey).toBe('demo_pings');
  });

  it('does not resolve a script-config alias from a module outside @dereekb/*', () => {
    const modify = (parts: FixtureParts) => {
      replaceInFile(parts.component, TASKBOT_FILE, 'type NotificationTaskBotScriptConfig, type NotificationTaskBotScriptType,', 'type NotificationTaskBotScriptType,');
      replaceInFile(parts.component, TASKBOT_FILE, "notificationTaskBotScriptConfigRecord } from '@dereekb/firebase';", "notificationTaskBotScriptConfigRecord } from '@dereekb/firebase';\nimport { type NotificationTaskBotScriptConfig as ScriptConfig } from 'some-app-lib';");
      rewriteScriptAnnotations(parts, { scriptType: 'NotificationTaskBotScriptType', scriptConfig: 'ScriptConfig', scriptConfigArray: 'ScriptConfig[]' });
    };
    expect(extractAppNotifications(inspectionOf(modify)).taskBot.scriptConfigs).toEqual([]);
  });
});

describe('NotificationTaskBot checks — handlers reached twice', () => {
  it('reports NOTIF_TASK_BOT_HANDLER_NOT_REGISTERED when handlers reach a local twice and leave the handler out', () => {
    const result = runWith((p) => {
      replaceInFile(p.api, TASK_SERVICE_FILE, 'const notificationTaskBotHandler = demoNotificationTaskBotRunNotificationTaskHandler(context);', 'const exampleHandlerAlias = exampleNotificationTaskHandler;');
      replaceInFile(p.api, TASK_SERVICE_FILE, '[exampleNotificationTaskHandler, notificationTaskBotHandler]', '[exampleNotificationTaskHandler, exampleHandlerAlias]');
    });
    expect(taskBotCodes(result)).toEqual(['NOTIF_TASK_BOT_HANDLER_NOT_REGISTERED']);
  });
});

describe('NotificationTaskBot checks — handlers the trace sees through', () => {
  it('reports NOTIF_TASK_BOT_HANDLER_NOT_REGISTERED when the handler leaves handlers that hold a non-null element', () => {
    const result = runWith((p) => replaceInFile(p.api, TASK_SERVICE_FILE, '[exampleNotificationTaskHandler, notificationTaskBotHandler]', '[exampleNotificationTaskHandler!]'));
    expect(taskBotCodes(result)).toEqual(['NOTIF_TASK_BOT_HANDLER_NOT_REGISTERED']);
  });
});
