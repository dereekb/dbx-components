/**
 * NotificationTaskBot rules (`NOTIF_TASK_BOT_*`) for `dbx_notification_m_validate_app`.
 *
 * Every rule is skipped for apps that don't use bots. Errors fire only on facts the extractor fully resolved; anything
 * it could not follow degrades to `NOTIF_TASK_BOT_SCRIPT_TRACE_UNRESOLVED` and the dependent check is skipped, so the
 * NTBR handler's own startup check stays the backstop.
 */

import {
  ALL_NOTIFICATION_TASK_BOT_TASK_TYPES,
  NOTIFICATION_TASK_BOT_REPAIR_METHOD,
  NOTIFICATION_TASK_BOT_RUN_HANDLER_FACTORY,
  NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD_FACTORY,
  NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_SERVICE_FACTORY,
  scriptTypeRefKey,
  scriptTypeRefLabel,
  taskServiceCallListsTaskBotTypes
} from './extract.taskbot.js';
import { selectTaskBotRegistry, selectTaskBotRunHandlerCalls } from './select.taskbot.js';
import type { ExtractedAppNotificationTaskBot, ExtractedAppNotifications, ExtractedTaskBotRegistry, ExtractedTaskBotRunHandlerCall, ExtractedTaskBotScriptConfig, ExtractedTaskBotScriptTypeRef, ExtractedTaskServiceCall, Violation } from './types.js';
import { pushViolation } from './violation.js';

const SCANNED_API_FOLDERS = '`src/app/common/model/notification/`, `src/app/common/firebase/` and `src/app/function/notification/`';
const DEFAULT_REGISTRY_FILE = 'src/lib/model/notification/notification.taskbot.ts';

/**
 * Runs every `NOTIF_TASK_BOT_*` rule.
 *
 * @param extracted - The full extraction; only its `taskBot`, `taskServiceCalls` and trust list are read.
 * @param violations - The mutable violation buffer.
 */
export function checkTaskBots(extracted: ExtractedAppNotifications, violations: Violation[]): void {
  const { taskBot } = extracted;
  if (!taskBot.taskBotInUse) {
    return;
  }

  const registry = selectTaskBotRegistry(taskBot);
  checkRegistryDeclared(taskBot, violations);
  checkRegistryWired(taskBot, extracted.trustedExternalIdentifiers, violations);

  const { reachedKeys, considered } = selectTaskBotRunHandlerCalls(extracted);
  checkHandlerRegistered(extracted, reachedKeys.size > 0, violations);
  checkTaskTypesInValidate(extracted.taskServiceCalls, violations);

  for (const call of considered) {
    checkRunHandlerCall(call, registry, violations);
  }

  checkRegistryTrace(taskBot, registry, violations);
  checkRepairScheduled(taskBot, violations);
  checkFirestoreRule(taskBot, violations);
  checkNatIndex(taskBot, violations);
}

// MARK: Registry
function checkRegistryDeclared(taskBot: ExtractedAppNotificationTaskBot, violations: Violation[]): void {
  const hasProcessors = taskBot.runHandlerCalls.some((call) => call.processors.length > 0);
  if (taskBot.registries.length === 0 && (taskBot.scriptConfigs.length > 0 || hasProcessors)) {
    const firstConfig = taskBot.scriptConfigs.find((c) => c.side === 'component');
    pushViolation(violations, {
      code: 'NOTIF_TASK_BOT_REGISTRY_MISSING',
      message: `The app uses NotificationTaskBots but declares no \`${NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD_FACTORY}([...])\` script registry. Declare \`export const <APP>_FIREBASE_NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD = ${NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_RECORD_FACTORY}(<APP>_NOTIFICATION_TASK_BOT_SCRIPT_CONFIGS);\` in \`${DEFAULT_REGISTRY_FILE}\`.`,
      side: 'component',
      file: firstConfig?.sourceFile ?? DEFAULT_REGISTRY_FILE
    });
  }
}

function checkRegistryWired(taskBot: ExtractedAppNotificationTaskBot, trusted: ReadonlySet<string>, violations: Violation[]): void {
  const { registries, registryWirings } = taskBot;
  if (registries.length === 0) {
    return;
  }
  const registryNames = new Set(registries.map((r) => r.symbolName).filter((x): x is string => x !== undefined));
  const wired = registryWirings.some((w) => w.kind === 'inline' || w.kind === 'other' || (w.kind === 'identifier' && w.recordIdentifier !== undefined && (registryNames.has(w.recordIdentifier) || trusted.has(w.recordIdentifier))));
  if (!wired) {
    const recordName = registries.find((r) => r.symbolName !== undefined)?.symbolName ?? '<RECORD>';
    const empty = registryWirings.find((w) => w.kind === 'empty');
    const other = registryWirings.find((w) => w.kind === 'identifier');
    let problem: string;
    if (empty) {
      problem = `\`${NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_SERVICE_FACTORY}()\` is called with no argument (${empty.sourceFile}:${empty.line}), so the registry is empty`;
    } else if (other) {
      problem = `\`${NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_SERVICE_FACTORY}(${other.recordIdentifier})\` (${other.sourceFile}:${other.line}) passes \`${other.recordIdentifier}\`, which is not the app's script registry`;
    } else {
      problem = `no \`${NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_SERVICE_FACTORY}(...)\` call was found in ${SCANNED_API_FOLDERS}`;
    }
    pushViolation(violations, {
      code: 'NOTIF_TASK_BOT_REGISTRY_NOT_WIRED',
      message: `The NotificationTaskBot script registry \`${recordName}\` is not wired: ${problem}. \`notificationServerActions()\` then falls back to an empty registry, and the NTBR handler throws at startup. Add \`AppNotificationTaskBotScriptConfigServiceRef\` to the server actions context class, and set \`appNotificationTaskBotScriptConfigService: ${NOTIFICATION_TASK_BOT_SCRIPT_CONFIG_SERVICE_FACTORY}(${recordName})\` in its factory (e.g. \`action.module.ts\`).`,
      side: 'api',
      file: empty?.sourceFile ?? other?.sourceFile
    });
  }
}

// MARK: Handler
function checkHandlerRegistered(extracted: ExtractedAppNotifications, handlerReached: boolean, violations: Violation[]): void {
  if (handlerReached) {
    return;
  }
  const { taskBot, taskServiceCalls } = extracted;
  const firstHandler = taskBot.runHandlerCalls[0];
  let problem: string;
  if (taskServiceCalls.length === 0) {
    problem = `no \`notificationTaskService(...)\` call was found in ${SCANNED_API_FOLDERS}`;
  } else if (firstHandler) {
    problem = `the NTBR handler built at ${firstHandler.sourceFile}:${firstHandler.line} is not reachable from \`notificationTaskService({ handlers })\``;
  } else {
    problem = `no \`${NOTIFICATION_TASK_BOT_RUN_HANDLER_FACTORY}(...)\` call exists`;
  }
  const throwsAtStartup = taskServiceCalls.some((call) => taskServiceCallListsTaskBotTypes(call)) ? ` \`notificationTaskService()\` also throws at startup, because its \`validate\` lists the NotificationTaskBot task types.` : '';
  pushViolation(violations, {
    code: 'NOTIF_TASK_BOT_HANDLER_NOT_REGISTERED',
    message: `The app uses NotificationTaskBots, but ${problem}. Every \`NTBR\` run fails until its task is deleted.${throwsAtStartup} Add the handler (e.g. \`<app>NotificationTaskBotRunNotificationTaskHandler(context)\`) to \`handlers\`.`,
    side: 'api',
    file: taskServiceCalls[0]?.sourceFile ?? firstHandler?.sourceFile
  });
}

function checkTaskTypesInValidate(taskServiceCalls: readonly ExtractedTaskServiceCall[], violations: Violation[]): void {
  for (const call of taskServiceCalls) {
    if (call.reachedTaskBotRunHandlerCalls.length > 0 && call.validateStatus === 'resolved' && !taskServiceCallListsTaskBotTypes(call)) {
      pushViolation(violations, {
        code: 'NOTIF_TASK_BOT_TASK_TYPES_NOT_IN_VALIDATE',
        severity: 'warning',
        message: `\`notificationTaskService(...)\` in ${call.sourceFile} registers the NTBR handler, but its \`validate\` does not list \`...${ALL_NOTIFICATION_TASK_BOT_TASK_TYPES}\`. Add it (from \`@dereekb/firebase\`), so startup fails if the handler is ever removed.`,
        side: 'api',
        file: call.sourceFile
      });
    }
  }
}

// MARK: Registry ↔ processors
function declaredKey(ref: ExtractedTaskBotScriptTypeRef | undefined): string | undefined {
  return ref?.declared ? scriptTypeRefKey(ref) : undefined;
}

interface ExpectedScript {
  readonly ref: ExtractedTaskBotScriptTypeRef;
  inRegistry: boolean;
  inValidate: boolean;
}

function checkRunHandlerCall(call: ExtractedTaskBotRunHandlerCall, registry: ExtractedTaskBotRegistry | undefined, violations: Violation[]): void {
  const where = `${call.sourceFile}:${call.line}`;
  const processorKeys = new Set<string>();
  const allResolved = call.processorsResolved && call.processors.every((p) => p.target?.declared);
  const registryKeys = new Set((registry?.configs ?? []).map((c) => declaredKey(c.scriptType)).filter((x): x is string => x !== undefined));
  const registryFull = registry?.unresolvedReferences.length === 0 && registry.trustedReferences.length === 0 && registry.configs.every((c) => c.scriptType?.declared);
  const notRegistered = new Set<string>();

  for (const processor of call.processors) {
    const key = declaredKey(processor.target);
    if (key !== undefined && processor.target) {
      if (processorKeys.has(key)) {
        pushViolation(violations, {
          code: 'NOTIF_TASK_BOT_PROCESSOR_DUPLICATE_TARGET',
          severity: 'warning',
          message: `Two processors of the NTBR handler at ${where} target \`${scriptTypeRefLabel(processor.target)}\`. Processors are indexed by target, so only the last one runs. Remove the duplicate, or merge the two processors.`,
          side: 'api',
          file: call.sourceFile
        });
      }
      processorKeys.add(key);
      if (registryFull && !registryKeys.has(key) && !notRegistered.has(key)) {
        notRegistered.add(key);
        const registryLabel = registry.symbolName ? ` \`${registry.symbolName}\`` : '';
        pushViolation(violations, {
          code: 'NOTIF_TASK_BOT_PROCESSOR_NOT_REGISTERED',
          message: `The NTBR handler at ${where} has a processor (\`${processor.label}\`) targeting \`${scriptTypeRefLabel(processor.target)}\`, which is not in the script registry${registryLabel}. The handler throws at startup. Add a \`NotificationTaskBotScriptConfig\` for it to the registry's configs, or remove the processor.`,
          side: 'api',
          file: call.sourceFile
        });
      }
    } else if (processor.unresolvedReason !== undefined) {
      pushViolation(violations, {
        code: 'NOTIF_TASK_BOT_SCRIPT_TRACE_UNRESOLVED',
        severity: 'warning',
        message: `The target of the NTBR handler processor \`${processor.label}\` (${processor.sourceFile}:${processor.line}) can't be resolved statically: ${processor.unresolvedReason}. The registry ↔ processor check is skipped for this handler. Give the processor \`target: <SCRIPT_TYPE_CONSTANT>\`, or a parameter that defaults to one.`,
        side: 'api',
        file: processor.sourceFile
      });
    }
  }

  if (!call.processorsResolved) {
    pushViolation(violations, {
      code: 'NOTIF_TASK_BOT_SCRIPT_TRACE_UNRESOLVED',
      severity: 'warning',
      message: `The \`processors\` of the NTBR handler at ${where} can't be read statically, so the registry ↔ processor check is skipped. Pass \`processors: [...]\` as an array literal (or a local array variable).`,
      side: 'api',
      file: call.sourceFile
    });
  }

  if (call.validateStatus === 'unresolved') {
    pushViolation(violations, {
      code: 'NOTIF_TASK_BOT_SCRIPT_TRACE_UNRESOLVED',
      severity: 'warning',
      message: `The \`validate\` of the NTBR handler at ${where} can't be read statically: ${call.validateUnresolvedReason ?? 'unknown shape'}. Build it as \`<CONFIGS>.map((x) => x.scriptType)\`.`,
      side: 'api',
      file: call.sourceFile
    });
  }

  if (allResolved) {
    checkScriptsWithoutProcessor({ call, registry, processorKeys, where, violations });
  }
}

interface CheckScriptsWithoutProcessorInput {
  readonly call: ExtractedTaskBotRunHandlerCall;
  readonly registry: ExtractedTaskBotRegistry | undefined;
  readonly processorKeys: ReadonlySet<string>;
  readonly where: string;
  readonly violations: Violation[];
}

function checkScriptsWithoutProcessor(input: CheckScriptsWithoutProcessorInput): void {
  const { call, registry, processorKeys, where, violations } = input;
  const expected = new Map<string, ExpectedScript>();
  const note = (ref: ExtractedTaskBotScriptTypeRef | undefined, from: 'inRegistry' | 'inValidate') => {
    const key = declaredKey(ref);
    if (key !== undefined && ref) {
      const entry = expected.get(key) ?? { ref, inRegistry: false, inValidate: false };
      entry[from] = true;
      expected.set(key, entry);
    }
  };
  for (const config of registry?.configs ?? []) {
    note(config.scriptType, 'inRegistry');
  }
  if (call.validateStatus === 'resolved' && !call.validateUsesRegistry) {
    for (const ref of call.validate) {
      note(ref, 'inValidate');
    }
  }
  for (const [key, entry] of expected) {
    if (!processorKeys.has(key)) {
      const registryName = registry?.symbolName ? `\`${registry.symbolName}\`` : 'the script registry';
      let listed: string;
      if (entry.inRegistry && entry.inValidate) {
        listed = `registered in ${registryName} and listed in the handler's \`validate\``;
      } else if (entry.inRegistry) {
        listed = `registered in ${registryName}`;
      } else {
        listed = `listed in the handler's \`validate\``;
      }
      pushViolation(violations, {
        code: 'NOTIF_TASK_BOT_SCRIPT_WITHOUT_PROCESSOR',
        message: `NotificationTaskBot script type \`${scriptTypeRefLabel(entry.ref)}\` is ${listed}, but the NTBR handler at ${where} has no processor for it. The handler throws at startup. Add a processor with \`target: ${scriptTypeRefLabel(entry.ref)}\` to \`processors\` (\`dbx_artifact_scaffold\` \`notification-task-bot-script\` emits one), or remove the script.`,
        side: 'api',
        file: call.sourceFile
      });
    }
  }
}

function checkRegistryTrace(taskBot: ExtractedAppNotificationTaskBot, registry: ExtractedTaskBotRegistry | undefined, violations: Violation[]): void {
  const registryLabel = registry?.symbolName ? ` \`${registry.symbolName}\`` : '';
  for (const reference of registry?.unresolvedReferences ?? []) {
    pushViolation(violations, {
      code: 'NOTIF_TASK_BOT_SCRIPT_TRACE_UNRESOLVED',
      severity: 'warning',
      message: `The NotificationTaskBot script registry${registryLabel} (${registry?.sourceFile}:${registry?.line}) has an entry the scanner can't resolve: \`${reference}\`. The processor registration check is skipped. Declare script configs as \`NotificationTaskBotScriptConfig\` constants under \`src/lib/model/notification/\`.`,
      side: registry?.side ?? 'component',
      file: registry?.sourceFile
    });
  }
  const configs = new Set<ExtractedTaskBotScriptConfig>([...taskBot.scriptConfigs, ...(registry?.configs ?? [])]);
  for (const config of configs) {
    if (!config.scriptType?.declared) {
      const name = config.symbolName ? `\`${config.symbolName}\`` : 'An inline NotificationTaskBotScriptConfig';
      const problem = config.scriptType ? `its \`scriptType\` (\`${config.scriptType.identifier}\`) is not a declared NotificationTaskBotScriptType constant` : 'it has no `scriptType`';
      pushViolation(violations, {
        code: 'NOTIF_TASK_BOT_SCRIPT_TRACE_UNRESOLVED',
        severity: 'warning',
        message: `${name} (${config.sourceFile}:${config.line}): ${problem}, so the registry ↔ processor check skips it. Declare the script type as a \`NotificationTaskBotScriptType\` constant.`,
        side: config.side,
        file: config.sourceFile
      });
    }
  }
}

// MARK: Repair, rules, index
function checkRepairScheduled(taskBot: ExtractedAppNotificationTaskBot, violations: Violation[]): void {
  if (taskBot.repairCalls.length === 0) {
    pushViolation(violations, {
      code: 'NOTIF_TASK_BOT_REPAIR_NOT_SCHEDULED',
      severity: 'warning',
      message: `Nothing in ${SCANNED_API_FOLDERS} calls \`${NOTIFICATION_TASK_BOT_REPAIR_METHOD}()\`. Lost NotificationTaskBot runs are never noticed, and their entries stall. Call \`request.nest.notificationActions.${NOTIFICATION_TASK_BOT_REPAIR_METHOD}()\` from the notification schedule, after \`sendQueuedNotifications\`.`,
      side: 'api',
      file: undefined
    });
  }
}

function checkFirestoreRule(taskBot: ExtractedAppNotificationTaskBot, violations: Violation[]): void {
  const rules = taskBot.firestoreRules;
  if (rules && (!rules.readable || !rules.hasNotificationTaskBotMatch)) {
    const problem = rules.readable ? `has no \`match /ntb/{...}\` block for the NotificationTaskBot collection` : 'could not be read';
    pushViolation(violations, {
      code: 'NOTIF_TASK_BOT_FIRESTORE_RULE_MISSING',
      severity: 'warning',
      message: `\`${rules.path}\` ${problem}. Add \`match /ntb/{notificationTaskBot} { allow get, list: if userClaimsIsSysAdmin(); }\`. Keep it admin-only; owners read their opt-outs through \`read:optOuts\`.`,
      side: 'both',
      file: rules.path
    });
  }
}

function checkNatIndex(taskBot: ExtractedAppNotificationTaskBot, violations: Violation[]): void {
  const indexes = taskBot.firestoreIndexes;
  if (indexes?.parsed && indexes.natIndexExempted) {
    pushViolation(violations, {
      code: 'NOTIF_TASK_BOT_NAT_INDEX_MISSING',
      message: `\`${indexes.path}\` has a \`fieldOverrides\` entry for \`ntb.nat\` that drops its COLLECTION / ASCENDING single-field index, so the repair sweep's \`notificationTaskBotsDueForRepairQuery\` fails with FAILED_PRECONDITION. Remove that entry, or add \`{ "queryScope": "COLLECTION", "order": "ASCENDING" }\` to its \`indexes\`.`,
      side: 'both',
      file: indexes.path
    });
  }
}
