/**
 * Token derivation + body templates for `dbx_scaffold_artifact`.
 *
 * Templates are inline TypeScript template-literal strings with
 * `<<token>>` slots that {@link applyTokens} substitutes once per
 * invocation. Slot-token names parallel the `dbx_file_convention`
 * placeholder set ({@link NameTokens}) so callers can think in the
 * same vocabulary across both tools.
 */

import type { NameTokens } from './types.js';

/**
 * Splits a free-form name (kebab, snake, camel, pascal) into lowercase
 * word tokens.
 */
function splitWords(input: string): readonly string[] {
  const broken = input
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[\s\-_]+/)
    .filter((p) => p.length > 0);
  return broken;
}

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
  readonly contextTypeName: string;
  readonly contextVarName: string;
}

/**
 * Builds a {@link TemplateContext} from the caller's input. Project-scoped
 * tokens are derived from the basename of `componentDir`:
 * `components/demo-firebase` → package name `demo-firebase`, app stem `demo`,
 * context type `DemoFirebaseServerActionsContext`.
 */
export function buildTemplateContext(input: { readonly tokens: NameTokens; readonly componentDir: string; readonly apiDir: string }): TemplateContext {
  const componentPackageName = basenameOf(input.componentDir) || 'firebase';
  const appStemParts = splitWords(componentPackageName.replace(/-firebase$/, ''));
  const appLower = appStemParts.map((p) => p.toLowerCase());
  const appPascal = appLower.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  const appCamel = appLower.map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1))).join('');
  const contextTypeName = `${appPascal}FirebaseServerActionsContext`;
  const contextVarName = appCamel ? `${appCamel}FirebaseServerActionsContext` : 'context';
  const result: TemplateContext = {
    tokens: input.tokens,
    componentDir: input.componentDir,
    apiDir: input.apiDir,
    componentPackageName,
    appPascal,
    appCamel,
    contextTypeName,
    contextVarName
  };
  return result;
}

function basenameOf(path: string): string {
  const stripped = path.replace(/\/+$/, '');
  const parts = stripped.split('/');
  return parts[parts.length - 1] ?? '';
}

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
