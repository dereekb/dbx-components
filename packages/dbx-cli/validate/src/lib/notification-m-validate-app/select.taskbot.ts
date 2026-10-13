/**
 * Selectors over the NotificationTaskBot extraction, shared by the `NOTIF_TASK_BOT_*` rules and the
 * `dbx_notification_m_list_app` NotificationTaskBot section, so both pick the same registry and handlers.
 */

import type { ExtractedAppNotificationTaskBot, ExtractedAppNotifications, ExtractedSourceLocation, ExtractedTaskBotRegistry, ExtractedTaskBotRegistryWiring, ExtractedTaskBotRunHandlerCall } from './types.js';

/**
 * The matching key of a source location: `<sourceFile>:<line>`.
 *
 * @param x - The source location.
 * @returns The location key.
 */
export function taskBotLocationKey(x: ExtractedSourceLocation): string {
  return `${x.sourceFile}:${x.line}`;
}

/**
 * Whether an `appNotificationTaskBotScriptConfigService(...)` call passes the registry: by name, or (inline record) a wiring
 * of kind `inline` in the same file.
 *
 * @param registry - The registry.
 * @param wirings - Every `appNotificationTaskBotScriptConfigService(...)` call in the API.
 * @returns `true` when a wiring passes the registry.
 */
export function isTaskBotRegistryWired(registry: ExtractedTaskBotRegistry, wirings: readonly ExtractedTaskBotRegistryWiring[]): boolean {
  let result: boolean;
  if (registry.symbolName === undefined) {
    result = wirings.some((w) => w.kind === 'inline' && w.sourceFile === registry.sourceFile);
  } else {
    result = wirings.some((w) => w.kind === 'identifier' && w.recordIdentifier === registry.symbolName);
  }
  return result;
}

/**
 * The registry the app wires: the record a wiring passes, else an inline wired record, else the first record.
 *
 * @param taskBot - The NotificationTaskBot extraction.
 * @returns The selected registry, or `undefined` when the app declares none.
 */
export function selectTaskBotRegistry(taskBot: ExtractedAppNotificationTaskBot): ExtractedTaskBotRegistry | undefined {
  const { registries, registryWirings } = taskBot;
  const passed = registries.find((r) => r.symbolName !== undefined && isTaskBotRegistryWired(r, registryWirings));
  const inline = registries.find((r) => r.symbolName === undefined && isTaskBotRegistryWired(r, registryWirings));
  return passed ?? inline ?? registries[0];
}

/**
 * The NTBR handler calls a `notificationTaskService({ handlers })` trace reached, and the ones the checks consider.
 */
export interface TaskBotRunHandlerCallSelection {
  /**
   * Location keys of every NTBR handler call a `notificationTaskService({ handlers })` trace reached.
   */
  readonly reachedKeys: ReadonlySet<string>;
  /**
   * The NTBR handler calls that are reached.
   */
  readonly reachable: readonly ExtractedTaskBotRunHandlerCall[];
  /**
   * What the processor checks and the per-script columns read: the reachable calls, else every call.
   */
  readonly considered: readonly ExtractedTaskBotRunHandlerCall[];
}

/**
 * Selects the NTBR handler calls: the reached ones, and the ones the processor checks and the per-script columns read.
 *
 * @param extracted - The extraction; only its `taskBot` and `taskServiceCalls` are read.
 * @returns The selection.
 */
export function selectTaskBotRunHandlerCalls(extracted: Pick<ExtractedAppNotifications, 'taskBot' | 'taskServiceCalls'>): TaskBotRunHandlerCallSelection {
  const { runHandlerCalls } = extracted.taskBot;
  const reachedKeys = new Set(extracted.taskServiceCalls.flatMap((call) => call.reachedTaskBotRunHandlerCalls.map((x) => taskBotLocationKey(x))));
  const reachable = runHandlerCalls.filter((call) => reachedKeys.has(taskBotLocationKey(call)));
  return { reachedKeys, reachable, considered: reachable.length > 0 ? reachable : runHandlerCalls };
}
