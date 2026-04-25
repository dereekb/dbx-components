/**
 * Shared types for the `dbx_validate_app_storagefiles` validator and
 * its sibling `dbx_list_app_storagefiles` listing tool.
 *
 * The validator accepts two directories — a `-firebase` component
 * package (where `StorageFilePurpose` / `UploadedFileTypeIdentifier`
 * constants are declared) and an API app (where the upload service
 * and the notification-task processing handler are wired) — and
 * cross-references every declared purpose with the two registration
 * paths it must travel through:
 *
 *   1. **Upload-service path.** A
 *      `StorageFileInitializeFromUploadServiceInitializer` whose
 *      `type:` references the purpose's
 *      `*_UPLOADED_FILE_TYPE_IDENTIFIER` constant must be reachable
 *      from a `storageFileInitializeFromUploadService({ initializer })`
 *      call, and that call's enclosing factory must be wired as the
 *      `useFactory` of a NestJS provider whose `provide:` is the
 *      `StorageFileInitializeFromUploadService` class itself.
 *
 *   2. **Processing-handler path** (only for purposes that declare
 *      subtasks). A
 *      `StorageFileProcessingPurposeSubtaskProcessorConfig` whose
 *      `target:` references the purpose constant must be reachable
 *      from a `storageFileProcessingNotificationTaskHandler({ processors })`
 *      call. Wiring of the surrounding `notificationTaskService(...)`
 *      handler is verified by the notification validator and is not
 *      re-checked here.
 *
 * Both paths are traced across multiple files using a single
 * in-memory ts-morph `Project` and symbol-name lookups — no
 * TypeScript language service.
 */

// MARK: Violation codes
export type ViolationCode =
  // I/O failures
  | 'STORAGEFILE_COMPONENT_DIR_NOT_FOUND'
  | 'STORAGEFILE_API_DIR_NOT_FOUND'
  | 'STORAGEFILE_COMPONENT_FOLDER_MISSING'
  | 'STORAGEFILE_API_FOLDER_MISSING'
  // Purpose declaration
  | 'STORAGEFILE_PURPOSE_MISSING_FILE_TYPE_IDENTIFIER'
  // Upload service errors
  | 'STORAGEFILE_UPLOAD_SERVICE_FACTORY_MISSING'
  | 'STORAGEFILE_UPLOAD_SERVICE_NOT_WIRED'
  | 'STORAGEFILE_PURPOSE_NOT_IN_UPLOAD_SERVICE'
  | 'STORAGEFILE_UPLOAD_INITIALIZER_ORPHAN'
  // Upload service warnings
  | 'STORAGEFILE_UPLOAD_SERVICE_SPREAD_UNRESOLVED'
  | 'STORAGEFILE_UPLOAD_SERVICE_MULTIPLE_FACTORIES'
  // Processing handler errors
  | 'STORAGEFILE_PROCESSING_HANDLER_MISSING'
  | 'STORAGEFILE_PROCESSING_CONFIG_MISSING'
  | 'STORAGEFILE_PROCESSING_CONFIG_ORPHAN'
  | 'STORAGEFILE_PROCESSING_SUBTASK_NOT_HANDLED'
  // Duplicate / convention warnings
  | 'STORAGEFILE_PURPOSE_DUPLICATE'
  | 'STORAGEFILE_FILE_TYPE_IDENTIFIER_DUPLICATE'
  | 'STORAGEFILE_GROUP_IDS_FUNCTION_MISSING';

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
export type SideStatus = 'ok' | 'dir-not-found' | 'storagefile-folder-missing';

export interface InspectedFile {
  /** Path relative to the side's root (e.g. `src/lib/model/storagefile/storagefile.ts`). */
  readonly relPath: string;
  readonly text: string;
}

export interface SideInspection {
  readonly rootDir: string;
  readonly storagefileFolder: string | undefined;
  readonly status: SideStatus;
  readonly files: readonly InspectedFile[];
}

export interface AppStorageFilesInspection {
  readonly component: SideInspection;
  readonly api: SideInspection;
}

// MARK: Extracted structures
/** An exported `*_PURPOSE: StorageFilePurpose` constant. */
export interface ExtractedPurposeConstant {
  readonly symbolName: string;
  readonly purposeCode: string | undefined;
  readonly sourceFile: string;
  readonly line: number;
}

/** An exported `*_UPLOADED_FILE_TYPE_IDENTIFIER: UploadedFileTypeIdentifier` constant. */
export interface ExtractedUploadedFileTypeIdentifierConstant {
  readonly symbolName: string;
  readonly typeCode: string | undefined;
  readonly sourceFile: string;
  readonly line: number;
}

/** An exported `*_PROCESSING_SUBTASK: StorageFileProcessingSubtask` constant. */
export interface ExtractedProcessingSubtaskConstant {
  readonly symbolName: string;
  readonly subtaskCode: string | undefined;
  readonly sourceFile: string;
  readonly line: number;
}

/** A union alias like `UserTestFileProcessingSubtask = typeof X | typeof Y`. */
export interface ExtractedProcessingSubtaskAlias {
  readonly symbolName: string;
  /** The `*_PROCESSING_SUBTASK` constant identifiers referenced via `typeof X` clauses. */
  readonly subtaskConstantNames: readonly string[];
  readonly sourceFile: string;
}

/** A `<purpose>FileGroupIds(...)` / `<purpose>StorageFileGroupIds(...)` factory function. */
export interface ExtractedGroupIdsFunction {
  readonly symbolName: string;
  readonly sourceFile: string;
}

/** A `StorageFileInitializeFromUploadServiceInitializer` object literal in the API. */
export interface ExtractedUploadInitializerEntry {
  readonly typeIdentifier: string;
  /** The variable name the initializer is bound to (best-effort). */
  readonly bindingName: string | undefined;
  readonly sourceFile: string;
  readonly line: number;
}

/** A `storageFileInitializeFromUploadService({ initializer })` call. */
export interface ExtractedUploadServiceCall {
  /** Names of variables/initializers used directly inside the initializer array. */
  readonly directBindingNames: readonly string[];
  /** Names of array bindings that were spread inside the initializer array. */
  readonly spreadBindingNames: readonly string[];
  /** Spread identifiers that could not be resolved to a declared array binding. */
  readonly unresolvedSpreadIdentifiers: readonly string[];
  /** All initializer-typed binding names reachable through direct + spread elements. */
  readonly resolvedInitializerBindings: readonly string[];
  /** Best-effort name of the enclosing factory function (e.g. `demoStorageFileUploadServiceFactory`). */
  readonly enclosingFactoryName: string | undefined;
  readonly sourceFile: string;
}

/** A NestJS provider object with `provide: StorageFileInitializeFromUploadService`. */
export interface ExtractedUploadServiceWiring {
  readonly useFactoryIdentifier: string | undefined;
  readonly sourceFile: string;
}

/** A `StorageFileProcessingPurposeSubtaskProcessorConfig` variable declaration. */
export interface ExtractedProcessingConfig {
  /** The identifier referenced by the `target:` property — usually a `*_PURPOSE` constant. */
  readonly targetIdentifier: string;
  /** The `subtask:` identifiers listed in the `flow:` array. */
  readonly flowSubtaskIdentifiers: readonly string[];
  readonly sourceFile: string;
  readonly line: number;
}

/** A `storageFileProcessingNotificationTaskHandler({ processors })` call. */
export interface ExtractedProcessingHandlerCall {
  /** Names of identifiers/calls used as direct elements of `processors:`. */
  readonly directProcessorReferences: readonly string[];
  /** Spread identifiers inside `processors:`. */
  readonly spreadProcessorReferences: readonly string[];
  readonly sourceFile: string;
}

/** Aggregated cross-file extraction result. */
export interface ExtractedAppStorageFiles {
  // Component side
  readonly purposeConstants: readonly ExtractedPurposeConstant[];
  readonly fileTypeIdentifierConstants: readonly ExtractedUploadedFileTypeIdentifierConstant[];
  readonly processingSubtaskConstants: readonly ExtractedProcessingSubtaskConstant[];
  readonly processingSubtaskAliases: readonly ExtractedProcessingSubtaskAlias[];
  readonly groupIdsFunctions: readonly ExtractedGroupIdsFunction[];
  // API side
  readonly uploadInitializerEntries: readonly ExtractedUploadInitializerEntry[];
  readonly uploadServiceCalls: readonly ExtractedUploadServiceCall[];
  readonly uploadServiceWirings: readonly ExtractedUploadServiceWiring[];
  readonly processingConfigs: readonly ExtractedProcessingConfig[];
  readonly processingHandlerCalls: readonly ExtractedProcessingHandlerCall[];
  // Trust-list for external imports (suppresses *_UNRESOLVED / ORPHAN warnings).
  readonly trustedExternalIdentifiers: ReadonlySet<string>;
}
