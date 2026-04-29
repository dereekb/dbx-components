/**
 * Violation codes emitted by `dbx_model_validate_folder`.
 *
 * Each member is the source of truth for its rule documentation. The
 * `extract-rule-catalog` build script (mirrors `extract-firebase-models`)
 * walks the JSDoc summary + `@dbxRule*` tags off each member and
 * emits `generated/rule-catalog.generated.json`. That JSON feeds
 * `dbx_explain_rule` and the per-domain `pushViolation` helper that
 * auto-attaches a `RemediationHint` to every emitted violation.
 *
 * Keep the JSDoc summary short (one paragraph). Use `@dbxRuleApplies`
 * for the conditions under which the rule fires and `@dbxRuleNotApplies`
 * for known false-positive cases. The full tag vocabulary is documented
 * in `src/tools/rule-catalog/types.ts`.
 */
export enum ModelValidateFolderCode {
  /**
   * Folder does not exist on disk.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Validating a folder path that doesn't resolve to a directory entry.
   * @dbxRuleNotApplies Glob patterns that intentionally match zero folders — pass at least one valid path.
   * @dbxRuleFix Verify the path argument is a real folder under the workspace.
   * @dbxRuleSeeAlso tool:dbx_model_validate_folder
   */
  FOLDER_NOT_FOUND = 'FOLDER_NOT_FOUND',

  /**
   * The path resolves to a file or other non-directory entry.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Validating a path that exists but is not a directory.
   * @dbxRuleNotApplies File-level model validation — use `dbx_model_validate` for `.ts` source files.
   * @dbxRuleFix Pass the model folder (e.g. `apps/.../src/lib/model/profile/`), not the `<name>.ts` file inside it.
   */
  FOLDER_NOT_DIRECTORY = 'FOLDER_NOT_DIRECTORY',

  /**
   * Required `<name>.ts` main module is missing from the model folder.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every canonical model folder anchored on its folder basename.
   * @dbxRuleNotApplies Reserved folders (`system`, `notification`, `storagefile`) — they have a different layout and surface a separate `RESERVED_MODEL_FOLDER` warning instead.
   * @dbxRuleFix Add `<name>.ts` containing the model's `firestoreModelIdentity`, interface, document class, converter, and collection wiring.
   * @dbxRuleSeeAlso artifact:firestore-model
   */
  FOLDER_MISSING_MAIN = 'FOLDER_MISSING_MAIN',

  /**
   * Required `<name>.id.ts` id-types module is missing.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every canonical model folder.
   * @dbxRuleNotApplies Reserved folders that don't follow the 5-file convention.
   * @dbxRuleFix Add `<name>.id.ts` exporting the model's id alias types and any composite-key helpers.
   * @dbxRuleSeeAlso artifact:firestore-model
   */
  FOLDER_MISSING_ID = 'FOLDER_MISSING_ID',

  /**
   * Required `<name>.query.ts` query-helpers module is missing.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every canonical model folder.
   * @dbxRuleNotApplies Reserved folders that don't follow the 5-file convention.
   * @dbxRuleFix Add `<name>.query.ts` with the model's query-builder helpers.
   * @dbxRuleSeeAlso artifact:firestore-model
   */
  FOLDER_MISSING_QUERY = 'FOLDER_MISSING_QUERY',

  /**
   * Required `<name>.action.ts` server-actions module is missing.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every canonical model folder.
   * @dbxRuleNotApplies Reserved folders that don't follow the 5-file convention.
   * @dbxRuleFix Add `<name>.action.ts` declaring the abstract `<Model>ServerActions` class plus the action-context interface.
   * @dbxRuleSeeAlso artifact:firestore-model
   */
  FOLDER_MISSING_ACTION = 'FOLDER_MISSING_ACTION',

  /**
   * Required `<name>.api.ts` CRUD api module is missing.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every canonical model folder.
   * @dbxRuleNotApplies Reserved folders that don't follow the 5-file convention.
   * @dbxRuleFix Add `<name>.api.ts` declaring the params/result interfaces, validators, and Functions block.
   * @dbxRuleSeeAlso tool:dbx_model_validate_api
   */
  FOLDER_MISSING_API = 'FOLDER_MISSING_API',

  /**
   * Required `index.ts` barrel is missing.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every canonical model folder.
   * @dbxRuleNotApplies Reserved folders that don't follow the 5-file convention.
   * @dbxRuleFix Add `index.ts` re-exporting every sibling `<name>.*.ts` module so the folder is consumed through one barrel.
   */
  FOLDER_MISSING_INDEX = 'FOLDER_MISSING_INDEX',

  /**
   * A `.ts` file in the folder doesn't start with the folder's `<name>.` prefix.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Any `.ts` file that is not `index.ts` and is not prefixed with `<folder-name>.`.
   * @dbxRuleNotApplies Files outside the canonical layout that the project intentionally hosts here (rare — prefer moving them out).
   * @dbxRuleFix Rename the file to `<folder-name>.<sub>.ts` so it stays grouped, or move it out of the model folder.
   */
  FOLDER_STRAY_FILE = 'FOLDER_STRAY_FILE',

  /**
   * The folder name matches a reserved group (system / notification / storagefile)
   * that follows a distinct layout. Validation skips it and points at the
   * dedicated tool.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Folders named `system`, `notification`, or `storagefile`.
   * @dbxRuleNotApplies Custom downstream folders that happen to share a substring — match is exact.
   * @dbxRuleFix Re-run validation with the recommended tool from the violation's message (e.g. `dbx_system_m_validate_folder`).
   * @dbxRuleSeeAlso tool:dbx_system_m_validate_folder
   * @dbxRuleSeeAlso tool:dbx_notification_m_validate_folder
   * @dbxRuleSeeAlso tool:dbx_storagefile_m_validate_folder
   */
  RESERVED_MODEL_FOLDER = 'RESERVED_MODEL_FOLDER'
}

/**
 * String-literal union derived from {@link ModelValidateFolderCode}.
 * Use this anywhere you previously wrote the string-literal union by
 * hand — `pushViolation({ code: 'FOLDER_NOT_FOUND', ... })` continues
 * to typecheck because the template literal widens to the same set.
 */
export type ModelValidateFolderCodeString = `${ModelValidateFolderCode}`;
