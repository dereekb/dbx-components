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
 * A top-level component constant annotated `NotificationTemplateType` (by name, through an `@dereekb/*` import alias, or as an `@dereekb/*` namespace member).
 */
export interface ExtractedTemplateTypeConstant {
  readonly symbolName: string;
  readonly typeCode: string | undefined;
  readonly sourceFile: string;
  readonly line: number;
}

/**
 * A `NotificationTemplateTypeInfo` object literal: a constant named `*_NOTIFICATION_TEMPLATE_TYPE_INFO`, or annotated
 * `NotificationTemplateTypeInfo` (by name, through an `@dereekb/*` import alias, or as an `@dereekb/*` namespace member).
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
 * A top-level component constant annotated `NotificationTaskType` (by name, through an `@dereekb/*` import alias, or as an `@dereekb/*` namespace member).
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
 * An aggregate `ALL_*_NOTIFICATION_TEMPLATE_TYPE_INFOS: NotificationTemplateTypeInfo[]` (also `readonly …[]`, `Array<…>`,
 * `ReadonlyArray<…>`; the element type (by name, through an `@dereekb/*` import alias, or as an `@dereekb/*` namespace member)).
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
 * An aggregate named `ALL_*_NOTIFICATION_TASK_TYPES`, or annotated `NotificationTaskType[]` (also `readonly …[]`,
 * `Array<…>`, `ReadonlyArray<…>`; the element type (by name, through an `@dereekb/*` import alias, or as an `@dereekb/*` namespace member)).
 */
export interface ExtractedTaskTypeAggregateArray {
  readonly symbolName: string;
  /**
   * Identifiers that are direct elements of the array literal: the app's task-type constants, plus any upstream constant
   * written directly (e.g. `STORAGE_FILE_PROCESSING_NOTIFICATION_TASK_TYPE`).
   */
  readonly taskTypeIdentifiers: readonly string[];
  /**
   * Identifiers spread (`...X`) into the aggregate: another of the app's aggregates, or an upstream aggregate such as
   * `ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES`. The `validate` expansion follows them
   * ({@link ExtractedTaskServiceCall.nestedValidateIdentifiers}, {@link ExtractedTaskServiceCall.nestedUpstreamValidateListings}).
   */
  readonly spreadIdentifiers: readonly string[];
  /**
   * Elements the extractor can't read (see {@link ExtractedTaskServiceCall.opaqueValidateValues}).
   */
  readonly opaqueValues: readonly string[];
  readonly sourceFile: string;
  readonly line: number;
}

/**
 * The top-level `notificationTemplateTypeInfoRecord([...])` call result (called directly, through an `@dereekb/*` import alias, or as an `@dereekb/*` namespace member).
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
 * A typed `{ type, flow }` task-handler config declaration
 * (`const <name>: NotificationTaskServiceTaskHandlerConfig<...> = { type, ... }`), one per declaration: two configs that
 * share a binding name (in two functions of one file, or in two files) are two entries.
 */
export interface ExtractedTaskHandlerEntry {
  readonly typeIdentifier: string;
  /**
   * Variable binding name when the literal is bound to a typed
   * `const <name>: NotificationTaskServiceTaskHandlerConfig<...> = { ... }` (the annotation's type (by name, through an `@dereekb/*` import alias, or as an `@dereekb/*` namespace member)).
   * Shown in findings; reachability is matched by declaration
   * ({@link ExtractedTaskServiceCall.reachedTaskHandlerEntries}), not by this
   * name. `undefined` for inline / anonymous literals.
   */
  readonly bindingName: string | undefined;
  readonly flowStepCount: number | undefined;
  readonly dataTypeArgument: string | undefined;
  readonly checkpointTypeArgument: string | undefined;
  readonly sourceFile: string;
  readonly line: number;
}

/**
 * The `notificationTaskService({ validate, handlers })` call (called directly, through an `@dereekb/*` import alias, or as an `@dereekb/*` namespace member).
 */
export interface ExtractedTaskServiceCall {
  /**
   * Identifiers written as elements of the `validate` literal. The task types it lists through the app's own component
   * aggregates are in {@link nestedValidateIdentifiers}.
   */
  readonly validateIdentifiers: readonly string[];
  /**
   * Identifiers `validate` spreads (`...X`). When `validate` names an aggregate directly ({@link validateAggregate},
   * {@link validateUpstreamAggregate}), this holds that aggregate's exported name, as if `validate` were `[...X]`.
   */
  readonly spreadValidateIdentifiers: readonly string[];
  readonly handlerTypeIdentifiers: readonly string[];
  readonly unresolvedHandlerSpreadIdentifiers: readonly string[];
  /**
   * Binding names (variable identifiers) reachable through the
   * `handlers:` array — direct elements, spreads, and chains followed
   * through the return of the API function each identifier is bound to
   * where it is used (a function its file declares, or a top-level `const`
   * of the file holds, or one it imports from another API file) and through
   * the initializer of the local variable it means there (the one
   * declaration of its name in scope) until a typed
   * `NotificationTaskServiceTaskHandlerConfig<...>` object literal is
   * reached. A local holding an arrow function or function expression that
   * returns from one place is followed through its return, like a function,
   * and parentheses, `!`, `as` / `<T>` casts and `satisfies` around a value
   * are seen through. Which declared handler configs are wired is read from
   * {@link reachedTaskHandlerEntries}, by declaration; these names only
   * excuse an unresolved name that a resolved binding shares.
   */
  readonly resolvedHandlerBindings: readonly string[];
  /**
   * Identifiers the `handlers:` trace could not follow, each listed once: a name bound, where it is used, to no local
   * variable, API function or `@dereekb/*` import (a parameter, a destructured name, a name only another function or file
   * declares, or an import the scan can't pin to one API function), plus each local or function whose value leads only to
   * such names (or to an object literal that isn't a typed handler config, or an empty array). A local or function whose
   * value ends at an upstream handler factory call or at an opaque value ({@link opaqueHandlerValues}) is not listed. The
   * trace walks each local and function once, and reaching one again reads what that walk found, except while the walk is
   * still running (a cycle), which is listed. The rules pass warns (`NOTIF_TASK_HANDLER_SPREAD_UNRESOLVED`) for each name
   * that is neither trust-listed nor a resolved binding.
   */
  readonly unresolvedHandlerBindings: readonly string[];
  /**
   * Whether the call's `validate` property is missing (`absent`), read (`resolved`: an array literal, inline or a local
   * array variable, or an aggregate it names directly, see {@link validateAggregate} and
   * {@link validateUpstreamAggregate}), or something else (`unresolved`).
   */
  readonly validateStatus: ExtractedTaskServiceValidateStatus;
  /**
   * The component task-type aggregate `validate` names directly, as in `validate: ALL_NOTIFICATION_TASK_TYPES` with
   * `ALL_NOTIFICATION_TASK_TYPES` imported from the app's `-firebase` component: by name, under an alias
   * (`validate: TASK_TYPES`), as a namespace member (`validate: demoFirebase.ALL_NOTIFICATION_TASK_TYPES`), or through a
   * local `const` that holds one of those ({@link validateReferenceText} is how the file writes it). The extractor reads such
   * a `validate` as `[...ALL_NOTIFICATION_TASK_TYPES]`, so every task check treats both forms alike. `undefined` for an
   * array literal (inline or a local array variable), an upstream aggregate ({@link validateUpstreamAggregate}), and a value
   * the scan can't pin (that one stays `unresolved`).
   */
  readonly validateAggregate: ExtractedTaskTypeAggregateArray | undefined;
  /**
   * The upstream aggregate from `UPSTREAM_NOTIFICATION_TASK_HANDLERS` that `validate` names directly, imported from
   * `@dereekb/*` (`validate: ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES`; also under an alias, as a namespace member, or
   * through a local `const`). Read as `[...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES]`, like {@link validateAggregate}.
   * `undefined` otherwise.
   */
  readonly validateUpstreamAggregate: string | undefined;
  /**
   * How the task service's file refers to the aggregate `validate` names directly ({@link validateAggregate} or
   * {@link validateUpstreamAggregate}), valid anywhere in that file: the import's local name (`ALL_NOTIFICATION_TASK_TYPES`,
   * or `TASK_TYPES` for `import { ALL_NOTIFICATION_TASK_TYPES as TASK_TYPES }`) or the namespace member
   * (`demoFirebase.ALL_NOTIFICATION_TASK_TYPES`). A local `const` that holds it is followed, so this names what the `const`
   * holds. Messages write their "`validate: [...]`" fix with it. `undefined` when `validate` names no aggregate.
   */
  readonly validateReferenceText: string | undefined;
  /**
   * Values in the `validate:` array the extractor can't read: a spread of anything but an identifier, or an element that is
   * not an identifier (a string literal, a call, a property access, …). The text is collapsed and truncated. When the list
   * is non-empty, the `*_TASK_TYPES_NOT_IN_VALIDATE` checks skip the service, because the task types could be in there.
   */
  readonly opaqueValidateValues: readonly string[];
  /**
   * Every identifier element of the app's own component `ALL_*_NOTIFICATION_TASK_TYPES` aggregates that `validate`
   * spreads, followed through any nesting (each aggregate once, so a cycle ends), in `validate` order: depth first, an
   * aggregate's spreads before its own elements. Holds the app's task types and any other name written in those
   * aggregates (an upstream task-type constant, a constant from elsewhere); each reader applies its own filters. A name
   * two aggregates hold appears twice. Empty when `validate` spreads (or names) no component aggregate.
   */
  readonly nestedValidateIdentifiers: readonly string[];
  /**
   * Upstream task types `validate` lists through the app's own component aggregates (see
   * {@link ExtractedNestedUpstreamValidateListing}), in `validate` order. Only names imported from `@dereekb/*` and not
   * declared by the component count, and only identifier spreads are followed. Empty when `validate` spreads (or names) no
   * component aggregate that holds one.
   */
  readonly nestedUpstreamValidateListings: readonly ExtractedNestedUpstreamValidateListing[];
  /**
   * Values inside the component aggregates `validate` spreads or names (followed through nesting) that the expansion can't place:
   * an element the extractor can't read, a spread of a name that is neither a component aggregate nor an upstream
   * aggregate imported from `@dereekb/*`, or an upstream task-type constant that is not imported from `@dereekb/*`. When
   * the list is non-empty, the `*_TASK_TYPES_NOT_IN_VALIDATE` checks skip the service, like
   * {@link opaqueValidateValues}.
   */
  readonly opaqueNestedValidateValues: readonly string[];
  /**
   * Every upstream handler-factory call (StorageFile, FormSpace, NotificationTaskBot) the `handlers:` trace reached,
   * called directly, through an `@dereekb/*` import alias, as an `@dereekb/*` namespace member, or through a local
   * `const` holding one of those.
   */
  readonly reachedUpstreamHandlerCalls: readonly ExtractedUpstreamHandlerCall[];
  /**
   * The declared handler configs ({@link ExtractedAppNotifications.taskHandlerEntries}) the `handlers:` trace reached, one
   * per declaration, in trace order. The rules read the task types `handlers` registers from these
   * (`NOTIF_TASK_HANDLER_NAME_MISMATCH`, `NOTIF_TASK_NOT_REGISTERED_IN_SERVICE`), so reaching one config doesn't vouch for
   * another of the same name. A reached typed config whose `type:` isn't an identifier has no entry; its name is still in
   * {@link resolvedHandlerBindings}.
   */
  readonly reachedTaskHandlerEntries: readonly ExtractedTaskHandlerEntry[];
  /**
   * Whether the call's `handlers` property is missing (`absent`), an array literal the extractor read (`resolved`), or
   * something else (`unresolved`).
   */
  readonly handlersStatus: ExtractedTaskServiceValidateStatus;
  /**
   * Values in the `handlers:` trace that the extractor can't see through: a `@dereekb/*` identifier reached as a value (a
   * helper that is not an upstream handler factory, or an upstream handler factory passed along as a value or held in a
   * variable the scan can't pin to one `const`), a call whose callee is neither an identifier nor an `@dereekb/*`
   * namespace member (`obj.fn(...)`, `fn(...)(...)`), any expression other than an identifier, call, array or object
   * literal once parentheses, `!`, `as` / `<T>` casts and `satisfies` are stripped (a conditional, a property read, an
   * arrow function written inline, …), a function held in a local that can return from more than one place, and a name
   * with more than one declaration in scope where it is used (a local or function plus a same-named parameter, import or
   * outer local), so the scan can't tell which one it means. The text is collapsed and truncated.
   * An opaque value ends the trace: the locals and functions that lead to it are not listed in
   * {@link unresolvedHandlerBindings}. When the list is non-empty, the upstream handler checks skip the service.
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
   * The factory's exported name (an import alias, a namespace member or a local `const` is resolved).
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
 * An upstream task-type aggregate or constant (`UPSTREAM_NOTIFICATION_TASK_HANDLERS`) that a
 * `notificationTaskService({ validate })` call lists through the app's own component aggregates, e.g.
 * `validate: [...ALL_NOTIFICATION_TASK_TYPES]` where the component declares
 * `ALL_NOTIFICATION_TASK_TYPES = [..., ...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES]`. The location is the component
 * aggregate that holds it (component-relative path).
 */
export interface ExtractedNestedUpstreamValidateListing extends ExtractedSourceLocation {
  /**
   * The upstream name as written in the component aggregate.
   */
  readonly identifier: string;
  /**
   * `true` for a spread aggregate (`...ALL_STORAGE_FILE_NOTIFICATION_TASK_TYPES`), `false` for a task-type constant element.
   */
  readonly spread: boolean;
  /**
   * The component aggregates from the one `validate` spreads down to the one that holds {@link identifier}, outermost first.
   */
  readonly via: readonly string[];
}

/**
 * The `appNotificationTemplateTypeInfoRecordService(X)` call in the API (called directly, through an `@dereekb/*` import alias, or as an `@dereekb/*` namespace member).
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
  /**
   * Every typed `NotificationTaskServiceTaskHandlerConfig` declared in the scanned API files, reachable or not, one per
   * declaration. Which ones a task service reaches is {@link ExtractedTaskServiceCall.reachedTaskHandlerEntries}.
   */
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
 * A `const X: NotificationTaskBotScriptType = '...'` declaration (the type (by name, through an `@dereekb/*` import alias, or as an `@dereekb/*` namespace member)).
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
 * A `NotificationTaskBotScriptConfig` object literal — a typed constant (annotated `NotificationTaskBotScriptConfig`
 * (by name, through an `@dereekb/*` import alias, or as an `@dereekb/*` namespace member)), or an inline element of a registry or aggregate.
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
 * alias, as an `@dereekb/*` namespace member, or through a local `const` holding one of those).
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
