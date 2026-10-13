/**
 * Per-artifact render dispatch for `dbx_artifact_scaffold`.
 *
 * Each `render*` function takes the parsed input + derived tokens
 * and returns a {@link ScaffoldArtifactResult} with file emissions
 * and manual wiring instructions. Pure — no filesystem I/O. The tool
 * wrapper layers idempotency on top by mutating each
 * {@link EmittedFile.status} based on `fs.access` results.
 */

import {
  applyTokens,
  NOTIFICATION_TASK_COMPONENT_TEMPLATE,
  NOTIFICATION_TASK_BOT_REGISTRY_TEMPLATE,
  NOTIFICATION_TASK_BOT_RUN_HANDLER_TEMPLATE,
  NOTIFICATION_TASK_BOT_SCRIPT_COMPONENT_TEMPLATE,
  NOTIFICATION_TASK_BOT_SCRIPT_PROCESSOR_TEMPLATE,
  NOTIFICATION_TASK_BOT_W1_BARREL_SCRIPT_SNIPPET,
  NOTIFICATION_TASK_BOT_W2_BARREL_REGISTRY_SNIPPET,
  NOTIFICATION_TASK_BOT_W3_REGISTRY_SNIPPET,
  NOTIFICATION_TASK_BOT_W4_HANDLER_SNIPPET,
  NOTIFICATION_TASK_BOT_W5_CONTEXT_SNIPPET,
  NOTIFICATION_TASK_BOT_W6_TASK_SERVICE_SNIPPET,
  NOTIFICATION_TASK_BOT_W7_SCHEDULE_SNIPPET,
  NOTIFICATION_TASK_BOT_W8_RULES_SNIPPET,
  NOTIFICATION_TASK_BOT_W9_ENSURE_SNIPPET,
  NOTIFICATION_TASK_HANDLER_TEMPLATE,
  NOTIFICATION_TASK_WIRING_SNIPPET,
  NOTIFICATION_TEMPLATE_COMPONENT_TEMPLATE,
  NOTIFICATION_TEMPLATE_FACTORY_TEMPLATE,
  NOTIFICATION_TEMPLATE_WIRING_SNIPPET,
  STORAGEFILE_PURPOSE_COMPONENT_TEMPLATE,
  STORAGEFILE_PURPOSE_HANDLER_TEMPLATE,
  STORAGEFILE_PURPOSE_WIRING_SNIPPET,
  type TemplateContext
} from './templates.js';
import type { EmittedFile, ScaffoldArtifactInput, ScaffoldArtifactResult, WiringStep } from './types.js';

/**
 * Dispatches to the artifact-specific renderer for the requested kind so the
 * scaffold core stays a small switch and individual renderers can grow
 * independently.
 *
 * @param input - The validated scaffold request.
 * @param ctx - The resolved template context (name tokens + project dirs)
 * @returns The artifact's emitted files and wiring instructions.
 */
export function renderArtifact(input: ScaffoldArtifactInput, ctx: TemplateContext): ScaffoldArtifactResult {
  let result: ScaffoldArtifactResult;
  switch (input.artifact) {
    case 'storagefile-purpose':
      result = renderStorageFilePurpose(input, ctx);
      break;
    case 'notification-template':
      result = renderNotificationTemplate(input, ctx);
      break;
    case 'notification-task':
      result = renderNotificationTask(input, ctx);
      break;
    case 'notification-task-bot-script':
      result = renderNotificationTaskBotScript(input, ctx);
      break;
  }
  return result;
}

// MARK: storagefile-purpose
function renderStorageFilePurpose(input: ScaffoldArtifactInput, ctx: TemplateContext): ScaffoldArtifactResult {
  const componentFile: EmittedFile = {
    status: 'append',
    path: applyTokens('<<componentDir>>/src/lib/model/storagefile/storagefile.ts', ctx),
    description: applyTokens(
      `Append the \`<<Pascal>>\` purpose block (constants + path helpers + group-ids) to the bottom of \`storagefile.ts\`. The block reuses the file's existing imports — no new top-level imports required as long as \`UploadedFileTypeIdentifier\`, \`StorageFilePurpose\`, \`StorageFileGroupId\`, \`SlashPathFolder\`, \`SlashPathFile\`, \`SlashPath\`, \`FirebaseAuthUserId\`, \`ALL_USER_UPLOADS_FOLDER_PATH\`, \`userStorageFolderPath\`, and \`userProfileStorageFileGroupId\` are already in scope (they are in the demo).`,
      ctx
    ),
    content: applyTokens(STORAGEFILE_PURPOSE_COMPONENT_TEMPLATE, ctx)
  };

  const handlerFile: EmittedFile = {
    status: 'new',
    path: applyTokens('<<apiDir>>/src/app/common/model/storagefile/handlers/upload.<<kebab>>.ts', ctx),
    description: applyTokens(`Upload-initializer factory bound to \`<<SCREAMING>>_UPLOADED_FILE_TYPE_IDENTIFIER\`. The inner variable is named \`<<camel>>FileInitializer\` so the strict-reachability trace in \`dbx_validate_app_storagefiles\` resolves cleanly when the call-site uses the same name.`, ctx),
    content: applyTokens(STORAGEFILE_PURPOSE_HANDLER_TEMPLATE, ctx)
  };

  const wiring: WiringStep[] = [
    {
      file: applyTokens('<<apiDir>>/src/app/common/model/storagefile/storagefile.upload.service.ts', ctx),
      description: applyTokens(`Import the new factory, instantiate it bound to \`<<camel>>FileInitializer\`, and push that name into the existing \`userFileInitializers\` array (or whichever array is spread into \`storageFileInitializeFromUploadService({ initializer })\`).`, ctx),
      snippet: applyTokens(STORAGEFILE_PURPOSE_WIRING_SNIPPET, ctx)
    }
  ];

  const result: ScaffoldArtifactResult = {
    artifact: input.artifact,
    tokens: ctx.tokens,
    files: [componentFile, handlerFile],
    wiring,
    summary: applyTokens(
      `Scaffolds a new \`<<SCREAMING>>_PURPOSE\` storage-file purpose end-to-end: component-side constants + path helpers (append to \`storagefile.ts\`) and an API-side upload-initializer factory in \`handlers/\`. After applying, run \`dbx_validate_app_storagefiles\` and \`dbx_validate_storagefile_folder\` against your project — both should PASS.`,
      ctx
    )
  };
  return result;
}

// MARK: notification-template
function renderNotificationTemplate(input: ScaffoldArtifactInput, ctx: TemplateContext): ScaffoldArtifactResult {
  const componentFile: EmittedFile = {
    status: 'append',
    path: applyTokens('<<componentDir>>/src/lib/model/notification/notification.ts', ctx),
    description: applyTokens(
      `Append the \`<<Pascal>>\` notification block to \`notification.ts\`: type constant + info + data interface + template factory. Reuses the file's existing imports — no new top-level imports required as long as \`NotificationTemplateType\`, \`NotificationTemplateTypeInfo\`, \`CreateNotificationTemplate\`, \`createNotificationTemplate\`, \`FirebaseAuthUserId\`, \`profileIdentity\`, and \`ProfileDocument\` are already in scope.`,
      ctx
    ),
    content: applyTokens(NOTIFICATION_TEMPLATE_COMPONENT_TEMPLATE, ctx)
  };

  const factoryFile: EmittedFile = {
    status: 'append',
    path: applyTokens('<<apiDir>>/src/app/common/model/notification/notification.factory.ts', ctx),
    description: applyTokens(
      `Append the \`<<appCamel>><<Pascal>>NotificationFactory\` to \`notification.factory.ts\`. Reuses the file's existing imports for \`NotificationMessageFunctionFactoryConfig\`, \`NotificationMessageInputContext\`, \`NotificationMessageContent\`, \`NotificationMessage\`, \`notificationMessageFunction\`, and \`NotificationTemplateServiceTypeConfig\`.`,
      ctx
    ),
    content: applyTokens(NOTIFICATION_TEMPLATE_FACTORY_TEMPLATE, ctx)
  };

  const wiring: WiringStep[] = [
    {
      file: applyTokens('<<apiDir>>/src/app/common/model/notification/notification.factory.ts', ctx),
      description: applyTokens(
        `Two registrations are required: (1) add a call to \`<<appCamel>><<Pascal>>NotificationFactory(context)\` in the existing configs-array factory return list (so the handler is reachable through the template service); (2) add \`<<SCREAMING>>_NOTIFICATION_TEMPLATE_TYPE_INFO\` to the \`*_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD\` aggregator in \`notification.ts\` so the metadata path is wired.`,
        ctx
      ),
      snippet: applyTokens(NOTIFICATION_TEMPLATE_WIRING_SNIPPET, ctx)
    }
  ];

  const result: ScaffoldArtifactResult = {
    artifact: input.artifact,
    tokens: ctx.tokens,
    files: [componentFile, factoryFile],
    wiring,
    summary: applyTokens(
      `Scaffolds a new \`<<SCREAMING>>_NOTIFICATION_TEMPLATE_TYPE\` end-to-end: component-side type + info + data + template factory (append to \`notification.ts\`) and an API-side template-service factory (append to \`notification.factory.ts\`). After applying the wiring, run \`dbx_notification_m_validate_app\` and \`dbx_notification_m_validate_folder\` against your project — both should PASS.`,
      ctx
    )
  };
  return result;
}

// MARK: notification-task
function renderNotificationTask(input: ScaffoldArtifactInput, ctx: TemplateContext): ScaffoldArtifactResult {
  const unique = input.options?.unique === true;
  const componentTemplate = applyTokens(NOTIFICATION_TASK_COMPONENT_TEMPLATE, ctx).replace('<<UNIQUE_FIELD>>', unique ? ',\n    unique: true' : '');

  const componentFile: EmittedFile = {
    status: 'append',
    path: applyTokens('<<componentDir>>/src/lib/model/notification/notification.task.ts', ctx),
    description: applyTokens(
      `Append the \`<<Pascal>>\` task block to \`notification.task.ts\`: type constant + primary checkpoint constant + checkpoint alias + data + input interfaces + template factory. Reuses the file's existing imports — no new top-level imports required as long as \`NotificationTaskType\`, \`CreateNotificationTaskTemplate\`, \`createNotificationTaskTemplate\`, \`FirebaseAuthUserId\`, and \`ProfileDocument\` are already in scope.${unique ? ' Includes `unique: true` per the requested option.' : ''}`,
      ctx
    ),
    content: componentTemplate
  };

  const handlerFile: EmittedFile = {
    status: 'new',
    path: applyTokens('<<apiDir>>/src/app/common/model/notification/handlers/task.handler.<<kebab>>.ts', ctx),
    description: applyTokens(`Task-handler factory bound to \`<<SCREAMING>>_NOTIFICATION_TASK_TYPE\`. The inner variable is named \`<<camel>>Handler\` so the strict-reachability trace in \`dbx_notification_m_validate_app\` resolves cleanly when the call-site uses the same name.`, ctx),
    content: applyTokens(NOTIFICATION_TASK_HANDLER_TEMPLATE, ctx)
  };

  const wiring: WiringStep[] = [
    {
      file: applyTokens('<<apiDir>>/src/app/common/model/notification/notification.task.service.ts', ctx),
      description: applyTokens(
        `Import the new factory, instantiate it bound to \`<<camel>>Handler\`, push that name into the existing \`handlers\` array, and add \`<<SCREAMING>>_NOTIFICATION_TASK_TYPE\` to the \`ALL_NOTIFICATION_TASK_TYPES\` aggregate in the component package's \`notification.task.ts\` so the validate-vs-handler parity check stays consistent.`,
        ctx
      ),
      snippet: applyTokens(NOTIFICATION_TASK_WIRING_SNIPPET, ctx)
    }
  ];

  const result: ScaffoldArtifactResult = {
    artifact: input.artifact,
    tokens: ctx.tokens,
    files: [componentFile, handlerFile],
    wiring,
    summary: applyTokens(
      `Scaffolds a new \`<<SCREAMING>>_NOTIFICATION_TASK_TYPE\` end-to-end: component-side type + checkpoint alias + data + template factory (append to \`notification.task.ts\`) and an API-side handler factory in \`handlers/\`. After applying the wiring (handlers array + ALL_NOTIFICATION_TASK_TYPES), run \`dbx_notification_m_validate_app\` and \`dbx_notification_m_validate_folder\` against your project — both should PASS.`,
      ctx
    )
  };
  return result;
}

// MARK: notification-task-bot-script
/**
 * Longest entry id a NotificationTaskBot accepts (`NOTIFICATION_TASK_BOT_ENTRY_ID_MAX_LENGTH` in `@dereekb/firebase`).
 */
export const NOTIFICATION_TASK_BOT_ENTRY_ID_MAX_LENGTH = 40;

function renderNotificationTaskBotScript(input: ScaffoldArtifactInput, ctx: TemplateContext): ScaffoldArtifactResult {
  if (ctx.tokens.kebab.length > NOTIFICATION_TASK_BOT_ENTRY_ID_MAX_LENGTH) {
    throw new Error(`Scaffold failed: the entry id \`${ctx.tokens.kebab}\` derived from "${input.name}" is longer than ${NOTIFICATION_TASK_BOT_ENTRY_ID_MAX_LENGTH} characters. Use a shorter name.`);
  }

  const registryPath = applyTokens('<<componentDir>>/src/lib/model/notification/notification.taskbot.ts', ctx);
  const handlerPath = applyTokens('<<apiDir>>/src/app/common/model/notification/handlers/taskbot/task.handler.taskbot.ts', ctx);

  const scriptFile: EmittedFile = {
    status: 'new',
    path: applyTokens('<<componentDir>>/src/lib/model/notification/notification.taskbot.<<kebab>>.ts', ctx),
    description: applyTokens('The `<<Pascal>>` script: script type `<<snake>>`, entry id `<<kebab>>`, default interval, entry data interface, its arktype `dataType` (which opts the script in to admin and MCP data patches through `update:entry`) and the script config.', ctx),
    content: applyTokens(NOTIFICATION_TASK_BOT_SCRIPT_COMPONENT_TEMPLATE, ctx)
  };

  const registryFile: EmittedFile = {
    status: 'new',
    path: registryPath,
    description: applyTokens("The app's NotificationTaskBot script registry: `<<AppScreaming>>_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS` and `<<AppScreaming>>_FIREBASE_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD`. Skipped when the app already has one; add the config to it instead (see the wiring).", ctx),
    content: applyTokens(NOTIFICATION_TASK_BOT_REGISTRY_TEMPLATE, ctx)
  };

  const processorFile: EmittedFile = {
    status: 'new',
    path: applyTokens('<<apiDir>>/src/app/common/model/notification/handlers/taskbot/task.handler.taskbot.<<kebab>>.ts', ctx),
    description: applyTokens('The `<<Pascal>>` script processor: a due check (`notificationTaskBotDelayUntilDue`), a fenced, idempotent run step (`runNotificationTaskBotEntryTransaction` + `markSubmitted`) and a cleanup that schedules the next run.', ctx),
    content: applyTokens(NOTIFICATION_TASK_BOT_SCRIPT_PROCESSOR_TEMPLATE, ctx)
  };

  const handlerFile: EmittedFile = {
    status: 'new',
    path: handlerPath,
    description: applyTokens('The NTBR handler factory `<<appCamel>>NotificationTaskBotRunNotificationTaskHandler`. Skipped when the app already has one; add the processor to it instead (see the wiring).', ctx),
    content: applyTokens(NOTIFICATION_TASK_BOT_RUN_HANDLER_TEMPLATE, ctx)
  };

  const barrelPath = applyTokens('<<componentDir>>/src/lib/model/notification/index.ts', ctx);
  const onFirstScript = { path: handlerPath, status: 'new' } as const;

  const wiring: WiringStep[] = [
    {
      file: barrelPath,
      description: 'Export the new script file from the notification barrel.',
      snippet: applyTokens(NOTIFICATION_TASK_BOT_W1_BARREL_SCRIPT_SNIPPET, ctx)
    },
    {
      file: barrelPath,
      description: 'Export the new registry file from the notification barrel. Satisfies `NOTIF_TASK_BOT_REGISTRY_MISSING`.',
      snippet: applyTokens(NOTIFICATION_TASK_BOT_W2_BARREL_REGISTRY_SNIPPET, ctx),
      when: { path: registryPath, status: 'new' }
    },
    {
      file: registryPath,
      description: applyTokens('Add `<<SCREAMING>>_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG` to the existing `<<AppScreaming>>_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS`. Satisfies `NOTIF_TASK_BOT_PROCESSOR_NOT_REGISTERED`.', ctx),
      snippet: applyTokens(NOTIFICATION_TASK_BOT_W3_REGISTRY_SNIPPET, ctx),
      when: { path: registryPath, status: 'exists-skipped' }
    },
    {
      file: handlerPath,
      description: applyTokens("Add `<<appCamel>><<Pascal>>NotificationTaskBotScriptProcessor(<<contextVarName>>)` to the existing NTBR handler's `processors`. Satisfies `NOTIF_TASK_BOT_SCRIPT_WITHOUT_PROCESSOR`.", ctx),
      snippet: applyTokens(NOTIFICATION_TASK_BOT_W4_HANDLER_SNIPPET, ctx),
      when: { path: handlerPath, status: 'exists-skipped' }
    },
    {
      file: applyTokens('<<apiDir>>/src/app/common/firebase/action.context.ts', ctx),
      description: applyTokens(
        'Add `AppNotificationTaskBotScriptConfigServiceRef` and the abstract `appNotificationTaskBotScriptConfigService` to `<<ContextTypeName>>`, and set `appNotificationTaskBotScriptConfigService(<<AppScreaming>>_FIREBASE_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD)` in its factory (`action.module.ts`). Without it, `notificationServerActions()` falls back to an empty registry and the NTBR handler throws at startup. Satisfies `NOTIF_TASK_BOT_REGISTRY_NOT_WIRED`.',
        ctx
      ),
      snippet: applyTokens(NOTIFICATION_TASK_BOT_W5_CONTEXT_SNIPPET, ctx),
      when: { path: registryPath, status: 'new' }
    },
    {
      file: applyTokens('<<apiDir>>/src/app/common/model/notification/notification.task.service.ts', ctx),
      description: applyTokens('Register the NTBR handler in `notificationTaskService({ handlers })`, and add `...ALL_NOTIFICATION_TASK_BOT_NOTIFICATION_TASK_TYPES` to its `validate`. Satisfies `NOTIF_TASK_BOT_HANDLER_NOT_REGISTERED` and `NOTIF_TASK_BOT_TASK_TYPES_NOT_IN_VALIDATE`.', ctx),
      snippet: applyTokens(NOTIFICATION_TASK_BOT_W6_TASK_SERVICE_SNIPPET, ctx),
      when: onFirstScript
    },
    {
      file: applyTokens('<<apiDir>>/src/app/function/notification/notification.schedule.ts', ctx),
      description: 'Run the repair sweep from the notification schedule, after `sendQueuedNotifications`, so lost runs are noticed and rescheduled. Satisfies `NOTIF_TASK_BOT_REPAIR_NOT_SCHEDULED`.',
      snippet: applyTokens(NOTIFICATION_TASK_BOT_W7_SCHEDULE_SNIPPET, ctx),
      when: onFirstScript
    },
    {
      file: 'firestore.rules',
      description: 'Add the admin-only `ntb` rule. No `firestore.indexes.json` entry is needed: the repair query uses the automatic single-field `nat` index (do not exempt `ntb.nat`). Satisfies `NOTIF_TASK_BOT_FIRESTORE_RULE_MISSING`.',
      snippet: applyTokens(NOTIFICATION_TASK_BOT_W8_RULES_SNIPPET, ctx),
      when: onFirstScript
    },
    {
      file: "the attached model's domain code (where the model is created or enabled)",
      description: applyTokens("Ensure the `<<kebab>>` entry on the model's bot with `ensureNotificationTaskBotEntryFactory`. Pass `owner` on every call.", ctx),
      snippet: applyTokens(NOTIFICATION_TASK_BOT_W9_ENSURE_SNIPPET, ctx)
    }
  ];

  const result: ScaffoldArtifactResult = {
    artifact: input.artifact,
    tokens: ctx.tokens,
    files: [scriptFile, registryFile, processorFile, handlerFile],
    wiring,
    summary: applyTokens(
      "Scaffolds the `<<SCREAMING>>_NOTIFICATION_TASK_BOT_SCRIPT_TYPE` NotificationTaskBot script end-to-end: the component-side script config (with its `dataType`), the API-side script processor and, for an app's first script, the script registry and the NTBR handler (both skipped when they already exist; the wiring then extends them instead). After applying the wiring, run `dbx_notification_m_validate_app`; the `NOTIF_TASK_BOT_*` checks should pass.",
      ctx
    )
  };
  return result;
}
