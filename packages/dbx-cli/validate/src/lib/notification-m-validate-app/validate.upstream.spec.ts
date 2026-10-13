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

const API_SF_HANDLER = `import { storageFileProcessingNotificationTaskHandler } from '@dereekb/firebase-server/model';

${SF_WRAPPER}
`;

const API_FS_HANDLER = `import { formSpaceSubmissionNotificationTaskHandler } from '@dereekb/firebase-server/model';

export function demoFormSpaceSubmissionNotificationTaskHandler(context) {
  return formSpaceSubmissionNotificationTaskHandler({ processors: [], validate: [], formSpaceFirestoreCollections: context });
}
`;

const API_SECONDARY_TASK_SERVICE = `import { ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES } from '@dereekb/firebase';
import { notificationTaskService } from '@dereekb/firebase-server/model';

export function demoSecondaryNotificationTaskServiceFactory() {
  return notificationTaskService({ validate: [...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES], handlers: [] });
}
`;

const COMPONENT_TASK_FILE = 'src/lib/model/notification/notification.task.ts';
const TASK_SERVICE_FILE = 'src/app/common/model/notification/notification.task.service.ts';
const SECONDARY_TASK_SERVICE_FILE = 'src/app/common/model/notification/notification.task.service.secondary.ts';
const SF_HANDLER_FILE = 'src/app/common/model/notification/handlers/task.handler.storagefile.ts';
const FS_HANDLER_FILE = 'src/app/common/model/notification/handlers/formspace/task.handler.formspace.submission.ts';

const FIREBASE_IMPORT = "import { ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES, ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES } from '@dereekb/firebase';";
const HANDLERS_LINE = 'const handlers: NotificationTaskServiceTaskHandlerConfig<any>[] = [exampleNotificationTaskHandler, storageFileHandler, formSpaceHandler];';
const SF_LOCAL = 'const storageFileHandler = demoStorageFileProcessingNotificationTaskHandler(context);';
const SF_IMPORT = "import { demoStorageFileProcessingNotificationTaskHandler } from './handlers/task.handler.storagefile';\n";

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
      replaceInFile(p.api, TASK_SERVICE_FILE, ', ...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES', '');
      dropStorageFileHandler(p);
    });
    expect(findingsOf(result)).toEqual([]);
  });

  it.each<[string, (parts: FixtureParts) => void]>([
    [
      'the factory written inline in handlers',
      (p) => {
        replaceInFile(p.api, TASK_SERVICE_FILE, ', storageFileHandler, ', ', storageFileProcessingNotificationTaskHandler({ processors: [], storageFileFirestoreCollections: context, storageAccessor: context.storageService }), ');
        addTaskServiceImport(p, "import { storageFileProcessingNotificationTaskHandler } from '@dereekb/firebase-server/model';");
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

  // Each case drops `storageFileHandler` from `handlers` (except the alias, which keeps it) and adds a value the trace can't follow.
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
      'an aliased factory import',
      (p) => {
        replaceInFile(p.api, SF_HANDLER_FILE, "import { storageFileProcessingNotificationTaskHandler } from '@dereekb/firebase-server/model';", "import { storageFileProcessingNotificationTaskHandler as sfHandler } from '@dereekb/firebase-server/model';");
        replaceInFile(p.api, SF_HANDLER_FILE, 'return storageFileProcessingNotificationTaskHandler(', 'return sfHandler(');
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
    expect(call.reachedUpstreamHandlerCalls.map((x) => x.factory)).toEqual(['storageFileProcessingNotificationTaskHandler', 'formSpaceSubmissionNotificationTaskHandler']);
    expect(extracted.upstreamHandlerCalls[0].enclosingFunction).toBe('demoStorageFileProcessingNotificationTaskHandler');
  });
});
