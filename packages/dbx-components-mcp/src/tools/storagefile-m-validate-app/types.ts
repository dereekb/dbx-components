/**
 * Shared types for the `dbx_storagefile_m_validate_app` validator and
 * its sibling `dbx_storagefile_m_list_app` listing tool.
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
import type { StorageFileMValidateAppCode } from './codes.js';
import type { RemediationHint } from '../rule-catalog/types.js';

/**
 * String-literal union derived from {@link StorageFileMValidateAppCode}.
 * Source of truth for code metadata is the enum's per-member JSDoc;
 * the template-literal type widens the enum back to its underlying
 * SCREAMING_SNAKE strings so existing emit-sites still typecheck.
 */
export type ViolationCode = `${StorageFileMValidateAppCode}`;

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

export type AppStorageFilesInspection = TwoSideInspectionInput;

// MARK: Extracted structures
/**
 * An exported `*_PURPOSE: StorageFilePurpose` constant.
 */
export interface ExtractedPurposeConstant {
  readonly symbolName: string;
  readonly purposeCode: string | undefined;
  readonly sourceFile: string;
  readonly line: number;
}

/**
 * An exported `*_UPLOADED_FILE_TYPE_IDENTIFIER: UploadedFileTypeIdentifier` constant.
 */
export interface ExtractedUploadedFileTypeIdentifierConstant {
  readonly symbolName: string;
  readonly typeCode: string | undefined;
  readonly sourceFile: string;
  readonly line: number;
}

/**
 * An exported `*_PROCESSING_SUBTASK: StorageFileProcessingSubtask` constant.
 */
export interface ExtractedProcessingSubtaskConstant {
  readonly symbolName: string;
  readonly subtaskCode: string | undefined;
  readonly sourceFile: string;
  readonly line: number;
}

/**
 * A union alias like `UserTestFileProcessingSubtask = typeof X | typeof Y`.
 */
export interface ExtractedProcessingSubtaskAlias {
  readonly symbolName: string;
  /**
   * The `*_PROCESSING_SUBTASK` constant identifiers referenced via `typeof X` clauses.
   */
  readonly subtaskConstantNames: readonly string[];
  readonly sourceFile: string;
}

/**
 * A `<purpose>FileGroupIds(...)` / `<purpose>StorageFileGroupIds(...)` factory function.
 */
export interface ExtractedGroupIdsFunction {
  readonly symbolName: string;
  readonly sourceFile: string;
}

/**
 * A `StorageFileInitializeFromUploadServiceInitializer` object literal in the API.
 */
export interface ExtractedUploadInitializerEntry {
  readonly typeIdentifier: string;
  /**
   * The variable name the initializer is bound to (best-effort).
   */
  readonly bindingName: string | undefined;
  readonly sourceFile: string;
  readonly line: number;
}

/**
 * A `storageFileInitializeFromUploadService({ initializer })` call.
 */
export interface ExtractedUploadServiceCall {
  /**
   * Names of variables/initializers used directly inside the initializer array.
   */
  readonly directBindingNames: readonly string[];
  /**
   * Names of array bindings that were spread inside the initializer array.
   */
  readonly spreadBindingNames: readonly string[];
  /**
   * Spread identifiers that could not be resolved to a declared array binding.
   */
  readonly unresolvedSpreadIdentifiers: readonly string[];
  /**
   * All initializer-typed binding names reachable through direct + spread elements.
   */
  readonly resolvedInitializerBindings: readonly string[];
  /**
   * Best-effort name of the enclosing factory function (e.g. `demoStorageFileUploadServiceFactory`).
   */
  readonly enclosingFactoryName: string | undefined;
  readonly sourceFile: string;
}

/**
 * A NestJS provider object with `provide: StorageFileInitializeFromUploadService`.
 */
export interface ExtractedUploadServiceWiring {
  readonly useFactoryIdentifier: string | undefined;
  readonly sourceFile: string;
}

/**
 * A `StorageFileProcessingPurposeSubtaskProcessorConfig` variable declaration.
 */
export interface ExtractedProcessingConfig {
  /**
   * The identifier referenced by the `target:` property — usually a `*_PURPOSE` constant.
   */
  readonly targetIdentifier: string;
  /**
   * The `subtask:` identifiers listed in the `flow:` array.
   */
  readonly flowSubtaskIdentifiers: readonly string[];
  readonly sourceFile: string;
  readonly line: number;
}

/**
 * A `storageFileProcessingNotificationTaskHandler({ processors })` call.
 */
export interface ExtractedProcessingHandlerCall {
  /**
   * Names of identifiers/calls used as direct elements of `processors:`.
   */
  readonly directProcessorReferences: readonly string[];
  /**
   * Spread identifiers inside `processors:`.
   */
  readonly spreadProcessorReferences: readonly string[];
  readonly sourceFile: string;
}

/**
 * Aggregated cross-file extraction result.
 */
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
