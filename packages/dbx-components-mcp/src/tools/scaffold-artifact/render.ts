/**
 * Per-artifact render dispatch for `dbx_scaffold_artifact`.
 *
 * Each `render*` function takes the parsed input + derived tokens
 * and returns a {@link ScaffoldArtifactResult} with file emissions
 * and manual wiring instructions. Pure — no filesystem I/O. The tool
 * wrapper layers idempotency on top by mutating each
 * {@link EmittedFile.status} based on `fs.access` results.
 */

import { applyTokens, NOTIFICATION_TEMPLATE_COMPONENT_TEMPLATE, NOTIFICATION_TEMPLATE_FACTORY_TEMPLATE, NOTIFICATION_TEMPLATE_WIRING_SNIPPET, STORAGEFILE_PURPOSE_COMPONENT_TEMPLATE, STORAGEFILE_PURPOSE_HANDLER_TEMPLATE, STORAGEFILE_PURPOSE_WIRING_SNIPPET, type TemplateContext } from './templates.js';
import type { ArtifactKind, EmittedFile, ScaffoldArtifactInput, ScaffoldArtifactOptions, ScaffoldArtifactResult, WiringStep } from './types.js';

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
    summary: applyTokens(`Scaffolds a new \`<<SCREAMING>>_PURPOSE\` storage-file purpose end-to-end: component-side constants + path helpers (append to \`storagefile.ts\`) and an API-side upload-initializer factory in \`handlers/\`. After applying, run \`dbx_validate_app_storagefiles\` and \`dbx_validate_storagefile_folder\` against your project — both should PASS.`, ctx)
  };
  return result;
}

// MARK: notification-template
function renderNotificationTemplate(input: ScaffoldArtifactInput, ctx: TemplateContext): ScaffoldArtifactResult {
  const componentFile: EmittedFile = {
    status: 'append',
    path: applyTokens('<<componentDir>>/src/lib/model/notification/notification.ts', ctx),
    description: applyTokens(`Append the \`<<Pascal>>\` notification block to \`notification.ts\`: type constant + info + data interface + template factory. Reuses the file's existing imports — no new top-level imports required as long as \`NotificationTemplateType\`, \`NotificationTemplateTypeInfo\`, \`CreateNotificationTemplate\`, \`createNotificationTemplate\`, \`FirebaseAuthUserId\`, \`profileIdentity\`, and \`ProfileDocument\` are already in scope.`, ctx),
    content: applyTokens(NOTIFICATION_TEMPLATE_COMPONENT_TEMPLATE, ctx)
  };

  const factoryFile: EmittedFile = {
    status: 'append',
    path: applyTokens('<<apiDir>>/src/app/common/model/notification/notification.factory.ts', ctx),
    description: applyTokens(`Append the \`<<appCamel>><<Pascal>>NotificationFactory\` to \`notification.factory.ts\`. Reuses the file's existing imports for \`NotificationMessageFunctionFactoryConfig\`, \`NotificationMessageInputContext\`, \`NotificationMessageContent\`, \`NotificationMessage\`, \`notificationMessageFunction\`, and \`NotificationTemplateServiceTypeConfig\`.`, ctx),
    content: applyTokens(NOTIFICATION_TEMPLATE_FACTORY_TEMPLATE, ctx)
  };

  const wiring: WiringStep[] = [
    {
      file: applyTokens('<<apiDir>>/src/app/common/model/notification/notification.factory.ts', ctx),
      description: applyTokens(`Two registrations are required: (1) add a call to \`<<appCamel>><<Pascal>>NotificationFactory(context)\` in the existing configs-array factory return list (so the handler is reachable through the template service); (2) add \`<<SCREAMING>>_NOTIFICATION_TEMPLATE_TYPE_INFO\` to the \`*_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD\` aggregator in \`notification.ts\` so the metadata path is wired.`, ctx),
      snippet: applyTokens(NOTIFICATION_TEMPLATE_WIRING_SNIPPET, ctx)
    }
  ];

  const result: ScaffoldArtifactResult = {
    artifact: input.artifact,
    tokens: ctx.tokens,
    files: [componentFile, factoryFile],
    wiring,
    summary: applyTokens(`Scaffolds a new \`<<SCREAMING>>_NOTIFICATION_TEMPLATE_TYPE\` end-to-end: component-side type + info + data + template factory (append to \`notification.ts\`) and an API-side template-service factory (append to \`notification.factory.ts\`). After applying the wiring, run \`dbx_validate_app_notifications\` and \`dbx_validate_notification_folder\` against your project — both should PASS.`, ctx)
  };
  return result;
}

// MARK: notification-task
function renderNotificationTask(input: ScaffoldArtifactInput, ctx: TemplateContext): ScaffoldArtifactResult {
  const files: EmittedFile[] = [placeholderEmission('append', `<<componentDir>>/src/lib/model/notification/notification.task.ts`, 'Append the new NotificationTaskType + checkpoint alias + data interface + template factory to notification.task.ts.', ctx), placeholderEmission('new', `<<apiDir>>/src/app/common/model/notification/handlers/task.handler.<<kebab>>.ts`, 'New task-handler factory in handlers/.', ctx)];
  const wiring: WiringStep[] = [{ file: applyTokens('<<apiDir>>/src/app/common/model/notification/notification.task.service.ts', ctx), description: 'Import the handler factory and add the bound result to the handlers array.' }];
  const result: ScaffoldArtifactResult = {
    artifact: input.artifact,
    tokens: ctx.tokens,
    files,
    wiring,
    summary: 'notification-task scaffold (skeleton — content TBD)'
  };
  // Suppress unused options arg until per-artifact options land.
  const _opts: ScaffoldArtifactOptions | undefined = input.options;
  void _opts;
  void artifactKindLabel;
  return result;
}

// MARK: helpers
function placeholderEmission(status: 'new' | 'append', pathTemplate: string, description: string, ctx: TemplateContext): EmittedFile {
  const path = applyTokens(pathTemplate, ctx);
  const description_ = applyTokens(description, ctx);
  const result: EmittedFile = {
    status,
    path,
    description: description_,
    content: `// TODO: scaffold body for <<Pascal>> artifact lands in a follow-up commit.\n`
  };
  return result;
}

function artifactKindLabel(kind: ArtifactKind): string {
  return kind;
}
