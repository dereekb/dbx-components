/**
 * Violation codes emitted by `dbx_notification_m_validate_folder`.
 *
 * Each member is the source of truth for its rule documentation.
 * `extract-rule-catalog` walks the JSDoc summary + `@dbxRule*` tags
 * off each member and emits the runtime catalog. See
 * `src/tools/rule-catalog/types.ts` for the tag vocabulary.
 *
 * The folder validator only inspects layout (folder presence,
 * required API files, file-name conventions, barrel re-exports);
 * cross-file wiring (whether each declared template / task is
 * reachable from the metadata record + service factory paths) is
 * handled by `dbx_notification_m_validate_app`.
 */
export enum NotificationMValidateFolderCode {
  /**
   * The component package directory does not exist on disk.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When the supplied `componentDir` does not resolve to a directory entry.
   * @dbxRuleNotApplies Components intentionally not part of this validation pass — pass `--skip notification_m` to `dbx_app_validate` instead.
   * @dbxRuleFix Verify the path argument resolves to an existing component package root.
   * @dbxRuleSeeAlso tool:dbx_notification_m_validate_folder
   */
  NOTIF_FOLDER_COMPONENT_DIR_NOT_FOUND = 'NOTIF_FOLDER_COMPONENT_DIR_NOT_FOUND',

  /**
   * The API app directory does not exist on disk.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When the supplied `apiDir` does not resolve to a directory entry.
   * @dbxRuleNotApplies API apps intentionally not validated — pass `--skip notification_m` instead.
   * @dbxRuleFix Verify the path argument resolves to an existing API app root.
   * @dbxRuleSeeAlso tool:dbx_notification_m_validate_folder
   */
  NOTIF_FOLDER_API_DIR_NOT_FOUND = 'NOTIF_FOLDER_API_DIR_NOT_FOUND',

  /**
   * The component root exists but `src/lib/model/notification/` is missing.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Components that should ship `NotificationTemplateType` / `NotificationTaskType` constants but lack the notification model folder.
   * @dbxRuleNotApplies Components that intentionally don't extend the notification group (rare — most apps with notifications do).
   * @dbxRuleFix Add `src/lib/model/notification/notification.ts` and the rest of the notification artefacts.
   * @dbxRuleSeeAlso artifact:notification-template
   * @dbxRuleSeeAlso artifact:notification-task
   */
  NOTIF_FOLDER_COMPONENT_FOLDER_MISSING = 'NOTIF_FOLDER_COMPONENT_FOLDER_MISSING',

  /**
   * The API root exists but `src/app/common/model/notification/` is missing.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies API apps expected to wire the notification module but with no notification folder.
   * @dbxRuleNotApplies API apps that intentionally don't wire notifications — pass `--skip notification_m`.
   * @dbxRuleFix Add `src/app/common/model/notification/` with `notification.module.ts`, `notification.task.service.ts`, and `notification.send.service.ts`.
   * @dbxRuleSeeAlso artifact:notification-template
   */
  NOTIF_FOLDER_API_FOLDER_MISSING = 'NOTIF_FOLDER_API_FOLDER_MISSING',

  /**
   * The API notification folder is missing the required `notification.module.ts` file.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every API notification folder that exists.
   * @dbxRuleNotApplies The NestJS notification module is provided elsewhere in the app (rare — convention is one module per folder).
   * @dbxRuleFix Add `notification.module.ts` declaring the NestJS module that binds the notification task / send service providers.
   */
  NOTIF_FOLDER_MODULE_FILE_MISSING = 'NOTIF_FOLDER_MODULE_FILE_MISSING',

  /**
   * The API notification folder is missing the required `notification.task.service.ts` file.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every API notification folder that exists.
   * @dbxRuleNotApplies Apps whose `NotificationTaskService` factory lives elsewhere (rare — convention is one factory per folder).
   * @dbxRuleFix Add `notification.task.service.ts` exporting the `notificationTaskService({ ... })` factory call.
   * @dbxRuleSeeAlso artifact:notification-task
   */
  NOTIF_FOLDER_TASK_SERVICE_FILE_MISSING = 'NOTIF_FOLDER_TASK_SERVICE_FILE_MISSING',

  /**
   * The API notification folder is missing the required `notification.send.service.ts` file.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every API notification folder that exists.
   * @dbxRuleNotApplies Apps whose `NotificationSendService` factory lives elsewhere (rare — convention is one factory per folder).
   * @dbxRuleFix Add `notification.send.service.ts` exporting the `NotificationSendService` factory wired through the notification module.
   */
  NOTIF_FOLDER_SEND_SERVICE_FILE_MISSING = 'NOTIF_FOLDER_SEND_SERVICE_FILE_MISSING',

  /**
   * `index.ts` re-exports a path that does not resolve to a sibling file or subfolder.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When `export * from './X'` in `index.ts` has no matching `./X.ts` or `./X/` under the notification folder root.
   * @dbxRuleNotApplies Re-exports that intentionally point outside the folder (use a relative path that climbs out, not `./X`).
   * @dbxRuleFix Add the missing `<name>.ts` / `<name>/` sibling, or remove the dangling re-export from `index.ts`.
   */
  NOTIF_FOLDER_BARREL_REEXPORT_MISSING = 'NOTIF_FOLDER_BARREL_REEXPORT_MISSING',

  /**
   * A `.ts` file in the notification folder doesn't start with the `notification.` prefix.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Any `.ts` file other than `index.ts` whose basename doesn't start with `notification.`.
   * @dbxRuleNotApplies Files outside the canonical layout that the project intentionally hosts here (rare — prefer moving them out).
   * @dbxRuleFix Rename the file to `notification.<sub>.ts`, or move it out of the notification folder.
   */
  NOTIF_FOLDER_UNEXPECTED_FILE_NAME = 'NOTIF_FOLDER_UNEXPECTED_FILE_NAME',

  /**
   * A non-canonical `.ts` file lives at the API notification root alongside a `handlers/` subfolder.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies API folders that mix root-level handler files with a sibling `handlers/` subfolder.
   * @dbxRuleNotApplies Strictly canonical files (`notification.module.ts`, `notification.task.service.ts`, `notification.send.service.ts`, plus the convention extras tracked in `CANONICAL_API_ROOT_FILES`) — those are allowed at the root.
   * @dbxRuleFix Move the handler file into `handlers/` so the convention stays consistent across the project.
   */
  NOTIF_FOLDER_HANDLERS_SUBFOLDER_MIXED = 'NOTIF_FOLDER_HANDLERS_SUBFOLDER_MIXED'
}

/**
 * String-literal union derived from {@link NotificationMValidateFolderCode}.
 */
export type NotificationMValidateFolderCodeString = `${NotificationMValidateFolderCode}`;
