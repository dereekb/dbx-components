/**
 * Builds the NotificationTaskBot section ({@link TaskBotSummary}) of the `dbx_notification_m_list_app` report from the
 * validator's NotificationTaskBot extraction. Picks the registry and NTBR handlers with the same selectors the
 * `NOTIF_TASK_BOT_*` rules use, so the section agrees with the validator's findings.
 */

import {
  isTaskBotRegistryWired,
  scriptTypeRefKey,
  selectTaskBotRegistry,
  selectTaskBotRunHandlerCalls,
  taskBotLocationKey,
  taskServiceCallListsTaskBotTypes,
  type ExtractedAppNotificationTaskBot,
  type ExtractedAppNotifications,
  type ExtractedTaskBotRegistry,
  type ExtractedTaskBotRunHandlerCall,
  type ExtractedTaskBotScriptConfig,
  type ExtractedTaskBotScriptTypeRef,
  type ExtractedTaskBotSide
} from '../notification-m-validate-app/index.js';
import type { TaskBotHandlerSummary, TaskBotRegistrySummary, TaskBotScriptSummary, TaskBotSummary } from './types.js';

/**
 * Builds the NotificationTaskBot section of the report.
 *
 * @param extracted - The validator extraction; only its `taskBot` and `taskServiceCalls` are read.
 * @returns The NotificationTaskBot section. Always present; `inUse: false` for an app without bots.
 */
export function buildTaskBotSummary(extracted: Pick<ExtractedAppNotifications, 'taskBot' | 'taskServiceCalls'>): TaskBotSummary {
  const { taskBot } = extracted;
  const registry = selectTaskBotRegistry(taskBot);
  const { reachedKeys, considered } = selectTaskBotRunHandlerCalls(extracted);

  const registries: TaskBotRegistrySummary[] = taskBot.registries.map((r) => ({
    symbolName: r.symbolName,
    side: r.side,
    sourceFile: r.sourceFile,
    line: r.line,
    scriptTypes: r.configs.flatMap((c) => (c.scriptType ? [c.scriptType] : [])),
    unresolvedReferences: r.unresolvedReferences,
    trustedReferences: r.trustedReferences,
    wired: isTaskBotRegistryWired(r, taskBot.registryWirings)
  }));

  const handlers: TaskBotHandlerSummary[] = taskBot.runHandlerCalls.map((call) => ({
    sourceFile: call.sourceFile,
    line: call.line,
    reachable: reachedKeys.has(taskBotLocationKey(call)),
    processorsResolved: call.processorsResolved,
    processors: call.processors,
    validateStatus: call.validateStatus,
    validateUsesRegistry: call.validateUsesRegistry,
    validate: call.validate,
    validateUnresolvedReason: call.validateUnresolvedReason
  }));

  const result: TaskBotSummary = {
    inUse: taskBot.taskBotInUse,
    registries,
    registryWirings: taskBot.registryWirings.map((w) => ({ kind: w.kind, recordIdentifier: w.recordIdentifier, sourceFile: w.sourceFile, line: w.line })),
    handlers,
    taskTypesInTaskServiceValidate: extracted.taskServiceCalls.some((call) => taskServiceCallListsTaskBotTypes(call)),
    repairCalls: taskBot.repairCalls.map((x) => ({ sourceFile: x.sourceFile, line: x.line })),
    scripts: buildTaskBotScriptSummaries({ taskBot, registry, considered })
  };
  return result;
}

// MARK: Scripts
interface BuildTaskBotScriptSummariesInput {
  readonly taskBot: ExtractedAppNotificationTaskBot;
  readonly registry: ExtractedTaskBotRegistry | undefined;
  readonly considered: readonly ExtractedTaskBotRunHandlerCall[];
}

/**
 * A script row while it is being joined. Each join step fills only the fields that are still unset.
 */
interface ScriptRowDraft {
  readonly key: string;
  scriptType: string | undefined;
  symbolName: string | undefined;
  side: ExtractedTaskBotSide | undefined;
  sourceFile: string | undefined;
  config: ExtractedTaskBotScriptConfig | undefined;
  readonly processorLabels: string[];
}

/**
 * The row key of a config: its script type's key, or its own location when it has no `scriptType`.
 *
 * @param config - The script config.
 * @returns The row key.
 */
function configRowKey(config: ExtractedTaskBotScriptConfig): string {
  return scriptTypeRefKey(config.scriptType) ?? `config:${config.side}:${config.sourceFile}:${config.line}`;
}

/**
 * Joins the script type constants, configs, processors and handler `validate` entries into one row per script type.
 *
 * @param input - The extraction, the selected registry and the considered NTBR handlers.
 * @returns One summary per script type, in first-seen order.
 */
function buildTaskBotScriptSummaries(input: BuildTaskBotScriptSummariesInput): TaskBotScriptSummary[] {
  const { taskBot, registry, considered } = input;
  const rows = new Map<string, ScriptRowDraft>();

  function rowFor(key: string): ScriptRowDraft {
    let row = rows.get(key);
    if (!row) {
      row = { key, scriptType: undefined, symbolName: undefined, side: undefined, sourceFile: undefined, config: undefined, processorLabels: [] };
      rows.set(key, row);
    }
    return row;
  }

  function joinRef(ref: ExtractedTaskBotScriptTypeRef | undefined): ScriptRowDraft | undefined {
    const key = scriptTypeRefKey(ref);
    let row: ScriptRowDraft | undefined;
    if (ref && key !== undefined) {
      row = rowFor(key);
      row.scriptType ??= ref.code;
      row.symbolName ??= ref.identifier;
    }
    return row;
  }

  // 1. Type constants
  for (const constant of taskBot.scriptTypeConstants) {
    const row = rowFor(constant.typeCode === undefined ? `id:${constant.symbolName}` : `code:${constant.typeCode}`);
    row.scriptType ??= constant.typeCode;
    row.symbolName ??= constant.symbolName;
    row.side ??= constant.side;
    row.sourceFile ??= constant.sourceFile;
  }

  // 2. Configs (the selected registry's first, so a wired config wins)
  const configs = new Set([...(registry?.configs ?? []), ...taskBot.registries.flatMap((r) => r.configs), ...taskBot.scriptConfigs]);
  for (const config of configs) {
    const row = joinRef(config.scriptType) ?? rowFor(configRowKey(config));
    row.config ??= config;
    row.side ??= config.side;
    row.sourceFile ??= config.sourceFile;
  }

  // 3. Processors
  for (const call of considered) {
    for (const processor of call.processors) {
      joinRef(processor.target)?.processorLabels.push(processor.label);
    }
  }

  // 4. Handler validate entries
  for (const call of considered) {
    for (const ref of call.validate) {
      joinRef(ref);
    }
  }

  const registryKeys = new Set((registry?.configs ?? []).map((c) => configRowKey(c)));
  const validateReadable = considered.length > 0 && considered.every((call) => call.validateStatus === 'resolved');

  return Array.from(rows.values()).map((row) => {
    const { config } = row;
    const inRegistry = registryKeys.has(row.key);
    const listed = considered.some((call) => (call.validateUsesRegistry && inRegistry) || call.validate.some((ref) => scriptTypeRefKey(ref) === row.key));
    let inHandlerValidate: boolean | undefined;
    if (listed) {
      inHandlerValidate = true;
    } else if (validateReadable) {
      inHandlerValidate = false;
    }
    const summary: TaskBotScriptSummary = {
      scriptType: row.scriptType,
      symbolName: row.symbolName,
      side: row.side,
      sourceFile: row.sourceFile,
      hasConfig: config !== undefined,
      configSymbolName: config?.symbolName,
      humanName: config?.humanName,
      description: config?.description,
      groupKey: config?.groupKey,
      allowOwnerOptOut: config?.allowOwnerOptOut,
      dataTypeSource: config?.dataTypeSource,
      inRegistry,
      inHandlerValidate,
      hasProcessor: row.processorLabels.length > 0,
      processorLabels: row.processorLabels
    };
    return summary;
  });
}
