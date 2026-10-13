import { describe, expect, it } from 'vitest';
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

// A module-level `const create = formSpaceSubmissionNotificationTaskHandler;` in the SF wrapper's file.
function addModuleLevelFormSpaceConst(parts: FixtureParts): void {
  replaceInFile(parts.api, SF_HANDLER_FILE, SF_FACTORY_IMPORT, "import { formSpaceSubmissionNotificationTaskHandler, storageFileProcessingNotificationTaskHandler } from '@dereekb/firebase-server/model';\n\nconst create = formSpaceSubmissionNotificationTaskHandler;");
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
      'the const passed to a helper instead of called',
      (p) => {
        replaceInFile(p.api, SF_HANDLER_FILE, SF_FACTORY_IMPORT, `${SF_FACTORY_IMPORT}\nimport { buildUpstreamHandler } from '@dereekb/firebase-server/model';`);
        replaceInFile(p.api, SF_HANDLER_FILE, SF_FACTORY_RETURN, 'const create = storageFileProcessingNotificationTaskHandler;\n  return buildUpstreamHandler(create, ');
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
