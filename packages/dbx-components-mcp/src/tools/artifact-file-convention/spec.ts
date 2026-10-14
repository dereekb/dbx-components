/**
 * File convention catalog for `dbx_artifact_file_convention`.
 *
 * One {@link FileConventionSpec} per supported artifact kind. Each
 * spec lists canonical file paths, required exports, wiring
 * registrations, and verification hints. Specs are pure static data
 * — placeholder substitution happens at render time.
 */

import type { FileConventionSpec, FileConventionStep } from './types.js';

const FIRESTORE_MODEL: FileConventionSpec = {
  artifact: 'firestore-model',
  title: 'Firestore model',
  summary: 'Add a new Firestore model end-to-end — identity + collection accessor + snapshot field converter + (optional) permissions + barrel exports + API CRUD wiring.',
  steps: [
    {
      heading: 'Component declarations',
      path: '<componentDir>/src/lib/model/<name>/<name>.ts',
      altPaths: ['<componentDir>/src/lib/model/<name>/<name>.snapshot.ts (optional split for large snapshot field maps)', '<componentDir>/src/lib/model/<name>/<name>.permissions.ts (optional permission helpers)'],
      body: [
        '**Required exports** (in `<name>.ts`):',
        '- `<Name>Identity` — `firestoreModelIdentity({ collectionType, modelType, ... })`',
        '- `<Name>` — the read model interface (NOT `readonly` — Firestore models are an exception).',
        '- `<Name>Document` — `FirestoreDocument<<Name>>` instance class.',
        '- `<name>CollectionReference` / `<Name>FirestoreCollection` — collection + accessor types.',
        '- `<Name>Roles` / `<name>RolesFactory` — if the model has role-based access.',
        '- Snapshot field converter (`<Name>FirestoreModelData` + `<name>ConverterFunctions` or `firestoreModelConverterFunctions(...)`).',
        '',
        '**Barrel:** Re-export everything from `<componentDir>/src/lib/model/<name>/index.ts` and add the model to `<componentDir>/src/lib/model/index.ts`.'
      ].join('\n')
    },
    {
      heading: 'Firestore service registration',
      path: '<componentDir>/src/lib/firestore/firestore.collections.ts',
      body: ["Register the new collection on the project's Firestore collections context (e.g. `<app>FirestoreCollections`). The exact host file may differ per project — search for an existing collection registration like `guestbookCollection` and follow its shape."].join('\n')
    },
    {
      heading: 'API CRUD wiring',
      body: ['Wire the new model into the API app via a NestJS module — see the `nestjs-model-module` artifact for placement. The module typically lives at `<apiDir>/src/app/common/model/<name>/<name>.module.ts` and registers a CRUD function map under `<apiDir>/src/app/function/<name>/`.'].join('\n')
    },
    {
      heading: 'Firestore rules',
      path: 'firestore.rules',
      body: ["Add `match /<collectionType>/{id}` rules with read/write conditions matching the model's ownership / role design."].join('\n')
    }
  ],
  seeAlso: ['nestjs-model-module', 'nestjs-function-module'],
  verify: 'Run `dbx_validate_firebase_model` (against the new `<name>.ts`) to confirm identity + accessor shape, then `dbx_validate_model_folder` to confirm folder layout.'
};

const STORAGEFILE_PURPOSE: FileConventionSpec = {
  artifact: 'storagefile-purpose',
  title: 'StorageFile purpose',
  summary: 'Add a new `StorageFilePurpose` end-to-end — component declarations + upload handler + (optional) processor + storage.rules + barrel exports.',
  steps: [
    {
      heading: 'Component declarations',
      path: '<componentDir>/src/lib/model/storagefile/storagefile.<name>.ts',
      altPaths: ['<componentDir>/src/lib/model/storagefile/storagefile.ts (single-file workspaces, demo-style)'],
      body: [
        '_Multi-file workspaces (hellosubs-style) name the file after the model owner: `storagefile.user.ts`, `storagefile.worker.ts`, `storagefile.job.ts`. Single-file workspaces share `storagefile.ts`._',
        '',
        '**Required exports:**',
        '- `<NAME>_PURPOSE: StorageFilePurpose`',
        '- `<NAME>_UPLOADED_FILE_TYPE_IDENTIFIER: UploadedFileTypeIdentifier`',
        '- `<NAME>_PURPOSE_<DESC>_SUBTASK: StorageFileProcessingSubtask` — one per subtask (skip if no processing).',
        '- `<Name>ProcessingSubtask` type alias — `typeof <NAME>_PURPOSE_<DESC>_SUBTASK | ...` (skip if no processing).',
        '- `<Name>ProcessingSubtaskMetadata` interface extending `StorageFileProcessingSubtaskMetadata` (skip if no processing).',
        '- `<camelName>FileGroupIds(userId)` or `<camelName>StorageFileGroupIds(userId)` returning `StorageFileGroupId[]`.',
        '- Path-builder helpers: `<camelName>UploadsFilePath(userId)`, `make<Name>FileStoragePath(userId)`.',
        '',
        '**Barrel:** Re-export from `<componentDir>/src/lib/model/storagefile/index.ts`.'
      ].join('\n')
    },
    {
      heading: 'API upload handler',
      path: '<apiDir>/src/app/common/model/storagefile/handlers/upload.<name>.ts',
      altPaths: ['Inline in `<apiDir>/src/app/common/model/storagefile/storagefile.upload.service.ts` for tiny workspaces.'],
      body: [
        '**Required export:** `<camelName>StorageFileUploadInitializers(context): StorageFileInitializeFromUploadServiceInitializer[]`.',
        '',
        '**Wire into:** `<apiDir>/src/app/common/model/storagefile/storagefile.upload.service.ts` — spread into the `initializer: [...]` array passed to `storageFileInitializeFromUploadService({ initializer })`.'
      ].join('\n')
    },
    {
      heading: 'API processor (only if subtasks declared)',
      path: '<apiDir>/src/app/common/model/notification/handlers/storagefile/task.handler.storagefile.<name>.ts',
      body: [
        '**Required shape:**',
        '```ts',
        'const <camelName>ProcessorConfig: StorageFileProcessingPurposeSubtaskProcessorConfig<<Name>SubtaskMetadata, <Name>ProcessingSubtask> = {',
        '  target: <NAME>_PURPOSE,',
        '  flow: [',
        '    { subtask: <NAME>_PURPOSE_<DESC>_SUBTASK, fn: async (input) => ... }',
        '  ]',
        '};',
        '```',
        '',
        '**Wire into:** `<apiDir>/src/app/common/model/notification/handlers/task.handler.storagefile.ts` — push into the `processors: [...]` array passed to `storageFileProcessingNotificationTaskHandler({ processors })`.'
      ].join('\n')
    },
    {
      heading: 'Storage rules',
      path: 'storage.rules',
      body: ["Add a `match /<upload_subpath>` block under `match /uploads/u/{uid}` with `request.resource.size` and `request.resource.contentType` validation matching the purpose's allowed file types."].join('\n')
    }
  ],
  seeAlso: ['storagefile-upload-handler', 'storagefile-processor', 'storagefile-processor-subtask'],
  verify: 'Run `dbx_validate_app_storagefiles` to confirm wiring, then `dbx_list_app_storagefiles` to confirm the new purpose appears.'
};

const STORAGEFILE_UPLOAD_HANDLER: FileConventionSpec = {
  artifact: 'storagefile-upload-handler',
  title: 'StorageFile upload handler',
  summary: 'Add the API-side initializer factory for an existing `StorageFilePurpose`.',
  steps: [
    {
      heading: 'API upload handler',
      path: '<apiDir>/src/app/common/model/storagefile/handlers/upload.<name>.ts',
      body: [
        '**Required export:** `<camelName>StorageFileUploadInitializers(context): StorageFileInitializeFromUploadServiceInitializer[]`.',
        '',
        'The factory should declare one `StorageFileInitializeFromUploadServiceInitializer` per upload-type identifier it owns, each with:',
        '- `type` — the `<NAME>_UPLOADED_FILE_TYPE_IDENTIFIER` constant from the component.',
        '- `initialize` — async function that processes the uploaded file (`fileDetailsAccessor.loadFileBytes()`, transforms, `storageService.file(path).upload(...)`, then `createStorageFileDocumentPair({...})`).',
        '- `determiner` — typically built via `determineUserByUserUploadsFolderWrapperFunction(determineByFilePath({...}))`.'
      ].join('\n')
    },
    {
      heading: 'Wire into upload service',
      path: '<apiDir>/src/app/common/model/storagefile/storagefile.upload.service.ts',
      body: ["Spread the factory's return value into the `initializer: [...]` array passed to `storageFileInitializeFromUploadService({ initializer })`. Example: `initializer: [...workerFileInitializers, ...<camelName>FileInitializers, ...systemFileInitializers]`."].join('\n')
    }
  ],
  seeAlso: ['storagefile-purpose', 'storagefile-processor'],
  verify: 'Run `dbx_validate_app_storagefiles` to confirm the initializer is reachable from the upload-service factory.'
};

const STORAGEFILE_PROCESSOR: FileConventionSpec = {
  artifact: 'storagefile-processor',
  title: 'StorageFile processor',
  summary: 'Add the API-side `StorageFileProcessingPurposeSubtaskProcessorConfig` for an existing subtask-bearing purpose.',
  steps: [
    {
      heading: 'API processor handler',
      path: '<apiDir>/src/app/common/model/notification/handlers/storagefile/task.handler.storagefile.<name>.ts',
      body: [
        '**Required shape:**',
        '```ts',
        'export function <camelName>ProcessingNotificationTaskHandler(context): StorageFileProcessingPurposeSubtaskProcessorConfig<<Name>SubtaskMetadata, <Name>ProcessingSubtask> {',
        '  const config: StorageFileProcessingPurposeSubtaskProcessorConfig<...> = {',
        '    target: <NAME>_PURPOSE,',
        '    flow: [',
        '      { subtask: <NAME>_PURPOSE_<DESC>_SUBTASK, fn: async (input) => ... }',
        '    ]',
        '  };',
        '  return config;',
        '}',
        '```'
      ].join('\n')
    },
    {
      heading: 'Wire into processing handler',
      path: '<apiDir>/src/app/common/model/notification/handlers/task.handler.storagefile.ts',
      body: [
        'Push the new processor config into the `processors: [...]` array passed to `storageFileProcessingNotificationTaskHandler({ processors })`. The surrounding handler is itself wired into `notificationTaskService({ handlers })` — already covered by the notification-task plumbing, so no further wiring needed here. `dbx_notification_m_validate_app` reports `NOTIF_TASK_UPSTREAM_HANDLER_NOT_REGISTERED` when `validate` lists `...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES` but this handler is not reachable from `handlers`, and warns `NOTIF_TASK_UPSTREAM_TASK_TYPES_NOT_IN_VALIDATE` when the handler is reachable but `validate` does not list the aggregate.'
      ].join('\n')
    }
  ],
  seeAlso: ['storagefile-purpose', 'storagefile-processor-subtask', 'notification-task'],
  verify: "Run `dbx_validate_app_storagefiles` — confirms `STORAGEFILE_PROCESSING_CONFIG_MISSING` clears and the purpose's declared subtasks are all covered by the new `flow:`."
};

const STORAGEFILE_PROCESSOR_SUBTASK: FileConventionSpec = {
  artifact: 'storagefile-processor-subtask',
  title: 'StorageFile processor subtask',
  summary: 'Add a single new processing subtask to an existing `StorageFilePurpose`.',
  steps: [
    {
      heading: 'Component declarations',
      path: '<componentDir>/src/lib/model/storagefile/storagefile.<name>.ts (the file that already declares the purpose)',
      body: [
        '**Add:**',
        "- `<NAME>_PURPOSE_<DESC>_SUBTASK: StorageFileProcessingSubtask = '<descriptor>'` — the new subtask constant.",
        '- Extend the `<Name>ProcessingSubtask` union alias: `typeof <NAME>_PURPOSE_<DESC>_SUBTASK | ...existing`.',
        '- Optional: extend `<Name>ProcessingSubtaskMetadata` with any new fields the new subtask needs.'
      ].join('\n')
    },
    {
      heading: 'API processor flow',
      path: '<apiDir>/src/app/common/model/notification/handlers/storagefile/task.handler.storagefile.<name>.ts (the file that already declares the processor)',
      body: ["Add a `{ subtask: <NAME>_PURPOSE_<DESC>_SUBTASK, fn: async (input) => ... }` entry to the processor config's `flow: [...]` array. Order matters — flow steps run in declaration order."].join('\n')
    }
  ],
  seeAlso: ['storagefile-processor', 'storagefile-purpose'],
  verify: 'Run `dbx_validate_app_storagefiles` — `STORAGEFILE_PROCESSING_SUBTASK_NOT_HANDLED` should clear once the flow entry is added.'
};

/**
 * Shared by the notification-template and notification-task specs: the nx
 * target that runs the notification validator at build time.
 */
const NOTIFICATION_BUILD_TIME_CHECK_STEP: FileConventionStep = {
  heading: 'Build-time check',
  path: '<apiDir>/project.json',
  body: [
    'Wire `dbx-cli-generate-notification-manifest` (from `@dereekb/dbx-cli`) as an nx target so broken notification wiring fails the build before deploy. It runs the same rules as `dbx_notification_m_validate_app`, writes `notification.manifest.json`, and exits non-zero on a validator error (warnings are written into the manifest). One target covers every template and task type; add it once per app.',
    '',
    '```json',
    '"generate-notification-manifest": {',
    '  "executor": "nx:run-commands",',
    '  "outputs": ["{workspaceRoot}/dist/<apiDir>/notification.manifest.json"],',
    '  "inputs": [',
    '    "{workspaceRoot}/<componentDir>/src/lib/model/notification/**/*.ts",',
    '    "{workspaceRoot}/<apiDir>/src/app/common/model/notification/**/*.ts",',
    '    "{workspaceRoot}/<apiDir>/src/app/common/firebase/**/*.ts",',
    '    "{workspaceRoot}/<apiDir>/src/app/function/notification/**/*.ts",',
    '    "{workspaceRoot}/firestore.rules",',
    '    "{workspaceRoot}/firestore.indexes.json"',
    '  ],',
    '  "options": {',
    '    "command": "npx dbx-cli-generate-notification-manifest --component-dir=<componentDir> --api-dir=<apiDir> --output=dist/<apiDir>/notification.manifest.json",',
    '    "cwd": "{workspaceRoot}"',
    '  }',
    '}',
    '```',
    '',
    "**Wire into:** the API project's `build.dependsOn` (not `serve`: nothing reads the manifest at runtime, and the server's startup checks already cover `serve`)."
  ].join('\n')
};

const NOTIFICATION_TEMPLATE: FileConventionSpec = {
  artifact: 'notification-template',
  title: 'Notification template',
  summary: 'Add a new `NotificationTemplateType` end-to-end — component type/info + ALL_* aggregate + record aggregator + API factory + factory-array wiring.',
  steps: [
    {
      heading: 'Component declarations',
      path: '<componentDir>/src/lib/model/notification/notification.<name>.ts',
      altPaths: ['<componentDir>/src/lib/model/notification/notification.ts (single-file workspaces; the main aggregator file lives here regardless)'],
      body: [
        '**Required exports:**',
        "- `<NAME>_NOTIFICATION_TEMPLATE_TYPE: NotificationTemplateType = '<short_code>'`.",
        '- `<NAME>_NOTIFICATION_TEMPLATE_TYPE_INFO: NotificationTemplateTypeInfo` with `{ type, name, description, notificationModelIdentity, targetModelIdentity? }`.',
        '- For multi-file workspaces, also declare `ALL_<MODULE>_NOTIFICATION_TEMPLATE_TYPE_INFOS: NotificationTemplateTypeInfo[]` and re-export the per-file infos.',
        '',
        '**Barrel:** Re-export from `<componentDir>/src/lib/model/notification/index.ts`.'
      ].join('\n')
    },
    {
      heading: 'Component aggregator',
      path: '<componentDir>/src/lib/model/notification/notification.ts',
      body: [
        'Add the new info to the call to `notificationTemplateTypeInfoRecord([...])` — either as a direct entry (`<NAME>_NOTIFICATION_TEMPLATE_TYPE_INFO`) or via a spread of the module aggregate (`...ALL_<MODULE>_NOTIFICATION_TEMPLATE_TYPE_INFOS`). The result constant is typically `<APP>_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD`.'
      ].join('\n')
    },
    {
      heading: 'API handler factory',
      path: '<apiDir>/src/app/common/model/notification/notification.factory.ts',
      altPaths: ['<apiDir>/src/app/common/model/notification/notification.factory.<name>.ts (split per-template for larger workspaces)'],
      body: [
        '**Required export:** A factory function returning a `NotificationTemplateServiceTypeConfig` with `{ type: <NAME>_NOTIFICATION_TEMPLATE_TYPE, factory: async (...) => ... }`.',
        '',
        '**Wire into:** the top-level `<app>NotificationTemplateServiceConfigsArrayFactory(context)` — call the new factory inside its returned array. The configs-array factory is itself bound via `NOTIFICATION_TEMPLATE_SERVICE_CONFIGS_ARRAY_TOKEN` in the notification module.'
      ].join('\n')
    },
    NOTIFICATION_BUILD_TIME_CHECK_STEP
  ],
  seeAlso: ['notification-task'],
  verify:
    'Run `dbx_notification_m_validate_app` to confirm both registration paths (info-record + handler factory) are wired, then `dbx_notification_m_list_app` to confirm the new template appears with `inInfoRecord: true` and `hasFactory: true`, then `npx nx run <api-project>:generate-notification-manifest` runs the same checks the build does.'
};

const NOTIFICATION_TASK: FileConventionSpec = {
  artifact: 'notification-task',
  title: 'Notification task',
  summary: 'Add a new `NotificationTaskType` end-to-end — component type + checkpoint alias + data interface + API handler config + service registration.',
  steps: [
    {
      heading: 'Component declarations',
      path: '<componentDir>/src/lib/model/notification/notification.task.<name>.ts',
      altPaths: ['<componentDir>/src/lib/model/notification/notification.task.ts (single-file workspaces)'],
      body: [
        '**Required exports:**',
        "- `<NAME>_NOTIFICATION_TASK_TYPE: NotificationTaskType = '<short_code>'`.",
        "- `<Name>NotificationTaskCheckpoint` type alias — string-literal union of checkpoint names (e.g. `'part_a' | 'part_b'`).",
        "- `<Name>NotificationTaskData` interface — the task's data shape.",
        "- Include the type in `ALL_NOTIFICATION_TASK_TYPES: NotificationTaskType[] = [...]` so it's picked up by the `validate:` spread.",
        '',
        '**Barrel:** Re-export from `<componentDir>/src/lib/model/notification/index.ts`.'
      ].join('\n')
    },
    {
      heading: 'API handler config',
      path: '<apiDir>/src/app/common/model/notification/notification.task.service.ts',
      altPaths: ['<apiDir>/src/app/common/model/notification/handlers/task.handler.<name>.ts (per-task split for larger workspaces)'],
      body: [
        '**Required shape:**',
        '```ts',
        'const <camelName>NotificationTaskHandler: NotificationTaskServiceTaskHandlerConfig<<Name>NotificationTaskData, <Name>NotificationTaskCheckpoint> = {',
        '  type: <NAME>_NOTIFICATION_TASK_TYPE,',
        '  flow: [',
        "    { checkpoint: 'part_a', fn: async (notificationTask) => ... }",
        '  ]',
        '};',
        '```'
      ].join('\n')
    },
    {
      heading: 'Wire into task service',
      body: ['Push the new handler config into the `handlers: [...]` array passed to `notificationTaskService({ validate, handlers })`. The `validate:` spread should already cover it via `ALL_NOTIFICATION_TASK_TYPES`.'].join('\n')
    },
    NOTIFICATION_BUILD_TIME_CHECK_STEP
  ],
  seeAlso: ['notification-template', 'notification-task-bot-script'],
  verify: 'Run `dbx_notification_m_validate_app` to confirm `inAllArray: true` + `hasHandler: true` for the new task type, then `npx nx run <api-project>:generate-notification-manifest` runs the same checks the build does.'
};

const NOTIFICATION_TASK_BOT_SCRIPT: FileConventionSpec = {
  artifact: 'notification-task-bot-script',
  title: 'NotificationTaskBot script',
  summary: 'Add a recurring NotificationTaskBot script end-to-end — component script config + registry, API script processor + NTBR handler, task-service wiring, repair cron, `ntb` rule, and the entry ensure call. `dbx_artifact_scaffold` `notification-task-bot-script` emits the bodies.',
  steps: [
    {
      heading: 'Component script',
      path: '<componentDir>/src/lib/model/notification/notification.taskbot.<name>.ts',
      altPaths: ['<componentDir>/src/lib/model/notification/notification.taskbot.ts (single-file workspaces, like the demo)'],
      body: [
        '**Required exports:**',
        "- `<NAME>_NOTIFICATION_TASK_BOT_SCRIPT_TYPE: NotificationTaskBotScriptType = '<snake_code>'`.",
        "- `<NAME>_NOTIFICATION_TASK_BOT_ENTRY_ID: NotificationTaskBotEntryId = '<kebab-id>'` (`^[a-z0-9-]+$`, at most 40 characters).",
        "- `<Name>NotificationTaskBotEntryData` interface, plus its arktype `dataType` (`.onUndeclaredKey('reject')`, cast `as Type<<Name>NotificationTaskBotEntryData>`) — setting `dataType` opts the script in to admin and MCP data patches through `update:entry`.",
        '- `<NAME>_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG: NotificationTaskBotScriptConfig` with `{ scriptType, name, description, dataType }` (add `group` + `allowOwnerOptOut: true` to let the owner turn it off; declare the group in its own file).',
        '',
        '**Barrel:** Re-export from `<componentDir>/src/lib/model/notification/index.ts`.'
      ].join('\n')
    },
    {
      heading: 'Component registry',
      path: '<componentDir>/src/lib/model/notification/notification.taskbot.ts',
      body: 'Add the config to `<APP>_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS: NotificationTaskBotScriptConfig[]`, and build `<APP>_FIREBASE_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD = notificationTaskBotScriptConfigRecord(<APP>_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS)` (`NOTIF_TASK_BOT_REGISTRY_MISSING`).'
    },
    {
      heading: 'Registry service',
      path: '<apiDir>/src/app/common/firebase/action.module.ts',
      altPaths: ['<apiDir>/src/app/common/firebase/action.context.ts (the `AppNotificationTaskBotScriptConfigServiceRef` member)'],
      body: 'Add `AppNotificationTaskBotScriptConfigServiceRef` to the server actions context class, and set `appNotificationTaskBotScriptConfigService: appNotificationTaskBotScriptConfigService(<APP>_FIREBASE_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD)` in its factory (`NOTIF_TASK_BOT_REGISTRY_NOT_WIRED`).'
    },
    {
      heading: 'API script processor',
      path: '<apiDir>/src/app/common/model/notification/handlers/taskbot/task.handler.taskbot.<name>.ts',
      altPaths: ['<apiDir>/src/app/common/model/notification/handlers/taskbot/task.handler.taskbot.ts (single-file workspaces)'],
      body: [
        '**Required shape:** a function returning `NotificationTaskBotScriptProcessorConfig<<Name>NotificationTaskBotEntryData>` with `target: <NAME>_NOTIFICATION_TASK_BOT_SCRIPT_TYPE` (or a parameter defaulting to it), a `flow` whose first step is a due check (`notificationTaskBotDelayUntilDue`) and whose side effect runs in `runNotificationTaskBotEntryTransaction` with `markSubmitted()`, and a `cleanup` returning the next run (`nextRunAt`).'
      ].join('\n')
    },
    {
      heading: 'NTBR handler',
      path: '<apiDir>/src/app/common/model/notification/handlers/taskbot/task.handler.taskbot.ts',
      body: 'Add the processor to `notificationTaskBotRunNotificationTaskHandler({ processors, validate: <APP>_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS.map((x) => x.scriptType), notificationTaskBotContext })`. Every registered script needs a processor and every processor target must be registered; the handler throws at startup otherwise (`NOTIF_TASK_BOT_SCRIPT_WITHOUT_PROCESSOR`, `NOTIF_TASK_BOT_PROCESSOR_NOT_REGISTERED`).'
    },
    {
      heading: 'Wire into task service',
      path: '<apiDir>/src/app/common/model/notification/notification.task.service.ts',
      body: 'Add the NTBR handler to `notificationTaskService({ handlers })` and `...ALL_NOTIFICATION_TASK_BOT_NOTIFICATION_TASK_TYPES` to its `validate` (`NOTIF_TASK_BOT_HANDLER_NOT_REGISTERED`, `NOTIF_TASK_BOT_TASK_TYPES_NOT_IN_VALIDATE`).'
    },
    {
      heading: 'Repair cron',
      path: '<apiDir>/src/app/function/notification/notification.schedule.ts',
      body: 'Call `request.nest.notificationActions.repairAllNotificationTaskBots()` from the notification schedule, after `sendQueuedNotifications` (`NOTIF_TASK_BOT_REPAIR_NOT_SCHEDULED`).'
    },
    {
      heading: 'Firestore rules',
      path: 'firestore.rules',
      body: 'Add `match /ntb/{notificationTaskBot} { allow get, list: if userClaimsIsSysAdmin(); }`. Keep it admin-only; owners read their opt-outs through `read:optOuts` (`NOTIF_TASK_BOT_FIRESTORE_RULE_MISSING`).'
    },
    {
      heading: 'Firestore index',
      path: 'firestore.indexes.json',
      body: 'No entry is needed: the repair query (`where nat <= …` on `ntb`) uses the automatic single-field index. Do not exempt `ntb.nat` in `fieldOverrides` (`NOTIF_TASK_BOT_NAT_INDEX_MISSING`).'
    },
    {
      heading: 'Start the bot',
      body: 'Where the attached model is created or enabled, call `ensureNotificationTaskBotEntryFactory(context)({ model, entryId: <NAME>_NOTIFICATION_TASK_BOT_ENTRY_ID, scriptType: <NAME>_NOTIFICATION_TASK_BOT_SCRIPT_TYPE, data, owner })`, passing `owner` on every call.'
    },
    NOTIFICATION_BUILD_TIME_CHECK_STEP
  ],
  seeAlso: ['notification-task'],
  verify:
    'Run `dbx_notification_m_validate_app`; the `NOTIF_TASK_BOT_*` checks (registry, NTBR handler, processors, repair cron, `ntb` rule, `nat` index) should pass. Then run `dbx_notification_m_list_app` to confirm the new script appears in the NotificationTaskBot section with `inRegistry`, `hasProcessor` and `dataTypeSource: declared`. `npx nx run <api-project>:generate-notification-manifest` runs the same checks the build does.'
};

const NESTJS_MODEL_MODULE: FileConventionSpec = {
  artifact: 'nestjs-model-module',
  title: 'NestJS model module',
  summary: "Per-domain model module that wraps an `app<Name>ModuleMetadata(...)` factory and registers the model's server actions.",
  steps: [
    {
      heading: 'Module file',
      path: '<apiDir>/src/app/common/model/<name>/<name>.module.ts',
      body: [
        '**Pattern (mirrors `apps/demo-api/src/app/common/model/storagefile/storagefile.module.ts`):**',
        '```ts',
        '@Module({',
        '  imports: [<App>ApiActionModule],',
        '  providers: [',
        '    { provide: <Name>Service, useFactory: <camelName>ServiceFactory, inject: [<App>FirebaseServerActionsContext] }',
        '    // ...other model-specific tokens',
        '  ],',
        '  exports: [<App>ApiActionModule, <Name>Service]',
        '})',
        'export class <Name>DependencyModule {}',
        '',
        '@Module(app<Name>ModuleMetadata({ dependencyModule: <Name>DependencyModule }))',
        'export class <Name>Module {}',
        '```'
      ].join('\n')
    },
    {
      heading: 'Companion files',
      path: '<apiDir>/src/app/common/model/<name>/<name>.action.ts',
      altPaths: ['<apiDir>/src/app/common/model/<name>/<name>.upload.service.ts (per-model upload handler factory)', '<apiDir>/src/app/common/model/<name>/<name>.init.ts (StorageFileInit-style initialization config)'],
      body: ['Companion files vary by model concern. Common patterns: an `*.action.ts` factory that builds server-action functions for the model, an `*.upload.service.ts` for storagefile-touching models, and an `*.init.ts` for models with `appStorageFileModuleMetadata`-style initialization.'].join('\n')
    },
    {
      heading: 'Wire into app module',
      body: ["Import the new `<Name>Module` in the API's root app module — see the `nestjs-app-module` artifact."].join('\n')
    }
  ],
  seeAlso: ['nestjs-app-module', 'firestore-model'],
  verify: 'Run `dbx_validate_model_api` against the module file to confirm provider shape, then `dbx_validate_model_folder` to confirm the surrounding folder layout.'
};

const NESTJS_FUNCTION_MODULE: FileConventionSpec = {
  artifact: 'nestjs-function-module',
  title: 'NestJS function module',
  summary: 'Cloud Function endpoint module — groups CRUD/scheduled/HTTP handlers for a single domain area.',
  steps: [
    {
      heading: 'Function map',
      path: '<apiDir>/src/app/function/<name>/<name>.function.ts',
      body: ['**Required export:** the function map for the area, e.g. `<camelName>FunctionMap` produced via `<App>FirebaseFunctionMapBuilder` or equivalent. Each entry corresponds to one Cloud Function handler.'].join('\n')
    },
    {
      heading: 'Per-verb handlers',
      path: '<apiDir>/src/app/function/<name>/<name>.create.ts',
      altPaths: ['<apiDir>/src/app/function/<name>/<name>.read.ts', '<apiDir>/src/app/function/<name>/<name>.update.ts', '<apiDir>/src/app/function/<name>/<name>.delete.ts', '<apiDir>/src/app/function/<name>/<name>.schedule.ts (for scheduled functions)'],
      body: ['Each verb file exports a function-handler factory that consumes the corresponding server-action. See the existing `apps/demo-api/src/app/function/<area>/<area>.<verb>.ts` files for shape.'].join('\n')
    },
    {
      heading: 'Wire into root function map',
      path: '<apiDir>/src/app/function/function.ts',
      body: ["Add the new area's function map into the root composition that builds the app's `httpsFunctions` / `firestoreFunctions` exports."].join('\n')
    }
  ],
  seeAlso: ['nestjs-model-module', 'firestore-model'],
  verify: 'Run `dbx_validate_model_api` against any of the per-verb handler files to confirm shape.'
};

const NESTJS_APP_MODULE: FileConventionSpec = {
  artifact: 'nestjs-app-module',
  title: 'NestJS app module',
  summary: 'Root app composition module — imports all common-model + function modules and exports the NestJS app for the API.',
  steps: [
    {
      heading: 'Root module',
      path: '<apiDir>/src/app/app.module.ts',
      body: ['**Pattern:** `@Module({ imports: [...all <Name>Module entries, ...all <Area>FunctionModule entries], ... })`. The root module is the single point where every per-domain module is composed.'].join('\n')
    },
    {
      heading: 'Bootstrap',
      path: '<apiDir>/src/main.ts',
      body: ['The Cloud Functions entry point (`main.ts`) imports the app module and exports the function map. Search for the existing bootstrap to see how it wires `NestFactory.createApplicationContext(AppModule)` with the function map composition.'].join('\n')
    }
  ],
  seeAlso: ['nestjs-model-module', 'nestjs-function-module']
};

export const FILE_CONVENTIONS: readonly FileConventionSpec[] = [FIRESTORE_MODEL, STORAGEFILE_PURPOSE, STORAGEFILE_UPLOAD_HANDLER, STORAGEFILE_PROCESSOR, STORAGEFILE_PROCESSOR_SUBTASK, NOTIFICATION_TEMPLATE, NOTIFICATION_TASK, NOTIFICATION_TASK_BOT_SCRIPT, NESTJS_MODEL_MODULE, NESTJS_FUNCTION_MODULE, NESTJS_APP_MODULE];
