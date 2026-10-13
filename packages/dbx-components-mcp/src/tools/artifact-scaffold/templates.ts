/**
 * Token derivation + body templates for `dbx_artifact_scaffold`.
 *
 * Templates are inline TypeScript template-literal strings with
 * `<<token>>` slots that {@link applyTokens} substitutes once per
 * invocation. Slot-token names parallel the `dbx_artifact_file_convention`
 * placeholder set ({@link NameTokens}) so callers can think in the
 * same vocabulary across both tools.
 */

import type { NameTokens } from './types.js';

/**
 * Splits a free-form name (kebab, snake, camel, pascal) into lowercase
 * word tokens.
 *
 * @param input - The raw identifier-like string to split.
 * @returns The lowercased word fragments preserving original ordering.
 */
function splitWords(input: string): readonly string[] {
  return input
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replaceAll(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[\s\-_]+/)
    .filter((p) => p.length > 0);
}

/**
 * Derives the canonical name tokens (camel, pascal, screaming-snake, kebab,
 * snake) used by every scaffold template from a single free-form name.
 * Throws when the input has no extractable word so templates never emit
 * empty identifiers.
 *
 * @param name - The raw artifact name supplied by the caller.
 * @returns The resolved tokens for substitution.
 * @throws {Error} When no word fragments can be extracted from `name`.
 */
export function deriveNameTokens(name: string): NameTokens {
  const parts = splitWords(name);
  if (parts.length === 0) {
    throw new Error(`Cannot derive tokens from empty name "${name}".`);
  }
  const lower = parts.map((p) => p.toLowerCase());
  const camel = lower.map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1))).join('');
  const pascal = lower.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  const screaming = lower.map((p) => p.toUpperCase()).join('_');
  const kebab = lower.join('-');
  const snake = lower.join('_');
  const result: NameTokens = { camel, pascal, screaming, kebab, snake };
  return result;
}

/**
 * Token substitution context. Slot syntax used by all templates:
 *
 * - `<<camel>>` / `<<Pascal>>` / `<<SCREAMING>>` / `<<kebab>>` / `<<snake>>` — name variants
 * - `<<componentDir>>` / `<<apiDir>>` — caller-supplied workspace paths
 * - `<<componentPackageName>>` — the component package name, derived from `componentDir`
 *   basename (`components/demo-firebase` → `demo-firebase`). Used in import sources.
 * - `<<AppPascal>>` — Pascal-cased application stem from the component package name
 *   (`demo-firebase` → `Demo`). Used in NestJS context type names.
 * - `<<ContextTypeName>>` — `<<AppPascal>>FirebaseServerActionsContext` — the type
 *   imported into handler files for the `context` parameter.
 * - `<<contextVarName>>` — camel-cased application stem (`demo`) for documentation
 *   wiring snippets. Defaults to lowercased `<<AppPascal>>`.
 */
export interface TemplateContext {
  readonly tokens: NameTokens;
  readonly componentDir: string;
  readonly apiDir: string;
  readonly componentPackageName: string;
  readonly appPascal: string;
  readonly appCamel: string;
  /**
   * SCREAMING_SNAKE application stem (`DEMO` for `demo-firebase`), or `APP` when the stem is empty.
   */
  readonly appScreaming: string;
  readonly contextTypeName: string;
  readonly contextVarName: string;
}

/**
 * Builds a {@link TemplateContext} from the caller's input. Project-scoped
 * tokens are derived from the basename of `componentDir`:
 * `components/demo-firebase` → package name `demo-firebase`, app stem `demo`,
 * context type `DemoFirebaseServerActionsContext`.
 *
 * @param input - The artifact name tokens and project directories.
 * @param input.tokens - The derived name tokens from {@link deriveNameTokens}
 * @param input.componentDir - Workspace path to the component package.
 * @param input.apiDir - Workspace path to the api package.
 * @returns The resolved template context including app-stem-derived constants.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function buildTemplateContext(input: { readonly tokens: NameTokens; readonly componentDir: string; readonly apiDir: string }): TemplateContext {
  const componentPackageName = basenameOf(input.componentDir) || 'firebase';
  const appStemParts = splitWords(componentPackageName.replace(/-firebase$/, ''));
  const appLower = appStemParts.map((p) => p.toLowerCase());
  const appPascal = appLower.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  const appCamel = appLower.map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1))).join('');
  const appScreaming = appLower.length > 0 ? appLower.join('_').toUpperCase() : 'APP';
  const contextTypeName = `${appPascal}FirebaseServerActionsContext`;
  const contextVarName = appCamel ? `${appCamel}FirebaseServerActionsContext` : 'context';
  const result: TemplateContext = {
    tokens: input.tokens,
    componentDir: input.componentDir,
    apiDir: input.apiDir,
    componentPackageName,
    appPascal,
    appCamel,
    appScreaming,
    contextTypeName,
    contextVarName
  };
  return result;
}

function basenameOf(path: string): string {
  const stripped = path.replace(/\/+$/, '');
  const parts = stripped.split('/');
  return parts.at(-1) ?? '';
}

/**
 * Substitutes every `<<token>>` slot in a template string with values from a
 * {@link TemplateContext}. The replacement order is intentional — longer or
 * more specific tokens go first so substrings (e.g. `<<Pascal>>` inside
 * `<<AppPascal>>`) cannot collide.
 *
 * @param template - The raw template string with `<<token>>` slots.
 * @param ctx - The resolved template context to substitute from.
 * @returns The template with every recognised token replaced.
 */
export function applyTokens(template: string, ctx: TemplateContext): string {
  let result = template;
  // Order: longer / more-specific tokens first to avoid partial matches.
  result = result.split('<<componentPackageName>>').join(ctx.componentPackageName);
  result = result.split('<<componentDir>>').join(ctx.componentDir);
  result = result.split('<<apiDir>>').join(ctx.apiDir);
  result = result.split('<<ContextTypeName>>').join(ctx.contextTypeName);
  result = result.split('<<contextVarName>>').join(ctx.contextVarName);
  result = result.split('<<AppPascal>>').join(ctx.appPascal);
  result = result.split('<<appCamel>>').join(ctx.appCamel);
  result = result.split('<<AppScreaming>>').join(ctx.appScreaming);
  result = result.split('<<camel>>').join(ctx.tokens.camel);
  result = result.split('<<Pascal>>').join(ctx.tokens.pascal);
  result = result.split('<<SCREAMING>>').join(ctx.tokens.screaming);
  result = result.split('<<kebab>>').join(ctx.tokens.kebab);
  result = result.split('<<snake>>').join(ctx.tokens.snake);
  return result;
}

// MARK: storagefile-purpose templates
//
// Modeled after demo's `userLog` block in
// `components/demo-firebase/src/lib/model/storagefile/storagefile.ts` and
// `apps/demo-api/src/app/common/model/storagefile/handlers/upload.user.log.ts`.
// The `<<camel>>FileInitializer` inner-variable name is intentional: the
// strict-reachability validator (`dbx_validate_app_storagefiles`) matches by
// identifier name through the trace, and the call-site naming convention is
// `<<camel>>FileInitializer = make<<Pascal>>FileUploadInitializer(context)`.

export const STORAGEFILE_PURPOSE_COMPONENT_TEMPLATE = `// === <<Pascal>> ===
/**
 * <<Pascal>> file uploaded by a user.
 */
export const <<SCREAMING>>_UPLOADED_FILE_TYPE_IDENTIFIER: UploadedFileTypeIdentifier = '<<snake>>';

/**
 * Allowed mime types for <<camel>> uploads.
 */
export const <<SCREAMING>>_UPLOADS_ALLOWED_FILE_TYPES: string[] = ['application/octet-stream']; // TODO: customize

/**
 * Folder under \`/uploads/u/{userId}/\` where <<camel>> files are uploaded.
 */
export const <<SCREAMING>>_UPLOADS_FOLDER_NAME: string = '<<kebab>>';

/**
 * Returns the uploads folder path for a user's <<camel>> files.
 */
export function <<camel>>UploadsFolderPath(userId: FirebaseAuthUserId): SlashPathFolder {
  return \`\${ALL_USER_UPLOADS_FOLDER_PATH}/\${userId}/\${<<SCREAMING>>_UPLOADS_FOLDER_NAME}/\`;
}

/**
 * Returns the full uploads file path for a user's <<camel>> file with the given name.
 */
export function <<camel>>UploadsFilePath(userId: FirebaseAuthUserId, name: SlashPathFile): SlashPath {
  return \`\${<<camel>>UploadsFolderPath(userId)}\${name}\`;
}

export const <<SCREAMING>>_PURPOSE: StorageFilePurpose = '<<snake>>';

export const <<SCREAMING>>_STORAGE_FOLDER_PATH: SlashPathFolder = '<<kebab>>/';

/**
 * Returns the final storage path for a user's <<camel>> file after upload processing.
 */
export function <<camel>>StoragePath(userId: FirebaseAuthUserId, name: SlashPathFile): SlashPath {
  return userStorageFolderPath(userId, <<SCREAMING>>_STORAGE_FOLDER_PATH, name);
}

/**
 * Returns the list of StorageFileGroupIds that a user's <<camel>> files belong to.
 */
export function <<camel>>FileGroupIds(userId: FirebaseAuthUserId): StorageFileGroupId[] {
  return [userProfileStorageFileGroupId(userId)];
}
`;

export const STORAGEFILE_PURPOSE_HANDLER_TEMPLATE = `import { ALL_USER_UPLOADS_FOLDER_PATH, createStorageFileDocumentPairFactory, determineByFilePath, determineUserByUserUploadsFolderWrapperFunction, type FirebaseAuthUserId, StorageFileCreationType } from '@dereekb/firebase';
import { type StorageFileInitializeFromUploadServiceInitializer, type StorageFileInitializeFromUploadServiceInitializerInput, type StorageFileInitializeFromUploadServiceInitializerResult } from '@dereekb/firebase-server/model';
import { type SlashPathPathMatcherPath } from '@dereekb/util';
import { <<SCREAMING>>_PURPOSE, <<SCREAMING>>_UPLOADED_FILE_TYPE_IDENTIFIER, <<SCREAMING>>_UPLOADS_FOLDER_NAME, <<camel>>FileGroupIds, <<camel>>StoragePath } from '<<componentPackageName>>';
import { type <<ContextTypeName>> } from '../../../firebase/action.context';

/**
 * Builds the upload initializer for \`<<SCREAMING>>_UPLOADED_FILE_TYPE_IDENTIFIER\`.
 *
 * The inner-variable name (\`<<camel>>FileInitializer\`) must match the
 * call-site binding in \`storagefile.upload.service.ts\` so the
 * \`dbx_validate_app_storagefiles\` strict-reachability trace can connect
 * them — see commit 8035c7bcd for the diagnostic that fires on a
 * mismatch.
 */
export function make<<Pascal>>FileUploadInitializer(context: <<ContextTypeName>>): StorageFileInitializeFromUploadServiceInitializer {
  const { storageFileCollection } = context;
  const storageFileDocumentAccessor = storageFileCollection.documentAccessor();
  const createStorageFileDocumentPair = createStorageFileDocumentPairFactory({
    defaultCreationType: StorageFileCreationType.INIT_FROM_UPLOAD
  });

  const matchUserUploadsFolderMatcherPath: SlashPathPathMatcherPath = [ALL_USER_UPLOADS_FOLDER_PATH, true];
  const determineUserFromUploadsFolderPath = determineUserByUserUploadsFolderWrapperFunction({ allowSubPaths: true });

  const determiner = determineUserFromUploadsFolderPath(
    determineByFilePath({
      fileType: <<SCREAMING>>_UPLOADED_FILE_TYPE_IDENTIFIER,
      match: {
        targetPath: [...matchUserUploadsFolderMatcherPath, <<SCREAMING>>_UPLOADS_FOLDER_NAME, true]
      }
    })
  );

  const <<camel>>FileInitializer: StorageFileInitializeFromUploadServiceInitializer = {
    type: <<SCREAMING>>_UPLOADED_FILE_TYPE_IDENTIFIER,
    initialize: async function (input: StorageFileInitializeFromUploadServiceInitializerInput): Promise<StorageFileInitializeFromUploadServiceInitializerResult> {
      const { file } = input.fileDetailsAccessor.getPathDetails();
      const userId = input.determinerResult.user as FirebaseAuthUserId;

      const newPath = <<camel>>StoragePath(userId, file as string);
      const createdFile = await input.fileDetailsAccessor.copy(newPath);

      const { storageFileDocument } = await createStorageFileDocumentPair({
        accessor: storageFileDocumentAccessor,
        file: createdFile,
        user: userId,
        purpose: <<SCREAMING>>_PURPOSE,
        storageFileGroupIds: <<camel>>FileGroupIds(userId),
        shouldBeProcessed: false
      });

      const result: StorageFileInitializeFromUploadServiceInitializerResult = { createdFile, storageFileDocument };
      return result;
    },
    determiner
  };

  return <<camel>>FileInitializer;
}
`;

export const STORAGEFILE_PURPOSE_WIRING_SNIPPET = `// Imports:
import { make<<Pascal>>FileUploadInitializer } from './handlers/upload.<<kebab>>';

// Inside the upload-service factory:
const <<camel>>FileInitializer = make<<Pascal>>FileUploadInitializer(<<contextVarName>>);

// Add to the existing initializer array:
const userFileInitializers = [/* ... */, <<camel>>FileInitializer];
`;

// MARK: notification-template templates
//
// Modeled after demo's `EXAMPLE_NOTIFICATION_TEMPLATE_TYPE` block in
// `components/demo-firebase/src/lib/model/notification/notification.ts` and
// the `demoExampleNotificationFactory` in
// `apps/demo-api/src/app/common/model/notification/notification.factory.ts`.

export const NOTIFICATION_TEMPLATE_COMPONENT_TEMPLATE = `// MARK: <<Pascal>> Notification
export const <<SCREAMING>>_NOTIFICATION_TEMPLATE_TYPE: NotificationTemplateType = '<<SCREAMING>>'; // TODO: shorten to a stable abbreviation if needed

export const <<SCREAMING>>_NOTIFICATION_TEMPLATE_TYPE_INFO: NotificationTemplateTypeInfo = {
  type: <<SCREAMING>>_NOTIFICATION_TEMPLATE_TYPE,
  name: '<<Pascal>>',
  description: 'TODO: describe the <<Pascal>> notification.',
  notificationModelIdentity: profileIdentity // TODO: replace with the model identity this notification targets
};

export interface <<Pascal>>NotificationData {
  readonly uid: FirebaseAuthUserId;
  // TODO: add notification-specific fields
}

export interface <<Pascal>>NotificationInput extends Omit<<<Pascal>>NotificationData, 'uid'> {
  readonly profileDocument: ProfileDocument;
}

/**
 * Creates a notification template for the <<Pascal>> notification type.
 */
export function <<camel>>NotificationTemplate(input: <<Pascal>>NotificationInput): CreateNotificationTemplate {
  const { profileDocument } = input;
  const uid = profileDocument.id;

  return createNotificationTemplate({
    type: <<SCREAMING>>_NOTIFICATION_TEMPLATE_TYPE,
    notificationModel: profileDocument,
    targetModel: profileDocument,
    data: { uid }
  });
}
`;

export const NOTIFICATION_TEMPLATE_FACTORY_TEMPLATE = `/**
 * Creates a notification template config for <<Pascal>> notifications.
 */
export function <<appCamel>><<Pascal>>NotificationFactory(_context: <<ContextTypeName>>): NotificationTemplateServiceTypeConfig {
  return {
    type: <<SCREAMING>>_NOTIFICATION_TEMPLATE_TYPE,
    factory: async (config: NotificationMessageFunctionFactoryConfig<<<Pascal>>NotificationData>) => {
      const { item } = config;

      return notificationMessageFunction(async (inputContext: NotificationMessageInputContext) => {
        const content: NotificationMessageContent = {
          title: '<<Pascal>>',
          openingMessage: 'TODO: write the opening message.',
          action: 'View',
          actionUrl: '' // TODO: build action URL from item.m
        };

        const result: NotificationMessage = {
          inputContext,
          item,
          content
        };

        return result;
      });
    }
  };
}
`;

export const NOTIFICATION_TEMPLATE_WIRING_SNIPPET = `// 1. Import in notification.factory.ts:
import { <<SCREAMING>>_NOTIFICATION_TEMPLATE_TYPE, type <<Pascal>>NotificationData } from '<<componentPackageName>>';

// 2. Add the new factory call to the configs-array factory return list:
export const <<camel>>NotificationTemplateServiceConfigsArrayFactory = (context: <<ContextTypeName>>) => {
  return [/* existing factories */, <<appCamel>><<Pascal>>NotificationFactory(context)];
};

// 3. Register the info constant in the aggregator (notification.ts):
export const <<componentPackageName>>NotificationTemplateTypeInfoRecord = notificationTemplateTypeInfoRecord([
  /* existing infos */,
  <<SCREAMING>>_NOTIFICATION_TEMPLATE_TYPE_INFO
]);
`;

// MARK: notification-task templates
//
// Modeled after demo's `EXAMPLE_HANDLED_NOTIFICATION_TASK_TYPE` block in
// `components/demo-firebase/src/lib/model/notification/notification.task.ts`
// and `apps/demo-api/src/app/common/model/notification/handlers/task.handler.example.handled.ts`.
// Inner-variable naming convention (`<<camel>>Handler`) supports the
// notification cross-file validator's strict-reachability trace; the
// trace is permissive enough that the leaf bindingName matters more
// than call-site name matching, but keeping them aligned avoids
// surprises when the trace's chain-walking falls back.

export const NOTIFICATION_TASK_COMPONENT_TEMPLATE = `// MARK: <<Pascal>> Notification Task
export const <<SCREAMING>>_NOTIFICATION_TASK_TYPE: NotificationTaskType = '<<SCREAMING>>'; // TODO: shorten to a stable abbreviation if needed

export const <<SCREAMING>>_NOTIFICATION_TASK_PRIMARY_CHECKPOINT = 'primary';

export type <<Pascal>>NotificationTaskCheckpoint = typeof <<SCREAMING>>_NOTIFICATION_TASK_PRIMARY_CHECKPOINT;

export interface <<Pascal>>NotificationTaskData {
  readonly uid: FirebaseAuthUserId;
  // TODO: add task-specific fields
}

export interface <<Pascal>>NotificationTaskInput extends Omit<<<Pascal>>NotificationTaskData, 'uid'> {
  readonly profileDocument: ProfileDocument;
}

/**
 * Creates a notification task template for the <<Pascal>> notification task type.
 */
export function <<camel>>NotificationTaskTemplate(input: <<Pascal>>NotificationTaskInput): CreateNotificationTaskTemplate {
  const { profileDocument } = input;
  const uid = profileDocument.id;

  return createNotificationTaskTemplate({
    type: <<SCREAMING>>_NOTIFICATION_TASK_TYPE,
    notificationModel: profileDocument,
    targetModel: profileDocument,
    data: { uid }<<UNIQUE_FIELD>>
  });
}

// Add the new task type to the all-types aggregate at the bottom of this file:
//   export const ALL_NOTIFICATION_TASK_TYPES: NotificationTaskType[] = [..., <<SCREAMING>>_NOTIFICATION_TASK_TYPE];
`;

export const NOTIFICATION_TASK_HANDLER_TEMPLATE = `import { type NotificationTaskServiceTaskHandlerConfig } from '@dereekb/firebase-server/model';
import { <<SCREAMING>>_NOTIFICATION_TASK_PRIMARY_CHECKPOINT, <<SCREAMING>>_NOTIFICATION_TASK_TYPE, type <<Pascal>>NotificationTaskCheckpoint, type <<Pascal>>NotificationTaskData } from '<<componentPackageName>>';
import { type <<ContextTypeName>> } from '../../../firebase/action.context';

/**
 * Builds the handler config for the <<Pascal>> notification task. The
 * inner-variable name (\`<<camel>>Handler\`) aligns with the call-site
 * binding in \`notification.task.service.ts\` so the cross-file
 * validator's strict-reachability trace resolves cleanly. See commit
 * 475129fd2 for the diagnostic that fires on a mismatch.
 */
export function <<appCamel>><<Pascal>>NotificationTaskHandler(_context: <<ContextTypeName>>): NotificationTaskServiceTaskHandlerConfig<<<Pascal>>NotificationTaskData, <<Pascal>>NotificationTaskCheckpoint> {
  const <<camel>>Handler: NotificationTaskServiceTaskHandlerConfig<<<Pascal>>NotificationTaskData, <<Pascal>>NotificationTaskCheckpoint> = {
    type: <<SCREAMING>>_NOTIFICATION_TASK_TYPE,
    flow: [
      {
        checkpoint: <<SCREAMING>>_NOTIFICATION_TASK_PRIMARY_CHECKPOINT,
        fn: async (_notificationTask) => {
          // TODO: implement the task body.
          const result = { completion: true };
          return result;
        }
      }
    ]
  };
  return <<camel>>Handler;
}
`;

export const NOTIFICATION_TASK_WIRING_SNIPPET = `// Imports in notification.task.service.ts:
import { <<appCamel>><<Pascal>>NotificationTaskHandler } from './handlers/task.handler.<<kebab>>';

// Inside the task-service factory:
const <<camel>>Handler = <<appCamel>><<Pascal>>NotificationTaskHandler(<<contextVarName>>);

// Add to the existing handlers array:
const handlers: NotificationTaskServiceTaskHandlerConfig<any>[] = [/* ... */, <<camel>>Handler];

// Also add the new task type to ALL_NOTIFICATION_TASK_TYPES in
// components/<<componentPackageName>>/src/lib/model/notification/notification.task.ts:
//   export const ALL_NOTIFICATION_TASK_TYPES: NotificationTaskType[] = [..., <<SCREAMING>>_NOTIFICATION_TASK_TYPE];
`;

// MARK: notification-task-bot-script templates
//
// Modeled after the demo's ping scripts:
// `components/demo-firebase/src/lib/model/notification/notification.taskbot.ts` (script type, entry id, data + its
// arktype `dataType`, script config, registry) and
// `apps/demo-api/src/app/common/model/notification/handlers/taskbot/task.handler.taskbot.ts` (processor + NTBR handler).

/**
 * Component-side script file: script type, entry id, default interval, entry data, its `dataType` and the script config.
 */
export const NOTIFICATION_TASK_BOT_SCRIPT_COMPONENT_TEMPLATE = `import { type, type Type } from 'arktype';
import { type NotificationTaskBotEntryId, type NotificationTaskBotScriptConfig, type NotificationTaskBotScriptType } from '@dereekb/firebase';
import { type Maybe, type Milliseconds, MS_IN_HOUR } from '@dereekb/util';

// MARK: <<Pascal>>
/**
 * Script type of the <<Pascal>> NotificationTaskBot script.
 *
 * TODO: describe what one run of the script does, and which model the bot is attached to.
 */
export const <<SCREAMING>>_NOTIFICATION_TASK_BOT_SCRIPT_TYPE: NotificationTaskBotScriptType = '<<snake>>';

/**
 * Entry id the <<Pascal>> script uses on a bot. Must match \`^[a-z0-9-]+$\`, at most 40 characters.
 */
export const <<SCREAMING>>_NOTIFICATION_TASK_BOT_ENTRY_ID: NotificationTaskBotEntryId = '<<kebab>>';

/**
 * Default time between <<Pascal>> runs.
 */
export const DEFAULT_<<SCREAMING>>_NOTIFICATION_TASK_BOT_INTERVAL: Milliseconds = MS_IN_HOUR; // TODO: choose the cadence

/**
 * Permanent data stored on a <<Pascal>> entry. Keep it small: every bot write rewrites the whole entries array.
 */
export interface <<Pascal>>NotificationTaskBotEntryData {
  /**
   * Interval between runs. Defaults to {@link DEFAULT_<<SCREAMING>>_NOTIFICATION_TASK_BOT_INTERVAL}.
   */
  readonly iv?: Maybe<Milliseconds>;
  // TODO: add the entry's durable fields (counters, flags)
}

/**
 * arktype type of {@link <<Pascal>>NotificationTaskBotEntryData}. Set as the script's \`dataType\`, so an admin (or the MCP) can patch an
 * entry's data through \`update:entry\`. Unknown keys are refused. Keep it in step with the interface.
 */
export const <<camel>>NotificationTaskBotEntryDataType = type({
  'iv?': 'number.integer > 0'
}).onUndeclaredKey('reject') as Type<<<Pascal>>NotificationTaskBotEntryData>;

/**
 * Script config for the <<Pascal>> script. Add it to the app's NotificationTaskBot script registry.
 */
export const <<SCREAMING>>_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG: NotificationTaskBotScriptConfig = {
  scriptType: <<SCREAMING>>_NOTIFICATION_TASK_BOT_SCRIPT_TYPE,
  name: '<<Pascal>>',
  description: 'TODO: describe the <<Pascal>> script.',
  dataType: <<camel>>NotificationTaskBotEntryDataType
  // To let the bot's owner turn this script off, add a \`group\` and \`allowOwnerOptOut: true\`. Declare the
  // NotificationTaskBotScriptGroup in its own file (not notification.taskbot.ts) to avoid an import cycle with the registry.
};
`;

/**
 * Component-side registry file. Emitted only for an app's first script.
 */
export const NOTIFICATION_TASK_BOT_REGISTRY_TEMPLATE = `import { type NotificationTaskBotScriptConfig, notificationTaskBotScriptConfigRecord } from '@dereekb/firebase';
import { <<SCREAMING>>_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG } from './notification.taskbot.<<kebab>>';

// MARK: Registry
/**
 * All <<AppPascal>> NotificationTaskBot script configs. Every script needs a processor in the API's NTBR handler.
 */
export const <<AppScreaming>>_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS: NotificationTaskBotScriptConfig[] = [<<SCREAMING>>_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG];

/**
 * The <<AppPascal>> app's NotificationTaskBot script registry. The API passes it to \`appNotificationTaskBotScriptConfigService()\` on its server actions context.
 */
export const <<AppScreaming>>_FIREBASE_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD = notificationTaskBotScriptConfigRecord(<<AppScreaming>>_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS);
`;

/**
 * API-side script processor file.
 */
export const NOTIFICATION_TASK_BOT_SCRIPT_PROCESSOR_TEMPLATE = `import { type NotificationTaskBotScriptProcessorConfig, notificationTaskBotDelayUntilDue, runNotificationTaskBotEntryTransaction } from '@dereekb/firebase-server/model';
import { addMilliseconds } from '@dereekb/util';
import { DEFAULT_<<SCREAMING>>_NOTIFICATION_TASK_BOT_INTERVAL, <<SCREAMING>>_NOTIFICATION_TASK_BOT_SCRIPT_TYPE, type <<Pascal>>NotificationTaskBotEntryData } from '<<componentPackageName>>';
import { type <<ContextTypeName>> } from '../../../../firebase/action.context';

/**
 * Subtask of the <<Pascal>> script that waits until the run is due.
 */
export const <<SCREAMING>>_NOTIFICATION_TASK_BOT_WAIT_SUBTASK = 'wait';

/**
 * Subtask of the <<Pascal>> script that performs the run.
 */
export const <<SCREAMING>>_NOTIFICATION_TASK_BOT_RUN_SUBTASK = 'run';

/**
 * Builds the processor for the <<Pascal>> NotificationTaskBot script. Add it to the NTBR handler's \`processors\`.
 *
 * - wait: delays the run until \`lsat + iv\`, unless the run is FORCED or explicit.
 * - run: creates the run's side effect in a fenced transaction and marks the run submitted, so a re-run step never submits twice.
 * - cleanup: schedules the next run after \`iv\`.
 *
 * @param _context - Server actions context. Rename it to \`context\` once the run step uses it.
 * @returns The script processor.
 */
export function <<appCamel>><<Pascal>>NotificationTaskBotScriptProcessor(_context: <<ContextTypeName>>): NotificationTaskBotScriptProcessorConfig<<<Pascal>>NotificationTaskBotEntryData> {
  return {
    target: <<SCREAMING>>_NOTIFICATION_TASK_BOT_SCRIPT_TYPE,
    flow: [
      {
        subtask: <<SCREAMING>>_NOTIFICATION_TASK_BOT_WAIT_SUBTASK,
        fn: async (input) => {
          const { lsat, d } = input.entry;
          const due = addMilliseconds(lsat, d?.iv ?? DEFAULT_<<SCREAMING>>_NOTIFICATION_TASK_BOT_INTERVAL);
          return (await notificationTaskBotDelayUntilDue(input, due)) ?? { completion: <<SCREAMING>>_NOTIFICATION_TASK_BOT_WAIT_SUBTASK };
        }
      },
      {
        subtask: <<SCREAMING>>_NOTIFICATION_TASK_BOT_RUN_SUBTASK,
        fn: async (input) => {
          await runNotificationTaskBotEntryTransaction<void, <<Pascal>>NotificationTaskBotEntryData>(input, async ({ alreadySubmitted, markSubmitted }) => {
            // a re-run of this step finds the run already submitted, and does not submit twice
            if (!alreadySubmitted) {
              // TODO: create the run's side effect with the context's \`transaction\`, e.g.
              // createNotificationDocument({ context, transaction, template: <yourTemplate>({ ... }) })
              markSubmitted();
            }
          });

          return { completion: <<SCREAMING>>_NOTIFICATION_TASK_BOT_RUN_SUBTASK };
        }
      }
    ],
    cleanup: (input) => ({ nextRunAt: addMilliseconds(new Date(), input.entry.d?.iv ?? DEFAULT_<<SCREAMING>>_NOTIFICATION_TASK_BOT_INTERVAL) })
  };
}
`;

/**
 * API-side NTBR handler file. Emitted only for an app's first script.
 */
export const NOTIFICATION_TASK_BOT_RUN_HANDLER_TEMPLATE = `import { type NotificationTaskBotRunNotificationTaskData } from '@dereekb/firebase';
import { type NotificationTaskServiceTaskHandlerConfig, notificationTaskBotRunNotificationTaskHandler } from '@dereekb/firebase-server/model';
import { <<AppScreaming>>_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS } from '<<componentPackageName>>';
import { type <<ContextTypeName>> } from '../../../../firebase/action.context';
import { <<appCamel>><<Pascal>>NotificationTaskBotScriptProcessor } from './task.handler.taskbot.<<kebab>>';

/**
 * Builds the handler config for the \`NTBR\` NotificationTaskBot run task. Register it in \`notificationTaskService({ handlers })\`
 * and add \`...ALL_NOTIFICATION_TASK_BOT_NOTIFICATION_TASK_TYPES\` to its \`validate\` list.
 *
 * Every script in the registry needs a processor here, and every processor's target must be registered; the handler throws at startup otherwise.
 *
 * @param <<contextVarName>> - Server actions context providing the NotificationTaskBot collections and script registry.
 * @returns The task-handler config registered into \`NotificationTaskService\`.
 */
export function <<appCamel>>NotificationTaskBotRunNotificationTaskHandler(<<contextVarName>>: <<ContextTypeName>>): NotificationTaskServiceTaskHandlerConfig<NotificationTaskBotRunNotificationTaskData> {
  return notificationTaskBotRunNotificationTaskHandler({
    processors: [<<appCamel>><<Pascal>>NotificationTaskBotScriptProcessor(<<contextVarName>>)],
    validate: <<AppScreaming>>_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS.map((x) => x.scriptType),
    notificationTaskBotContext: <<contextVarName>>
  });
}
`;

/**
 * W1 — export the new script file from the component's notification barrel.
 */
export const NOTIFICATION_TASK_BOT_W1_BARREL_SCRIPT_SNIPPET = `export * from './notification.taskbot.<<kebab>>';
`;

/**
 * W2 — export the new registry file from the component's notification barrel (first script only).
 */
export const NOTIFICATION_TASK_BOT_W2_BARREL_REGISTRY_SNIPPET = `export * from './notification.taskbot';
`;

/**
 * W3 — add the new config to an existing registry.
 */
export const NOTIFICATION_TASK_BOT_W3_REGISTRY_SNIPPET = `import { <<SCREAMING>>_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG } from './notification.taskbot.<<kebab>>';

export const <<AppScreaming>>_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS: NotificationTaskBotScriptConfig[] = [
  // ...existing script configs,
  <<SCREAMING>>_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG
];
`;

/**
 * W4 — add the new processor to an existing NTBR handler.
 */
export const NOTIFICATION_TASK_BOT_W4_HANDLER_SNIPPET = `import { <<appCamel>><<Pascal>>NotificationTaskBotScriptProcessor } from './task.handler.taskbot.<<kebab>>';

  return notificationTaskBotRunNotificationTaskHandler({
    processors: [
      // ...existing processors,
      <<appCamel>><<Pascal>>NotificationTaskBotScriptProcessor(<<contextVarName>>)
    ],
    validate: <<AppScreaming>>_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS.map((x) => x.scriptType),
    notificationTaskBotContext: <<contextVarName>>
  });
`;

/**
 * W5 — set the script registry on the server actions context (first script only).
 */
export const NOTIFICATION_TASK_BOT_W5_CONTEXT_SNIPPET = `// action.context.ts
import { type AppNotificationTaskBotScriptConfigService, type AppNotificationTaskBotScriptConfigServiceRef } from '@dereekb/firebase';

export abstract class <<ContextTypeName>> implements FirebaseServerActionsContext, AppNotificationTaskBotScriptConfigServiceRef /* , ...existing refs */ {
  abstract readonly appNotificationTaskBotScriptConfigService: AppNotificationTaskBotScriptConfigService;
  // ...existing members
}

// action.module.ts — in the context factory
import { appNotificationTaskBotScriptConfigService } from '@dereekb/firebase';
import { <<AppScreaming>>_FIREBASE_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD } from '<<componentPackageName>>';

    appNotificationTaskBotScriptConfigService: appNotificationTaskBotScriptConfigService(<<AppScreaming>>_FIREBASE_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD),
`;

/**
 * W6 — register the NTBR handler in the task service (first script only).
 */
export const NOTIFICATION_TASK_BOT_W6_TASK_SERVICE_SNIPPET = `import { ALL_NOTIFICATION_TASK_BOT_NOTIFICATION_TASK_TYPES } from '@dereekb/firebase';
import { <<appCamel>>NotificationTaskBotRunNotificationTaskHandler } from './handlers/taskbot/task.handler.taskbot';

  const notificationTaskBotHandler = <<appCamel>>NotificationTaskBotRunNotificationTaskHandler(<<contextVarName>>);

  return notificationTaskService({
    validate: [...ALL_NOTIFICATION_TASK_TYPES, ...ALL_NOTIFICATION_TASK_BOT_NOTIFICATION_TASK_TYPES],
    handlers: [/* ...existing handlers, */ notificationTaskBotHandler]
  });
`;

/**
 * W7 — run the repair sweep from the notification schedule (first script only).
 */
export const NOTIFICATION_TASK_BOT_W7_SCHEDULE_SNIPPET = `    // repair NotificationTaskBot entries whose run went missing, after the queue had its chance to run them
    repairAllNotificationTaskBots: async () => {
      const repairAllNotificationTaskBotsResult = await request.nest.notificationActions.repairAllNotificationTaskBots();
      return { repairAllNotificationTaskBotsResult };
    }
`;

/**
 * W8 — the admin-only `ntb` Firestore rule (first script only).
 */
export const NOTIFICATION_TASK_BOT_W8_RULES_SNIPPET = `    // NotificationTaskBot: admin-only. Owners read and change their opt-outs through the read:optOuts / update:optOut callables.
    match /ntb/{notificationTaskBot} {
      allow get, list: if userClaimsIsSysAdmin();
    }
`;

/**
 * W9 — ensure the entry from the attached model's lifecycle.
 */
export const NOTIFICATION_TASK_BOT_W9_ENSURE_SNIPPET = `import { ensureNotificationTaskBotEntryFactory } from '@dereekb/firebase-server/model';
import { <<SCREAMING>>_NOTIFICATION_TASK_BOT_ENTRY_ID, <<SCREAMING>>_NOTIFICATION_TASK_BOT_SCRIPT_TYPE } from '<<componentPackageName>>';

// where the attached model is created or enabled:
await ensureNotificationTaskBotEntryFactory(<<contextVarName>>)({
  model: modelDocument.key,
  entryId: <<SCREAMING>>_NOTIFICATION_TASK_BOT_ENTRY_ID,
  scriptType: <<SCREAMING>>_NOTIFICATION_TASK_BOT_SCRIPT_TYPE,
  data: {},
  owner: modelDocument.key // pass the owner on every call; it keys the owner's opt-outs (the demo uses the model key, as its NotificationBox does)
});
`;
