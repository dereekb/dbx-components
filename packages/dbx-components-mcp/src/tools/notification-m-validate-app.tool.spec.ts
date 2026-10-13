/**
 * Runs `dbx_notification_m_validate_app` against the real demo pair (`components/demo-firebase` + `apps/demo-api`)
 * and the workspace's `firestore.rules` / `firestore.indexes.json`, then checks that targeted mutations of the demo's
 * NotificationTaskBot wiring each raise their `NOTIF_TASK_BOT_*` code, and that a scaffolded bot script round-trips
 * through the checks once its wiring is applied. It also covers the upstream StorageFile and FormSpace handler checks
 * (`NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED` and `NOTIF_TASK_UPSTREAM_TASK_TYPES_NOT_IN_VALIDATE`) against the demo's
 * task service, with the upstream task types listed directly in `validate`, moved into `ALL_NOTIFICATION_TASK_TYPES`, or
 * moved there with `validate` naming that aggregate directly.
 *
 * The mutation helper throws when the text it replaces is gone, so a refactor of the demo's bot wiring fails here
 * loudly instead of silently passing.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { notificationListApp, notificationValidateApp } from '@dereekb/dbx-cli/validate';
import { applyIdempotency, scaffoldArtifact } from './artifact-scaffold/index.js';
import { notificationMValidateAppTool } from './notification-m-validate-app.tool.js';

type Inspection = Awaited<ReturnType<typeof notificationValidateApp.inspectAppNotifications>>;
type InspectedFile = Inspection['api']['files'][number];

const WORKSPACE_ROOT = resolve(fileURLToPath(import.meta.url), '../../../../..');
const COMPONENT_DIR = 'components/demo-firebase';
const API_DIR = 'apps/demo-api';

const TASKBOT_FILE = 'src/lib/model/notification/notification.taskbot.ts';
const HANDLER_FILE = 'src/app/common/model/notification/handlers/taskbot/task.handler.taskbot.ts';
const TASK_SERVICE_FILE = 'src/app/common/model/notification/notification.task.service.ts';
const ACTION_MODULE_FILE = 'src/app/common/firebase/action.module.ts';
const SCHEDULE_FILE = 'src/app/function/notification/notification.schedule.ts';
const COMPONENT_TASK_FILE = 'src/lib/model/notification/notification.task.ts';

interface MutableInspection {
  component: InspectedFile[];
  api: InspectedFile[];
  rules: string | undefined;
  indexes: string | undefined;
}

let base: Inspection;
let originalCwd: string;

beforeAll(async () => {
  originalCwd = process.cwd();
  process.chdir(WORKSPACE_ROOT);
  base = await notificationValidateApp.inspectAppNotifications(resolve(WORKSPACE_ROOT, COMPONENT_DIR), resolve(WORKSPACE_ROOT, API_DIR), {
    firestoreRulesPath: resolve(WORKSPACE_ROOT, 'firestore.rules'),
    firestoreIndexesPath: resolve(WORKSPACE_ROOT, 'firestore.indexes.json'),
    workspaceDir: WORKSPACE_ROOT
  });
});

afterAll(() => {
  process.chdir(originalCwd);
});

function replaceIn(files: InspectedFile[], relPath: string, from: string, to: string): void {
  const i = files.findIndex((f) => f.relPath === relPath);
  if (i < 0 || !files[i].text.includes(from)) {
    throw new Error(`The demo no longer contains \`${from}\` in ${relPath}; update this spec's mutation.`);
  }
  files[i] = { ...files[i], text: files[i].text.replace(from, to) };
}

function removeFrom(files: InspectedFile[], relPath: string): void {
  const i = files.findIndex((f) => f.relPath === relPath);
  if (i < 0) {
    throw new Error(`The demo no longer has ${relPath}; update this spec's mutation.`);
  }
  files.splice(i, 1);
}

function inspectionWith(modify?: (m: MutableInspection) => void): Inspection {
  const m: MutableInspection = { component: [...base.component.files], api: [...base.api.files], rules: base.workspace?.firestoreRules?.text, indexes: base.workspace?.firestoreIndexes?.text };
  modify?.(m);
  const inspection: Inspection = {
    component: { ...base.component, files: m.component },
    api: { ...base.api, files: m.api },
    workspace: { firestoreRules: { path: 'firestore.rules', text: m.rules }, firestoreIndexes: { path: 'firestore.indexes.json', text: m.indexes } }
  };
  return inspection;
}

function validateWith(modify?: (m: MutableInspection) => void) {
  return notificationValidateApp.validateAppNotifications(inspectionWith(modify), { componentDir: COMPONENT_DIR, apiDir: API_DIR });
}

function taskBotFindings(result: ReturnType<typeof validateWith>) {
  return result.violations.filter((v) => v.code.startsWith('NOTIF_TASK_BOT_'));
}

function upstreamFindings(result: ReturnType<typeof validateWith>) {
  return result.violations.filter((v) => v.code.startsWith('NOTIF_TASK_UPSTREAM_'));
}

describe('dbx_notification_m_validate_app — demo pair', () => {
  it('passes the demo with no NotificationTaskBot findings, reading the workspace rules and indexes by default', async () => {
    const result = await notificationMValidateAppTool.run({ componentDir: COMPONENT_DIR, apiDir: API_DIR });
    const text = result.content.map((c) => ('text' in c ? c.text : '')).join('\n');
    expect(result.isError).toBe(false);
    expect(text).toContain('PASS');
    expect(text).not.toContain('NOTIF_TASK_BOT_');
    expect(base.workspace?.firestoreRules?.text).toBeDefined();
    expect(taskBotFindings(validateWith())).toEqual([]);
    expect(upstreamFindings(validateWith())).toEqual([]);
  });

  it('rejects a rulesFile that escapes the cwd', async () => {
    const result = await notificationMValidateAppTool.run({ componentDir: COMPONENT_DIR, apiDir: API_DIR, rulesFile: '../outside/firestore.rules' });
    expect(result.isError).toBe(true);
  });

  it.each<[string, (m: MutableInspection) => void, string, string | undefined]>([
    ['the schedule file is gone', (m) => removeFrom(m.api, SCHEDULE_FILE), 'NOTIF_TASK_BOT_REPAIR_NOT_SCHEDULED', undefined],
    ['the handler leaves handlers', (m) => replaceIn(m.api, TASK_SERVICE_FILE, ', notificationTaskBotHandler]', ']'), 'NOTIF_TASK_BOT_HANDLER_NOT_REGISTERED', undefined],
    ['validate drops the NTB task types', (m) => replaceIn(m.api, TASK_SERVICE_FILE, ', ...ALL_NOTIFICATION_TASK_BOT_NOTIFICATION_TASK_TYPES', ''), 'NOTIF_TASK_BOT_TASK_TYPES_NOT_IN_VALIDATE', undefined],
    [
      'the required ping processor is dropped',
      (m) => replaceIn(m.api, HANDLER_FILE, ', demoPingNotificationTaskBotScriptProcessor(demoFirebaseServerActionsContext, DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE)', ''),
      'NOTIF_TASK_BOT_SCRIPT_WITHOUT_PROCESSOR',
      'DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE'
    ],
    [
      'the required ping config leaves the registry',
      (m) => replaceIn(m.component, TASKBOT_FILE, '[DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG, DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG]', '[DEMO_PING_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG]'),
      'NOTIF_TASK_BOT_PROCESSOR_NOT_REGISTERED',
      'DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE'
    ],
    ['the registry wiring has no argument', (m) => replaceIn(m.api, ACTION_MODULE_FILE, 'appNotificationTaskBotScriptConfigService(DEMO_FIREBASE_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD)', 'appNotificationTaskBotScriptConfigService()'), 'NOTIF_TASK_BOT_REGISTRY_NOT_WIRED', undefined],
    [
      'the ntb rule is renamed',
      (m) => {
        if (!m.rules?.includes('match /ntb/{notificationTaskBot}')) throw new Error('The workspace rules no longer contain the ntb match; update this spec.');
        m.rules = m.rules.replace('match /ntb/{notificationTaskBot}', 'match /ntbx/{notificationTaskBot}');
      },
      'NOTIF_TASK_BOT_FIRESTORE_RULE_MISSING',
      undefined
    ],
    [
      'ntb.nat is exempted from its index',
      (m) => {
        const parsed = JSON.parse(m.indexes ?? '{}') as { fieldOverrides?: unknown[] };
        m.indexes = JSON.stringify({ ...parsed, fieldOverrides: [...(parsed.fieldOverrides ?? []), { collectionGroup: 'ntb', fieldPath: 'nat', indexes: [] }] });
      },
      'NOTIF_TASK_BOT_NAT_INDEX_MISSING',
      undefined
    ]
  ])('reports when %s', (_label, modify, code, messagePart) => {
    const found = taskBotFindings(validateWith(modify)).filter((v) => v.code === code);
    expect(found.length).toBeGreaterThan(0);
    if (messagePart) {
      expect(found[0].message).toContain(messagePart);
    }
  });
});

describe('dbx_notification_m_validate_app — demo pair upstream task handlers', () => {
  it.each<[string, string, readonly string[]]>([
    ['the StorageFile handler', ', storageFileHandler, ', ['ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES', '`demoStorageFileProcessingNotificationTaskHandler` builds', 'notification.task.service.ts:']],
    ['the FormSpace handler', ', formSpaceHandler, ', ['ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES', 'demoFormSpaceSubmissionNotificationTaskHandler', 'handlers/formspace/task.handler.formspace.submission.ts:']]
  ])('reports NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED when %s leaves handlers', (_label, from, messageParts) => {
    const found = upstreamFindings(validateWith((m) => replaceIn(m.api, TASK_SERVICE_FILE, from, ', ')));
    expect(found).toHaveLength(1);
    expect(found[0].code).toBe('NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED');
    for (const part of messageParts) {
      expect(found[0].message).toContain(part);
    }
  });

  it('reports the NTBR handler only as NOTIF_TASK_BOT_HANDLER_NOT_REGISTERED', () => {
    const result = validateWith((m) => replaceIn(m.api, TASK_SERVICE_FILE, ', notificationTaskBotHandler]', ']'));
    expect(result.violations.map((v) => v.code)).toContain('NOTIF_TASK_BOT_HANDLER_NOT_REGISTERED');
    expect(upstreamFindings(result)).toEqual([]);
  });

  it.each<[string, string, readonly string[]]>([
    ['the StorageFile aggregate', ', ...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES', ['`...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES`', '`SFP`', '`storageFileProcessingNotificationTaskHandler(...)`', 'notification.task.service.ts:']],
    ['the FormSpace aggregate', ', ...ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES', ['`...ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES`', '`FSPS`', '`formSpaceSubmissionNotificationTaskHandler(...)`', 'handlers/formspace/task.handler.formspace.submission.ts:']]
  ])('warns NOTIF_TASK_UPSTREAM_TASK_TYPES_NOT_IN_VALIDATE when validate drops %s', (_label, from, messageParts) => {
    const found = upstreamFindings(validateWith((m) => replaceIn(m.api, TASK_SERVICE_FILE, from, '')));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ code: 'NOTIF_TASK_UPSTREAM_TASK_TYPES_NOT_IN_VALIDATE', severity: 'warning', file: TASK_SERVICE_FILE });
    for (const part of messageParts) {
      expect(found[0].message).toContain(part);
    }
  });

  it('reports the NTB task types only as NOTIF_TASK_BOT_TASK_TYPES_NOT_IN_VALIDATE', () => {
    const result = validateWith((m) => replaceIn(m.api, TASK_SERVICE_FILE, ', ...ALL_NOTIFICATION_TASK_BOT_NOTIFICATION_TASK_TYPES', ''));
    expect(result.violations.map((v) => v.code)).toContain('NOTIF_TASK_BOT_TASK_TYPES_NOT_IN_VALIDATE');
    expect(upstreamFindings(result)).toEqual([]);
  });
});

describe('dbx_notification_m_validate_app — demo pair upstream task types nested in ALL_NOTIFICATION_TASK_TYPES', () => {
  const DEMO_TASK_AGGREGATE = 'export const ALL_NOTIFICATION_TASK_TYPES: NotificationTaskType[] = [EXAMPLE_NOTIFICATION_TASK_TYPE, EXAMPLE_UNIQUE_NOTIFICATION_TASK_TYPE, EXAMPLE_HANDLED_NOTIFICATION_TASK_TYPE];';
  const DEMO_VALIDATE = 'validate: [...ALL_NOTIFICATION_TASK_TYPES, ...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES, ...ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES, ...ALL_NOTIFICATION_TASK_BOT_NOTIFICATION_TASK_TYPES]';
  const UPSTREAM_AGGREGATES = ['ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES', 'ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES', 'ALL_NOTIFICATION_TASK_BOT_NOTIFICATION_TASK_TYPES'];

  // Moves the upstream spreads from the demo's `validate` into its `ALL_NOTIFICATION_TASK_TYPES`.
  function nestDemoUpstreamTaskTypes(m: MutableInspection, aggregates: readonly string[] = UPSTREAM_AGGREGATES): void {
    replaceIn(m.component, COMPONENT_TASK_FILE, 'import { type CreateNotificationTaskTemplate,', `import { ${aggregates.join(', ')}, type CreateNotificationTaskTemplate,`);
    replaceIn(m.component, COMPONENT_TASK_FILE, DEMO_TASK_AGGREGATE, DEMO_TASK_AGGREGATE.replace('];', `, ${aggregates.map((x) => `...${x}`).join(', ')}];`));
    replaceIn(m.api, TASK_SERVICE_FILE, DEMO_VALIDATE, 'validate: [...ALL_NOTIFICATION_TASK_TYPES]');
  }

  // Names `ALL_NOTIFICATION_TASK_TYPES` as the demo's `validate` (after `nestDemoUpstreamTaskTypes` has reduced it to `[...ALL_NOTIFICATION_TASK_TYPES]`).
  function nameDemoValidateAggregate(m: MutableInspection): void {
    replaceIn(m.api, TASK_SERVICE_FILE, 'validate: [...ALL_NOTIFICATION_TASK_TYPES]', 'validate: ALL_NOTIFICATION_TASK_TYPES');
  }

  it('accepts the demo with its upstream task types nested in ALL_NOTIFICATION_TASK_TYPES', () => {
    const result = validateWith((m) => nestDemoUpstreamTaskTypes(m));
    expect(upstreamFindings(result)).toEqual([]);
    expect(taskBotFindings(result)).toEqual([]);
    expect(result.errorCount).toBe(0);
  });

  it('reports NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED for the nested StorageFile aggregate when its handler leaves handlers', () => {
    const found = upstreamFindings(
      validateWith((m) => {
        nestDemoUpstreamTaskTypes(m);
        replaceIn(m.api, TASK_SERVICE_FILE, ', storageFileHandler, ', ', ');
      })
    );
    expect(found).toHaveLength(1);
    expect(found[0].code).toBe('NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED');
    expect(found[0].message).toContain('through `...ALL_NOTIFICATION_TASK_TYPES`');
    expect(found[0].message).toContain(`${COMPONENT_TASK_FILE}:`);
    expect(found[0].message).toContain('`demoStorageFileProcessingNotificationTaskHandler` builds');
  });

  it('warns NOTIF_TASK_UPSTREAM_TASK_TYPES_NOT_IN_VALIDATE when the nested aggregates leave out FormSpace', () => {
    const found = upstreamFindings(validateWith((m) => nestDemoUpstreamTaskTypes(m, ['ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES', 'ALL_NOTIFICATION_TASK_BOT_NOTIFICATION_TASK_TYPES'])));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ code: 'NOTIF_TASK_UPSTREAM_TASK_TYPES_NOT_IN_VALIDATE', severity: 'warning' });
    expect(found[0].message).toContain('`...ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES`');
  });

  it('accepts the demo with validate: ALL_NOTIFICATION_TASK_TYPES holding its upstream task types', () => {
    const result = validateWith((m) => {
      nestDemoUpstreamTaskTypes(m);
      nameDemoValidateAggregate(m);
    });
    expect(upstreamFindings(result)).toEqual([]);
    expect(taskBotFindings(result)).toEqual([]);
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(validateWith().warningCount);
  });

  it('reports NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED through validate: ALL_NOTIFICATION_TASK_TYPES when the StorageFile handler leaves handlers', () => {
    const found = upstreamFindings(
      validateWith((m) => {
        nestDemoUpstreamTaskTypes(m);
        nameDemoValidateAggregate(m);
        replaceIn(m.api, TASK_SERVICE_FILE, ', storageFileHandler, ', ', ');
      })
    );
    expect(found).toHaveLength(1);
    expect(found[0].code).toBe('NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED');
    expect(found[0].message).toContain('through `ALL_NOTIFICATION_TASK_TYPES` (');
    expect(found[0].message).toContain(`${COMPONENT_TASK_FILE}:`);
    expect(found[0].message).not.toContain('`...ALL_NOTIFICATION_TASK_TYPES`');
  });

  it('warns for the upstream task types validate: ALL_NOTIFICATION_TASK_TYPES leaves out', () => {
    const result = validateWith((m) => replaceIn(m.api, TASK_SERVICE_FILE, DEMO_VALIDATE, 'validate: ALL_NOTIFICATION_TASK_TYPES'));
    expect(upstreamFindings(result).map((v) => v.code)).toEqual(['NOTIF_TASK_UPSTREAM_TASK_TYPES_NOT_IN_VALIDATE', 'NOTIF_TASK_UPSTREAM_TASK_TYPES_NOT_IN_VALIDATE']);
    expect(taskBotFindings(result).map((v) => v.code)).toEqual(['NOTIF_TASK_BOT_TASK_TYPES_NOT_IN_VALIDATE']);
    expect(result.errorCount).toBe(0);
  });
});

// MARK: Demo task types two component aggregates below validate
const WRAPPER_FILE = 'src/lib/model/notification/notification.task.all.ts';
const DEMO_VALIDATE_HEAD = 'validate: [...ALL_NOTIFICATION_TASK_TYPES,';

interface DemoWrapperExtra {
  readonly declarations: string;
  readonly elements: string;
}

// Wraps the demo's ALL_NOTIFICATION_TASK_TYPES in ALL_DEMO_NOTIFICATION_TASK_TYPES (plus `extra.elements`) and points
// `validate` at the wrapper, so every demo task type sits two component aggregates below `validate`.
function wrapDemoTaskTypes(m: MutableInspection, extra: DemoWrapperExtra = { declarations: '', elements: '' }): void {
  m.component.push({
    relPath: WRAPPER_FILE,
    text: `import { type NotificationTaskType } from '@dereekb/firebase';\nimport { ALL_NOTIFICATION_TASK_TYPES } from './notification.task';\n${extra.declarations}\nexport const ALL_DEMO_NOTIFICATION_TASK_TYPES: NotificationTaskType[] = [...ALL_NOTIFICATION_TASK_TYPES${extra.elements}];\n`
  });
  replaceIn(m.api, TASK_SERVICE_FILE, DEMO_VALIDATE_HEAD, 'validate: [...ALL_DEMO_NOTIFICATION_TASK_TYPES,');
}

describe('dbx_notification_m_validate_app — demo pair task types two component aggregates below validate', () => {
  it('accepts the demo with ALL_NOTIFICATION_TASK_TYPES wrapped in another component aggregate, and lists every task as in validate', () => {
    expect(validateWith((m) => wrapDemoTaskTypes(m)).violations).toEqual(validateWith().violations);
    const report = notificationListApp.listAppNotifications(
      inspectionWith((m) => wrapDemoTaskTypes(m)),
      { componentDir: COMPONENT_DIR, apiDir: API_DIR }
    );
    expect(report.tasks.length).toBeGreaterThan(0);
    expect(report.tasks.filter((t) => !t.inValidateList).map((t) => t.symbolName)).toEqual([]);
  });

  it('reports NOTIF_TASK_IN_VALIDATE_WITHOUT_HANDLER for a task type two aggregates deep that no handler declares', () => {
    const baseline = new Set(validateWith().violations.map((v) => v.message));
    const extra: DemoWrapperExtra = {
      declarations: "const DEMO_UNHANDLED_NOTIFICATION_TASK_TYPE = 'DU';\nexport const ALL_DEMO_EXTRA_NOTIFICATION_TASK_TYPES: NotificationTaskType[] = [DEMO_UNHANDLED_NOTIFICATION_TASK_TYPE];\n",
      elements: ', ...ALL_DEMO_EXTRA_NOTIFICATION_TASK_TYPES'
    };
    const added = validateWith((m) => wrapDemoTaskTypes(m, extra)).violations.filter((v) => !baseline.has(v.message));
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ code: 'NOTIF_TASK_IN_VALIDATE_WITHOUT_HANDLER', severity: 'error', file: TASK_SERVICE_FILE });
    expect(added[0].message).toContain('`DEMO_UNHANDLED_NOTIFICATION_TASK_TYPE`');
  });
});

describe('dbx_artifact_scaffold notification-task-bot-script — round trip through the demo', () => {
  async function scaffoldFollowUp() {
    const raw = scaffoldArtifact({ artifact: 'notification-task-bot-script', name: 'followUp', componentDir: COMPONENT_DIR, apiDir: API_DIR });
    return { raw, applied: await applyIdempotency(raw, (path) => existsSync(resolve(WORKSPACE_ROOT, path))) };
  }

  it('skips the existing registry and handler, and keeps only the extend steps', async () => {
    const { raw, applied } = await scaffoldFollowUp();
    expect(applied.files.map((f) => f.status)).toEqual(['new', 'exists-skipped', 'new', 'exists-skipped']);
    expect(applied.wiring.map((step) => raw.wiring.indexOf(step) + 1)).toEqual([1, 3, 4, 9]);
  });

  async function validateScaffolded(applyW4: boolean) {
    const { applied } = await scaffoldFollowUp();
    const [scriptFile, , processorFile] = applied.files;
    return validateWith((m) => {
      m.component.push({ relPath: scriptFile.path.slice(`${COMPONENT_DIR}/`.length), text: scriptFile.content });
      m.api.push({ relPath: processorFile.path.slice(`${API_DIR}/`.length), text: processorFile.content });
      // W3: add the config to the registry's configs
      replaceIn(m.component, TASKBOT_FILE, 'DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG];', 'DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG, FOLLOW_UP_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG];');
      if (applyW4) {
        // W4: add the processor to the NTBR handler
        replaceIn(m.api, HANDLER_FILE, 'DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE)]', 'DEMO_PING_REQUIRED_NOTIFICATION_TASK_BOT_SCRIPT_TYPE), demoFollowUpNotificationTaskBotScriptProcessor(demoFirebaseServerActionsContext)]');
      }
    });
  }

  it('passes the NotificationTaskBot checks once the wiring is applied', async () => {
    expect(taskBotFindings(await validateScaffolded(true))).toEqual([]);
  });

  it('reports the missing processor when the handler step is skipped', async () => {
    const found = taskBotFindings(await validateScaffolded(false));
    expect(found.map((v) => v.code)).toEqual(['NOTIF_TASK_BOT_SCRIPT_WITHOUT_PROCESSOR']);
    expect(found[0].message).toContain('FOLLOW_UP_NOTIFICATION_TASK_BOT_SCRIPT_TYPE');
  });
});
