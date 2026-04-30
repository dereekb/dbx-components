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
import type { RemediationHint } from '../rule-catalog/types.js';

/**
 * String-literal union derived from {@link NotificationMValidateAppCode}.
 */
export type ViolationCode = `${NotificationMValidateAppCode}`;

import type { TwoSideResult, TwoSideViolation } from '../validate-format.js';
export type { ViolationSeverity } from '../validate-format.js';

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
export type { InspectedFile, SideInspection, SideStatus } from '../_validate/inspection.types.js';
import type { TwoSideInspectionInput } from '../_validate/inspection.types.js';

export type AppNotificationsInspection = TwoSideInspectionInput;

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
  readonly notificationMIdentity: string | undefined;
  readonly targetModelIdentity: string | undefined;
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
  readonly sourceFile: string;
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
  // Trust-list for external imports (suppresses *_UNRESOLVED / ORPHAN warnings).
  readonly trustedExternalIdentifiers: ReadonlySet<string>;
}
