/**
 * Per-artifact render dispatch for `dbx_scaffold_artifact`.
 *
 * Each `render*` function takes the parsed input + derived tokens
 * and returns a {@link ScaffoldArtifactResult} with file emissions
 * and manual wiring instructions. Pure — no filesystem I/O. The tool
 * wrapper layers idempotency on top by mutating each
 * {@link EmittedFile.status} based on `fs.access` results.
 */

import { applyTokens, type TemplateContext } from './templates.js';
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
  const files: EmittedFile[] = [placeholderEmission('append', `<<componentDir>>/src/lib/model/storagefile/storagefile.ts`, 'Append the new purpose constants + path helpers to the existing storagefile.ts.', ctx), placeholderEmission('new', `<<apiDir>>/src/app/common/model/storagefile/handlers/upload.<<kebab>>.ts`, 'New upload-initializer factory in handlers/.', ctx)];
  const wiring: WiringStep[] = [{ file: applyTokens('<<apiDir>>/src/app/common/model/storagefile/storagefile.upload.service.ts', ctx), description: 'Import the factory and add it to the initializer array.' }];
  const result: ScaffoldArtifactResult = {
    artifact: input.artifact,
    tokens: ctx.tokens,
    files,
    wiring,
    summary: 'storagefile-purpose scaffold (skeleton — content TBD)'
  };
  return result;
}

// MARK: notification-template
function renderNotificationTemplate(input: ScaffoldArtifactInput, ctx: TemplateContext): ScaffoldArtifactResult {
  const files: EmittedFile[] = [placeholderEmission('append', `<<componentDir>>/src/lib/model/notification/notification.ts`, 'Append the new NotificationTemplateType + info + factory to notification.ts.', ctx), placeholderEmission('append', `<<apiDir>>/src/app/common/model/notification/notification.factory.ts`, 'Append the handler factory to notification.factory.ts.', ctx)];
  const wiring: WiringStep[] = [{ file: applyTokens('<<apiDir>>/src/app/common/model/notification/notification.factory.ts', ctx), description: 'Add factory call to the configs-array factory return list, and add the info constant to the template-info record aggregator.' }];
  const result: ScaffoldArtifactResult = {
    artifact: input.artifact,
    tokens: ctx.tokens,
    files,
    wiring,
    summary: 'notification-template scaffold (skeleton — content TBD)'
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
