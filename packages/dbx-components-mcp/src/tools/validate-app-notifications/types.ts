/**
 * Shared types for the `dbx_validate_app_notifications` validator and
 * its sibling `dbx_list_app_notifications` listing tool.
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
export type ViolationCode =
  // I/O failures
  | 'NOTIF_COMPONENT_DIR_NOT_FOUND'
  | 'NOTIF_API_DIR_NOT_FOUND'
  | 'NOTIF_COMPONENT_NOTIFICATION_FOLDER_MISSING'
  | 'NOTIF_API_NOTIFICATION_FOLDER_MISSING'
  // Template metadata (info-record path)
  | 'NOTIF_TEMPLATE_INFO_MISSING'
  | 'NOTIF_TEMPLATE_INFO_TYPE_MISMATCH'
  | 'NOTIF_TEMPLATE_INFO_NOT_IN_RECORD'
  | 'NOTIF_TEMPLATE_RECORD_MISSING'
  | 'NOTIF_TEMPLATE_RECORD_NOT_WIRED'
  | 'NOTIF_TEMPLATE_SPREAD_UNRESOLVED'
  // Template handler (factory path)
  | 'NOTIF_TEMPLATE_FACTORY_MISSING'
  | 'NOTIF_TEMPLATE_FACTORY_NOT_WIRED'
  | 'NOTIF_TEMPLATE_FACTORY_ORPHAN'
  | 'NOTIF_TEMPLATE_FACTORY_ARRAY_MISSING'
  | 'NOTIF_TEMPLATE_FACTORY_SPREAD_UNRESOLVED'
  // Tasks
  | 'NOTIF_TASK_NOT_IN_ALL_ARRAY'
  | 'NOTIF_TASK_NOT_REGISTERED_IN_SERVICE'
  | 'NOTIF_TASK_HANDLER_ORPHAN'
  | 'NOTIF_TASK_HANDLER_NAME_MISMATCH'
  | 'NOTIF_TASK_SERVICE_FACTORY_MISSING'
  | 'NOTIF_TASK_HANDLER_SPREAD_UNRESOLVED'
  // Warnings
  | 'NOTIF_TEMPLATE_INFO_UNUSED'
  | 'NOTIF_TEMPLATE_TYPE_CODE_DUPLICATE'
  | 'NOTIF_TASK_TYPE_CODE_DUPLICATE'
  | 'NOTIF_TASK_IN_VALIDATE_WITHOUT_HANDLER'
  | 'NOTIF_TEMPLATE_INFO_MISSING_NAME_OR_DESCRIPTION'
  | 'NOTIF_TASK_MULTIPLE_SERVICES';

export type ViolationSeverity = 'error' | 'warning';

export interface Violation {
  readonly code: ViolationCode;
  readonly severity: ViolationSeverity;
  readonly message: string;
  readonly side: 'component' | 'api' | 'both';
  readonly file: string | undefined;
}

export interface ValidationResult {
  readonly violations: readonly Violation[];
  readonly errorCount: number;
  readonly warningCount: number;
  readonly componentDir: string;
  readonly apiDir: string;
}

// MARK: Inspection
export type SideStatus = 'ok' | 'dir-not-found' | 'notification-folder-missing';

export interface InspectedFile {
  /** Path relative to the side's root (e.g. `src/lib/model/notification/notification.ts`). */
  readonly relPath: string;
  readonly text: string;
}

export interface SideInspection {
  readonly rootDir: string;
  readonly notificationFolder: string | undefined;
  readonly status: SideStatus;
  readonly files: readonly InspectedFile[];
}

export interface AppNotificationsInspection {
  readonly component: SideInspection;
  readonly api: SideInspection;
}

// MARK: Extracted structures
/** An exported `*_NOTIFICATION_TEMPLATE_TYPE` constant. */
export interface ExtractedTemplateTypeConstant {
  readonly symbolName: string;
  readonly typeCode: string | undefined;
  readonly sourceFile: string;
  readonly line: number;
}

/** An exported `NotificationTemplateTypeInfo` object literal. */
export interface ExtractedTemplateTypeInfo {
  readonly symbolName: string;
  readonly typeConstantName: string | undefined;
  readonly humanName: string | undefined;
  readonly description: string | undefined;
  readonly notificationModelIdentity: string | undefined;
  readonly targetModelIdentity: string | undefined;
  readonly sourceFile: string;
  readonly line: number;
}

/** An exported `*_NOTIFICATION_TASK_TYPE` constant. */
export interface ExtractedTaskTypeConstant {
  readonly symbolName: string;
  readonly typeCode: string | undefined;
  readonly sourceFile: string;
  readonly line: number;
}

/** A union alias like `ExampleNotificationTaskCheckpoint = 'part_a' | 'part_b'`. */
export interface ExtractedTaskCheckpointAlias {
  readonly symbolName: string;
  readonly checkpoints: readonly string[];
  readonly sourceFile: string;
}

/** A data interface like `ExampleNotificationTaskData`. */
export interface ExtractedTaskDataInterface {
  readonly symbolName: string;
  readonly sourceFile: string;
}

/** An aggregate `ALL_*_NOTIFICATION_TEMPLATE_TYPE_INFOS: NotificationTemplateTypeInfo[]`. */
export interface ExtractedTemplateInfoAggregateArray {
  readonly symbolName: string;
  /** Identifiers that are elements of the array literal (info-symbol names). */
  readonly infoIdentifiers: readonly string[];
  readonly sourceFile: string;
}

/** An aggregate `ALL_*_NOTIFICATION_TASK_TYPES: NotificationTaskType[]`. */
export interface ExtractedTaskTypeAggregateArray {
  readonly symbolName: string;
  readonly taskTypeIdentifiers: readonly string[];
  readonly sourceFile: string;
}

/** The top-level `notificationTemplateTypeInfoRecord([...])` call result. */
export interface ExtractedTemplateInfoRecord {
  readonly symbolName: string;
  /** Identifiers that are direct elements of the record array argument. */
  readonly directInfoIdentifiers: readonly string[];
  /** Identifiers that are spread (`...ALL_X_...`) in the record array argument. */
  readonly spreadAggregateIdentifiers: readonly string[];
  /** Fully resolved info-symbol names after flattening all spreads (via aggregate arrays). */
  readonly resolvedInfoIdentifiers: readonly string[];
  /** Spread identifiers that could not be resolved to a declared aggregate array. */
  readonly unresolvedSpreadIdentifiers: readonly string[];
  readonly sourceFile: string;
}

/** A `NotificationTemplateServiceTypeConfig` object literal reachable from the configs-array factory. */
export interface ExtractedTemplateHandlerEntry {
  /** The template-type identifier the handler claims via its `type:` property. */
  readonly typeIdentifier: string;
  /** The factory-function name that produced this handler config (e.g. `demoNotificationTestFactory`, or a nested sub-factory like `hellosubsNotificationWorkerPaidFactory`). */
  readonly factoryFunctionName: string | undefined;
  readonly sourceFile: string;
  readonly line: number;
}

/** The top-level `<app>NotificationTemplateServiceConfigsArrayFactory` composition. */
export interface ExtractedTemplateConfigsArrayFactory {
  readonly symbolName: string;
  /** Names of functions called directly inside the return array (no spread). */
  readonly directFactoryCalls: readonly string[];
  /** Names of functions spread (`...fooNotifications(context)`) inside the return array. */
  readonly spreadFactoryCalls: readonly string[];
  /** Spread identifiers that could not be resolved to a declared function. */
  readonly unresolvedSpreadIdentifiers: readonly string[];
  readonly sourceFile: string;
}

/** A `{ type, flow }` task-handler config (either a variable binding or an object-literal element). */
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

/** The `notificationTaskService({ validate, handlers })` call. */
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

/** The `appNotificationTemplateTypeInfoRecordService(X)` call in the API. */
export interface ExtractedTemplateInfoRecordWiring {
  readonly recordIdentifier: string;
  readonly sourceFile: string;
}

/** The NestJS provider `{ provide: NOTIFICATION_TEMPLATE_SERVICE_CONFIGS_ARRAY_TOKEN, useFactory: X }`. */
export interface ExtractedTemplateConfigsArrayWiring {
  readonly useFactoryIdentifier: string;
  readonly sourceFile: string;
}

/** Aggregated cross-file extraction result. */
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
