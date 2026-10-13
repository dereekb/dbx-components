/**
 * Shared types for the `dbx_notification_m_validate_app` validator and
 * its sibling `dbx_notification_m_list_app` listing tool.
 *
 * The validator accepts two directories — a `-firebase` component
 * package (where `NotificationTemplateType` / `NotificationTaskType`
 * constants are declared) and an API app (where the services are wired
 * via NestJS) — and cross-references every declared notification with
 * the two registration paths it must travel through:
 *
 *   1. **Metadata path (templates only).** A `NotificationTemplateTypeInfo`
 *      object must be reachable from a `<APP>_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD`
 *      aggregator that is passed to `appNotificationTemplateTypeInfoRecordService(...)`
 *      somewhere in the API.
 *
 *   2. **Handler path.** For templates, a `NotificationTemplateServiceTypeConfig`
 *      must be reachable from the `<app>NotificationTemplateServiceConfigsArrayFactory`
 *      function (wired via `NOTIFICATION_TEMPLATE_SERVICE_CONFIGS_ARRAY_TOKEN`).
 *      For tasks, a `NotificationTaskServiceTaskHandlerConfig` must be
 *      reachable from the `notificationTaskService({ handlers })` call
 *      argument.
 *
 * Both paths are traced across multiple files using a single
 * in-memory ts-morph `Project` and symbol-name lookups — no TypeScript
 * language service.
 */

// MARK: Violation codes
import type { NotificationMValidateAppCode } from './codes.js';
import type { RemediationHint } from '../_core/rule-catalog/types.js';

/**
 * String-literal union derived from {@link NotificationMValidateAppCode}.
 */
export type ViolationCode = `${NotificationMValidateAppCode}`;

import type { TwoSideResult, TwoSideViolation } from '../_core/validate-format.js';
export type { ViolationSeverity } from '../_core/validate-format.js';

export interface Violation extends TwoSideViolation {
  readonly code: ViolationCode;
  /**
   * Auto-attached remediation hint pulled from the rule catalog at
   * emission time. `undefined` when no catalog entry exists for the
   * code (the formatter renders no nested block in that case).
   */
  readonly remediation?: RemediationHint;
}

export interface ValidationResult extends TwoSideResult {
  readonly violations: readonly Violation[];
}

// MARK: Inspection
export type { InspectedFile, SideInspection, SideStatus } from '../_core/_validate/inspection.types.js';
import type { TwoSideInspectionInput } from '../_core/_validate/inspection.types.js';

/**
 * A workspace-level file read for the NotificationTaskBot checks (`firestore.rules`, `firestore.indexes.json`).
 */
export interface InspectedWorkspaceFile {
  /**
   * Workspace-relative path, used as the `file` of findings about this file.
   */
  readonly path: string;
  /**
   * The file's contents, or `undefined` when it is missing or unreadable.
   */
  readonly text: string | undefined;
}

/**
 * Workspace-level files the NotificationTaskBot checks read. Each check is skipped when its file is absent.
 */
export interface AppNotificationsWorkspaceFiles {
  readonly firestoreRules?: InspectedWorkspaceFile;
  readonly firestoreIndexes?: InspectedWorkspaceFile;
}

/**
 * The component + api file snapshot, plus the optional workspace files the NotificationTaskBot checks read.
 */
export interface AppNotificationsInspection extends TwoSideInspectionInput {
  /**
   * When absent, the `ntb` Firestore rule and `ntb.nat` index checks are skipped.
   */
  readonly workspace?: AppNotificationsWorkspaceFiles;
}

// MARK: Delivery methods
/**
 * Member names of `NotificationDeliveryMethod` (`@dereekb/firebase`): EMAIL='e', TEXT='t', PUSH='p', NOTIFICATION_SUMMARY='n'. Mirrored, not imported, to keep the validator dependency-light.
 */
export type NotificationDeliveryMethodName = 'EMAIL' | 'TEXT' | 'PUSH' | 'NOTIFICATION_SUMMARY';

/**
 * Where a template info's `userConfigurableDeliveryMethods` came from.
 *
 * - `default` — the property is absent (or `undefined` / `null`), so the runtime default applies: the default methods, or none when the
 *   info forces a method.
 * - `declared` — an array the extractor read statically.
 * - `unresolved` — present, but not statically readable (an import, a call, an unknown element, ...).
 */
export type UserConfigurableDeliveryMethodsSource = 'default' | 'declared' | 'unresolved';

/**
 * Where a template info's `forcedDeliveryMethods` came from. Same values as {@link UserConfigurableDeliveryMethodsSource}; `default`
 * means no method is forced.
 */
export type ForcedDeliveryMethodsSource = UserConfigurableDeliveryMethodsSource;

// MARK: Extracted structures
/**
 * An exported `*_NOTIFICATION_TEMPLATE_TYPE` constant.
 */
export interface ExtractedTemplateTypeConstant {
  readonly symbolName: string;
  readonly typeCode: string | undefined;
  readonly sourceFile: string;
  readonly line: number;
}

/**
 * An exported `NotificationTemplateTypeInfo` object literal.
 */
export interface ExtractedTemplateTypeInfo {
  readonly symbolName: string;
  readonly typeConstantName: string | undefined;
  readonly humanName: string | undefined;
  readonly description: string | undefined;
  readonly notificationModelIdentity: string | undefined;
  readonly targetModelIdentity: string | undefined;
  /**
   * The statically read `userConfigurableDeliveryMethods`. Only set when {@link userConfigurableDeliveryMethodsSource} is `declared`.
   */
  readonly userConfigurableDeliveryMethods: readonly NotificationDeliveryMethodName[] | undefined;
  readonly userConfigurableDeliveryMethodsSource: UserConfigurableDeliveryMethodsSource;
  /**
   * The statically read `forcedDeliveryMethods`. Only set when {@link forcedDeliveryMethodsSource} is `declared`.
   */
  readonly forcedDeliveryMethods: readonly NotificationDeliveryMethodName[] | undefined;
  readonly forcedDeliveryMethodsSource: ForcedDeliveryMethodsSource;
  /**
   * The `onlySendToExplicitlyEnabledRecipients` boolean literal, when set to one.
   */
  readonly onlySendToExplicitlyEnabledRecipients: boolean | undefined;
  readonly sourceFile: string;
  readonly line: number;
}

/**
 * An exported `*_NOTIFICATION_TASK_TYPE` constant.
 */
export interface ExtractedTaskTypeConstant {
  readonly symbolName: string;
  readonly typeCode: string | undefined;
  readonly sourceFile: string;
  readonly line: number;
}

/**
 * A union alias like `ExampleNotificationTaskCheckpoint = 'part_a' | 'part_b'`.
 */
export interface ExtractedTaskCheckpointAlias {
  readonly symbolName: string;
  readonly checkpoints: readonly string[];
  readonly sourceFile: string;
}

/**
 * A data interface like `ExampleNotificationTaskData`.
 */
export interface ExtractedTaskDataInterface {
  readonly symbolName: string;
  readonly sourceFile: string;
}

/**
 * An aggregate `ALL_*_NOTIFICATION_TEMPLATE_TYPE_INFOS: NotificationTemplateTypeInfo[]`.
 */
export interface ExtractedTemplateInfoAggregateArray {
  readonly symbolName: string;
  /**
   * Identifiers that are elements of the array literal (info-symbol names).
   */
  readonly infoIdentifiers: readonly string[];
  readonly sourceFile: string;
}

/**
 * An aggregate `ALL_*_NOTIFICATION_TASK_TYPES: NotificationTaskType[]`.
 */
export interface ExtractedTaskTypeAggregateArray {
  readonly symbolName: string;
  readonly taskTypeIdentifiers: readonly string[];
  /**
   * Identifiers spread into the aggregate (`...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES`). Recorded, not followed yet:
   * `isValidateListingConclusive` treats a `validate` that spreads such an aggregate as inconclusive.
   */
  readonly spreadIdentifiers: readonly string[];
  /**
   * Elements the extractor can't read (see {@link ExtractedTaskServiceCall.opaqueValidateValues}).
   */
  readonly opaqueValues: readonly string[];
  readonly sourceFile: string;
}

/**
 * The top-level `notificationTemplateTypeInfoRecord([...])` call result.
 */
export interface ExtractedTemplateInfoRecord {
  readonly symbolName: string;
  /**
   * Identifiers that are direct elements of the record array argument.
   */
  readonly directInfoIdentifiers: readonly string[];
  /**
   * Identifiers that are spread (`...ALL_X_...`) in the record array argument.
   */
  readonly spreadAggregateIdentifiers: readonly string[];
  /**
   * Fully resolved info-symbol names after flattening all spreads (via aggregate arrays).
   */
  readonly resolvedInfoIdentifiers: readonly string[];
  /**
   * Spread identifiers that could not be resolved to a declared aggregate array.
   */
  readonly unresolvedSpreadIdentifiers: readonly string[];
  readonly sourceFile: string;
}

/**
 * A `NotificationTemplateServiceTypeConfig` object literal reachable from the configs-array factory.
 */
export interface ExtractedTemplateHandlerEntry {
  /**
   * The template-type identifier the handler claims via its `type:` property.
   */
  readonly typeIdentifier: string;
  /**
   * The factory-function name that produced this handler config (e.g. `demoNotificationTestFactory`, or a nested sub-factory like `hellosubsNotificationWorkerPaidFactory`).
   */
  readonly factoryFunctionName: string | undefined;
  /**
   * Delivery methods the handler's factory builds channel content for (`emailContent` → EMAIL, `textContent` → TEXT, `notificationSummaryContent` → NOTIFICATION_SUMMARY), in that order. Heuristic: scans the factory's own source plus one `factory:` hop.
   */
  readonly contentDeliveryMethods: readonly NotificationDeliveryMethodName[];
  readonly sourceFile: string;
  readonly line: number;
}

/**
 * The top-level `<app>NotificationTemplateServiceConfigsArrayFactory` composition.
 */
export interface ExtractedTemplateConfigsArrayFactory {
  readonly symbolName: string;
  /**
   * Names of functions called directly inside the return array (no spread).
   */
  readonly directFactoryCalls: readonly string[];
  /**
   * Names of functions spread (`...fooNotifications(context)`) inside the return array.
   */
  readonly spreadFactoryCalls: readonly string[];
  /**
   * Spread identifiers that could not be resolved to a declared function.
   */
  readonly unresolvedSpreadIdentifiers: readonly string[];
  readonly sourceFile: string;
}

/**
 * A `{ type, flow }` task-handler config (either a variable binding or an object-literal element).
 */
export interface ExtractedTaskHandlerEntry {
  readonly typeIdentifier: string;
  /**
   * Variable binding name when the literal is bound to a typed
   * `const <name>: NotificationTaskServiceTaskHandlerConfig<...> = { ... }`.
   * Used by the cross-file reachability trace to match the call-site
   * identifier in `notificationTaskService({ handlers })` against the
   * declared literal. `undefined` for inline / anonymous literals.
   */
  readonly bindingName: string | undefined;
  readonly flowStepCount: number | undefined;
  readonly dataTypeArgument: string | undefined;
  readonly checkpointTypeArgument: string | undefined;
  readonly sourceFile: string;
  readonly line: number;
}

/**
 * The `notificationTaskService({ validate, handlers })` call.
 */
export interface ExtractedTaskServiceCall {
  readonly validateIdentifiers: readonly string[];
  readonly spreadValidateIdentifiers: readonly string[];
  readonly handlerTypeIdentifiers: readonly string[];
  readonly unresolvedHandlerSpreadIdentifiers: readonly string[];
  /**
   * Binding names (variable identifiers) reachable through the
   * `handlers:` array — direct elements, spreads, and chains followed
   * through local-variable initializers and function returns until a
   * typed `NotificationTaskServiceTaskHandlerConfig<...>` object literal
   * is reached. The rules pass intersects this set with the
   * {@link ExtractedTaskHandlerEntry.bindingName} field to compute
   * which declared handlers are actually wired.
   */
  readonly resolvedHandlerBindings: readonly string[];
  /**
   * Identifiers that the handler-array trace could not bind to a local
   * declaration or function. The rules pass cross-checks them against
   * the trust-list before warning, so upstream factory calls (e.g.
   * `storageFileProcessingNotificationTaskHandler` from
   * `@dereekb/firebase-server/model`) do not produce noise.
   */
  readonly unresolvedHandlerBindings: readonly string[];
  /**
   * Whether the call's `validate` property is missing (`absent`), an array literal the extractor read (`resolved`), or
   * something else (`unresolved`).
   */
  readonly validateStatus: ExtractedTaskServiceValidateStatus;
  /**
   * Values in the `validate:` array the extractor can't read: a spread of anything but an identifier, or an element that is
   * not an identifier (a string literal, a call, a property access, …). The text is collapsed and truncated. When the list
   * is non-empty, the `*_TASK_TYPES_NOT_IN_VALIDATE` checks skip the service, because the task types could be in there.
   */
  readonly opaqueValidateValues: readonly string[];
  /**
   * Every upstream handler-factory call (StorageFile, FormSpace, NotificationTaskBot) the `handlers:` trace reached,
   * called directly, through an `@dereekb/*` import alias, or as an `@dereekb/*` namespace member.
   */
  readonly reachedUpstreamHandlerCalls: readonly ExtractedUpstreamHandlerCall[];
  /**
   * Whether the call's `handlers` property is missing (`absent`), an array literal the extractor read (`resolved`), or
   * something else (`unresolved`).
   */
  readonly handlersStatus: ExtractedTaskServiceValidateStatus;
  /**
   * Values in the `handlers:` trace that the extractor can't see through: a `@dereekb/*` identifier reached as a value (a
   * helper that is not an upstream handler factory, or an upstream handler factory held in a variable), a call whose
   * callee is neither an identifier nor an `@dereekb/*` namespace member (`obj.fn(...)`, `fn(...)(...)`), and any expression
   * other than an identifier, call, array or object literal (a conditional, `satisfies`, a parenthesized or non-null
   * expression, …). The text is collapsed and truncated. When the list is non-empty, the upstream handler checks skip
   * the service.
   */
  readonly opaqueHandlerValues: readonly string[];
  readonly sourceFile: string;
}

/**
 * How a `notificationTaskService` (or NTBR handler) `validate` or `handlers` list was read.
 */
export type ExtractedTaskServiceValidateStatus = 'absent' | 'resolved' | 'unresolved';

/**
 * A location in a scanned file. Also written into the `dbx_notification_m_list_app` report and
 * `notification.manifest.json` (`taskBot`); keep changes additive.
 */
export interface ExtractedSourceLocation {
  readonly sourceFile: string;
  readonly line: number;
}

/**
 * A call of an upstream handler factory from `UPSTREAM_NOTIFICATION_TASK_HANDLERS` (e.g. `storageFileProcessingNotificationTaskHandler(...)`).
 */
export interface ExtractedUpstreamHandlerCall extends ExtractedSourceLocation {
  /**
   * The factory's exported name (an import alias or namespace member is resolved).
   */
  readonly factory: string;
}

/**
 * An upstream handler factory call anywhere in the scanned API files, with the function that builds it.
 */
export interface ExtractedUpstreamHandlerFactoryCall extends ExtractedUpstreamHandlerCall {
  /**
   * The enclosing named function (e.g. `demoStorageFileProcessingNotificationTaskHandler`), or `undefined` at module scope.
   */
  readonly enclosingFunction: string | undefined;
}

/**
 * The `appNotificationTemplateTypeInfoRecordService(X)` call in the API.
 */
export interface ExtractedTemplateInfoRecordWiring {
  readonly recordIdentifier: string;
  readonly sourceFile: string;
}

/**
 * The NestJS provider `{ provide: NOTIFICATION_TEMPLATE_SERVICE_CONFIGS_ARRAY_TOKEN, useFactory: X }`.
 */
export interface ExtractedTemplateConfigsArrayWiring {
  readonly useFactoryIdentifier: string;
  readonly sourceFile: string;
}

/**
 * Aggregated cross-file extraction result.
 */
export interface ExtractedAppNotifications {
  // Component side
  readonly templateTypeConstants: readonly ExtractedTemplateTypeConstant[];
  readonly templateTypeInfos: readonly ExtractedTemplateTypeInfo[];
  readonly templateInfoAggregates: readonly ExtractedTemplateInfoAggregateArray[];
  readonly templateInfoRecord: ExtractedTemplateInfoRecord | undefined;
  readonly taskTypeConstants: readonly ExtractedTaskTypeConstant[];
  readonly taskAllTypesAggregates: readonly ExtractedTaskTypeAggregateArray[];
  readonly taskCheckpointAliases: readonly ExtractedTaskCheckpointAlias[];
  readonly taskDataInterfaces: readonly ExtractedTaskDataInterface[];
  // API side
  readonly templateInfoRecordWiring: ExtractedTemplateInfoRecordWiring | undefined;
  readonly templateConfigsArrayFactory: ExtractedTemplateConfigsArrayFactory | undefined;
  readonly templateConfigsArrayWiring: ExtractedTemplateConfigsArrayWiring | undefined;
  readonly templateHandlerEntries: readonly ExtractedTemplateHandlerEntry[];
  readonly taskServiceCalls: readonly ExtractedTaskServiceCall[];
  readonly taskHandlerEntries: readonly ExtractedTaskHandlerEntry[];
  /**
   * Every upstream handler-factory call in the scanned API files, reachable or not; used to point at an unreachable handler.
   */
  readonly upstreamHandlerCalls: readonly ExtractedUpstreamHandlerFactoryCall[];
  // NotificationTaskBot wiring (both sides plus the workspace files).
  readonly taskBot: ExtractedAppNotificationTaskBot;
  // Trust-list for external imports (suppresses *_UNRESOLVED / ORPHAN warnings).
  readonly trustedExternalIdentifiers: ReadonlySet<string>;
}

// MARK: NotificationTaskBot
/**
 * The side a NotificationTaskBot fact was declared on.
 */
export type ExtractedTaskBotSide = 'component' | 'api';

/**
 * A located NotificationTaskBot fact.
 */
export interface ExtractedTaskBotLocation extends ExtractedSourceLocation {
  readonly side: ExtractedTaskBotSide;
}

/**
 * A reference to a NotificationTaskBot script type: a config's `scriptType`, a processor's `target`, or a `validate`
 * entry. Also written into the `dbx_notification_m_list_app` report and `notification.manifest.json` (`taskBot`); keep
 * changes additive.
 */
export interface ExtractedTaskBotScriptTypeRef {
  /**
   * The constant the reference names, when it names one.
   */
  readonly identifier?: string;
  /**
   * The script type's literal code, when known.
   */
  readonly code?: string;
  /**
   * Whether the reference is a string literal, a declared `NotificationTaskBotScriptType` constant, or a trust-listed
   * `@dereekb/*` import. Only declared references take part in the registry ↔ processor check.
   */
  readonly declared: boolean;
}

/**
 * A `const X: NotificationTaskBotScriptType = '...'` declaration.
 */
export interface ExtractedTaskBotScriptTypeConstant extends ExtractedTaskBotLocation {
  readonly symbolName: string;
  readonly typeCode: string | undefined;
}

/**
 * Whether a NotificationTaskBot script config sets `dataType`:
 *
 * - `declared` — the property is present and not an `undefined` / `null` literal (a shorthand `{ dataType }` counts).
 * - `none` — the property is absent (and the object spreads nothing), or is `undefined` / `null`. `update:entry` refuses
 *   every data patch for such a script.
 * - `unresolved` — the property is absent, but the object spreads another object that may set it.
 */
export type ExtractedTaskBotScriptConfigDataTypeSource = 'declared' | 'none' | 'unresolved';

/**
 * A `NotificationTaskBotScriptConfig` object literal — a typed constant, or an inline element of a registry or
 * aggregate.
 */
export interface ExtractedTaskBotScriptConfig extends ExtractedTaskBotLocation {
  readonly symbolName: string | undefined;
  /**
   * The config's `scriptType`, or `undefined` when the property is missing.
   */
  readonly scriptType: ExtractedTaskBotScriptTypeRef | undefined;
  /**
   * The config's `name` string literal.
   */
  readonly humanName: string | undefined;
  /**
   * The config's `description` string literal.
   */
  readonly description: string | undefined;
  /**
   * The `key` of the config's `group`, when `group` is an object literal or a `NotificationTaskBotScriptGroup` constant
   * with a string-literal `key`.
   */
  readonly groupKey: string | undefined;
  /**
   * The config's `allowOwnerOptOut`, when set to a boolean literal.
   */
  readonly allowOwnerOptOut: boolean | undefined;
  /**
   * Whether the config sets `dataType`.
   */
  readonly dataTypeSource: ExtractedTaskBotScriptConfigDataTypeSource;
}

/**
 * A `notificationTaskBotScriptConfigRecord(...)` call with its configs resolved.
 */
export interface ExtractedTaskBotRegistry extends ExtractedTaskBotLocation {
  /**
   * The variable the record is assigned to; `undefined` for an inline record.
   */
  readonly symbolName: string | undefined;
  readonly configs: readonly ExtractedTaskBotScriptConfig[];
  /**
   * Elements the extractor could not resolve to a config or a config array (source text).
   */
  readonly unresolvedReferences: readonly string[];
  /**
   * Elements imported from a trust-listed `@dereekb/*` module.
   */
  readonly trustedReferences: readonly string[];
}

/**
 * What an `appNotificationTaskBotScriptConfigService(...)` call passes:
 *
 * - `identifier` — a variable, named by `recordIdentifier`.
 * - `inline` — a `notificationTaskBotScriptConfigRecord(...)` call written in place.
 * - `empty` — no argument, so the registry is empty.
 * - `other` — anything else.
 */
export type ExtractedTaskBotRegistryWiringKind = 'identifier' | 'inline' | 'empty' | 'other';

/**
 * An `appNotificationTaskBotScriptConfigService(...)` call in the API. Also written into the
 * `dbx_notification_m_list_app` report and `notification.manifest.json` (`taskBot`); keep changes additive.
 */
export interface ExtractedTaskBotRegistryWiring extends ExtractedSourceLocation {
  readonly kind: ExtractedTaskBotRegistryWiringKind;
  readonly recordIdentifier: string | undefined;
}

/**
 * One element of an NTBR handler's `processors`. Also written into the `dbx_notification_m_list_app` report and
 * `notification.manifest.json` (`taskBot`); keep changes additive.
 */
export interface ExtractedTaskBotProcessor extends ExtractedSourceLocation {
  /**
   * Short source text of the element, for messages.
   */
  readonly label: string;
  /**
   * The processor's `target`, when it resolved.
   */
  readonly target: ExtractedTaskBotScriptTypeRef | undefined;
  /**
   * Why `target` did not resolve. `undefined` when it resolved, or when the processor is a trust-listed import.
   */
  readonly unresolvedReason: string | undefined;
  /**
   * The processor is built by a trust-listed `@dereekb/*` import, so its target is unknown but not reported.
   */
  readonly trusted: boolean;
}

/**
 * A `notificationTaskBotRunNotificationTaskHandler(...)` call in the API (called directly, through an `@dereekb/*` import
 * alias, or as an `@dereekb/*` namespace member).
 */
export interface ExtractedTaskBotRunHandlerCall extends ExtractedSourceLocation {
  /**
   * Whether the `processors` array itself could be read.
   */
  readonly processorsResolved: boolean;
  readonly processors: readonly ExtractedTaskBotProcessor[];
  readonly validateStatus: ExtractedTaskServiceValidateStatus;
  /**
   * The script types `validate` lists, when it resolved and does not defer to the registry.
   */
  readonly validate: readonly ExtractedTaskBotScriptTypeRef[];
  /**
   * `validate` is `<registry>.getAllKnownScriptTypes()`, so it lists exactly the registry's script types.
   */
  readonly validateUsesRegistry: boolean;
  /**
   * Why `validate` did not resolve.
   */
  readonly validateUnresolvedReason: string | undefined;
}

/**
 * The workspace `firestore.rules` facts.
 */
export interface ExtractedTaskBotFirestoreRules {
  readonly path: string;
  readonly readable: boolean;
  /**
   * The file has an uncommented `match /ntb/{...}` (or `match /{path=**}/ntb/{...}`) block.
   */
  readonly hasNotificationTaskBotMatch: boolean;
}

/**
 * The workspace `firestore.indexes.json` facts.
 */
export interface ExtractedTaskBotFirestoreIndexes {
  readonly path: string;
  readonly parsed: boolean;
  /**
   * A `fieldOverrides` entry for `ntb.nat` drops the COLLECTION / ASCENDING single-field index.
   */
  readonly natIndexExempted: boolean;
}

/**
 * Everything the NotificationTaskBot rules consume.
 */
export interface ExtractedAppNotificationTaskBot {
  /**
   * The app uses bots: a script config, a registry, a registry service with an argument, an NTBR handler call, or the
   * NotificationTaskBot task types in a task service's `validate`. Every `NOTIF_TASK_BOT_*` rule is skipped otherwise.
   */
  readonly taskBotInUse: boolean;
  readonly scriptTypeConstants: readonly ExtractedTaskBotScriptTypeConstant[];
  readonly scriptConfigs: readonly ExtractedTaskBotScriptConfig[];
  readonly registries: readonly ExtractedTaskBotRegistry[];
  readonly registryWirings: readonly ExtractedTaskBotRegistryWiring[];
  readonly runHandlerCalls: readonly ExtractedTaskBotRunHandlerCall[];
  readonly repairCalls: readonly ExtractedSourceLocation[];
  readonly firestoreRules: ExtractedTaskBotFirestoreRules | undefined;
  readonly firestoreIndexes: ExtractedTaskBotFirestoreIndexes | undefined;
}
