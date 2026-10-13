import { describe, expect, it } from 'vitest';
import { isHandlersTraceComplete } from './extract.upstream.js';
import { extractAppNotifications, validateAppNotifications } from './index.js';
import type { AppNotificationsInspection, InspectedFile, ValidationResult, ViolationCode } from './types.js';

// MARK: Fixture — a demo-shaped app with the StorageFile and FormSpace upstream task handlers
const COMPONENT_TASK = `import { type NotificationTaskType } from '@dereekb/firebase';

export const EXAMPLE_NOTIFICATION_TASK_TYPE: NotificationTaskType = 'E';

export interface ExampleNotificationTaskData {
  readonly uid: string;
}

export const ALL_NOTIFICATION_TASK_TYPES: NotificationTaskType[] = [EXAMPLE_NOTIFICATION_TASK_TYPE];
`;

const API_TASK_SERVICE = `import { ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES, ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES } from '@dereekb/firebase';
import { type NotificationTaskService, type NotificationTaskServiceTaskHandlerConfig, notificationTaskService } from '@dereekb/firebase-server/model';
import { ALL_NOTIFICATION_TASK_TYPES, EXAMPLE_NOTIFICATION_TASK_TYPE, type ExampleNotificationTaskData } from 'demo-firebase';
import { demoStorageFileProcessingNotificationTaskHandler } from './handlers/task.handler.storagefile';
import { demoFormSpaceSubmissionNotificationTaskHandler } from './handlers/formspace/task.handler.formspace.submission';

export function demoNotificationTaskServiceFactory(context): NotificationTaskService {
  const exampleNotificationTaskHandler: NotificationTaskServiceTaskHandlerConfig<ExampleNotificationTaskData> = {
    type: EXAMPLE_NOTIFICATION_TASK_TYPE,
    flow: [{ fn: async () => null }]
  };
  const storageFileHandler = demoStorageFileProcessingNotificationTaskHandler(context);
  const formSpaceHandler = demoFormSpaceSubmissionNotificationTaskHandler(context);
  const handlers: NotificationTaskServiceTaskHandlerConfig<any>[] = [exampleNotificationTaskHandler, storageFileHandler, formSpaceHandler];
  return notificationTaskService({ validate: [...ALL_NOTIFICATION_TASK_TYPES, ...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES, ...ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES], handlers });
}
`;

const SF_WRAPPER = `export function demoStorageFileProcessingNotificationTaskHandler(context) {
  const processors = [];
  return storageFileProcessingNotificationTaskHandler({ processors, storageFileFirestoreCollections: context, storageAccessor: context.storageService });
}`;

const SF_FACTORY_IMPORT = "import { storageFileProcessingNotificationTaskHandler } from '@dereekb/firebase-server/model';";
const SF_FACTORY_RETURN = 'return storageFileProcessingNotificationTaskHandler(';
const SF_INLINE_CONFIG = '{ processors: [], storageFileFirestoreCollections: context, storageAccessor: context.storageService }';

const API_SF_HANDLER = `${SF_FACTORY_IMPORT}

${SF_WRAPPER}
`;

const API_FS_HANDLER = `import { formSpaceSubmissionNotificationTaskHandler } from '@dereekb/firebase-server/model';

export function demoFormSpaceSubmissionNotificationTaskHandler(context) {
  return formSpaceSubmissionNotificationTaskHandler({ processors: [], validate: [], formSpaceFirestoreCollections: context });
}
`;

// A second component aggregate that holds the StorageFile aggregate (on line 3), for two-level nesting.
const COMPONENT_NESTED_SF_TASK = `import { ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES, type NotificationTaskType } from '@dereekb/firebase';

export const ALL_APP_STORAGE_FILE_NOTIFICATION_TASK_TYPES: NotificationTaskType[] = [...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES];
`;

const API_SECONDARY_TASK_SERVICE = `import { ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES } from '@dereekb/firebase';
import { notificationTaskService } from '@dereekb/firebase-server/model';

export function demoSecondaryNotificationTaskServiceFactory() {
  return notificationTaskService({ validate: [...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES], handlers: [] });
}
`;

const API_SECONDARY_TASK_SERVICE_WITH_HANDLER = `import { notificationTaskService } from '@dereekb/firebase-server/model';
import { demoStorageFileProcessingNotificationTaskHandler } from './handlers/task.handler.storagefile';

export function demoSecondaryNotificationTaskServiceFactory(context) {
  return notificationTaskService({ validate: [], handlers: [demoStorageFileProcessingNotificationTaskHandler(context)] });
}
`;

const COMPONENT_TASK_FILE = 'src/lib/model/notification/notification.task.ts';
const NESTED_SF_TASK_FILE = 'src/lib/model/notification/notification.storagefile.task.ts';
const TASK_SERVICE_FILE = 'src/app/common/model/notification/notification.task.service.ts';
const SECONDARY_TASK_SERVICE_FILE = 'src/app/common/model/notification/notification.task.service.secondary.ts';
const SF_HANDLER_FILE = 'src/app/common/model/notification/handlers/task.handler.storagefile.ts';
const FS_HANDLER_FILE = 'src/app/common/model/notification/handlers/formspace/task.handler.formspace.submission.ts';

const FIREBASE_IMPORT = "import { ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES, ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES } from '@dereekb/firebase';";
const HANDLERS_LINE = 'const handlers: NotificationTaskServiceTaskHandlerConfig<any>[] = [exampleNotificationTaskHandler, storageFileHandler, formSpaceHandler];';
const SF_LOCAL = 'const storageFileHandler = demoStorageFileProcessingNotificationTaskHandler(context);';
const SF_IMPORT = "import { demoStorageFileProcessingNotificationTaskHandler } from './handlers/task.handler.storagefile';\n";
const SF_SPREAD = ', ...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES';
const FS_SPREAD = ', ...ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES';
const COMPONENT_FIREBASE_IMPORT = "import { type NotificationTaskType } from '@dereekb/firebase';";
const COMPONENT_AGGREGATE = '[EXAMPLE_NOTIFICATION_TASK_TYPE]';

interface FixtureParts {
  readonly component: InspectedFile[];
  readonly api: InspectedFile[];
}

function happyParts(): FixtureParts {
  return {
    component: [{ relPath: COMPONENT_TASK_FILE, text: COMPONENT_TASK }],
    api: [
      { relPath: TASK_SERVICE_FILE, text: API_TASK_SERVICE },
      { relPath: SF_HANDLER_FILE, text: API_SF_HANDLER },
      { relPath: FS_HANDLER_FILE, text: API_FS_HANDLER }
    ]
  };
}

function inspectionOf(modify?: (parts: FixtureParts) => void): AppNotificationsInspection {
  const parts = happyParts();
  modify?.(parts);
  return {
    component: { rootDir: 'components/demo-firebase', folder: 'src/lib/model/notification', status: 'ok', files: parts.component },
    api: { rootDir: 'apps/demo-api', folder: 'src/app/common/model/notification', status: 'ok', files: parts.api }
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

function findingsOf(result: ValidationResult, code: ViolationCode = 'NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED') {
  return result.violations.filter((v) => v.code === code);
}

function dropStorageFileHandler(parts: FixtureParts): void {
  replaceInFile(parts.api, TASK_SERVICE_FILE, ', storageFileHandler, ', ', ');
}

function addTaskServiceImport(parts: FixtureParts, line: string): void {
  replaceInFile(parts.api, TASK_SERVICE_FILE, FIREBASE_IMPORT, `${FIREBASE_IMPORT}\n${line}`);
}

// Adds `member` (an upstream aggregate spread or task-type constant) to the component's `ALL_NOTIFICATION_TASK_TYPES`.
function addToAppAggregate(parts: FixtureParts, importName: string, member: string): void {
  replaceInFile(parts.component, COMPONENT_TASK_FILE, COMPONENT_FIREBASE_IMPORT, `import { ${importName}, type NotificationTaskType } from '@dereekb/firebase';`);
  replaceInFile(parts.component, COMPONENT_TASK_FILE, COMPONENT_AGGREGATE, `[EXAMPLE_NOTIFICATION_TASK_TYPE, ${member}]`);
}

// Adds the spread `...NAME` to the component's `ALL_NOTIFICATION_TASK_TYPES`, importing NAME from `importFrom` on the first
// line, so the aggregate stays on line 9.
function addSpreadToAppAggregateFrom(parts: FixtureParts, spread: string, importFrom: string): void {
  replaceInFile(parts.component, COMPONENT_TASK_FILE, COMPONENT_FIREBASE_IMPORT, `${COMPONENT_FIREBASE_IMPORT} import { ${spread.replace('...', '')} } from '${importFrom}';`);
  replaceInFile(parts.component, COMPONENT_TASK_FILE, COMPONENT_AGGREGATE, `[EXAMPLE_NOTIFICATION_TASK_TYPE, ${spread}]`);
}

// Moves the StorageFile aggregate from `validate` into the component's `ALL_NOTIFICATION_TASK_TYPES`.
function nestStorageFile(parts: FixtureParts): void {
  addToAppAggregate(parts, 'ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES', '...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES');
  replaceInFile(parts.api, TASK_SERVICE_FILE, SF_SPREAD, '');
}

// Moves the FormSpace aggregate from `validate` into the component's `ALL_NOTIFICATION_TASK_TYPES`.
function nestFormSpace(parts: FixtureParts): void {
  addToAppAggregate(parts, 'ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES', '...ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES');
  replaceInFile(parts.api, TASK_SERVICE_FILE, FS_SPREAD, '');
}

function dropFormSpaceHandler(parts: FixtureParts): void {
  replaceInFile(parts.api, TASK_SERVICE_FILE, ', formSpaceHandler]', ']');
}

function aliasStorageFileFactory(parts: FixtureParts): void {
  replaceInFile(parts.api, SF_HANDLER_FILE, SF_FACTORY_IMPORT, "import { storageFileProcessingNotificationTaskHandler as sfHandler } from '@dereekb/firebase-server/model';");
  replaceInFile(parts.api, SF_HANDLER_FILE, SF_FACTORY_RETURN, 'return sfHandler(');
}

function namespaceStorageFileFactory(parts: FixtureParts): void {
  replaceInFile(parts.api, SF_HANDLER_FILE, SF_FACTORY_IMPORT, "import * as serverModel from '@dereekb/firebase-server/model';");
  replaceInFile(parts.api, SF_HANDLER_FILE, SF_FACTORY_RETURN, 'return serverModel.storageFileProcessingNotificationTaskHandler(');
}

// `const create = <callee>;` before the SF wrapper's return, which then calls `create(`.
function holdStorageFileFactoryInLocalConst(parts: FixtureParts, callee: string): void {
  replaceInFile(parts.api, SF_HANDLER_FILE, `return ${callee}(`, `const create = ${callee};\n  return create(`);
}

const VALIDATE_LITERAL = 'validate: [...ALL_NOTIFICATION_TASK_TYPES, ...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES, ...ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES]';
const DEMO_FIREBASE_IMPORT = "import { ALL_NOTIFICATION_TASK_TYPES, EXAMPLE_NOTIFICATION_TASK_TYPE, type ExampleNotificationTaskData } from 'demo-firebase';";

// Replaces the task service's `validate` literal with `validate: <ref>`, by default the component's `ALL_NOTIFICATION_TASK_TYPES`.
function nameValidateAggregate(parts: FixtureParts, ref = 'ALL_NOTIFICATION_TASK_TYPES'): void {
  replaceInFile(parts.api, TASK_SERVICE_FILE, VALIDATE_LITERAL, `validate: ${ref}`);
}

// Moves both upstream aggregates into the component's `ALL_NOTIFICATION_TASK_TYPES` (still on line 9).
function nestBothUpstreamAggregates(parts: FixtureParts): void {
  addToAppAggregate(parts, 'ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES, ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES', '...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES, ...ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES');
}

// Moves both upstream aggregates into the component's `ALL_NOTIFICATION_TASK_TYPES`, then names it as `validate`.
function nameValidateAggregateHoldingUpstream(parts: FixtureParts): void {
  nestBothUpstreamAggregates(parts);
  nameValidateAggregate(parts);
}

const DEMO_FIREBASE_ALIAS_IMPORT = "import { ALL_NOTIFICATION_TASK_TYPES as TASK_TYPES, EXAMPLE_NOTIFICATION_TASK_TYPE, type ExampleNotificationTaskData } from 'demo-firebase';";
const TASK_SERVICE_RETURN = '  return notificationTaskService(';

// Declares `line` (a local `const` or `let`) right before the task service's `return notificationTaskService(...)`.
function addBeforeTaskServiceCall(parts: FixtureParts, line: string): void {
  replaceInFile(parts.api, TASK_SERVICE_FILE, TASK_SERVICE_RETURN, `  ${line}\n${TASK_SERVICE_RETURN}`);
}

// Adds `declaration` (e.g. a function whose parameter reuses a name) right before the task service factory.
function addBeforeTaskServiceFactory(parts: FixtureParts, declaration: string): void {
  replaceInFile(parts.api, TASK_SERVICE_FILE, 'export function demoNotificationTaskServiceFactory', `${declaration}\n\nexport function demoNotificationTaskServiceFactory`);
}

// A module-level `const create = formSpaceSubmissionNotificationTaskHandler;` in the SF wrapper's file.
function addModuleLevelFormSpaceConst(parts: FixtureParts): void {
  replaceInFile(parts.api, SF_HANDLER_FILE, SF_FACTORY_IMPORT, "import { formSpaceSubmissionNotificationTaskHandler, storageFileProcessingNotificationTaskHandler } from '@dereekb/firebase-server/model';\n\nconst create = formSpaceSubmissionNotificationTaskHandler;");
}

// An unrelated function after the SF wrapper whose parameter is named `name`. Call it before the wrapper is rewritten.
function addUnrelatedHelperWithParameter(parts: FixtureParts, name: string): void {
  replaceInFile(parts.api, SF_HANDLER_FILE, SF_WRAPPER, `${SF_WRAPPER}\n\nexport function demoUnrelatedHelper(${name}: boolean) { return ${name}; }`);
}

const BOTH_FACTORIES_IMPORT = "import { formSpaceSubmissionNotificationTaskHandler, storageFileProcessingNotificationTaskHandler } from '@dereekb/firebase-server/model';";

// Each wrapper keeps the handler it builds in a local of the same name, `handler`.
const SF_WRAPPER_HANDLER_LOCAL = `export function demoStorageFileProcessingNotificationTaskHandler(context) {
  const handler = storageFileProcessingNotificationTaskHandler(${SF_INLINE_CONFIG});
  return handler;
}`;

const FS_WRAPPER_HANDLER_LOCAL = `export function demoFormSpaceSubmissionNotificationTaskHandler(context) {
  const handler = formSpaceSubmissionNotificationTaskHandler({ processors: [], validate: [], formSpaceFirestoreCollections: context });
  return handler;
}`;

// The same wrappers, each holding a helper's result: `const handler = buildStorageFileHandler(context)`.
const WRAPPER_HELPERS = `function buildStorageFileHandler(context) {
  return storageFileProcessingNotificationTaskHandler(${SF_INLINE_CONFIG});
}

function buildFormSpaceHandler(context) {
  return formSpaceSubmissionNotificationTaskHandler({ processors: [], validate: [], formSpaceFirestoreCollections: context });
}`;

const SF_WRAPPER_HELPER_LOCAL = SF_WRAPPER_HANDLER_LOCAL.replace(`storageFileProcessingNotificationTaskHandler(${SF_INLINE_CONFIG})`, 'buildStorageFileHandler(context)');
const FS_WRAPPER_HELPER_LOCAL = FS_WRAPPER_HANDLER_LOCAL.replace('formSpaceSubmissionNotificationTaskHandler({ processors: [], validate: [], formSpaceFirestoreCollections: context })', 'buildFormSpaceHandler(context)');

// Replaces the SF wrapper's file with `body` (after an import of both factories) and points the task service's FS import at it.
function writeBothWrappersInOneFile(parts: FixtureParts, body: string): void {
  replaceInFile(parts.api, SF_HANDLER_FILE, API_SF_HANDLER, `${BOTH_FACTORIES_IMPORT}\n\n${body}\n`);
  removeFile(parts.api, FS_HANDLER_FILE);
  replaceInFile(parts.api, TASK_SERVICE_FILE, "'./handlers/formspace/task.handler.formspace.submission'", "'./handlers/task.handler.storagefile'");
}

describe('NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED', () => {
  it('passes the demo-shaped fixture with no findings', () => {
    expect(runWith().violations).toEqual([]);
  });

  it('reports the StorageFile aggregate when its handler leaves handlers', () => {
    const found = findingsOf(runWith(dropStorageFileHandler));
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ severity: 'error', side: 'api', file: TASK_SERVICE_FILE });
    expect(found[0].message).toContain('...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES');
    expect(found[0].message).toContain('`SFP`');
    expect(found[0].message).toContain('`demoStorageFileProcessingNotificationTaskHandler` builds');
    expect(found[0].message).toContain('handlers/task.handler.storagefile.ts:');
    expect(found[0].message).toContain('Add `demoStorageFileProcessingNotificationTaskHandler(...)` to `handlers`');
    expect(found[0].message).toContain('throws at startup');
  });

  it('reports the FormSpace aggregate when its handler leaves handlers', () => {
    const found = findingsOf(runWith((p) => replaceInFile(p.api, TASK_SERVICE_FILE, ', formSpaceHandler]', ']')));
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES');
    expect(found[0].message).toContain('`FSPS`');
    expect(found[0].message).toContain('demoFormSpaceSubmissionNotificationTaskHandler');
  });

  it('reports both aggregates when both handlers leave handlers', () => {
    const found = findingsOf(runWith((p) => replaceInFile(p.api, TASK_SERVICE_FILE, ', storageFileHandler, formSpaceHandler]', ']')));
    expect(found).toHaveLength(2);
    expect(found[0].message).toContain('ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES');
    expect(found[1].message).toContain('ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES');
  });

  it('says no factory call was found when the app never builds the StorageFile handler', () => {
    const found = findingsOf(
      runWith((p) => {
        removeFile(p.api, SF_HANDLER_FILE);
        replaceInFile(p.api, TASK_SERVICE_FILE, SF_IMPORT, '');
        replaceInFile(p.api, TASK_SERVICE_FILE, `  ${SF_LOCAL}\n`, '');
        dropStorageFileHandler(p);
      })
    );
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('no `storageFileProcessingNotificationTaskHandler(...)` call was found');
    expect(found[0].message).toContain('src/app/common/model/notification/');
    expect(found[0].message).toContain('<app>StorageFileProcessingNotificationTaskHandler(context)');
  });

  it('reports a task-type constant listed directly in validate', () => {
    const found = findingsOf(
      runWith((p) => {
        replaceInFile(p.api, TASK_SERVICE_FILE, FIREBASE_IMPORT, "import { ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES, STORAGE_FILE_PROCESSING_NOTIFICATION_TASK_TYPE } from '@dereekb/firebase';");
        replaceInFile(p.api, TASK_SERVICE_FILE, '...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES', 'STORAGE_FILE_PROCESSING_NOTIFICATION_TASK_TYPE');
        dropStorageFileHandler(p);
      })
    );
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('`STORAGE_FILE_PROCESSING_NOTIFICATION_TASK_TYPE`');
  });

  it('reports nothing when validate does not list the aggregate', () => {
    const result = runWith((p) => {
      replaceInFile(p.api, TASK_SERVICE_FILE, SF_SPREAD, '');
      dropStorageFileHandler(p);
    });
    expect(result.violations).toEqual([]);
  });

  it.each<[string, (parts: FixtureParts) => void]>([
    [
      'the factory written inline in handlers',
      (p) => {
        replaceInFile(p.api, TASK_SERVICE_FILE, ', storageFileHandler, ', `, storageFileProcessingNotificationTaskHandler(${SF_INLINE_CONFIG}), `);
        addTaskServiceImport(p, SF_FACTORY_IMPORT);
      }
    ],
    [
      'a spread of a local function returning both wrappers',
      (p) => {
        replaceInFile(p.api, TASK_SERVICE_FILE, ', storageFileHandler, formSpaceHandler]', ', ...upstreamHandlers(context)]');
        replaceInFile(
          p.api,
          TASK_SERVICE_FILE,
          'export function demoNotificationTaskServiceFactory',
          'function upstreamHandlers(context) {\n  return [demoStorageFileProcessingNotificationTaskHandler(context), demoFormSpaceSubmissionNotificationTaskHandler(context)];\n}\n\nexport function demoNotificationTaskServiceFactory'
        );
      }
    ],
    ['a typed local', (p) => replaceInFile(p.api, TASK_SERVICE_FILE, 'const storageFileHandler =', 'const storageFileHandler: NotificationTaskServiceTaskHandlerConfig<StorageFileProcessingNotificationTaskData> =')],
    [
      'an arrow-function wrapper',
      (p) => replaceInFile(p.api, SF_HANDLER_FILE, SF_WRAPPER, 'export const demoStorageFileProcessingNotificationTaskHandler = (context) => storageFileProcessingNotificationTaskHandler({ processors: [], storageFileFirestoreCollections: context, storageAccessor: context.storageService });')
    ],
    [
      'handlers written inline in the notificationTaskService call',
      (p) => {
        replaceInFile(p.api, TASK_SERVICE_FILE, `  ${HANDLERS_LINE}\n`, '');
        replaceInFile(p.api, TASK_SERVICE_FILE, ', handlers });', ', handlers: [exampleNotificationTaskHandler, storageFileHandler, formSpaceHandler] });');
      }
    ]
  ])('accepts %s', (_label, modify) => {
    const result = runWith(modify);
    expect(findingsOf(result)).toEqual([]);
  });

  it('accepts the arrow-function wrapper as a reachable handler', () => {
    const extracted = extractAppNotifications(
      inspectionOf((p) => replaceInFile(p.api, SF_HANDLER_FILE, SF_WRAPPER, 'export const demoStorageFileProcessingNotificationTaskHandler = (context) => storageFileProcessingNotificationTaskHandler({ processors: [], storageFileFirestoreCollections: context, storageAccessor: context.storageService });'))
    );
    expect(extracted.taskServiceCalls[0].reachedUpstreamHandlerCalls.map((x) => x.factory)).toContain('storageFileProcessingNotificationTaskHandler');
    expect(extracted.upstreamHandlerCalls[0].enclosingFunction).toBe('demoStorageFileProcessingNotificationTaskHandler');
  });

  // Each case drops `storageFileHandler` from `handlers` and adds a value the trace can't follow.
  it.each<[string, (parts: FixtureParts) => void, ViolationCode | undefined]>([
    [
      'an element imported from a non-upstream module',
      (p) => {
        dropStorageFileHandler(p);
        replaceInFile(p.api, TASK_SERVICE_FILE, ', formSpaceHandler]', ', formSpaceHandler, otherHandler]');
        addTaskServiceImport(p, "import { otherHandler } from 'some-app-lib';");
      },
      'NOTIF_TASK_HANDLER_SPREAD_UNRESOLVED'
    ],
    [
      'a handlers list built by a call',
      (p) => {
        replaceInFile(p.api, TASK_SERVICE_FILE, HANDLERS_LINE, 'const handlers = filterMaybeArrayValues([exampleNotificationTaskHandler, formSpaceHandler]);');
        addTaskServiceImport(p, "import { filterMaybeArrayValues } from '@dereekb/util';");
      },
      undefined
    ],
    [
      'a conditional element',
      (p) => {
        dropStorageFileHandler(p);
        replaceInFile(p.api, TASK_SERVICE_FILE, ', formSpaceHandler]', ', useSf ? storageFileHandler : formSpaceHandler]');
      },
      undefined
    ],
    [
      'a spread of an unknown @dereekb/* helper',
      (p) => {
        dropStorageFileHandler(p);
        replaceInFile(p.api, TASK_SERVICE_FILE, ', formSpaceHandler]', ', formSpaceHandler, ...someUpstreamHandlers(context)]');
        addTaskServiceImport(p, "import { someUpstreamHandlers } from '@dereekb/firebase-server/model';");
      },
      undefined
    ],
    [
      'a spread of an unknown @dereekb/* namespace helper',
      (p) => {
        dropStorageFileHandler(p);
        replaceInFile(p.api, TASK_SERVICE_FILE, ', formSpaceHandler]', ', formSpaceHandler, ...serverModel.someUpstreamHandlers(context)]');
        addTaskServiceImport(p, "import * as serverModel from '@dereekb/firebase-server/model';");
      },
      undefined
    ]
  ])('skips a service whose handlers hold %s', (_label, modify, alsoExpected) => {
    const result = runWith(modify);
    expect(findingsOf(result)).toEqual([]);
    if (alsoExpected) {
      expect(result.violations.map((v) => v.code)).toContain(alsoExpected);
    }
  });

  it('checks each task service on its own', () => {
    const result = runWith((p) => p.api.push({ relPath: SECONDARY_TASK_SERVICE_FILE, text: API_SECONDARY_TASK_SERVICE }));
    const found = findingsOf(result);
    expect(found).toHaveLength(1);
    expect(found[0].file).toBe(SECONDARY_TASK_SERVICE_FILE);
    expect(result.violations.filter((v) => v.code !== 'NOTIF_TASK_MULTIPLE_SERVICES' && v.code !== 'NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED')).toEqual([]);
  });

  it('reports an app without component task types', () => {
    const result = runWith((p) => {
      replaceInFile(p.component, COMPONENT_TASK_FILE, COMPONENT_TASK, "export const DEMO_NOTIFICATION_PLACEHOLDER = 'placeholder';\n");
      replaceInFile(p.api, TASK_SERVICE_FILE, '...ALL_NOTIFICATION_TASK_TYPES, ', '');
      replaceInFile(p.api, TASK_SERVICE_FILE, '[exampleNotificationTaskHandler, storageFileHandler, formSpaceHandler]', '[formSpaceHandler]');
    });
    const found = findingsOf(result);
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES');
  });

  it('extracts the reached upstream handlers and where they are built', () => {
    const extracted = extractAppNotifications(inspectionOf());
    expect(extracted.taskServiceCalls).toHaveLength(1);
    const [call] = extracted.taskServiceCalls;
    expect(call.handlersStatus).toBe('resolved');
    expect(call.opaqueHandlerValues).toEqual([]);
    expect(call.opaqueValidateValues).toEqual([]);
    expect(call.reachedUpstreamHandlerCalls.map((x) => x.factory)).toEqual(['storageFileProcessingNotificationTaskHandler', 'formSpaceSubmissionNotificationTaskHandler']);
    expect(extracted.upstreamHandlerCalls[0].enclosingFunction).toBe('demoStorageFileProcessingNotificationTaskHandler');
    expect(extracted.taskAllTypesAggregates[0]).toMatchObject({ spreadIdentifiers: [], opaqueValues: [] });
  });
});

describe('NOTIF_TASK_UPSTREAM_TASK_TYPES_NOT_IN_VALIDATE', () => {
  const CODE: ViolationCode = 'NOTIF_TASK_UPSTREAM_TASK_TYPES_NOT_IN_VALIDATE';

  it('warns when validate drops the StorageFile aggregate while its handler stays', () => {
    const result = runWith((p) => replaceInFile(p.api, TASK_SERVICE_FILE, SF_SPREAD, ''));
    expect(result.violations.map((v) => v.code)).toEqual([CODE]);
    const [found] = findingsOf(result, CODE);
    expect(found).toMatchObject({ severity: 'warning', side: 'api', file: TASK_SERVICE_FILE });
    expect(found.message).toContain('`...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES`');
    expect(found.message).toContain('`SFP`');
    expect(found.message).toContain(`\`storageFileProcessingNotificationTaskHandler(...)\` at ${SF_HANDLER_FILE}:`);
    expect(found.message).toContain('fails at startup if the handler is ever removed');
  });

  it('warns for the FormSpace aggregate', () => {
    const found = findingsOf(
      runWith((p) => replaceInFile(p.api, TASK_SERVICE_FILE, FS_SPREAD, '')),
      CODE
    );
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES');
    expect(found[0].message).toContain('`FSPS`');
    expect(found[0].message).toContain('handlers/formspace/task.handler.formspace.submission.ts:');
  });

  it('warns for both aggregates, in table order', () => {
    const found = findingsOf(
      runWith((p) => {
        replaceInFile(p.api, TASK_SERVICE_FILE, SF_SPREAD, '');
        replaceInFile(p.api, TASK_SERVICE_FILE, FS_SPREAD, '');
      }),
      CODE
    );
    expect(found).toHaveLength(2);
    expect(found[0].message).toContain('ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES');
    expect(found[1].message).toContain('ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES');
  });

  it('accepts a task-type constant listed directly in validate', () => {
    const result = runWith((p) => {
      replaceInFile(p.api, TASK_SERVICE_FILE, FIREBASE_IMPORT, "import { ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES, STORAGE_FILE_PROCESSING_NOTIFICATION_TASK_TYPE } from '@dereekb/firebase';");
      replaceInFile(p.api, TASK_SERVICE_FILE, '...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES', 'STORAGE_FILE_PROCESSING_NOTIFICATION_TASK_TYPE');
    });
    expect(result.violations).toEqual([]);
  });

  it('accepts the aggregate nested in the app aggregate', () => {
    const result = runWith((p) => {
      addToAppAggregate(p, 'ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES', '...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES');
      replaceInFile(p.api, TASK_SERVICE_FILE, SF_SPREAD, '');
    });
    expect(result.violations).toEqual([]);
  });

  it('accepts a task-type constant held by the app aggregate', () => {
    const result = runWith((p) => {
      addToAppAggregate(p, 'STORAGE_FILE_PROCESSING_NOTIFICATION_TASK_TYPE', 'STORAGE_FILE_PROCESSING_NOTIFICATION_TASK_TYPE');
      replaceInFile(p.api, TASK_SERVICE_FILE, SF_SPREAD, '');
    });
    expect(result.violations).toEqual([]);
  });

  // StorageFile's handler stays in `handlers` in every case, so a finding would be a false warning.
  it.each<[string, (parts: FixtureParts) => void]>([
    [
      'an aggregate it does not know',
      (p) => {
        replaceInFile(p.api, TASK_SERVICE_FILE, '...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES', '...SHARED_NOTIFICATION_TASK_TYPES');
        addTaskServiceImport(p, "import { SHARED_NOTIFICATION_TASK_TYPES } from 'some-shared-lib';");
      }
    ],
    [
      'an aliased import of the aggregate',
      (p) => {
        replaceInFile(p.api, TASK_SERVICE_FILE, FIREBASE_IMPORT, "import { ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES, ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES as SF_TASK_TYPES } from '@dereekb/firebase';");
        replaceInFile(p.api, TASK_SERVICE_FILE, '...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES', '...SF_TASK_TYPES');
      }
    ],
    ['a string-literal task type', (p) => replaceInFile(p.api, TASK_SERVICE_FILE, '...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES', "'SFP'")],
    ['a spread of a call', (p) => replaceInFile(p.api, TASK_SERVICE_FILE, '...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES', '...upstreamTaskTypes()')],
    ['a value that is not an array literal', (p) => replaceInFile(p.api, TASK_SERVICE_FILE, 'validate: [...ALL_NOTIFICATION_TASK_TYPES, ...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES, ...ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES]', 'validate: taskTypes')],
    [
      'an app aggregate that spreads an aggregate it does not know',
      (p) => {
        addSpreadToAppAggregateFrom(p, '...SHARED_NOTIFICATION_TASK_TYPES', 'some-shared-lib');
        replaceInFile(p.api, TASK_SERVICE_FILE, SF_SPREAD, '');
      }
    ],
    [
      'an app aggregate that spreads the upstream aggregate without importing it from @dereekb/*',
      (p) => {
        addSpreadToAppAggregateFrom(p, '...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES', './storagefile.task.local');
        replaceInFile(p.api, TASK_SERVICE_FILE, FIREBASE_IMPORT, "import { ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES } from '@dereekb/firebase';");
        replaceInFile(p.api, TASK_SERVICE_FILE, SF_SPREAD, '');
      }
    ],
    [
      'an app aggregate that holds a value it cannot read',
      (p) => {
        addToAppAggregate(p, 'ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES', '...(useSf ? ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES : [])');
        replaceInFile(p.api, TASK_SERVICE_FILE, SF_SPREAD, '');
      }
    ]
  ])('skips a service whose validate holds %s', (_label, modify) => {
    expect(findingsOf(runWith(modify), CODE)).toEqual([]);
  });

  it('warns when the app aggregate holds another upstream aggregate but validate never lists this one', () => {
    const result = runWith((p) => {
      addToAppAggregate(p, 'ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES', '...ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES');
      replaceInFile(p.api, TASK_SERVICE_FILE, SF_SPREAD, '');
    });
    expect(result.violations.map((v) => v.code)).toEqual([CODE]);
    expect(findingsOf(result, CODE)[0].message).toContain('`...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES`');
  });

  it('accepts the aggregate nested two levels deep in app aggregates', () => {
    const result = runWith((p) => {
      p.component.push({ relPath: NESTED_SF_TASK_FILE, text: COMPONENT_NESTED_SF_TASK });
      addSpreadToAppAggregateFrom(p, '...ALL_APP_STORAGE_FILE_NOTIFICATION_TASK_TYPES', './notification.storagefile.task');
      replaceInFile(p.api, TASK_SERVICE_FILE, SF_SPREAD, '');
    });
    expect(result.violations).toEqual([]);
  });

  it('does not warn when the task service has no validate', () => {
    const result = runWith((p) => replaceInFile(p.api, TASK_SERVICE_FILE, 'validate: [...ALL_NOTIFICATION_TASK_TYPES, ...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES, ...ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES], ', ''));
    expect(findingsOf(result, CODE)).toEqual([]);
  });

  it('stays quiet when the handler is not reachable', () => {
    const result = runWith(dropStorageFileHandler);
    expect(findingsOf(result)).toHaveLength(1);
    expect(findingsOf(result, CODE)).toEqual([]);
  });

  it('checks each task service on its own', () => {
    const result = runWith((p) => p.api.push({ relPath: SECONDARY_TASK_SERVICE_FILE, text: API_SECONDARY_TASK_SERVICE_WITH_HANDLER }));
    const found = findingsOf(result, CODE);
    expect(found).toHaveLength(1);
    expect(found[0].file).toBe(SECONDARY_TASK_SERVICE_FILE);
    expect(result.violations.filter((v) => v.code !== 'NOTIF_TASK_MULTIPLE_SERVICES' && v.code !== CODE)).toEqual([]);
  });

  it('extracts what validate holds that it cannot read, and the app aggregate spreads', () => {
    const extracted = extractAppNotifications(
      inspectionOf((p) => {
        replaceInFile(p.api, TASK_SERVICE_FILE, '...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES', "'SFP'");
        addToAppAggregate(p, 'ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES', '...ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES');
      })
    );
    expect(extracted.taskServiceCalls[0].opaqueValidateValues).toEqual(["'SFP'"]);
    expect(extracted.taskAllTypesAggregates[0]).toMatchObject({ taskTypeIdentifiers: ['EXAMPLE_NOTIFICATION_TASK_TYPE'], spreadIdentifiers: ['ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES'], opaqueValues: [] });
  });
});

describe('NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED — aliased and namespaced factories', () => {
  const variants: [string, (parts: FixtureParts) => void][] = [
    ['an aliased factory import', aliasStorageFileFactory],
    ['a namespace factory call', namespaceStorageFileFactory]
  ];

  it.each(variants)('follows %s in the wrapper', (_label, modify) => {
    const inspection = inspectionOf(modify);
    const extracted = extractAppNotifications(inspection);
    const [call] = extracted.taskServiceCalls;
    expect(call.opaqueHandlerValues).toEqual([]);
    expect(call.unresolvedHandlerBindings).toEqual([]);
    expect(call.reachedUpstreamHandlerCalls.map((x) => x.factory)).toEqual(['storageFileProcessingNotificationTaskHandler', 'formSpaceSubmissionNotificationTaskHandler']);
    expect(extracted.upstreamHandlerCalls).toContainEqual(expect.objectContaining({ factory: 'storageFileProcessingNotificationTaskHandler', sourceFile: SF_HANDLER_FILE, enclosingFunction: 'demoStorageFileProcessingNotificationTaskHandler' }));
    expect(runWith(modify).violations).toEqual([]);
  });

  it.each(variants)('reports the StorageFile aggregate when the handler built through %s leaves handlers', (_label, modify) => {
    const found = findingsOf(
      runWith((p) => {
        modify(p);
        dropStorageFileHandler(p);
      })
    );
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('`demoStorageFileProcessingNotificationTaskHandler` builds');
    expect(found[0].message).toContain('handlers/task.handler.storagefile.ts:');
  });

  it.each<[string, string, string]>([
    ['an aliased factory import', `, sfHandler(${SF_INLINE_CONFIG}), `, "import { storageFileProcessingNotificationTaskHandler as sfHandler } from '@dereekb/firebase-server/model';"],
    ['a namespace factory call', `, serverModel.storageFileProcessingNotificationTaskHandler(${SF_INLINE_CONFIG}), `, "import * as serverModel from '@dereekb/firebase-server/model';"]
  ])('follows %s written inline in handlers', (_label, element, importLine) => {
    const modify = (p: FixtureParts) => {
      replaceInFile(p.api, TASK_SERVICE_FILE, ', storageFileHandler, ', element);
      addTaskServiceImport(p, importLine);
    };
    const [call] = extractAppNotifications(inspectionOf(modify)).taskServiceCalls;
    expect(call.opaqueHandlerValues).toEqual([]);
    expect(call.reachedUpstreamHandlerCalls).toContainEqual(expect.objectContaining({ factory: 'storageFileProcessingNotificationTaskHandler', sourceFile: TASK_SERVICE_FILE }));
    expect(runWith(modify).violations).toEqual([]);
  });

  // The alias or namespace name is also a parameter of an unrelated function in the wrapper's file.
  const unrelatedParameterVariants: [string, (parts: FixtureParts) => void][] = [
    [
      'an aliased factory import',
      (p) => {
        addUnrelatedHelperWithParameter(p, 'sfHandler');
        aliasStorageFileFactory(p);
      }
    ],
    [
      'a namespace factory call',
      (p) => {
        addUnrelatedHelperWithParameter(p, 'serverModel');
        namespaceStorageFileFactory(p);
      }
    ]
  ];

  it.each(unrelatedParameterVariants)('follows %s past a same-named parameter in another function of the file', (_label, modify) => {
    const [call] = extractAppNotifications(inspectionOf(modify)).taskServiceCalls;
    expect(call.opaqueHandlerValues).toEqual([]);
    expect(call.reachedUpstreamHandlerCalls.map((x) => x.factory)).toEqual(['storageFileProcessingNotificationTaskHandler', 'formSpaceSubmissionNotificationTaskHandler']);
    expect(runWith(modify).violations).toEqual([]);
  });

  it.each(unrelatedParameterVariants)('reports the FormSpace aggregate when its handler leaves handlers, with %s past a same-named parameter', (_label, modify) => {
    const found = findingsOf(
      runWith((p) => {
        modify(p);
        dropFormSpaceHandler(p);
      })
    );
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES');
  });

  it.each(unrelatedParameterVariants)('warns NOTIF_TASK_UPSTREAM_TASK_TYPES_NOT_IN_VALIDATE through %s past a same-named parameter', (_label, modify) => {
    const result = runWith((p) => {
      modify(p);
      replaceInFile(p.api, TASK_SERVICE_FILE, SF_SPREAD, '');
    });
    expect(result.violations.map((x) => x.code)).toEqual(['NOTIF_TASK_UPSTREAM_TASK_TYPES_NOT_IN_VALIDATE']);
  });
});

describe('NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED — factories held in a local const', () => {
  const SF_FACTORY = 'storageFileProcessingNotificationTaskHandler';
  const FS_FACTORY = 'formSpaceSubmissionNotificationTaskHandler';
  const localConstVariants: [string, (parts: FixtureParts) => void][] = [
    ['the factory', (p) => holdStorageFileFactoryInLocalConst(p, SF_FACTORY)],
    [
      'an aliased factory',
      (p) => {
        aliasStorageFileFactory(p);
        holdStorageFileFactoryInLocalConst(p, 'sfHandler');
      }
    ],
    [
      'a namespace member',
      (p) => {
        namespaceStorageFileFactory(p);
        holdStorageFileFactoryInLocalConst(p, `serverModel.${SF_FACTORY}`);
      }
    ]
  ];

  // Both wrappers in the SF file, each with its own `const create`.
  const holdBothWrappersInOneFile = (p: FixtureParts) => {
    const bothWrappers = `import { ${FS_FACTORY}, ${SF_FACTORY} } from '@dereekb/firebase-server/model';

export function demoStorageFileProcessingNotificationTaskHandler(context) {
  const processors = [];
  const create = ${SF_FACTORY};
  return create({ processors, storageFileFirestoreCollections: context, storageAccessor: context.storageService });
}

export function demoFormSpaceSubmissionNotificationTaskHandler(context) {
  const create = ${FS_FACTORY};
  return create({ processors: [], validate: [], formSpaceFirestoreCollections: context });
}
`;
    replaceInFile(p.api, SF_HANDLER_FILE, API_SF_HANDLER, bothWrappers);
    removeFile(p.api, FS_HANDLER_FILE);
    replaceInFile(p.api, TASK_SERVICE_FILE, "'./handlers/formspace/task.handler.formspace.submission'", "'./handlers/task.handler.storagefile'");
  };

  it.each(localConstVariants)('follows %s held in a local const', (_label, modify) => {
    const extracted = extractAppNotifications(inspectionOf(modify));
    const [call] = extracted.taskServiceCalls;
    expect(call.opaqueHandlerValues).toEqual([]);
    expect(call.unresolvedHandlerBindings).toEqual([]);
    expect(call.reachedUpstreamHandlerCalls.map((x) => x.factory)).toEqual([SF_FACTORY, FS_FACTORY]);
    const reached = call.reachedUpstreamHandlerCalls.find((x) => x.factory === SF_FACTORY);
    const built = extracted.upstreamHandlerCalls.find((x) => x.factory === SF_FACTORY);
    expect(reached?.sourceFile).toBe(SF_HANDLER_FILE);
    expect(built).toEqual(expect.objectContaining({ sourceFile: SF_HANDLER_FILE, line: reached?.line, enclosingFunction: 'demoStorageFileProcessingNotificationTaskHandler' }));
    expect(runWith(modify).violations).toEqual([]);
  });

  it.each(localConstVariants)('reports the StorageFile aggregate when the handler built through %s held in a local const leaves handlers', (_label, modify) => {
    const found = findingsOf(
      runWith((p) => {
        modify(p);
        dropStorageFileHandler(p);
      })
    );
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('`demoStorageFileProcessingNotificationTaskHandler` builds');
    expect(found[0].message).toContain('handlers/task.handler.storagefile.ts:');
  });

  it('warns NOTIF_TASK_UPSTREAM_TASK_TYPES_NOT_IN_VALIDATE for a const-held handler whose aggregate leaves validate', () => {
    const result = runWith((p) => {
      holdStorageFileFactoryInLocalConst(p, SF_FACTORY);
      replaceInFile(p.api, TASK_SERVICE_FILE, SF_SPREAD, '');
    });
    expect(result.violations.map((x) => x.code)).toEqual(['NOTIF_TASK_UPSTREAM_TASK_TYPES_NOT_IN_VALIDATE']);
  });

  it.each<[string, (parts: FixtureParts) => void, string]>([
    [
      'a module-level const',
      (p) => {
        replaceInFile(p.api, SF_HANDLER_FILE, SF_FACTORY_IMPORT, `${SF_FACTORY_IMPORT}\n\nconst create = ${SF_FACTORY};`);
        replaceInFile(p.api, SF_HANDLER_FILE, SF_FACTORY_RETURN, 'return create(');
      },
      SF_HANDLER_FILE
    ],
    [
      'a chain of local consts',
      (p) => {
        replaceInFile(p.api, SF_HANDLER_FILE, SF_FACTORY_RETURN, `const factory = ${SF_FACTORY};\n  const create = factory;\n  return create(`);
      },
      SF_HANDLER_FILE
    ],
    [
      'a const in the task service, called inline in handlers',
      (p) => {
        replaceInFile(p.api, TASK_SERVICE_FILE, `  ${HANDLERS_LINE}`, `  const create = ${SF_FACTORY};\n  ${HANDLERS_LINE}`);
        replaceInFile(p.api, TASK_SERVICE_FILE, ', storageFileHandler, ', `, create(${SF_INLINE_CONFIG}), `);
        addTaskServiceImport(p, SF_FACTORY_IMPORT);
      },
      TASK_SERVICE_FILE
    ],
    ['both wrappers in one file, each with its own const create', holdBothWrappersInOneFile, SF_HANDLER_FILE],
    [
      'a same-named parameter in another function of the file',
      (p) => {
        replaceInFile(p.api, SF_HANDLER_FILE, SF_WRAPPER, `${SF_WRAPPER}\n\nexport function demoUnrelatedHelper(create: boolean) { return create; }`);
        holdStorageFileFactoryInLocalConst(p, SF_FACTORY);
      },
      SF_HANDLER_FILE
    ]
  ])('accepts %s', (_label, modify, sourceFile) => {
    const [call] = extractAppNotifications(inspectionOf(modify)).taskServiceCalls;
    expect(call.opaqueHandlerValues).toEqual([]);
    expect(call.reachedUpstreamHandlerCalls).toContainEqual(expect.objectContaining({ factory: SF_FACTORY, sourceFile }));
    expect(runWith(modify).violations).toEqual([]);
  });

  it('reaches both factories when both wrappers share one file', () => {
    const [call] = extractAppNotifications(inspectionOf(holdBothWrappersInOneFile)).taskServiceCalls;
    expect(call.reachedUpstreamHandlerCalls.map((x) => x.factory)).toEqual([SF_FACTORY, FS_FACTORY]);
  });
});

describe('NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED — same-named locals in one file', () => {
  const SF_FACTORY = 'storageFileProcessingNotificationTaskHandler';
  const FS_FACTORY = 'formSpaceSubmissionNotificationTaskHandler';
  const sameNamedLocalVariants: [string, (parts: FixtureParts) => void][] = [
    ['`const handler = <factory>(...)`', (p) => writeBothWrappersInOneFile(p, `${SF_WRAPPER_HANDLER_LOCAL}\n\n${FS_WRAPPER_HANDLER_LOCAL}`)],
    ['`const handler = someHelper(context)`', (p) => writeBothWrappersInOneFile(p, `${WRAPPER_HELPERS}\n\n${SF_WRAPPER_HELPER_LOCAL}\n\n${FS_WRAPPER_HELPER_LOCAL}`)]
  ];

  it.each(sameNamedLocalVariants)('follows each wrapper to its own %s', (_label, modify) => {
    const extracted = extractAppNotifications(inspectionOf(modify));
    const [call] = extracted.taskServiceCalls;
    expect(call.opaqueHandlerValues).toEqual([]);
    expect(call.unresolvedHandlerBindings).toEqual([]);
    expect(call.reachedUpstreamHandlerCalls.map((x) => x.factory)).toEqual([SF_FACTORY, FS_FACTORY]);
    for (const reached of call.reachedUpstreamHandlerCalls) {
      expect(extracted.upstreamHandlerCalls.find((x) => x.factory === reached.factory)).toEqual(expect.objectContaining({ sourceFile: SF_HANDLER_FILE, line: reached.line }));
    }
    expect(runWith(modify).violations).toEqual([]);
  });

  it.each(sameNamedLocalVariants)('accepts the second wrapper of the file on its own, with %s', (_label, modify) => {
    const onlyFormSpace = (p: FixtureParts) => {
      modify(p);
      dropStorageFileHandler(p);
      replaceInFile(p.api, TASK_SERVICE_FILE, SF_SPREAD, '');
    };
    const [call] = extractAppNotifications(inspectionOf(onlyFormSpace)).taskServiceCalls;
    expect(call.reachedUpstreamHandlerCalls.map((x) => x.factory)).toEqual([FS_FACTORY]);
    expect(runWith(onlyFormSpace).violations).toEqual([]);
  });

  it('accepts the first wrapper of the file on its own when the FormSpace wrapper comes first', () => {
    const onlyStorageFile = (p: FixtureParts) => {
      writeBothWrappersInOneFile(p, `${FS_WRAPPER_HANDLER_LOCAL}\n\n${SF_WRAPPER_HANDLER_LOCAL}`);
      dropFormSpaceHandler(p);
      replaceInFile(p.api, TASK_SERVICE_FILE, FS_SPREAD, '');
    };
    const [call] = extractAppNotifications(inspectionOf(onlyStorageFile)).taskServiceCalls;
    expect(call.reachedUpstreamHandlerCalls.map((x) => x.factory)).toEqual([SF_FACTORY]);
    expect(runWith(onlyStorageFile).violations).toEqual([]);
  });

  it.each(sameNamedLocalVariants)('reports the StorageFile aggregate, not FormSpace, when the first wrapper leaves handlers, with %s', (_label, modify) => {
    const found = findingsOf(
      runWith((p) => {
        modify(p);
        dropStorageFileHandler(p);
      })
    );
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('lists `...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES`');
    expect(found[0].message).not.toContain('FORM_SPACE');
  });

  it('does not follow a same-named local of another function to a parameter', () => {
    const modify = (p: FixtureParts) => {
      replaceInFile(
        p.api,
        SF_HANDLER_FILE,
        API_SF_HANDLER,
        `${BOTH_FACTORIES_IMPORT}\n\nexport function demoStorageFileProcessingNotificationTaskHandler(context, handler = storageFileProcessingNotificationTaskHandler(${SF_INLINE_CONFIG})) {\n  return handler;\n}\n\n${FS_WRAPPER_HANDLER_LOCAL.replace('demoFormSpaceSubmissionNotificationTaskHandler', 'demoUnrelatedFormSpaceHelper')}\n`
      );
    };
    expect(findingsOf(runWith(modify))).toEqual([]);
    const [call] = extractAppNotifications(inspectionOf(modify)).taskServiceCalls;
    expect(call.reachedUpstreamHandlerCalls.filter((x) => x.sourceFile === SF_HANDLER_FILE)).toEqual([]);
    expect(call.unresolvedHandlerBindings).toContain('handler');
    expect(isHandlersTraceComplete(call)).toBe(false);
  });
});

describe('NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED — values the trace still skips', () => {
  // `storageFileHandler` stays in `handlers` in every case, so a finding would be a false error.
  it.each<[string, (parts: FixtureParts) => void]>([
    [
      'the factory held in a let',
      (p) => {
        replaceInFile(p.api, SF_HANDLER_FILE, SF_FACTORY_RETURN, 'let create = storageFileProcessingNotificationTaskHandler;\n  return create(');
      }
    ],
    [
      // a naive resolver would record the module-level FormSpace const
      'a local const shadowed by a parameter',
      (p) => {
        addModuleLevelFormSpaceConst(p);
        replaceInFile(p.api, SF_HANDLER_FILE, 'demoStorageFileProcessingNotificationTaskHandler(context) {', 'demoStorageFileProcessingNotificationTaskHandler(context, create = storageFileProcessingNotificationTaskHandler) {');
        replaceInFile(p.api, SF_HANDLER_FILE, SF_FACTORY_RETURN, 'return create(');
      }
    ],
    [
      // a naive first-match resolver would record the module-level FormSpace const
      'two consts of the name in scope',
      (p) => {
        addModuleLevelFormSpaceConst(p);
        holdStorageFileFactoryInLocalConst(p, 'storageFileProcessingNotificationTaskHandler');
      }
    ],
    [
      // a first-match resolver would follow the module-level FormSpace local from inside the StorageFile wrapper
      'a local shadowed by a module-level local of the same name',
      (p) => {
        replaceInFile(p.api, SF_HANDLER_FILE, API_SF_HANDLER, `${BOTH_FACTORIES_IMPORT}\n\nconst handler = formSpaceSubmissionNotificationTaskHandler({ processors: [], validate: [], formSpaceFirestoreCollections: undefined });\n\n${SF_WRAPPER_HANDLER_LOCAL}\n`);
      }
    ],
    [
      'the const passed to a helper instead of called',
      (p) => {
        replaceInFile(p.api, SF_HANDLER_FILE, SF_FACTORY_IMPORT, `${SF_FACTORY_IMPORT}\nimport { buildUpstreamHandler } from '@dereekb/firebase-server/model';`);
        replaceInFile(p.api, SF_HANDLER_FILE, SF_FACTORY_RETURN, 'const create = storageFileProcessingNotificationTaskHandler;\n  return buildUpstreamHandler(create, ');
      }
    ],
    [
      'an alias shadowed by a parameter',
      (p) => {
        aliasStorageFileFactory(p);
        replaceInFile(p.api, SF_HANDLER_FILE, 'demoStorageFileProcessingNotificationTaskHandler(context) {', 'demoStorageFileProcessingNotificationTaskHandler(context, sfHandler = context.handlerFactories) {');
      }
    ],
    [
      'a namespace shadowed by a parameter',
      (p) => {
        namespaceStorageFileFactory(p);
        replaceInFile(p.api, SF_HANDLER_FILE, 'demoStorageFileProcessingNotificationTaskHandler(context) {', 'demoStorageFileProcessingNotificationTaskHandler(context, serverModel = context.handlerFactories) {');
      }
    ],
    [
      'a namespace import from a non-@dereekb/* module',
      (p) => {
        replaceInFile(p.api, SF_HANDLER_FILE, SF_FACTORY_IMPORT, "import * as lib from 'some-app-lib';");
        replaceInFile(p.api, SF_HANDLER_FILE, SF_FACTORY_RETURN, 'return lib.storageFileProcessingNotificationTaskHandler(');
      }
    ]
  ])('skips %s', (_label, modify) => {
    expect(findingsOf(runWith(modify))).toEqual([]);
    const [call] = extractAppNotifications(inspectionOf(modify)).taskServiceCalls;
    expect(call.opaqueHandlerValues).not.toEqual([]);
    expect(call.reachedUpstreamHandlerCalls.map((x) => x.factory)).not.toContain('storageFileProcessingNotificationTaskHandler');
    expect(call.reachedUpstreamHandlerCalls.filter((x) => x.sourceFile === SF_HANDLER_FILE)).toEqual([]);
  });
});

describe('NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED — nested in a component aggregate', () => {
  const AGGREGATE_AT = `${COMPONENT_TASK_FILE}:9`;

  it('accepts the StorageFile aggregate nested in ALL_NOTIFICATION_TASK_TYPES', () => {
    expect(runWith(nestStorageFile).violations).toEqual([]);
  });

  it.each([
    { label: 'StorageFile', nest: nestStorageFile, drop: dropStorageFileHandler, spread: '...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES', code: '`SFP`', wrapper: 'demoStorageFileProcessingNotificationTaskHandler' },
    { label: 'FormSpace', nest: nestFormSpace, drop: dropFormSpaceHandler, spread: '...ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES', code: '`FSPS`', wrapper: 'demoFormSpaceSubmissionNotificationTaskHandler' }
  ])('reports the nested $label aggregate when its handler leaves handlers', ({ nest, drop, spread, code, wrapper }) => {
    const found = findingsOf(
      runWith((p) => {
        nest(p);
        drop(p);
      })
    );
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ severity: 'error', side: 'api', file: TASK_SERVICE_FILE });
    expect(found[0].message).toContain(`lists \`${spread}\``);
    expect(found[0].message).toContain(code);
    expect(found[0].message).toContain(`in \`validate\` through \`...ALL_NOTIFICATION_TASK_TYPES\` (${AGGREGATE_AT}), but`);
    expect(found[0].message).toContain(`\`${wrapper}\` builds`);
    expect(found[0].message).toContain(`or remove \`${spread}\` from \`ALL_NOTIFICATION_TASK_TYPES\` (${AGGREGATE_AT}).`);
  });

  it('reports a member constant nested in the component aggregate', () => {
    const found = findingsOf(
      runWith((p) => {
        addToAppAggregate(p, 'STORAGE_FILE_PROCESSING_NOTIFICATION_TASK_TYPE', 'STORAGE_FILE_PROCESSING_NOTIFICATION_TASK_TYPE');
        replaceInFile(p.api, TASK_SERVICE_FILE, SF_SPREAD, '');
        dropStorageFileHandler(p);
      })
    );
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('lists `STORAGE_FILE_PROCESSING_NOTIFICATION_TASK_TYPE` (StorageFile processing: `SFP`) in `validate` through `...ALL_NOTIFICATION_TASK_TYPES`');
  });

  it('follows a component aggregate nested in another one', () => {
    const found = findingsOf(
      runWith((p) => {
        p.component.push({ relPath: NESTED_SF_TASK_FILE, text: COMPONENT_NESTED_SF_TASK });
        addSpreadToAppAggregateFrom(p, '...ALL_APP_STORAGE_FILE_NOTIFICATION_TASK_TYPES', './notification.storagefile.task');
        replaceInFile(p.api, TASK_SERVICE_FILE, SF_SPREAD, '');
        dropStorageFileHandler(p);
      })
    );
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain(`through \`...ALL_NOTIFICATION_TASK_TYPES\` → \`...ALL_APP_STORAGE_FILE_NOTIFICATION_TASK_TYPES\` (${NESTED_SF_TASK_FILE}:3)`);
    expect(found[0].message).toContain(`from \`ALL_APP_STORAGE_FILE_NOTIFICATION_TASK_TYPES\` (${NESTED_SF_TASK_FILE}:3).`);
  });

  it('reports one finding naming both places when validate also lists the aggregate directly', () => {
    const found = findingsOf(
      runWith((p) => {
        addToAppAggregate(p, 'ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES', '...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES');
        dropStorageFileHandler(p);
      })
    );
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('lists `...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES` (StorageFile processing: `SFP`) in `validate`, but');
    expect(found[0].message).toContain(`from \`validate\` and \`...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES\` from \`ALL_NOTIFICATION_TASK_TYPES\` (${AGGREGATE_AT}).`);
  });

  it('reports nothing when validate does not spread the component aggregate', () => {
    const result = runWith((p) => {
      nestStorageFile(p);
      replaceInFile(p.api, TASK_SERVICE_FILE, '...ALL_NOTIFICATION_TASK_TYPES, ', '');
      dropStorageFileHandler(p);
    });
    expect(findingsOf(result)).toEqual([]);
  });

  // The StorageFile handler leaves `handlers` in every case, so the only thing standing between these and a finding is the
  // guard under test; a finding would be a false error.
  it.each<[string, (parts: FixtureParts) => void]>([
    [
      'not imported from @dereekb/*',
      (p) => {
        addSpreadToAppAggregateFrom(p, '...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES', './storagefile.task.local');
        replaceInFile(p.api, TASK_SERVICE_FILE, FIREBASE_IMPORT, "import { ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES } from '@dereekb/firebase';");
        replaceInFile(p.api, TASK_SERVICE_FILE, SF_SPREAD, '');
        dropStorageFileHandler(p);
      }
    ],
    [
      'that the component declares as its own task type',
      (p) => {
        replaceInFile(p.component, COMPONENT_TASK_FILE, "= 'E';", "= 'E';\nexport const STORAGE_FILE_PROCESSING_NOTIFICATION_TASK_TYPE: NotificationTaskType = 'SFX';");
        replaceInFile(p.component, COMPONENT_TASK_FILE, COMPONENT_AGGREGATE, '[EXAMPLE_NOTIFICATION_TASK_TYPE, STORAGE_FILE_PROCESSING_NOTIFICATION_TASK_TYPE]');
        addTaskServiceImport(p, "import { STORAGE_FILE_PROCESSING_NOTIFICATION_TASK_TYPE } from '@dereekb/firebase';");
        replaceInFile(p.api, TASK_SERVICE_FILE, SF_SPREAD, '');
        dropStorageFileHandler(p);
      }
    ],
    [
      'behind a non-identifier spread',
      (p) => {
        addToAppAggregate(p, 'ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES', '...(useSf ? ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES : [])');
        replaceInFile(p.api, TASK_SERVICE_FILE, SF_SPREAD, '');
        dropStorageFileHandler(p);
      }
    ],
    [
      'in a service whose handlers trace is incomplete',
      (p) => {
        nestStorageFile(p);
        replaceInFile(p.api, TASK_SERVICE_FILE, HANDLERS_LINE, 'const handlers = filterMaybeArrayValues([exampleNotificationTaskHandler, formSpaceHandler]);');
        addTaskServiceImport(p, "import { filterMaybeArrayValues } from '@dereekb/util';");
      }
    ]
  ])('skips a nested listing %s', (_label, modify) => {
    expect(findingsOf(runWith(modify))).toEqual([]);
  });

  it('records the aggregate spreads and the nested listing', () => {
    const extracted = extractAppNotifications(inspectionOf(nestStorageFile));
    expect(extracted.taskAllTypesAggregates).toEqual([{ symbolName: 'ALL_NOTIFICATION_TASK_TYPES', taskTypeIdentifiers: ['EXAMPLE_NOTIFICATION_TASK_TYPE'], spreadIdentifiers: ['ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES'], opaqueValues: [], sourceFile: COMPONENT_TASK_FILE, line: 9 }]);
    expect(extracted.taskServiceCalls[0].nestedUpstreamValidateListings).toEqual([{ identifier: 'ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES', spread: true, via: ['ALL_NOTIFICATION_TASK_TYPES'], sourceFile: COMPONENT_TASK_FILE, line: 9 }]);
    expect(extracted.taskServiceCalls[0].opaqueNestedValidateValues).toEqual([]);
    const plain = extractAppNotifications(inspectionOf()).taskServiceCalls[0];
    expect(plain.nestedUpstreamValidateListings).toEqual([]);
    expect(plain.opaqueNestedValidateValues).toEqual([]);
  });

  it('records what the expansion cannot place', () => {
    const [call] = extractAppNotifications(
      inspectionOf((p) => {
        addSpreadToAppAggregateFrom(p, '...SHARED_NOTIFICATION_TASK_TYPES', 'some-shared-lib');
        replaceInFile(p.component, COMPONENT_TASK_FILE, '...SHARED_NOTIFICATION_TASK_TYPES]', "...SHARED_NOTIFICATION_TASK_TYPES, 'X']");
      })
    ).taskServiceCalls;
    expect(call.nestedUpstreamValidateListings).toEqual([]);
    expect(call.opaqueNestedValidateValues).toEqual(["'X'", '...SHARED_NOTIFICATION_TASK_TYPES']);
  });

  it('terminates on component aggregates that spread each other', () => {
    const modify = (p: FixtureParts) => {
      p.component.push({
        relPath: 'src/lib/model/notification/notification.cycle.task.ts',
        text: "import { type NotificationTaskType } from '@dereekb/firebase';\nimport { ALL_NOTIFICATION_TASK_TYPES } from './notification.task';\n\nexport const ALL_CYCLE_NOTIFICATION_TASK_TYPES: NotificationTaskType[] = [...ALL_NOTIFICATION_TASK_TYPES];\n"
      });
      addSpreadToAppAggregateFrom(p, '...ALL_CYCLE_NOTIFICATION_TASK_TYPES', './notification.cycle.task');
      dropStorageFileHandler(p);
      replaceInFile(p.api, TASK_SERVICE_FILE, SF_SPREAD, '');
    };
    const [call] = extractAppNotifications(inspectionOf(modify)).taskServiceCalls;
    expect(call.nestedUpstreamValidateListings).toEqual([]);
    expect(call.opaqueNestedValidateValues).toEqual([]);
    expect(findingsOf(runWith(modify))).toEqual([]);
  });
});

describe('notificationTaskService validate naming a component aggregate (validate: ALL_NOTIFICATION_TASK_TYPES)', () => {
  const AGGREGATE_AT = `${COMPONENT_TASK_FILE}:9`;
  const NOT_IN_VALIDATE: ViolationCode = 'NOTIF_TASK_UPSTREAM_TASK_TYPES_NOT_IN_VALIDATE';

  it('accepts a validate naming the component aggregate that holds both upstream aggregates', () => {
    expect(runWith(nameValidateAggregateHoldingUpstream).violations).toEqual([]);
  });

  it('reads the named aggregate as a spread of it', () => {
    const [call] = extractAppNotifications(inspectionOf(nameValidateAggregateHoldingUpstream)).taskServiceCalls;
    expect(call).toMatchObject({ validateStatus: 'resolved', validateIdentifiers: [], spreadValidateIdentifiers: ['ALL_NOTIFICATION_TASK_TYPES'], opaqueValidateValues: [], opaqueNestedValidateValues: [] });
    expect(call.validateAggregate).toMatchObject({ symbolName: 'ALL_NOTIFICATION_TASK_TYPES', sourceFile: COMPONENT_TASK_FILE, line: 9 });
    expect(call.nestedUpstreamValidateListings.map((x) => [x.identifier, x.via])).toEqual([
      ['ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES', ['ALL_NOTIFICATION_TASK_TYPES']],
      ['ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES', ['ALL_NOTIFICATION_TASK_TYPES']]
    ]);
    expect(extractAppNotifications(inspectionOf()).taskServiceCalls[0].validateAggregate).toBeUndefined();
  });

  it.each([
    { label: 'StorageFile', drop: dropStorageFileHandler, spread: '...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES', code: '`SFP`' },
    { label: 'FormSpace', drop: dropFormSpaceHandler, spread: '...ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES', code: '`FSPS`' }
  ])('reports the $label aggregate held by the named aggregate when its handler leaves handlers', ({ drop, spread, code }) => {
    const found = findingsOf(
      runWith((p) => {
        nameValidateAggregateHoldingUpstream(p);
        drop(p);
      })
    );
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ severity: 'error', side: 'api', file: TASK_SERVICE_FILE });
    expect(found[0].message).toContain(`lists \`${spread}\``);
    expect(found[0].message).toContain(code);
    expect(found[0].message).toContain(`in \`validate\` through \`ALL_NOTIFICATION_TASK_TYPES\` (${AGGREGATE_AT}), but`);
    expect(found[0].message).not.toContain('`...ALL_NOTIFICATION_TASK_TYPES`');
    expect(found[0].message).toContain(`or remove \`${spread}\` from \`ALL_NOTIFICATION_TASK_TYPES\` (${AGGREGATE_AT}).`);
  });

  it('follows a component aggregate nested in the named one', () => {
    const found = findingsOf(
      runWith((p) => {
        p.component.push({ relPath: NESTED_SF_TASK_FILE, text: COMPONENT_NESTED_SF_TASK });
        addSpreadToAppAggregateFrom(p, '...ALL_APP_STORAGE_FILE_NOTIFICATION_TASK_TYPES', './notification.storagefile.task');
        nameValidateAggregate(p);
        dropStorageFileHandler(p);
      })
    );
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain(`through \`ALL_NOTIFICATION_TASK_TYPES\` → \`...ALL_APP_STORAGE_FILE_NOTIFICATION_TASK_TYPES\` (${NESTED_SF_TASK_FILE}:3)`);
  });

  it('warns for each upstream handler whose aggregate the named aggregate leaves out', () => {
    const result = runWith(nameValidateAggregate);
    expect(result.violations.map((v) => v.code)).toEqual([NOT_IN_VALIDATE, NOT_IN_VALIDATE]);
    const [sf, fs] = result.violations;
    expect(sf.message).toContain(`its \`validate\` (\`ALL_NOTIFICATION_TASK_TYPES\`, ${AGGREGATE_AT}) does not list \`...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES\` (\`SFP\`)`);
    expect(sf.message).toContain('Add it (from `@dereekb/firebase`) to `ALL_NOTIFICATION_TASK_TYPES`, or write `validate: [...ALL_NOTIFICATION_TASK_TYPES, ...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES]`, so ');
    expect(fs.message).toContain('`...ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES`');
  });

  it('skips the reverse check when the named aggregate holds a value it cannot read', () => {
    const result = runWith((p) => {
      addToAppAggregate(p, 'ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES', '...(useSf ? ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES : [])');
      nameValidateAggregate(p);
    });
    expect(findingsOf(result, NOT_IN_VALIDATE)).toEqual([]);
  });

  // Each shape names `ALL_NOTIFICATION_TASK_TYPES` as `validate` in a way the scan follows; the third column is how the task
  // service's file refers to it (`validateReferenceText`).
  const READ_SHAPES: [string, (parts: FixtureParts) => void, string][] = [
    [
      'an aggregate imported under an alias',
      (p) => {
        replaceInFile(p.api, TASK_SERVICE_FILE, DEMO_FIREBASE_IMPORT, DEMO_FIREBASE_ALIAS_IMPORT);
        nameValidateAggregate(p, 'TASK_TYPES');
      },
      'TASK_TYPES'
    ],
    [
      'a namespace member',
      (p) => {
        addTaskServiceImport(p, "import * as demoFirebase from 'demo-firebase';");
        nameValidateAggregate(p, 'demoFirebase.ALL_NOTIFICATION_TASK_TYPES');
      },
      'demoFirebase.ALL_NOTIFICATION_TASK_TYPES'
    ],
    [
      'a local alias of the aggregate',
      (p) => {
        nameValidateAggregate(p, 'taskTypes');
        addBeforeTaskServiceCall(p, 'const taskTypes = ALL_NOTIFICATION_TASK_TYPES;');
      },
      'ALL_NOTIFICATION_TASK_TYPES'
    ],
    [
      'a shorthand validate held in a local const',
      (p) => {
        replaceInFile(p.api, TASK_SERVICE_FILE, VALIDATE_LITERAL, 'validate');
        addBeforeTaskServiceCall(p, 'const validate = ALL_NOTIFICATION_TASK_TYPES;');
      },
      'ALL_NOTIFICATION_TASK_TYPES'
    ],
    [
      'a module-level const',
      (p) => {
        nameValidateAggregate(p, 'DEMO_TASK_TYPES');
        addBeforeTaskServiceFactory(p, 'const DEMO_TASK_TYPES = ALL_NOTIFICATION_TASK_TYPES;');
      },
      'ALL_NOTIFICATION_TASK_TYPES'
    ],
    [
      'a local const holding an aliased import',
      (p) => {
        replaceInFile(p.api, TASK_SERVICE_FILE, DEMO_FIREBASE_IMPORT, DEMO_FIREBASE_ALIAS_IMPORT);
        nameValidateAggregate(p, 'taskTypes');
        addBeforeTaskServiceCall(p, 'const taskTypes = TASK_TYPES;');
      },
      'TASK_TYPES'
    ],
    [
      'a local const holding a namespace member',
      (p) => {
        addTaskServiceImport(p, "import * as demoFirebase from 'demo-firebase';");
        nameValidateAggregate(p, 'taskTypes');
        addBeforeTaskServiceCall(p, 'const taskTypes = demoFirebase.ALL_NOTIFICATION_TASK_TYPES;');
      },
      'demoFirebase.ALL_NOTIFICATION_TASK_TYPES'
    ]
  ];

  it.each(READ_SHAPES)('reads validate naming the component aggregate through %s', (_label, modify, referenceText) => {
    const fullModify = (p: FixtureParts) => {
      nestBothUpstreamAggregates(p);
      dropStorageFileHandler(p);
      modify(p);
    };
    const found = findingsOf(runWith(fullModify));
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain(`in \`validate\` through \`ALL_NOTIFICATION_TASK_TYPES\` (${AGGREGATE_AT}), but`);
    const [call] = extractAppNotifications(inspectionOf(fullModify)).taskServiceCalls;
    expect(call).toMatchObject({ validateStatus: 'resolved', spreadValidateIdentifiers: ['ALL_NOTIFICATION_TASK_TYPES'], validateUpstreamAggregate: undefined, validateReferenceText: referenceText });
    expect(call.validateAggregate).toMatchObject({ symbolName: 'ALL_NOTIFICATION_TASK_TYPES', sourceFile: COMPONENT_TASK_FILE, line: 9 });
  });

  it.each(READ_SHAPES)('writes the fix the way the file refers to the aggregate, through %s', (_label, modify, referenceText) => {
    const result = runWith(modify);
    expect(result.violations.map((v) => v.code)).toEqual([NOT_IN_VALIDATE, NOT_IN_VALIDATE]);
    expect(result.violations[0].message).toContain(`its \`validate\` (\`ALL_NOTIFICATION_TASK_TYPES\`, ${AGGREGATE_AT}) does not list \`...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES\``);
    expect(result.violations[0].message).toContain(`Add it (from \`@dereekb/firebase\`) to \`ALL_NOTIFICATION_TASK_TYPES\`, or write \`validate: [...${referenceText}, ...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES]\`, so `);
  });

  // The StorageFile handler leaves `handlers` in every case, so a read of `validate` would raise
  // NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED; the guard under test is all that stands between these and a false error.
  it.each<[string, (parts: FixtureParts) => void]>([
    [
      'an aggregate imported from @dereekb/*',
      (p) => {
        replaceInFile(p.api, TASK_SERVICE_FILE, DEMO_FIREBASE_IMPORT, "import { EXAMPLE_NOTIFICATION_TASK_TYPE, type ExampleNotificationTaskData } from 'demo-firebase';\nimport { ALL_NOTIFICATION_TASK_TYPES } from '@dereekb/firebase';");
        nameValidateAggregate(p);
      }
    ],
    [
      'an aggregate imported from a relative path',
      (p) => {
        replaceInFile(p.api, TASK_SERVICE_FILE, DEMO_FIREBASE_IMPORT, "import { EXAMPLE_NOTIFICATION_TASK_TYPE, type ExampleNotificationTaskData } from 'demo-firebase';\nimport { ALL_NOTIFICATION_TASK_TYPES } from './notification.task.types';");
        nameValidateAggregate(p);
      }
    ],
    [
      'a namespace member of a relative module',
      (p) => {
        addTaskServiceImport(p, "import * as taskTypes from './notification.task.types';");
        nameValidateAggregate(p, 'taskTypes.ALL_NOTIFICATION_TASK_TYPES');
      }
    ],
    [
      'a name the file also declares',
      (p) => {
        nameValidateAggregate(p);
        addBeforeTaskServiceFactory(p, 'function unrelated(ALL_NOTIFICATION_TASK_TYPES: string[]) {\n  return ALL_NOTIFICATION_TASK_TYPES;\n}');
      }
    ],
    [
      'an alias the file also declares',
      (p) => {
        replaceInFile(p.api, TASK_SERVICE_FILE, DEMO_FIREBASE_IMPORT, DEMO_FIREBASE_ALIAS_IMPORT);
        nameValidateAggregate(p, 'TASK_TYPES');
        addBeforeTaskServiceFactory(p, 'function unrelated(TASK_TYPES: string[]) {\n  return TASK_TYPES;\n}');
      }
    ],
    [
      'a namespace the file also declares',
      (p) => {
        addTaskServiceImport(p, "import * as demoFirebase from 'demo-firebase';");
        nameValidateAggregate(p, 'demoFirebase.ALL_NOTIFICATION_TASK_TYPES');
        addBeforeTaskServiceFactory(p, 'function unrelated(demoFirebase: object) {\n  return demoFirebase;\n}');
      }
    ],
    [
      'a name the component does not declare as an aggregate',
      (p) => {
        replaceInFile(p.api, TASK_SERVICE_FILE, DEMO_FIREBASE_IMPORT, "import { ALL_NOTIFICATION_TASK_TYPES, OTHER_NOTIFICATION_TASK_TYPES, EXAMPLE_NOTIFICATION_TASK_TYPE, type ExampleNotificationTaskData } from 'demo-firebase';");
        nameValidateAggregate(p, 'OTHER_NOTIFICATION_TASK_TYPES');
      }
    ],
    [
      'a let holding the aggregate',
      (p) => {
        nameValidateAggregate(p, 'taskTypes');
        addBeforeTaskServiceCall(p, 'let taskTypes = ALL_NOTIFICATION_TASK_TYPES;');
      }
    ],
    [
      'a module-level const a parameter shadows',
      (p) => {
        nameValidateAggregate(p, 'taskTypes');
        addBeforeTaskServiceFactory(p, 'const taskTypes = ALL_NOTIFICATION_TASK_TYPES;');
        replaceInFile(p.api, TASK_SERVICE_FILE, 'demoNotificationTaskServiceFactory(context)', 'demoNotificationTaskServiceFactory(context, taskTypes)');
      }
    ]
  ])('leaves validate unread when it names %s', (_label, modify) => {
    const fullModify = (p: FixtureParts) => {
      nestBothUpstreamAggregates(p);
      dropStorageFileHandler(p);
      modify(p);
    };
    const result = runWith(fullModify);
    expect(findingsOf(result)).toEqual([]);
    expect(findingsOf(result, NOT_IN_VALIDATE)).toEqual([]);
    const [call] = extractAppNotifications(inspectionOf(fullModify)).taskServiceCalls;
    expect(call.validateStatus).toBe('unresolved');
    expect(call.validateAggregate).toBeUndefined();
    expect(call.validateReferenceText).toBeUndefined();
  });
});

describe('notificationTaskService validate naming an upstream aggregate (validate: ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES)', () => {
  const NOT_IN_VALIDATE: ViolationCode = 'NOTIF_TASK_UPSTREAM_TASK_TYPES_NOT_IN_VALIDATE';
  const SF = 'ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES';
  const FS = 'ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES';

  // Each shape names the StorageFile aggregate as `validate`; the third column is how the task service's file refers to it.
  const SHAPES: [string, (parts: FixtureParts) => void, string][] = [
    ['by name', (p) => nameValidateAggregate(p, SF), SF],
    [
      'under an alias',
      (p) => {
        addTaskServiceImport(p, `import { ${SF} as SF_TASK_TYPES } from '@dereekb/firebase';`);
        nameValidateAggregate(p, 'SF_TASK_TYPES');
      },
      'SF_TASK_TYPES'
    ],
    [
      'as a namespace member',
      (p) => {
        addTaskServiceImport(p, "import * as firebase from '@dereekb/firebase';");
        nameValidateAggregate(p, `firebase.${SF}`);
      },
      `firebase.${SF}`
    ],
    [
      'through a local const',
      (p) => {
        nameValidateAggregate(p, 'taskTypes');
        addBeforeTaskServiceCall(p, `const taskTypes = ${SF};`);
      },
      SF
    ],
    [
      'through a shorthand validate',
      (p) => {
        replaceInFile(p.api, TASK_SERVICE_FILE, VALIDATE_LITERAL, 'validate');
        addBeforeTaskServiceCall(p, `const validate = ${SF};`);
      },
      SF
    ]
  ];

  it.each(SHAPES)('reads the aggregate named %s as a spread of it', (_label, modify, referenceText) => {
    const [call] = extractAppNotifications(inspectionOf(modify)).taskServiceCalls;
    expect(call).toMatchObject({
      validateStatus: 'resolved',
      validateIdentifiers: [],
      spreadValidateIdentifiers: [SF],
      opaqueValidateValues: [],
      nestedUpstreamValidateListings: [],
      opaqueNestedValidateValues: [],
      validateAggregate: undefined,
      validateUpstreamAggregate: SF,
      validateReferenceText: referenceText
    });
  });

  it.each(SHAPES)('warns for the FormSpace handler the aggregate named %s leaves out', (_label, modify, referenceText) => {
    const result = runWith(modify);
    expect(result.violations.map((v) => v.code)).toEqual([NOT_IN_VALIDATE]);
    expect(result.violations[0].message).toContain(`its \`validate\` (\`${SF}\`) does not list \`...${FS}\` (\`FSPS\`). Add it (from \`@dereekb/firebase\`): write \`validate: [...${referenceText}, ...${FS}]\`, so `);
  });

  it.each(SHAPES)('reports the aggregate named %s when its handler leaves handlers', (_label, modify) => {
    const found = findingsOf(
      runWith((p) => {
        modify(p);
        dropStorageFileHandler(p);
      })
    );
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ severity: 'error', side: 'api', file: TASK_SERVICE_FILE });
    expect(found[0].message).toContain(`passes \`${SF}\` (StorageFile processing: \`SFP\`) as its \`validate\`, but the handler \`demoStorageFileProcessingNotificationTaskHandler\` builds`);
    expect(found[0].message).toContain(`Add \`demoStorageFileProcessingNotificationTaskHandler(...)\` to \`handlers\`, or stop passing \`${SF}\` as \`validate\`.`);
    expect(found[0].message).not.toContain(`\`...${SF}\``);
  });

  it('accepts validate naming the StorageFile aggregate once the FormSpace handler is gone', () => {
    const result = runWith((p) => {
      nameValidateAggregate(p, SF);
      dropFormSpaceHandler(p);
    });
    expect(result.violations).toEqual([]);
  });

  it('says no factory call was found for an upstream aggregate named as validate that the app never builds', () => {
    const found = findingsOf(
      runWith((p) => {
        removeFile(p.api, SF_HANDLER_FILE);
        replaceInFile(p.api, TASK_SERVICE_FILE, SF_IMPORT, '');
        replaceInFile(p.api, TASK_SERVICE_FILE, `  ${SF_LOCAL}\n`, '');
        dropStorageFileHandler(p);
        nameValidateAggregate(p, SF);
      })
    );
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('no `storageFileProcessingNotificationTaskHandler(...)` call was found');
    expect(found[0].message).toContain(`to \`handlers\`, or stop passing \`${SF}\` as \`validate\`.`);
  });

  // The StorageFile handler leaves `handlers` in every case, so a read would raise NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED.
  it.each<[string, (parts: FixtureParts) => void]>([
    [
      'imported from outside @dereekb/*',
      (p) => {
        addTaskServiceImport(p, `import { ${SF} as SF_TASK_TYPES } from 'demo-firebase';`);
        nameValidateAggregate(p, 'SF_TASK_TYPES');
      }
    ],
    [
      'under a type-only import',
      (p) => {
        addTaskServiceImport(p, `import { type ${SF} as SF_TASK_TYPES } from '@dereekb/firebase';`);
        nameValidateAggregate(p, 'SF_TASK_TYPES');
      }
    ],
    [
      'whose name the file also declares',
      (p) => {
        nameValidateAggregate(p, SF);
        addBeforeTaskServiceFactory(p, `function unrelated(${SF}: string[]) {\n  return ${SF};\n}`);
      }
    ],
    [
      'that the component also declares as its own aggregate',
      (p) => {
        replaceInFile(p.component, COMPONENT_TASK_FILE, `${COMPONENT_AGGREGATE};`, `${COMPONENT_AGGREGATE};\n\nexport const ${SF}: NotificationTaskType[] = [EXAMPLE_NOTIFICATION_TASK_TYPE];`);
        nameValidateAggregate(p, SF);
      }
    ]
  ])('leaves validate unread when it names an upstream aggregate %s', (_label, modify) => {
    const fullModify = (p: FixtureParts) => {
      modify(p);
      dropStorageFileHandler(p);
    };
    expect(findingsOf(runWith(fullModify))).toEqual([]);
    const [call] = extractAppNotifications(inspectionOf(fullModify)).taskServiceCalls;
    expect(call).toMatchObject({ validateStatus: 'unresolved', validateUpstreamAggregate: undefined, validateReferenceText: undefined });
  });
});

describe('NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED — aliased and namespaced task services', () => {
  const variants: [string, (parts: FixtureParts) => void][] = [
    [
      'an aliased notificationTaskService',
      (p) => {
        replaceInFile(p.api, TASK_SERVICE_FILE, ", notificationTaskService } from '@dereekb/firebase-server/model';", ", notificationTaskService as createNotificationTaskService } from '@dereekb/firebase-server/model';");
        replaceInFile(p.api, TASK_SERVICE_FILE, 'return notificationTaskService(', 'return createNotificationTaskService(');
      }
    ],
    [
      'a namespaced notificationTaskService',
      (p) => {
        replaceInFile(p.api, TASK_SERVICE_FILE, ", notificationTaskService } from '@dereekb/firebase-server/model';", " } from '@dereekb/firebase-server/model';\nimport * as serverModel from '@dereekb/firebase-server/model';");
        replaceInFile(p.api, TASK_SERVICE_FILE, 'return notificationTaskService(', 'return serverModel.notificationTaskService(');
      }
    ]
  ];

  it.each(variants)('passes with %s', (_label, modify) => {
    expect(runWith(modify).violations).toEqual([]);
    const calls = extractAppNotifications(inspectionOf(modify)).taskServiceCalls;
    expect(calls).toHaveLength(1);
    expect(calls[0].opaqueHandlerValues).toEqual([]);
    expect(calls[0].unresolvedHandlerBindings).toEqual([]);
  });

  it.each(variants)('checks the handlers of %s', (_label, modify) => {
    const found = findingsOf(
      runWith((p) => {
        modify(p);
        dropStorageFileHandler(p);
      })
    );
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('`demoStorageFileProcessingNotificationTaskHandler` builds');
  });
});

describe('NOTIF_TASK_HANDLER_SPREAD_UNRESOLVED — an opaque value ends the handlers trace', () => {
  // `storageFileHandler` stays in `handlers` in every case, and the trace meets a value it can't see through behind it. That
  // value makes the upstream checks skip the service; the wrapper and the local that lead to it are not unresolved.
  it.each<[string, (parts: FixtureParts) => void, string]>([
    [
      'a namespace call into a non-@dereekb/* module',
      (p) => {
        replaceInFile(p.api, SF_HANDLER_FILE, SF_FACTORY_IMPORT, "import * as lib from 'some-app-lib';");
        replaceInFile(p.api, SF_HANDLER_FILE, SF_FACTORY_RETURN, 'return lib.storageFileProcessingNotificationTaskHandler(');
      },
      'lib.storageFileProcessingNotificationTaskHandler('
    ],
    [
      'a call through a shadowed @dereekb/* namespace',
      (p) => {
        namespaceStorageFileFactory(p);
        replaceInFile(p.api, SF_HANDLER_FILE, 'demoStorageFileProcessingNotificationTaskHandler(context) {', 'demoStorageFileProcessingNotificationTaskHandler(context, serverModel = context.handlerFactories) {');
      },
      'serverModel.storageFileProcessingNotificationTaskHandler('
    ],
    ['a call through a property access', (p) => replaceInFile(p.api, SF_HANDLER_FILE, SF_FACTORY_RETURN, 'return context.handlerFactories.storageFile('), 'context.handlerFactories.storageFile('],
    ['a call of a call', (p) => replaceInFile(p.api, SF_HANDLER_FILE, SF_FACTORY_RETURN, 'return makeStorageFileHandler(context)('), 'makeStorageFileHandler(context)('],
    [
      'a call of a non-factory @dereekb/* namespace member',
      (p) => {
        replaceInFile(p.api, SF_HANDLER_FILE, SF_FACTORY_IMPORT, "import * as serverModel from '@dereekb/firebase-server/model';");
        replaceInFile(p.api, SF_HANDLER_FILE, SF_FACTORY_RETURN, 'return serverModel.someOtherHelper(');
      },
      'serverModel.someOtherHelper('
    ],
    ['a conditional local', (p) => replaceInFile(p.api, TASK_SERVICE_FILE, SF_LOCAL, 'const storageFileHandler = context.useStorageFiles ? demoStorageFileProcessingNotificationTaskHandler(context) : undefined;'), 'context.useStorageFiles ?'],
    ['a local read from a property', (p) => replaceInFile(p.api, TASK_SERVICE_FILE, SF_LOCAL, 'const storageFileHandler = context.storageFileHandler;'), 'context.storageFileHandler']
  ])('does not report the wrapper or local behind %s', (_label, modify, opaqueValue) => {
    const [call] = extractAppNotifications(inspectionOf(modify)).taskServiceCalls;
    expect(call.opaqueHandlerValues).toEqual([expect.stringContaining(opaqueValue)]);
    expect(call.unresolvedHandlerBindings).toEqual([]);
    expect(call.reachedUpstreamHandlerCalls.map((x) => x.factory)).not.toContain('storageFileProcessingNotificationTaskHandler');
    expect(isHandlersTraceComplete(call)).toBe(false);
    expect(runWith(modify).violations).toEqual([]);
  });

  it('still skips the upstream check when an opaque value could be the missing handler', () => {
    const result = runWith((p) => {
      replaceInFile(p.api, TASK_SERVICE_FILE, SF_LOCAL, 'const registryHandler = context.handlerRegistry.build(context);');
      replaceInFile(p.api, TASK_SERVICE_FILE, ', storageFileHandler, ', ', registryHandler, ');
    });
    expect(result.violations).toEqual([]);
  });

  it('still reports an unresolved identifier next to an opaque value', () => {
    const modify = (p: FixtureParts) => {
      replaceInFile(p.api, SF_HANDLER_FILE, SF_FACTORY_RETURN, 'return context.handlerFactories.storageFile(');
      replaceInFile(p.api, TASK_SERVICE_FILE, ', formSpaceHandler]', ', formSpaceHandler, mysteryHandler]');
    };
    const [call] = extractAppNotifications(inspectionOf(modify)).taskServiceCalls;
    expect(call.unresolvedHandlerBindings).toEqual(['mysteryHandler']);
    const found = findingsOf(runWith(modify), 'NOTIF_TASK_HANDLER_SPREAD_UNRESOLVED');
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('`mysteryHandler`');
  });
});

// MARK: Handler configs typed through an alias or namespace
const HANDLER_CONFIG_IMPORT = 'import { type NotificationTaskService, type NotificationTaskServiceTaskHandlerConfig, notificationTaskService }';

/**
 * Rewrites the task service's handler config import, then both handler config annotations, to the given type name.
 *
 * @param parts - The fixture parts.
 * @param importLine - The replacement for the `@dereekb/firebase-server/model` import's opening.
 * @param name - The `NotificationTaskServiceTaskHandlerConfig` replacement.
 */
function rewriteHandlerConfigAnnotations(parts: FixtureParts, importLine: string, name: string): void {
  replaceInFile(parts.api, TASK_SERVICE_FILE, HANDLER_CONFIG_IMPORT, importLine);
  replaceInFile(parts.api, TASK_SERVICE_FILE, 'exampleNotificationTaskHandler: NotificationTaskServiceTaskHandlerConfig<', `exampleNotificationTaskHandler: ${name}<`);
  replaceInFile(parts.api, TASK_SERVICE_FILE, 'const handlers: NotificationTaskServiceTaskHandlerConfig<any>[]', `const handlers: ${name}<any>[]`);
}

describe('NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED — handler configs typed through an alias or namespace', () => {
  const variants: readonly (readonly [string, (parts: FixtureParts) => void])[] = [
    ['an aliased handler config', (p) => rewriteHandlerConfigAnnotations(p, 'import { type NotificationTaskService, type NotificationTaskServiceTaskHandlerConfig as HandlerConfig, notificationTaskService }', 'HandlerConfig')],
    ['a namespaced handler config', (p) => rewriteHandlerConfigAnnotations(p, "import type * as serverModel from '@dereekb/firebase-server/model';\nimport { type NotificationTaskService, notificationTaskService }", 'serverModel.NotificationTaskServiceTaskHandlerConfig')]
  ];

  it.each(variants)('passes with %s, and the handlers trace is complete', (_label, modify) => {
    expect(runWith(modify).violations).toEqual([]);
    const [call] = extractAppNotifications(inspectionOf(modify)).taskServiceCalls;
    expect(call.unresolvedHandlerBindings).toEqual([]);
    expect(call.opaqueHandlerValues).toEqual([]);
  });

  it.each(variants)('checks the handlers of a service whose handler config uses %s', (_label, modify) => {
    const result = runWith((p) => {
      modify(p);
      dropStorageFileHandler(p);
    });
    expect(result.violations.map((v) => v.code)).toEqual(['NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED']);
  });
});

describe('the handlers trace — a local or function reached twice', () => {
  // A second visit reads what the first visit found, so the local or function isn't listed in `unresolvedHandlerBindings`.
  const SF_AGAIN_LOCAL = 'const storageFileHandlerAgain = demoStorageFileProcessingNotificationTaskHandler(context);';

  const setHandlers = (p: FixtureParts, elements: string) => replaceInFile(p.api, TASK_SERVICE_FILE, '[exampleNotificationTaskHandler, storageFileHandler, formSpaceHandler]', `[${elements}]`);
  const addLocal = (p: FixtureParts, line: string) => replaceInFile(p.api, TASK_SERVICE_FILE, SF_LOCAL, `${SF_LOCAL}\n  ${line}`);
  const addFunction = (p: FixtureParts, text: string) => replaceInFile(p.api, TASK_SERVICE_FILE, 'export function demoNotificationTaskServiceFactory', `${text}\n\nexport function demoNotificationTaskServiceFactory`);
  const opaqueStorageFileWrapper = (p: FixtureParts) => replaceInFile(p.api, SF_HANDLER_FILE, SF_FACTORY_RETURN, 'return context.handlerFactories.storageFile(');
  const reachStorageFileWrapperTwice = (p: FixtureParts, elements: string) => {
    addLocal(p, SF_AGAIN_LOCAL);
    setHandlers(p, elements);
  };

  it.each<[string, (parts: FixtureParts) => void]>([
    ['the exact-factory wrapper, from a second local', (p) => reachStorageFileWrapperTwice(p, 'exampleNotificationTaskHandler, storageFileHandler, formSpaceHandler, storageFileHandlerAgain')],
    ['the same local, listed twice', (p) => setHandlers(p, 'exampleNotificationTaskHandler, storageFileHandler, storageFileHandler, formSpaceHandler')],
    ['the wrapper, called inline twice', (p) => setHandlers(p, 'exampleNotificationTaskHandler, demoStorageFileProcessingNotificationTaskHandler(context), demoStorageFileProcessingNotificationTaskHandler(context), formSpaceHandler')],
    [
      'the wrapper, again from a spread function',
      (p) => {
        addFunction(p, 'function upstreamHandlers(context) {\n  return [demoStorageFileProcessingNotificationTaskHandler(context), demoFormSpaceSubmissionNotificationTaskHandler(context)];\n}');
        setHandlers(p, 'exampleNotificationTaskHandler, storageFileHandler, ...upstreamHandlers(context)');
      }
    ],
    [
      'a local, through another local that holds it',
      (p) => {
        addLocal(p, 'const storageFileHandlerAlias = storageFileHandler;');
        setHandlers(p, 'exampleNotificationTaskHandler, storageFileHandler, storageFileHandlerAlias, formSpaceHandler');
      }
    ],
    ['the typed handler config, listed twice', (p) => setHandlers(p, 'exampleNotificationTaskHandler, exampleNotificationTaskHandler, storageFileHandler, formSpaceHandler')]
  ])('follows %s', (_label, modify) => {
    const [call] = extractAppNotifications(inspectionOf(modify)).taskServiceCalls;
    expect(call.unresolvedHandlerBindings).toEqual([]);
    expect(call.reachedUpstreamHandlerCalls.map((x) => x.factory)).toEqual(['storageFileProcessingNotificationTaskHandler', 'formSpaceSubmissionNotificationTaskHandler']);
    expect(isHandlersTraceComplete(call)).toBe(true);
    expect(runWith(modify).violations).toEqual([]);
  });

  it('reads an opaque wrapper the same way both times', () => {
    const modify = (p: FixtureParts) => {
      opaqueStorageFileWrapper(p);
      reachStorageFileWrapperTwice(p, 'exampleNotificationTaskHandler, storageFileHandler, formSpaceHandler, storageFileHandlerAgain');
    };
    const [call] = extractAppNotifications(inspectionOf(modify)).taskServiceCalls;
    expect(call.opaqueHandlerValues).toEqual([expect.stringContaining('context.handlerFactories.storageFile(')]);
    expect(call.unresolvedHandlerBindings).toEqual([]);
    expect(isHandlersTraceComplete(call)).toBe(false);
    expect(runWith(modify).violations).toEqual([]);
  });

  it('checks a service whose handlers reach the wrapper twice', () => {
    const result = runWith((p) => reachStorageFileWrapperTwice(p, 'exampleNotificationTaskHandler, storageFileHandler, storageFileHandlerAgain'));
    expect(result.violations.map((v) => v.code)).toEqual(['NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED']);
    expect(findingsOf(result)[0].message).toContain('ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES');
  });

  it('still skips that service when the wrapper it reaches twice is opaque', () => {
    const result = runWith((p) => {
      opaqueStorageFileWrapper(p);
      reachStorageFileWrapperTwice(p, 'exampleNotificationTaskHandler, storageFileHandler, storageFileHandlerAgain');
    });
    expect(result.violations).toEqual([]);
  });

  it.each<[string, (parts: FixtureParts) => void, string[]]>([
    [
      'two functions that return each other',
      (p) => {
        addFunction(p, 'function cycleA(context) {\n  return cycleB(context);\n}\n\nfunction cycleB(context) {\n  return cycleA(context);\n}');
        setHandlers(p, 'exampleNotificationTaskHandler, storageFileHandler, formSpaceHandler, cycleA(context)');
      },
      ['cycleA', 'cycleB']
    ],
    [
      'a local that spreads itself',
      (p) => {
        addLocal(p, 'const selfHandlers = [...selfHandlers];');
        setHandlers(p, 'exampleNotificationTaskHandler, storageFileHandler, formSpaceHandler, ...selfHandlers');
      },
      ['selfHandlers']
    ]
  ])('ends a cycle through %s and lists each name in it once', (_label, modify, unresolved) => {
    const [call] = extractAppNotifications(inspectionOf(modify)).taskServiceCalls;
    expect(call.unresolvedHandlerBindings).toEqual(unresolved);
    expect(isHandlersTraceComplete(call)).toBe(false);
    expect(findingsOf(runWith(modify), 'NOTIF_TASK_HANDLER_SPREAD_UNRESOLVED')).toHaveLength(unresolved.length);
  });

  // The scan reads a name by itself, so when a name has more than one declaration, its second visit may mean another
  // declaration than the first visit read. The trace stays incomplete, and the upstream checks skip the service. Each case
  // registers both upstream handlers, so a finding would be a false error.
  const BOTH_WRAPPERS_WITH_CONST_HANDLER = `import { formSpaceSubmissionNotificationTaskHandler, storageFileProcessingNotificationTaskHandler } from '@dereekb/firebase-server/model';

export function demoStorageFileProcessingNotificationTaskHandler(context) {
  const handler = storageFileProcessingNotificationTaskHandler({ processors: [], storageFileFirestoreCollections: context, storageAccessor: context.storageService });
  return handler;
}

export function demoFormSpaceSubmissionNotificationTaskHandler(context) {
  const handler = formSpaceSubmissionNotificationTaskHandler({ processors: [], validate: [], formSpaceFirestoreCollections: context });
  return handler;
}
`;

  const SF_HANDLER_THROUGH_BUILD = `${SF_FACTORY_IMPORT}

function build(context) {
  return storageFileProcessingNotificationTaskHandler({ processors: [], storageFileFirestoreCollections: context, storageAccessor: context.storageService });
}

export function demoStorageFileProcessingNotificationTaskHandler(context) {
  return build(context);
}
`;

  const FS_HANDLER_THROUGH_BUILD = `import { formSpaceSubmissionNotificationTaskHandler } from '@dereekb/firebase-server/model';

function build(context) {
  return formSpaceSubmissionNotificationTaskHandler({ processors: [], validate: [], formSpaceFirestoreCollections: context });
}

export function demoFormSpaceSubmissionNotificationTaskHandler(context) {
  return build(context);
}
`;

  const SF_HANDLER_WITH_SHADOWED_CONST = `${SF_FACTORY_IMPORT}

const handler = storageFileProcessingNotificationTaskHandler({ processors: [], storageFileFirestoreCollections: {}, storageAccessor: {} });

export function demoStorageFileProcessingNotificationTaskHandler(context) {
  return handler;
}

export function passThrough(handler) {
  return handler;
}
`;

  // Declared after the task service factory, so the factory's typed exampleNotificationTaskHandler is the first one.
  const EXTRA_TASK_HANDLERS = `
function demoExtraTaskHandlers(context) {
  const exampleNotificationTaskHandler = demoFormSpaceSubmissionNotificationTaskHandler(context);
  return [exampleNotificationTaskHandler, demoStorageFileProcessingNotificationTaskHandler(context)];
}
`;

  it.each<[string, (parts: FixtureParts) => void]>([
    [
      'two wrappers of one file each declare `const handler`',
      (p) => {
        replaceInFile(p.api, SF_HANDLER_FILE, API_SF_HANDLER, BOTH_WRAPPERS_WITH_CONST_HANDLER);
        removeFile(p.api, FS_HANDLER_FILE);
        replaceInFile(p.api, TASK_SERVICE_FILE, "'./handlers/formspace/task.handler.formspace.submission'", "'./handlers/task.handler.storagefile'");
      }
    ],
    [
      'two API files each declare `function build`',
      (p) => {
        replaceInFile(p.api, SF_HANDLER_FILE, API_SF_HANDLER, SF_HANDLER_THROUGH_BUILD);
        replaceInFile(p.api, FS_HANDLER_FILE, API_FS_HANDLER, FS_HANDLER_THROUGH_BUILD);
      }
    ],
    [
      'a parameter shadows a module-level `const handler`',
      (p) => {
        replaceInFile(p.api, SF_HANDLER_FILE, API_SF_HANDLER, SF_HANDLER_WITH_SHADOWED_CONST);
        setHandlers(p, 'exampleNotificationTaskHandler, storageFileHandler, passThrough(formSpaceHandler)');
      }
    ],
    [
      'another function of the task service file declares a local named like the typed handler config',
      (p) => {
        replaceInFile(p.api, TASK_SERVICE_FILE, API_TASK_SERVICE, `${API_TASK_SERVICE}${EXTRA_TASK_HANDLERS}`);
        setHandlers(p, 'exampleNotificationTaskHandler, ...demoExtraTaskHandlers(context)');
      }
    ]
  ])('does not report a handler as missing when %s', (_label, modify) => {
    expect(findingsOf(runWith(modify))).toEqual([]);
  });
});

// MARK: Values the handlers trace sees through
const SF_ARROW_WRAPPER = `(context) => storageFileProcessingNotificationTaskHandler(${SF_INLINE_CONFIG})`;

// Replaces the StorageFile wrapper's file with `const demoStorageFileProcessingNotificationTaskHandler = <value>;` above the
// task service factory, so the trace reaches the wrapper through a local of the task service file.
function declareStorageFileWrapperInTaskService(parts: FixtureParts, value: string): void {
  removeFile(parts.api, SF_HANDLER_FILE);
  replaceInFile(parts.api, TASK_SERVICE_FILE, SF_IMPORT, '');
  addTaskServiceImport(parts, SF_FACTORY_IMPORT);
  replaceInFile(parts.api, TASK_SERVICE_FILE, 'export function demoNotificationTaskServiceFactory', `const demoStorageFileProcessingNotificationTaskHandler = ${value};\n\nexport function demoNotificationTaskServiceFactory`);
}

// Replaces the `storageFileHandler` element of `handlers` with `element`.
function replaceStorageFileElement(parts: FixtureParts, element: string): void {
  replaceInFile(parts.api, TASK_SERVICE_FILE, ', storageFileHandler, ', `, ${element}, `);
}

describe('NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED — values the handlers trace sees through', () => {
  const SF_FACTORY = 'storageFileProcessingNotificationTaskHandler';
  const FS_FACTORY = 'formSpaceSubmissionNotificationTaskHandler';
  // Each shape used to land in `opaqueHandlerValues`, which skipped the upstream checks for the service.
  const seeThroughVariants: [string, (parts: FixtureParts) => void][] = [
    ['a same-file arrow-function wrapper', (p) => declareStorageFileWrapperInTaskService(p, SF_ARROW_WRAPPER)],
    ['a same-file function-expression wrapper', (p) => declareStorageFileWrapperInTaskService(p, `function (context) {\n  return storageFileProcessingNotificationTaskHandler(${SF_INLINE_CONFIG});\n}`)],
    ['a same-file arrow wrapper behind `satisfies`', (p) => declareStorageFileWrapperInTaskService(p, `(${SF_ARROW_WRAPPER}) satisfies (context: unknown) => unknown`)],
    [
      'an arrow wrapper declared inside the task service factory',
      (p) => {
        removeFile(p.api, SF_HANDLER_FILE);
        replaceInFile(p.api, TASK_SERVICE_FILE, SF_IMPORT, '');
        addTaskServiceImport(p, SF_FACTORY_IMPORT);
        replaceInFile(p.api, TASK_SERVICE_FILE, SF_LOCAL, `const makeStorageFileHandler = ${SF_ARROW_WRAPPER};\n  const storageFileHandler = makeStorageFileHandler(context);`);
      }
    ],
    ['a same-file arrow helper the wrapper returns', (p) => replaceInFile(p.api, SF_HANDLER_FILE, SF_WRAPPER, `const buildStorageFileHandler = ${SF_ARROW_WRAPPER};\n\nexport function demoStorageFileProcessingNotificationTaskHandler(context) {\n  return buildStorageFileHandler(context);\n}`)],
    ['a parenthesized element', (p) => replaceStorageFileElement(p, '(storageFileHandler)')],
    ['a non-null element', (p) => replaceStorageFileElement(p, 'storageFileHandler!')],
    ['an element behind `satisfies`', (p) => replaceStorageFileElement(p, 'storageFileHandler satisfies NotificationTaskServiceTaskHandlerConfig<any>')],
    ['an element behind an angle-bracket cast', (p) => replaceStorageFileElement(p, '<NotificationTaskServiceTaskHandlerConfig<any>>storageFileHandler')],
    ['a non-null local', (p) => replaceInFile(p.api, TASK_SERVICE_FILE, SF_LOCAL, 'const storageFileHandler = demoStorageFileProcessingNotificationTaskHandler(context)!;')],
    ['a parenthesized local', (p) => replaceInFile(p.api, TASK_SERVICE_FILE, SF_LOCAL, 'const storageFileHandler = (demoStorageFileProcessingNotificationTaskHandler(context));')],
    ['a wrapper return behind `satisfies`', (p) => replaceInFile(p.api, SF_HANDLER_FILE, 'context.storageService });\n}', 'context.storageService }) satisfies object;\n}')],
    [
      'a non-null spread',
      (p) => {
        replaceInFile(p.api, TASK_SERVICE_FILE, 'export function demoNotificationTaskServiceFactory', 'function storageFileHandlers(context) {\n  return [demoStorageFileProcessingNotificationTaskHandler(context)];\n}\n\nexport function demoNotificationTaskServiceFactory');
        replaceStorageFileElement(p, '...storageFileHandlers(context)!');
      }
    ]
  ];

  it.each(seeThroughVariants)('follows %s, and the handlers trace is complete', (_label, modify) => {
    const [call] = extractAppNotifications(inspectionOf(modify)).taskServiceCalls;
    expect(call.opaqueHandlerValues).toEqual([]);
    expect(call.unresolvedHandlerBindings).toEqual([]);
    expect(call.reachedUpstreamHandlerCalls.map((x) => x.factory)).toEqual([SF_FACTORY, FS_FACTORY]);
    expect(isHandlersTraceComplete(call)).toBe(true);
    expect(runWith(modify).violations).toEqual([]);
  });

  it.each(seeThroughVariants)('reports the FormSpace aggregate when its handler leaves handlers, with %s', (_label, modify) => {
    const found = findingsOf(
      runWith((p) => {
        modify(p);
        dropFormSpaceHandler(p);
      })
    );
    expect(found).toHaveLength(1);
    expect(found[0].message).toContain('ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES');
  });

  it('warns NOTIF_TASK_UPSTREAM_TASK_TYPES_NOT_IN_VALIDATE for a handler it reaches through a non-null element', () => {
    const result = runWith((p) => {
      replaceStorageFileElement(p, 'storageFileHandler!');
      replaceInFile(p.api, TASK_SERVICE_FILE, SF_SPREAD, '');
    });
    expect(result.violations.map((v) => v.code)).toEqual(['NOTIF_TASK_UPSTREAM_TASK_TYPES_NOT_IN_VALIDATE']);
  });

  it('does not report a wrapper the trace reaches through the function index first, then through its own local', () => {
    const modify = (p: FixtureParts) => {
      replaceInFile(p.api, SF_HANDLER_FILE, SF_WRAPPER, `export const demoStorageFileProcessingNotificationTaskHandler = ${SF_ARROW_WRAPPER};\n\nexport function demoStorageFileHandlers(context) {\n  return [demoStorageFileProcessingNotificationTaskHandler(context)];\n}`);
      replaceInFile(p.api, TASK_SERVICE_FILE, SF_IMPORT, "import { demoStorageFileHandlers, demoStorageFileProcessingNotificationTaskHandler } from './handlers/task.handler.storagefile';\n");
      replaceStorageFileElement(p, 'storageFileHandler, ...demoStorageFileHandlers(context)');
    };
    const [call] = extractAppNotifications(inspectionOf(modify)).taskServiceCalls;
    expect(call.unresolvedHandlerBindings).toEqual([]);
    expect(isHandlersTraceComplete(call)).toBe(true);
    expect(runWith(modify).violations).toEqual([]);
  });

  // A function that can return from more than one place returns a conditional value, which the trace doesn't see through.
  it.each<[string, (parts: FixtureParts) => void]>([
    [
      'an arrow function written inline',
      (p) => {
        replaceStorageFileElement(p, SF_ARROW_WRAPPER);
        addTaskServiceImport(p, SF_FACTORY_IMPORT);
      }
    ],
    ['a same-file wrapper that returns from two places', (p) => declareStorageFileWrapperInTaskService(p, `(context) => {\n  if (!context.storageService) {\n    return undefined;\n  }\n  return storageFileProcessingNotificationTaskHandler(${SF_INLINE_CONFIG});\n}`)],
    ['a same-file wrapper that returns only from inside a branch', (p) => declareStorageFileWrapperInTaskService(p, `(context) => {\n  if (context.storageService) {\n    return storageFileProcessingNotificationTaskHandler(${SF_INLINE_CONFIG});\n  } else {\n    return undefined;\n  }\n}`)],
    ['an element behind `??`', (p) => replaceStorageFileElement(p, 'storageFileHandler ?? formSpaceHandler')]
  ])('still skips a service whose handlers hold %s', (_label, modify) => {
    const withoutFormSpace = (p: FixtureParts) => {
      modify(p);
      dropFormSpaceHandler(p);
    };
    expect(findingsOf(runWith(withoutFormSpace))).toEqual([]);
    const [call] = extractAppNotifications(inspectionOf(withoutFormSpace)).taskServiceCalls;
    expect(call.opaqueHandlerValues).not.toEqual([]);
    expect(isHandlersTraceComplete(call)).toBe(false);
  });
});
