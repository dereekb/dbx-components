/**
 * Violation codes emitted by `dbx_storagefile_m_validate_app`.
 *
 * Each member is the source of truth for its rule documentation.
 * `extract-rule-catalog` walks the JSDoc summary + `@dbxRule*` tags
 * off each member and emits the runtime catalog. See
 * `src/tools/rule-catalog/types.ts` for the tag vocabulary.
 */
export enum StorageFileMValidateAppCode {
  /**
   * The component's `src/lib/model/storagefile/` directory does not exist.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When `componentDir` resolves to a directory but the storagefile model folder is missing.
   * @dbxRuleNotApplies Components that intentionally don't ship storage-file purposes — pass `--skip storagefile_m` to `dbx_app_validate` instead.
   * @dbxRuleFix Add `<componentDir>/src/lib/model/storagefile/storagefile.ts` and the rest of the storagefile artefacts.
   * @dbxRuleSeeAlso artifact:storagefile-purpose
   * @dbxRuleSeeAlso tool:dbx_storagefile_m_validate_folder
   */
  STORAGEFILE_COMPONENT_DIR_NOT_FOUND = 'STORAGEFILE_COMPONENT_DIR_NOT_FOUND',

  /**
   * The API app's `src/app/common/model/storagefile/` directory does not exist.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When `apiDir` resolves to a directory but the storagefile API folder is missing.
   * @dbxRuleNotApplies API apps that intentionally don't wire storage-file purposes — pass `--skip storagefile_m` instead.
   * @dbxRuleFix Add `<apiDir>/src/app/common/model/storagefile/` with `storagefile.module.ts`, `storagefile.upload.service.ts`, and `storagefile.init.ts`.
   * @dbxRuleSeeAlso tool:dbx_storagefile_m_validate_folder
   */
  STORAGEFILE_API_DIR_NOT_FOUND = 'STORAGEFILE_API_DIR_NOT_FOUND',

  /**
   * The component root exists but has no `src/lib/model/storagefile/` subfolder.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When the component package is present but has no storagefile model folder.
   * @dbxRuleNotApplies Components that don't extend the storagefile group.
   * @dbxRuleFix Run `dbx_artifact_scaffold artifact="storagefile-purpose"` to scaffold the folder layout.
   * @dbxRuleSeeAlso artifact:storagefile-purpose
   */
  STORAGEFILE_COMPONENT_FOLDER_MISSING = 'STORAGEFILE_COMPONENT_FOLDER_MISSING',

  /**
   * The API root exists but neither `src/app/common/model/storagefile/` nor
   * `src/app/common/model/notification/` is present (the storage-file
   * processing handler may live in `notification/handlers/`).
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When the API package is present but has no storagefile or notification subfolders.
   * @dbxRuleNotApplies API apps that don't wire storage-file or notification purposes.
   * @dbxRuleFix Add `src/app/common/model/storagefile/` and (if processing handlers are needed) `src/app/common/model/notification/handlers/`.
   * @dbxRuleSeeAlso tool:dbx_storagefile_m_validate_folder
   */
  STORAGEFILE_API_FOLDER_MISSING = 'STORAGEFILE_API_FOLDER_MISSING',

  /**
   * A `*_PURPOSE: StorageFilePurpose` constant has no matching
   * `*_UPLOADED_FILE_TYPE_IDENTIFIER` constant alongside it.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every declared `StorageFilePurpose` constant.
   * @dbxRuleNotApplies Purposes whose file-type identifier is intentionally imported from a trust-listed `@dereekb/firebase` module.
   * @dbxRuleFix Declare `<PREFIX>_UPLOADED_FILE_TYPE_IDENTIFIER: UploadedFileTypeIdentifier = '...'` next to the purpose.
   * @dbxRuleSeeAlso artifact:storagefile-purpose
   */
  STORAGEFILE_PURPOSE_MISSING_FILE_TYPE_IDENTIFIER = 'STORAGEFILE_PURPOSE_MISSING_FILE_TYPE_IDENTIFIER',

  /**
   * No `storageFileInitializeFromUploadService(...)` call was found in
   * the API.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies APIs that declare at least one `UploadedFileTypeIdentifier` and therefore need to wire the upload service.
   * @dbxRuleNotApplies APIs whose upload service is provided by an upstream module (and the call lives outside the scanned subpaths — extend the scanner if so).
   * @dbxRuleFix Add a factory whose return value is built from `storageFileInitializeFromUploadService({ initializer: [...] })` and bind it as a NestJS provider.
   * @dbxRuleSeeAlso artifact:storagefile-upload-handler
   */
  STORAGEFILE_UPLOAD_SERVICE_FACTORY_MISSING = 'STORAGEFILE_UPLOAD_SERVICE_FACTORY_MISSING',

  /**
   * The upload-service factory exists but no NestJS provider binds it via
   * `provide: StorageFileInitializeFromUploadService, useFactory: ...`.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When the API has at least one upload-service factory.
   * @dbxRuleNotApplies When the binding lives in a module imported transitively from a trust-listed `@dereekb` package.
   * @dbxRuleFix Add a NestJS provider with `provide: StorageFileInitializeFromUploadService, useFactory: <factory>` to a module imported by the app.
   */
  STORAGEFILE_UPLOAD_SERVICE_NOT_WIRED = 'STORAGEFILE_UPLOAD_SERVICE_NOT_WIRED',

  /**
   * A declared `UploadedFileTypeIdentifier` constant has no
   * `StorageFileInitializeFromUploadServiceInitializer` reachable from any
   * `storageFileInitializeFromUploadService(...)` call.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every declared file-type identifier.
   * @dbxRuleNotApplies File-type identifiers that are intentionally orphaned (rare — usually a typo in a binding name; see `STORAGEFILE_UPLOAD_INITIALIZER_NAME_MISMATCH`).
   * @dbxRuleFix Add an initializer with `type: <CONSTANT>` and include it in the upload-service `initializer` array.
   * @dbxRuleSeeAlso artifact:storagefile-upload-handler
   */
  STORAGEFILE_PURPOSE_NOT_IN_UPLOAD_SERVICE = 'STORAGEFILE_PURPOSE_NOT_IN_UPLOAD_SERVICE',

  /**
   * An upload initializer references a `type:` identifier that is not a
   * declared `UploadedFileTypeIdentifier` constant in the component (or a
   * trust-listed external).
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every initializer literal seen in the API.
   * @dbxRuleNotApplies When the type identifier is imported from `@dereekb/firebase`/`@dereekb/firebase-server` — those are auto-trusted.
   * @dbxRuleFix Either declare the missing constant in the component or remove the initializer.
   */
  STORAGEFILE_UPLOAD_INITIALIZER_ORPHAN = 'STORAGEFILE_UPLOAD_INITIALIZER_ORPHAN',

  /**
   * A `type:` constant is declared and referenced by an initializer, but
   * the initializer's binding name doesn't match any element of the
   * `initializer` array — usually a rename drift.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When an initializer literal exists but the wrapping factory's local-variable name diverges from the call-site binding.
   * @dbxRuleNotApplies Initializer factories that intentionally compose multiple bindings via `...spread` (the validator handles spreads via `STORAGEFILE_UPLOAD_SERVICE_SPREAD_UNRESOLVED`).
   * @dbxRuleFix Rename the local variable to match the binding name used in the `initializer` array element / spread, or update the array.
   */
  STORAGEFILE_UPLOAD_INITIALIZER_NAME_MISMATCH = 'STORAGEFILE_UPLOAD_INITIALIZER_NAME_MISMATCH',

  /**
   * A `...spread` element inside the `initializer` array does not resolve
   * to a declared array binding or factory call.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies When the spread identifier is local but not declared anywhere reachable.
   * @dbxRuleNotApplies Spread identifiers from trust-listed `@dereekb/*` modules.
   * @dbxRuleFix Declare the spread as `const <name>: StorageFileInitializeFromUploadServiceInitializer[] = [...]` or import it from a trusted module.
   */
  STORAGEFILE_UPLOAD_SERVICE_SPREAD_UNRESOLVED = 'STORAGEFILE_UPLOAD_SERVICE_SPREAD_UNRESOLVED',

  /**
   * Multiple `storageFileInitializeFromUploadService(...)` calls were
   * found.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies When more than one upload-service factory exists in the API.
   * @dbxRuleNotApplies Apps that intentionally compose multiple factories (rare — only the first one runs).
   * @dbxRuleFix Consolidate the factories into one — only the first call's config takes effect at runtime.
   */
  STORAGEFILE_UPLOAD_SERVICE_MULTIPLE_FACTORIES = 'STORAGEFILE_UPLOAD_SERVICE_MULTIPLE_FACTORIES',

  /**
   * The component declares purposes with subtasks but no
   * `storageFileProcessingNotificationTaskHandler({ processors })` call
   * is present in the API.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When at least one purpose declares a `*ProcessingSubtask` union and `*_PROCESSING_SUBTASK` constants.
   * @dbxRuleNotApplies Purposes that store a file but do not need processing.
   * @dbxRuleFix Add a `storageFileProcessingNotificationTaskHandler({ processors: [...] })` call and wire it into the notification-task service.
   * @dbxRuleSeeAlso artifact:storagefile-processor
   */
  STORAGEFILE_PROCESSING_HANDLER_MISSING = 'STORAGEFILE_PROCESSING_HANDLER_MISSING',

  /**
   * A purpose with subtasks has no
   * `StorageFileProcessingPurposeSubtaskProcessorConfig` whose `target:`
   * references it.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every purpose that declares a `*ProcessingSubtask` union.
   * @dbxRuleNotApplies Purposes whose processing config is provided by an upstream module.
   * @dbxRuleFix Add a config with `target: <PURPOSE_CONST>, flow: [{ subtask: <SUBTASK_CONST>, ... }, ...]`.
   * @dbxRuleSeeAlso artifact:storagefile-processor
   */
  STORAGEFILE_PROCESSING_CONFIG_MISSING = 'STORAGEFILE_PROCESSING_CONFIG_MISSING',

  /**
   * A processing config references a `target:` identifier that is not
   * any declared `StorageFilePurpose` constant.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When the `target:` identifier is local but not declared.
   * @dbxRuleNotApplies When the target is imported from a trust-listed module.
   * @dbxRuleFix Either declare the purpose or remove the orphaned config.
   */
  STORAGEFILE_PROCESSING_CONFIG_ORPHAN = 'STORAGEFILE_PROCESSING_CONFIG_ORPHAN',

  /**
   * A `*_PROCESSING_SUBTASK` declared on a purpose's union is absent
   * from the matching processor config's `flow:` array.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every purpose × subtask pairing.
   * @dbxRuleNotApplies Subtasks whose processor lives in a separate, dedicated config (uncommon — usually a missed flow step).
   * @dbxRuleFix Add `{ subtask: <SUBTASK_CONST>, processor: ... }` to the config's `flow:` array.
   * @dbxRuleSeeAlso artifact:storagefile-processor-subtask
   */
  STORAGEFILE_PROCESSING_SUBTASK_NOT_HANDLED = 'STORAGEFILE_PROCESSING_SUBTASK_NOT_HANDLED',

  /**
   * Two `StorageFilePurpose` constants share the same string literal value.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies When more than one purpose constant resolves to the same `'<value>'` literal.
   * @dbxRuleNotApplies Purposes intentionally aliased — but this defeats persisted-document discrimination, so almost always a copy-paste.
   * @dbxRuleFix Rename one of the literals so each purpose code is unique.
   */
  STORAGEFILE_PURPOSE_DUPLICATE = 'STORAGEFILE_PURPOSE_DUPLICATE',

  /**
   * Two `UploadedFileTypeIdentifier` constants share the same string
   * literal value.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies When more than one file-type identifier constant resolves to the same `'<value>'`.
   * @dbxRuleNotApplies File-type identifiers intentionally re-used across purposes (rare — almost always a bug).
   * @dbxRuleFix Rename one of the literals so each file-type code is unique.
   */
  STORAGEFILE_FILE_TYPE_IDENTIFIER_DUPLICATE = 'STORAGEFILE_FILE_TYPE_IDENTIFIER_DUPLICATE',

  /**
   * A `*_PURPOSE` constant has no `<purpose>FileGroupIds(...)` or
   * `<purpose>StorageFileGroupIds(...)` helper function in the same
   * component.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Validating a downstream `-firebase` component that declares at least one `StorageFilePurpose` constant.
   * @dbxRuleNotApplies Purposes that intentionally hold no group membership (rare — most purposes belong to a workspace's group convention).
   * @dbxRuleFix Declare `export function <purpose>FileGroupIds(input): StorageFileGroupIds` adjacent to the purpose constant.
   * @dbxRuleTemplate ```ts
   * export function <purpose>FileGroupIds(input: { /* ids the group needs *\/ }): StorageFileGroupIds {
   *   return [storageFileGroupId({ /* ... *\/ })];
   * }
   * ```
   * @dbxRuleSeeAlso artifact:storagefile-purpose
   */
  STORAGEFILE_GROUP_IDS_FUNCTION_MISSING = 'STORAGEFILE_GROUP_IDS_FUNCTION_MISSING'
}

/**
 * String-literal union derived from {@link StorageFileMValidateAppCode}.
 */
export type StorageFileMValidateAppCodeString = `${StorageFileMValidateAppCode}`;
