/**
 * Validation rules applied against an {@link ExtractedAppNotifications}.
 * Rules accumulate {@link Violation}s into a mutable buffer; the public
 * entry point is {@link validateAppNotifications} in `./index.ts`.
 */

import type { AppNotificationsInspection, ExtractedAppNotifications, ExtractedTaskHandlerEntry, ExtractedTemplateHandlerEntry, ExtractedTemplateTypeInfo, Violation, ViolationSeverity } from './types.js';

/**
 * Applies every cross-file notification rule and returns the aggregated
 * diagnostics. I/O-level rules (missing folders) short-circuit the content
 * checks so the report stays focused on the root cause.
 *
 * @param inspection - the on-disk snapshot used for I/O-level rules
 * @param extracted - the pre-extracted facts the content rules consume
 * @returns the violations the rules emit for the snapshot
 */
export function runRules(inspection: AppNotificationsInspection, extracted: ExtractedAppNotifications): readonly Violation[] {
  const violations: Violation[] = [];

  // I/O rules short-circuit content checks.
  if (inspection.component.status === 'dir-not-found') {
    pushViolation(violations, {
      code: 'NOTIF_COMPONENT_DIR_NOT_FOUND',
      message: `Component directory \`${inspection.component.rootDir}\` does not exist.`,
      side: 'component',
      file: undefined
    });
  } else if (inspection.component.status === 'notification-folder-missing') {
    pushViolation(violations, {
      code: 'NOTIF_COMPONENT_NOTIFICATION_FOLDER_MISSING',
      message: `Component is missing \`src/lib/model/notification/\` (looked under \`${inspection.component.rootDir}\`).`,
      side: 'component',
      file: undefined
    });
  }
  if (inspection.api.status === 'dir-not-found') {
    pushViolation(violations, {
      code: 'NOTIF_API_DIR_NOT_FOUND',
      message: `API directory \`${inspection.api.rootDir}\` does not exist.`,
      side: 'api',
      file: undefined
    });
  } else if (inspection.api.status === 'notification-folder-missing') {
    pushViolation(violations, {
      code: 'NOTIF_API_NOTIFICATION_FOLDER_MISSING',
      message: `API is missing \`src/app/common/model/notification/\` (looked under \`${inspection.api.rootDir}\`).`,
      side: 'api',
      file: undefined
    });
  }
  if (inspection.component.status !== 'ok' || inspection.api.status !== 'ok') {
    return violations;
  }

  checkTemplateInfoPairing(extracted, violations);
  checkTemplateInfoRecord(extracted, violations);
  checkTemplateHandlerFactory(extracted, violations);
  checkTasks(extracted, violations);
  checkDuplicates(extracted, violations);

  return violations;
}

// MARK: Template info pairing (info-record path)
function checkTemplateInfoPairing(extracted: ExtractedAppNotifications, violations: Violation[]): void {
  const typeConstantNames = new Set(extracted.templateTypeConstants.map((c) => c.symbolName));
  const infoByTypeConstant = new Map<string, ExtractedTemplateTypeInfo>();
  for (const info of extracted.templateTypeInfos) {
    if (info.typeConstantName) infoByTypeConstant.set(info.typeConstantName, info);
  }

  for (const constant of extracted.templateTypeConstants) {
    const info = infoByTypeConstant.get(constant.symbolName);
    if (!info) {
      pushViolation(violations, {
        code: 'NOTIF_TEMPLATE_INFO_MISSING',
        message: `Template type \`${constant.symbolName}\` has no matching \`NotificationTemplateTypeInfo\` object whose \`type:\` property references it. Expected an exported \`${constant.symbolName}_INFO\` (or similar).`,
        side: 'component',
        file: constant.sourceFile
      });
    }
  }

  for (const info of extracted.templateTypeInfos) {
    if (!info.typeConstantName) {
      pushViolation(violations, {
        code: 'NOTIF_TEMPLATE_INFO_TYPE_MISMATCH',
        message: `Info \`${info.symbolName}\` has no \`type:\` property referencing a declared \`*_NOTIFICATION_TEMPLATE_TYPE\` identifier.`,
        side: 'component',
        file: info.sourceFile
      });
      continue;
    }
    if (!typeConstantNames.has(info.typeConstantName)) {
      pushViolation(violations, {
        code: 'NOTIF_TEMPLATE_INFO_TYPE_MISMATCH',
        message: `Info \`${info.symbolName}\` has \`type: ${info.typeConstantName}\` but no matching \`NotificationTemplateType\` constant is declared in the component.`,
        side: 'component',
        file: info.sourceFile
      });
    }
    if (!info.humanName || !info.description) {
      pushViolation(violations, {
        code: 'NOTIF_TEMPLATE_INFO_MISSING_NAME_OR_DESCRIPTION',
        severity: 'warning',
        message: `Info \`${info.symbolName}\` is missing ${!info.humanName ? '`name`' : '`description`'} — human-readable metadata is required for the list tool.`,
        side: 'component',
        file: info.sourceFile
      });
    }
  }
}

// MARK: Template info record (aggregator)
function checkTemplateInfoRecord(extracted: ExtractedAppNotifications, violations: Violation[]): void {
  const record = extracted.templateInfoRecord;
  if (!record) {
    if (extracted.templateTypeConstants.length > 0) {
      pushViolation(violations, {
        code: 'NOTIF_TEMPLATE_RECORD_MISSING',
        message: `No \`notificationTemplateTypeInfoRecord([...])\` call found in the component. Aggregate all \`NotificationTemplateTypeInfo\` objects into a single exported constant ending in \`SystemStateStoredDataConverterMap\`-style — e.g. \`<APP>_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD\`.`,
        side: 'component',
        file: undefined
      });
    }
    return;
  }

  for (const unresolved of record.unresolvedSpreadIdentifiers) {
    if (extracted.trustedExternalIdentifiers.has(unresolved)) continue;
    pushViolation(violations, {
      code: 'NOTIF_TEMPLATE_SPREAD_UNRESOLVED',
      message: `Spread \`...${unresolved}\` in \`${record.symbolName}\` does not resolve to a declared \`ALL_*_NOTIFICATION_TEMPLATE_TYPE_INFOS\` aggregate. Declare the array or import it from an \`@dereekb/*\` package.`,
      side: 'component',
      file: record.sourceFile
    });
  }

  const resolved = new Set(record.resolvedInfoIdentifiers);
  for (const info of extracted.templateTypeInfos) {
    if (!resolved.has(info.symbolName)) {
      pushViolation(violations, {
        code: 'NOTIF_TEMPLATE_INFO_NOT_IN_RECORD',
        message: `Info \`${info.symbolName}\` is not reachable from the aggregate record \`${record.symbolName}\`. Add it directly or include it in an \`ALL_*_NOTIFICATION_TEMPLATE_TYPE_INFOS\` array referenced by the record.`,
        side: 'component',
        file: info.sourceFile
      });
    }
  }

  const wiring = extracted.templateInfoRecordWiring;
  if (!wiring) {
    pushViolation(violations, {
      code: 'NOTIF_TEMPLATE_RECORD_NOT_WIRED',
      message: `Aggregate record \`${record.symbolName}\` is not passed to \`appNotificationTemplateTypeInfoRecordService(...)\` in the API. Wire it so every registered template info is routable at runtime.`,
      side: 'api',
      file: undefined
    });
    return;
  }
  if (wiring.recordIdentifier !== record.symbolName && !extracted.trustedExternalIdentifiers.has(wiring.recordIdentifier)) {
    pushViolation(violations, {
      code: 'NOTIF_TEMPLATE_RECORD_NOT_WIRED',
      message: `API wires \`appNotificationTemplateTypeInfoRecordService(${wiring.recordIdentifier})\`, but the component declares \`${record.symbolName}\`. Pass the component-declared record constant instead.`,
      side: 'api',
      file: wiring.sourceFile
    });
  }
}

// MARK: Template handler factory (coverage)
function checkTemplateHandlerFactory(extracted: ExtractedAppNotifications, violations: Violation[]): void {
  if (extracted.templateTypeConstants.length === 0) return;
  const factory = extracted.templateConfigsArrayFactory;
  if (!factory) {
    pushViolation(violations, {
      code: 'NOTIF_TEMPLATE_FACTORY_ARRAY_MISSING',
      message: `No \`<app>NotificationTemplateServiceConfigsArrayFactory\` found in the API. Declare a factory whose return array assembles every template handler config.`,
      side: 'api',
      file: undefined
    });
    return;
  }

  for (const unresolved of factory.unresolvedSpreadIdentifiers) {
    if (extracted.trustedExternalIdentifiers.has(unresolved)) continue;
    pushViolation(violations, {
      code: 'NOTIF_TEMPLATE_FACTORY_SPREAD_UNRESOLVED',
      severity: 'warning',
      message: `Spread \`...${unresolved}(context)\` inside \`${factory.symbolName}\` does not resolve to a declared function in the API. Declare the sub-factory or import it from a trusted \`@dereekb/*\` package.`,
      side: 'api',
      file: factory.sourceFile
    });
  }

  const typeConstantNames = new Set(extracted.templateTypeConstants.map((c) => c.symbolName));
  const handlerTypeIdentifiers = new Set<string>();
  for (const entry of extracted.templateHandlerEntries) {
    handlerTypeIdentifiers.add(entry.typeIdentifier);
    if (!typeConstantNames.has(entry.typeIdentifier) && !extracted.trustedExternalIdentifiers.has(entry.typeIdentifier)) {
      pushViolation(violations, {
        code: 'NOTIF_TEMPLATE_FACTORY_ORPHAN',
        message: `Template handler factory \`${entry.factoryFunctionName ?? '<anonymous>'}\` references \`type: ${entry.typeIdentifier}\`, but no such \`NotificationTemplateType\` constant is declared in the component.`,
        side: 'api',
        file: entry.sourceFile
      });
    }
  }

  for (const constant of extracted.templateTypeConstants) {
    if (!handlerTypeIdentifiers.has(constant.symbolName)) {
      pushViolation(violations, {
        code: 'NOTIF_TEMPLATE_FACTORY_MISSING',
        message: `Template type \`${constant.symbolName}\` has no \`NotificationTemplateServiceTypeConfig\` handler reachable from \`${factory.symbolName}\`. Add a factory in \`notification.factory.ts\` (or a sibling \`notification.factory.*.ts\`) that returns \`{ type: ${constant.symbolName}, factory: ... }\` and is composed into the top-level configs-array factory.`,
        side: 'api',
        file: factory.sourceFile
      });
    }
  }

  const wiring = extracted.templateConfigsArrayWiring;
  if (!wiring) {
    pushViolation(violations, {
      code: 'NOTIF_TEMPLATE_FACTORY_NOT_WIRED',
      message: `No NestJS provider for \`NOTIFICATION_TEMPLATE_SERVICE_CONFIGS_ARRAY_TOKEN\` found. Wire \`${factory.symbolName}\` as the \`useFactory\` on a provider for the token.`,
      side: 'api',
      file: undefined
    });
    return;
  }
  if (wiring.useFactoryIdentifier !== factory.symbolName) {
    pushViolation(violations, {
      code: 'NOTIF_TEMPLATE_FACTORY_NOT_WIRED',
      message: `NestJS provider for \`NOTIFICATION_TEMPLATE_SERVICE_CONFIGS_ARRAY_TOKEN\` uses \`useFactory: ${wiring.useFactoryIdentifier}\`, but the configs-array factory is \`${factory.symbolName}\`. Bind them together.`,
      side: 'api',
      file: wiring.sourceFile
    });
  }
}

// MARK: Tasks
function checkTasks(extracted: ExtractedAppNotifications, violations: Violation[]): void {
  if (extracted.taskTypeConstants.length === 0) return;

  flagTasksMissingFromAllArrays(extracted, violations);

  if (extracted.taskServiceCalls.length === 0) {
    pushViolation(violations, {
      code: 'NOTIF_TASK_SERVICE_FACTORY_MISSING',
      message: `No \`notificationTaskService({ validate, handlers })\` call found in the API, but the component declares ${extracted.taskTypeConstants.length} task type(s). Wire a \`NotificationTaskService\` factory.`,
      side: 'api',
      file: undefined
    });
    return;
  }
  if (extracted.taskServiceCalls.length > 1) {
    pushViolation(violations, {
      code: 'NOTIF_TASK_MULTIPLE_SERVICES',
      severity: 'warning',
      message: `Found ${extracted.taskServiceCalls.length} \`notificationTaskService({...})\` calls in the API. Prefer one factory per app — the first call's config is what runtime uses.`,
      side: 'api',
      file: undefined
    });
  }

  const lenientHandlerTypeIdentifiers = flagOrphanTaskHandlers(extracted, violations);
  const reachableBindings = collectReachableHandlerBindings(extracted);
  flagTaskHandlerCoverage({ extracted, violations, reachableBindings });
  flagUnresolvedHandlerIdentifiers({ extracted, violations, reachableBindings });
  flagValidateWithoutHandler({ extracted, violations, lenientHandlerTypeIdentifiers });
}

/**
 * Flags every declared `NotificationTaskType` constant that does not appear in
 * any `ALL_*_NOTIFICATION_TASK_TYPES` aggregate array.
 *
 * @param extracted - the validator extraction
 * @param violations - the mutable violations buffer to append to
 */
function flagTasksMissingFromAllArrays(extracted: ExtractedAppNotifications, violations: Violation[]): void {
  const aggregateMembers = new Set<string>();
  for (const agg of extracted.taskAllTypesAggregates) {
    for (const id of agg.taskTypeIdentifiers) aggregateMembers.add(id);
  }
  for (const constant of extracted.taskTypeConstants) {
    if (!aggregateMembers.has(constant.symbolName)) {
      pushViolation(violations, {
        code: 'NOTIF_TASK_NOT_IN_ALL_ARRAY',
        message: `Task type \`${constant.symbolName}\` is not an element of any \`ALL_*_NOTIFICATION_TASK_TYPES\` array. Add it so the task-service \`validate: [...]\` spread picks it up.`,
        side: 'component',
        file: constant.sourceFile
      });
    }
  }
}

/**
 * Records every handler config whose `type:` does not match a declared
 * `NotificationTaskType` constant or a trust-listed identifier, and returns
 * the lenient set of every extracted handler's `type:` identifier (used by
 * the validate-vs-handlers parity warning).
 *
 * @param extracted - the validator extraction
 * @param violations - the mutable violations buffer to append to
 * @returns the lenient set of all handler-config type identifiers
 */
function flagOrphanTaskHandlers(extracted: ExtractedAppNotifications, violations: Violation[]): Set<string> {
  const taskConstantNames = new Set(extracted.taskTypeConstants.map((c) => c.symbolName));
  const lenientHandlerTypeIdentifiers = new Set<string>();
  for (const entry of extracted.taskHandlerEntries) {
    lenientHandlerTypeIdentifiers.add(entry.typeIdentifier);
    if (!taskConstantNames.has(entry.typeIdentifier) && !extracted.trustedExternalIdentifiers.has(entry.typeIdentifier)) {
      pushViolation(violations, {
        code: 'NOTIF_TASK_HANDLER_ORPHAN',
        message: `Task handler config references \`type: ${entry.typeIdentifier}\`, but no such \`NotificationTaskType\` constant is declared in the component.`,
        side: 'api',
        file: entry.sourceFile
      });
    }
  }
  return lenientHandlerTypeIdentifiers;
}

/**
 * Collects the union of every binding name resolved from
 * `notificationTaskService({ handlers })` array elements.
 *
 * @param extracted - the validator extraction
 * @returns the reachable-binding set
 */
function collectReachableHandlerBindings(extracted: ExtractedAppNotifications): Set<string> {
  const reachableBindings = new Set<string>();
  for (const c of extracted.taskServiceCalls) {
    for (const name of c.resolvedHandlerBindings) reachableBindings.add(name);
  }
  return reachableBindings;
}

interface FlagTaskHandlerCoverageOptions {
  readonly extracted: ExtractedAppNotifications;
  readonly violations: Violation[];
  readonly reachableBindings: Set<string>;
}

/**
 * Flags each declared task type whose handler config is either missing or
 * present-but-unreachable (binding-name mismatch).
 *
 * @param options - extraction, violations buffer, and reachable bindings set
 */
function flagTaskHandlerCoverage(options: FlagTaskHandlerCoverageOptions): void {
  const { extracted, violations, reachableBindings } = options;
  const reachableTypeIdentifiers = new Set<string>();
  for (const entry of extracted.taskHandlerEntries) {
    if (entry.bindingName && reachableBindings.has(entry.bindingName)) {
      reachableTypeIdentifiers.add(entry.typeIdentifier);
    }
  }

  const entriesByType = new Map<string, ExtractedTaskHandlerEntry[]>();
  for (const entry of extracted.taskHandlerEntries) {
    const list = entriesByType.get(entry.typeIdentifier);
    if (list) {
      list.push(entry);
    } else {
      entriesByType.set(entry.typeIdentifier, [entry]);
    }
  }

  for (const constant of extracted.taskTypeConstants) {
    if (reachableTypeIdentifiers.has(constant.symbolName)) continue;
    const entries = entriesByType.get(constant.symbolName);
    if (entries && entries.length > 0) {
      const entry = entries[0];
      const bindingHint = entry.bindingName ? `\`${entry.bindingName}\`` : '<anonymous>';
      pushViolation(violations, {
        code: 'NOTIF_TASK_HANDLER_NAME_MISMATCH',
        message: `Handler ${bindingHint} in \`${entry.sourceFile}\` declares \`type: ${constant.symbolName}\` but is not reachable from \`notificationTaskService({ handlers })\` because no array element resolves to that binding name. The cross-file tracer matches by identifier name through function returns — when a factory function ships a task-handler config, its inner variable name must match the call-site binding name (and the array element / spread that references it).`,
        side: 'api',
        file: entry.sourceFile
      });
      continue;
    }
    pushViolation(violations, {
      code: 'NOTIF_TASK_NOT_REGISTERED_IN_SERVICE',
      message: `Task type \`${constant.symbolName}\` has no \`NotificationTaskServiceTaskHandlerConfig\` declared in the API. Add a handler config typed \`NotificationTaskServiceTaskHandlerConfig<${handlerDataHint(constant.symbolName)}>\` and include it in \`notificationTaskService({ handlers })\`.`,
      side: 'api',
      file: undefined
    });
  }
}

interface FlagUnresolvedHandlerIdentifiersOptions {
  readonly extracted: ExtractedAppNotifications;
  readonly violations: Violation[];
  readonly reachableBindings: Set<string>;
}

/**
 * Flags handler-array identifiers that the binding tracer could not follow
 * locally, are not reachable as bindings, and aren't trust-listed.
 *
 * @param options - extraction, violations buffer, and reachable bindings set
 */
function flagUnresolvedHandlerIdentifiers(options: FlagUnresolvedHandlerIdentifiersOptions): void {
  const { extracted, violations, reachableBindings } = options;
  for (const c of extracted.taskServiceCalls) {
    for (const unresolved of c.unresolvedHandlerBindings) {
      if (extracted.trustedExternalIdentifiers.has(unresolved)) continue;
      if (reachableBindings.has(unresolved)) continue;
      pushViolation(violations, {
        code: 'NOTIF_TASK_HANDLER_SPREAD_UNRESOLVED',
        severity: 'warning',
        message: `Identifier \`${unresolved}\` inside \`notificationTaskService({ handlers })\` does not resolve to a declared \`NotificationTaskServiceTaskHandlerConfig\` literal or a trust-listed upstream factory. Declare the handler locally or import the factory from a trusted \`@dereekb/*\` package.`,
        side: 'api',
        file: c.sourceFile
      });
    }
  }
}

interface FlagValidateWithoutHandlerOptions {
  readonly extracted: ExtractedAppNotifications;
  readonly violations: Violation[];
  readonly lenientHandlerTypeIdentifiers: Set<string>;
}

/**
 * Emits the validate-vs-handlers parity warning for the first
 * `notificationTaskService` call. Uses the lenient handler-type set so a
 * declared-but-unreachable handler still counts as "exists" here; strict
 * reachability is covered separately.
 *
 * @param options - extraction, violations buffer, and lenient handler-type set
 */
function flagValidateWithoutHandler(options: FlagValidateWithoutHandlerOptions): void {
  const { extracted, violations, lenientHandlerTypeIdentifiers } = options;
  const call = extracted.taskServiceCalls[0];
  if (!call) return;
  const validateNames = new Set<string>(call.validateIdentifiers);
  for (const spread of call.spreadValidateIdentifiers) {
    const agg = extracted.taskAllTypesAggregates.find((a) => a.symbolName === spread);
    if (agg) {
      for (const id of agg.taskTypeIdentifiers) validateNames.add(id);
    }
  }
  for (const name of validateNames) {
    if (!lenientHandlerTypeIdentifiers.has(name) && !extracted.trustedExternalIdentifiers.has(name)) {
      pushViolation(violations, {
        code: 'NOTIF_TASK_IN_VALIDATE_WITHOUT_HANDLER',
        severity: 'warning',
        message: `Task type \`${name}\` appears in \`notificationTaskService({ validate })\` but has no matching handler in the \`handlers\` array.`,
        side: 'api',
        file: call.sourceFile
      });
    }
  }
}

// MARK: Duplicates
function checkDuplicates(extracted: ExtractedAppNotifications, violations: Violation[]): void {
  flagDuplicates(extracted.templateTypeConstants, 'NOTIF_TEMPLATE_TYPE_CODE_DUPLICATE', violations);
  flagDuplicates(extracted.taskTypeConstants, 'NOTIF_TASK_TYPE_CODE_DUPLICATE', violations);

  // Unused-info warning.
  if (extracted.templateInfoRecord) {
    const resolved = new Set(extracted.templateInfoRecord.resolvedInfoIdentifiers);
    for (const info of extracted.templateTypeInfos) {
      if (!resolved.has(info.symbolName)) continue;
      // Already in record; skip — NOTIF_TEMPLATE_INFO_NOT_IN_RECORD handles the other case.
    }
    for (const agg of extracted.templateInfoAggregates) {
      for (const id of agg.infoIdentifiers) {
        if (!extracted.templateTypeInfos.some((i) => i.symbolName === id) && !extracted.trustedExternalIdentifiers.has(id)) {
          pushViolation(violations, {
            code: 'NOTIF_TEMPLATE_INFO_UNUSED',
            severity: 'warning',
            message: `Aggregate \`${agg.symbolName}\` references \`${id}\`, but that identifier is not a declared \`NotificationTemplateTypeInfo\` in the component.`,
            side: 'component',
            file: agg.sourceFile
          });
        }
      }
    }
  }
}

function flagDuplicates(entries: readonly { readonly symbolName: string; readonly typeCode: string | undefined; readonly sourceFile: string }[], code: 'NOTIF_TEMPLATE_TYPE_CODE_DUPLICATE' | 'NOTIF_TASK_TYPE_CODE_DUPLICATE', violations: Violation[]): void {
  const seen = new Map<string, string>();
  for (const entry of entries) {
    if (!entry.typeCode) continue;
    const previous = seen.get(entry.typeCode);
    if (previous) {
      pushViolation(violations, {
        code,
        severity: 'warning',
        message: `Type code \`'${entry.typeCode}'\` is shared by \`${previous}\` and \`${entry.symbolName}\`. Runtime aggregators reject duplicates — change one of the string literals.`,
        side: 'component',
        file: entry.sourceFile
      });
    } else {
      seen.set(entry.typeCode, entry.symbolName);
    }
  }
}

// MARK: Helpers
function handlerDataHint(taskConstantName: string): string {
  const stem = taskConstantName.endsWith('_NOTIFICATION_TASK_TYPE') ? taskConstantName.slice(0, -'_NOTIFICATION_TASK_TYPE'.length) : taskConstantName;
  return pascalize(stem) + 'TaskData';
}

function pascalize(screaming: string): string {
  const parts = screaming.split('_').filter((p) => p.length > 0);
  let out = '';
  for (const p of parts) {
    out += p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
  }
  return out;
}

function pushViolation(buffer: Violation[], violation: Omit<Violation, 'severity'> & { readonly severity?: ViolationSeverity }): void {
  const severity: ViolationSeverity = violation.severity ?? 'error';
  const filled: Violation = {
    code: violation.code,
    severity,
    message: violation.message,
    side: violation.side,
    file: violation.file
  };
  buffer.push(filled);
}

/**
 * Exported only so the list-app-notifications tool can share the
 * trusted-handler matcher logic when computing `hasFactory` /
 * `hasHandler` booleans without re-running rules.
 *
 * @param entries - the resolved template-handler entries to scan
 * @param typeIdentifier - the template-type identifier to look for coverage of
 * @returns `true` when at least one entry handles the type
 */
export function templateHandlerCoversType(entries: readonly ExtractedTemplateHandlerEntry[], typeIdentifier: string): boolean {
  return entries.some((e) => e.typeIdentifier === typeIdentifier);
}
