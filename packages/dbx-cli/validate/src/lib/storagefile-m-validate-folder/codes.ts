/**
 * Violation codes emitted by `dbx_storagefile_m_validate_folder`.
 *
 * Each member is the source of truth for its rule documentation.
 * `extract-rule-catalog` walks the JSDoc summary + `@dbxRule*` tags
 * off each member and emits the runtime catalog. See
 * `src/tools/rule-catalog/types.ts` for the tag vocabulary.
 *
 * The folder validator only inspects layout (folder presence,
 * required API files, file-name conventions, barrel re-exports);
 * cross-file wiring (purposes reachable from the upload service /
 * processing handler) is handled by `dbx_storagefile_m_validate_app`.
 */
export enum StorageFileMValidateFolderCode {
  /**
   * The component package directory does not exist on disk.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When the supplied `componentDir` does not resolve to a directory entry.
   * @dbxRuleNotApplies Components intentionally not part of this validation pass — pass `--skip storagefile_m` to `dbx_app_validate` instead.
   * @dbxRuleFix Verify the path argument resolves to an existing component package root.
   * @dbxRuleSeeAlso tool:dbx_storagefile_m_validate_folder
   */
  STORAGEFILE_FOLDER_COMPONENT_DIR_NOT_FOUND = 'STORAGEFILE_FOLDER_COMPONENT_DIR_NOT_FOUND',

  /**
   * The API app directory does not exist on disk.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When the supplied `apiDir` does not resolve to a directory entry.
   * @dbxRuleNotApplies API apps intentionally not validated — pass `--skip storagefile_m` instead.
   * @dbxRuleFix Verify the path argument resolves to an existing API app root.
   * @dbxRuleSeeAlso tool:dbx_storagefile_m_validate_folder
   */
  STORAGEFILE_FOLDER_API_DIR_NOT_FOUND = 'STORAGEFILE_FOLDER_API_DIR_NOT_FOUND',

  /**
   * The component root exists but `src/lib/model/storagefile/` is missing.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Components that should ship `StorageFilePurpose` constants but lack the storagefile model folder.
   * @dbxRuleNotApplies Components that intentionally don't extend the storagefile group (rare — most apps with file uploads do).
   * @dbxRuleFix Run `dbx_artifact_scaffold artifact="storagefile-purpose"` to scaffold the folder, or add `src/lib/model/storagefile/storagefile.ts` by hand.
   * @dbxRuleSeeAlso artifact:storagefile-purpose
   */
  STORAGEFILE_FOLDER_COMPONENT_FOLDER_MISSING = 'STORAGEFILE_FOLDER_COMPONENT_FOLDER_MISSING',

  /**
   * The API root exists but `src/app/common/model/storagefile/` is missing.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies API apps expected to wire the storagefile module but with no storagefile folder.
   * @dbxRuleNotApplies API apps that intentionally don't wire storage uploads — pass `--skip storagefile_m`.
   * @dbxRuleFix Add `src/app/common/model/storagefile/` with `storagefile.module.ts`, `storagefile.upload.service.ts`, and `storagefile.init.ts`.
   * @dbxRuleSeeAlso artifact:storagefile-purpose
   */
  STORAGEFILE_FOLDER_API_FOLDER_MISSING = 'STORAGEFILE_FOLDER_API_FOLDER_MISSING',

  /**
   * The API storagefile folder is missing the required `storagefile.upload.service.ts` file.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every API storagefile folder that exists.
   * @dbxRuleNotApplies API apps whose upload service is provided by an upstream module imported transitively (rare — usually a missed scaffold step).
   * @dbxRuleFix Add `storagefile.upload.service.ts` exporting the `storageFileInitializeFromUploadService(...)` factory function.
   * @dbxRuleSeeAlso artifact:storagefile-purpose
   */
  STORAGEFILE_FOLDER_UPLOAD_SERVICE_FILE_MISSING = 'STORAGEFILE_FOLDER_UPLOAD_SERVICE_FILE_MISSING',

  /**
   * The API storagefile folder is missing the required `storagefile.module.ts` file.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every API storagefile folder that exists.
   * @dbxRuleNotApplies The NestJS storage-file module is provided elsewhere in the app (rare — convention is one module per folder).
   * @dbxRuleFix Add `storagefile.module.ts` declaring the NestJS module that binds the upload service provider.
   */
  STORAGEFILE_FOLDER_MODULE_FILE_MISSING = 'STORAGEFILE_FOLDER_MODULE_FILE_MISSING',

  /**
   * The API storagefile folder is missing the required `storagefile.init.ts` file.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every API storagefile folder that exists.
   * @dbxRuleNotApplies Apps that don't expose storagefile server-actions on the action context (rare — most do).
   * @dbxRuleFix Add `storagefile.init.ts` with the storage-file init server-actions config wired through the action context.
   */
  STORAGEFILE_FOLDER_INIT_FILE_MISSING = 'STORAGEFILE_FOLDER_INIT_FILE_MISSING',

  /**
   * `index.ts` re-exports a path that does not resolve to a sibling file or subfolder.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When `export * from './X'` in `index.ts` has no matching `./X.ts` or `./X/` under the storagefile folder root.
   * @dbxRuleNotApplies Re-exports that intentionally point outside the folder (use a relative path that climbs out, not `./X`).
   * @dbxRuleFix Add the missing `<name>.ts` / `<name>/` sibling, or remove the dangling re-export from `index.ts`.
   */
  STORAGEFILE_FOLDER_BARREL_REEXPORT_MISSING = 'STORAGEFILE_FOLDER_BARREL_REEXPORT_MISSING',

  /**
   * A `.ts` file in the storagefile folder doesn't start with the `storagefile.` prefix.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Any `.ts` file other than `index.ts` whose basename doesn't start with `storagefile.`.
   * @dbxRuleNotApplies Files outside the canonical layout that the project intentionally hosts here (rare — prefer moving them out).
   * @dbxRuleFix Rename the file to `storagefile.<sub>.ts`, or move it out of the storagefile folder.
   */
  STORAGEFILE_FOLDER_UNEXPECTED_FILE_NAME = 'STORAGEFILE_FOLDER_UNEXPECTED_FILE_NAME',

  /**
   * A non-canonical `.ts` file lives at the API storagefile root alongside a `handlers/` subfolder.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies API folders that mix root-level handler files with a sibling `handlers/` subfolder.
   * @dbxRuleNotApplies Strictly canonical files (`storagefile.module.ts`, `storagefile.upload.service.ts`, `storagefile.init.ts`) — those are allowed at the root.
   * @dbxRuleFix Move the handler file into `handlers/` so the convention stays consistent across the project.
   */
  STORAGEFILE_FOLDER_HANDLERS_SUBFOLDER_MIXED = 'STORAGEFILE_FOLDER_HANDLERS_SUBFOLDER_MIXED'
}

/**
 * String-literal union derived from {@link StorageFileMValidateFolderCode}.
 */
export type StorageFileMValidateFolderCodeString = `${StorageFileMValidateFolderCode}`;
