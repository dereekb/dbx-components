/**
 * Violation codes emitted by `dbx_notification_m_validate_app`.
 *
 * Each member is the source of truth for its rule documentation.
 * `extract-rule-catalog` walks the JSDoc summary + `@dbxRule*` tags
 * off each member and emits the runtime catalog. See
 * `src/tools/rule-catalog/types.ts` for the tag vocabulary.
 *
 * The validator cross-references every declared `NotificationTemplateType`
 * and `NotificationTaskType` constant with two registration paths it
 * must travel through:
 *
 *   1. **Metadata path (templates only)** — a `NotificationTemplateTypeInfo`
 *      reachable from the API's
 *      `appNotificationTemplateTypeInfoRecordService(...)` call.
 *   2. **Handler path** — for templates, a
 *      `NotificationTemplateServiceTypeConfig` reachable from
 *      `<app>NotificationTemplateServiceConfigsArrayFactory`; for tasks,
 *      a `NotificationTaskServiceTaskHandlerConfig` reachable from
 *      `notificationTaskService({ handlers })`.
 */
export enum NotificationMValidateAppCode {
  /**
   * The component package directory does not exist on disk.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When the supplied `componentDir` does not resolve to a directory entry.
   * @dbxRuleNotApplies Components intentionally not part of this validation pass — pass `--skip notification_m` to `dbx_app_validate` instead.
   * @dbxRuleFix Verify the path argument resolves to an existing component package root.
   * @dbxRuleSeeAlso tool:dbx_notification_m_validate_folder
   */
  NOTIF_COMPONENT_DIR_NOT_FOUND = 'NOTIF_COMPONENT_DIR_NOT_FOUND',

  /**
   * The API app directory does not exist on disk.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When the supplied `apiDir` does not resolve to a directory entry.
   * @dbxRuleNotApplies API apps intentionally not validated — pass `--skip notification_m` instead.
   * @dbxRuleFix Verify the path argument resolves to an existing API app root.
   * @dbxRuleSeeAlso tool:dbx_notification_m_validate_folder
   */
  NOTIF_API_DIR_NOT_FOUND = 'NOTIF_API_DIR_NOT_FOUND',

  /**
   * The component root exists but `src/lib/model/notification/` is missing.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Components that should ship template / task constants but lack the notification model folder.
   * @dbxRuleNotApplies Components that intentionally don't extend the notification group.
   * @dbxRuleFix Add `src/lib/model/notification/notification.ts` and the rest of the notification artefacts.
   * @dbxRuleSeeAlso artifact:notification-template
   * @dbxRuleSeeAlso artifact:notification-task
   */
  NOTIF_COMPONENT_NOTIFICATION_FOLDER_MISSING = 'NOTIF_COMPONENT_NOTIFICATION_FOLDER_MISSING',

  /**
   * The API root exists but `src/app/common/model/notification/` is missing.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies API apps expected to wire the notification module but with no notification folder.
   * @dbxRuleNotApplies API apps that intentionally don't wire notifications — pass `--skip notification_m`.
   * @dbxRuleFix Add `src/app/common/model/notification/` with `notification.module.ts`, `notification.task.service.ts`, and `notification.send.service.ts`.
   * @dbxRuleSeeAlso artifact:notification-template
   */
  NOTIF_API_NOTIFICATION_FOLDER_MISSING = 'NOTIF_API_NOTIFICATION_FOLDER_MISSING',

  /**
   * A `*_NOTIFICATION_TEMPLATE_TYPE` constant has no matching `NotificationTemplateTypeInfo` object.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every declared template-type constant in the component.
   * @dbxRuleNotApplies Template types declared in an upstream `@dereekb/*` module — those are detected via the trust list and skipped.
   * @dbxRuleFix Declare `export const <foo>NotificationTemplateTypeInfo: NotificationTemplateTypeInfo = { type: <CONSTANT>, name, description, ... }` adjacent to the constant.
   * @dbxRuleSeeAlso artifact:notification-template
   */
  NOTIF_TEMPLATE_INFO_MISSING = 'NOTIF_TEMPLATE_INFO_MISSING',

  /**
   * A `NotificationTemplateTypeInfo` object's `type:` does not match a declared template-type constant.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When the info's `type:` references a missing constant or an identifier outside the trust list.
   * @dbxRuleNotApplies Info objects whose `type:` is provided by an imported `@dereekb/*` constant — covered by the trust list.
   * @dbxRuleFix Either declare the missing template-type constant or update the info's `type:` to a real constant in the component.
   */
  NOTIF_TEMPLATE_INFO_TYPE_MISMATCH = 'NOTIF_TEMPLATE_INFO_TYPE_MISMATCH',

  /**
   * A declared `NotificationTemplateTypeInfo` is not reachable from the metadata aggregator record.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every info object whose symbol does not appear in the resolved set traced from `notificationTemplateTypeInfoRecord([...])`.
   * @dbxRuleNotApplies Infos intentionally excluded from the runtime record (rare — usually a missed registration step).
   * @dbxRuleFix Add the info symbol (or its containing `ALL_*_NOTIFICATION_TEMPLATE_TYPE_INFOS` aggregate) to the record array.
   */
  NOTIF_TEMPLATE_INFO_NOT_IN_RECORD = 'NOTIF_TEMPLATE_INFO_NOT_IN_RECORD',

  /**
   * No top-level `notificationTemplateTypeInfoRecord([...])` call was found.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Components that declare at least one `NotificationTemplateTypeInfo`.
   * @dbxRuleNotApplies Components whose record is provided by an upstream `@dereekb/*` module (rare — convention is one record per app).
   * @dbxRuleFix Declare `export const <APP>_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD = notificationTemplateTypeInfoRecord([...]);` covering every template info.
   */
  NOTIF_TEMPLATE_RECORD_MISSING = 'NOTIF_TEMPLATE_RECORD_MISSING',

  /**
   * The metadata record exists but is not wired through `appNotificationTemplateTypeInfoRecordService(...)` in the API.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When `appNotificationTemplateTypeInfoRecordService(...)` is missing or its argument doesn't resolve to the declared record.
   * @dbxRuleNotApplies APIs that wire the record indirectly through an imported app-module (rare — extend the scanner's subpaths if so).
   * @dbxRuleFix Add `appNotificationTemplateTypeInfoRecordService(<APP>_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD)` to the API's notification module.
   */
  NOTIF_TEMPLATE_RECORD_NOT_WIRED = 'NOTIF_TEMPLATE_RECORD_NOT_WIRED',

  /**
   * The metadata record's `[...]` array spreads an identifier that doesn't resolve to a declared aggregate.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When `notificationTemplateTypeInfoRecord([...])` spreads a name that isn't a `ALL_*_NOTIFICATION_TEMPLATE_TYPE_INFOS` aggregate or trusted external.
   * @dbxRuleNotApplies Spreads from trust-listed `@dereekb/*` modules.
   * @dbxRuleFix Declare the aggregate as `export const ALL_<NAME>_NOTIFICATION_TEMPLATE_TYPE_INFOS: NotificationTemplateTypeInfo[] = [...]` or import it from a trusted module.
   */
  NOTIF_TEMPLATE_SPREAD_UNRESOLVED = 'NOTIF_TEMPLATE_SPREAD_UNRESOLVED',

  /**
   * A `*_NOTIFICATION_TEMPLATE_TYPE` constant has no matching `NotificationTemplateServiceTypeConfig` reachable from the configs-array factory.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every declared template-type constant.
   * @dbxRuleNotApplies Template types whose handler config is provided by an upstream module (covered by the trust list).
   * @dbxRuleFix Declare a `<foo>NotificationTemplateFactory` returning the `NotificationTemplateServiceTypeConfig` and call it from the app's configs-array factory.
   * @dbxRuleSeeAlso artifact:notification-template
   */
  NOTIF_TEMPLATE_FACTORY_MISSING = 'NOTIF_TEMPLATE_FACTORY_MISSING',

  /**
   * The configs-array factory exists but no NestJS provider binds it via `NOTIFICATION_TEMPLATE_SERVICE_CONFIGS_ARRAY_TOKEN`.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When `<app>NotificationTemplateServiceConfigsArrayFactory` exists but no `{ provide: NOTIFICATION_TEMPLATE_SERVICE_CONFIGS_ARRAY_TOKEN, useFactory }` provider exists.
   * @dbxRuleNotApplies APIs that wire the factory indirectly through an imported app-module (rare — extend the scanner's subpaths if so).
   * @dbxRuleFix Add a NestJS provider with `provide: NOTIFICATION_TEMPLATE_SERVICE_CONFIGS_ARRAY_TOKEN, useFactory: <app>NotificationTemplateServiceConfigsArrayFactory`.
   */
  NOTIF_TEMPLATE_FACTORY_NOT_WIRED = 'NOTIF_TEMPLATE_FACTORY_NOT_WIRED',

  /**
   * A `NotificationTemplateServiceTypeConfig` references a `type:` identifier that is not a declared template-type constant.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When the handler config's `type:` is an identifier outside the component's declared constants and the trust list.
   * @dbxRuleNotApplies Handler configs whose `type:` is imported from a trust-listed module.
   * @dbxRuleFix Either declare the matching template-type constant or remove the orphaned config.
   */
  NOTIF_TEMPLATE_FACTORY_ORPHAN = 'NOTIF_TEMPLATE_FACTORY_ORPHAN',

  /**
   * No top-level `<app>NotificationTemplateServiceConfigsArrayFactory` was found.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies APIs that declare at least one `NotificationTemplateTypeInfo`.
   * @dbxRuleNotApplies APIs whose configs-array factory is provided by an upstream module (rare — convention is one factory per app).
   * @dbxRuleFix Declare `export function <app>NotificationTemplateServiceConfigsArrayFactory(context): NotificationTemplateServiceTypeConfig[] { return [<foo>NotificationTemplateFactory(context), ...]; }`.
   */
  NOTIF_TEMPLATE_FACTORY_ARRAY_MISSING = 'NOTIF_TEMPLATE_FACTORY_ARRAY_MISSING',

  /**
   * The configs-array factory spreads an identifier that doesn't resolve to a declared function.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies When `<app>NotificationTemplateServiceConfigsArrayFactory` spreads (`...fooNotifications(context)`) a function that isn't declared locally or imported.
   * @dbxRuleNotApplies Spreads from trust-listed `@dereekb/*` modules.
   * @dbxRuleFix Declare the missing function or import it from a trusted module.
   */
  NOTIF_TEMPLATE_FACTORY_SPREAD_UNRESOLVED = 'NOTIF_TEMPLATE_FACTORY_SPREAD_UNRESOLVED',

  /**
   * A declared `*_NOTIFICATION_TASK_TYPE` is not present in any `ALL_*_NOTIFICATION_TASK_TYPES` aggregate array.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every declared task-type constant.
   * @dbxRuleNotApplies Task-type constants intentionally held outside any aggregate (rare — most apps centralise the list).
   * @dbxRuleFix Add the constant to `ALL_<NAME>_NOTIFICATION_TASK_TYPES: NotificationTaskType[]` so the aggregate stays comprehensive.
   */
  NOTIF_TASK_NOT_IN_ALL_ARRAY = 'NOTIF_TASK_NOT_IN_ALL_ARRAY',

  /**
   * A declared `*_NOTIFICATION_TASK_TYPE` is not reachable from any `notificationTaskService({ handlers })` call.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies Every declared task-type constant.
   * @dbxRuleNotApplies Task-type constants whose handler is provided by an upstream module (covered by the trust list).
   * @dbxRuleFix Add a `NotificationTaskServiceTaskHandlerConfig<...>` for the task and include its binding in `notificationTaskService({ handlers: [...] })`.
   * @dbxRuleSeeAlso artifact:notification-task
   * @dbxRuleSeeAlso doc:dbx__guide__notification-task
   */
  NOTIF_TASK_NOT_REGISTERED_IN_SERVICE = 'NOTIF_TASK_NOT_REGISTERED_IN_SERVICE',

  /**
   * A `NotificationTaskServiceTaskHandlerConfig` references a `type:` identifier that is not a declared task-type constant.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When the handler's `type:` is an identifier outside the component's declared constants and the trust list.
   * @dbxRuleNotApplies Handler configs whose `type:` is imported from a trust-listed module.
   * @dbxRuleFix Either declare the matching task-type constant or remove the orphaned handler config.
   */
  NOTIF_TASK_HANDLER_ORPHAN = 'NOTIF_TASK_HANDLER_ORPHAN',

  /**
   * A `NotificationTaskServiceTaskHandlerConfig`'s binding name doesn't match its handler-array reference.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies When the handler is bound to a typed const but the local-variable name diverges from the array element name in `notificationTaskService({ handlers })`.
   * @dbxRuleNotApplies Inline / anonymous handler literals (no binding name to check against).
   * @dbxRuleFix Rename the binding to match the handler-array element, or update the array reference to match the binding.
   */
  NOTIF_TASK_HANDLER_NAME_MISMATCH = 'NOTIF_TASK_HANDLER_NAME_MISMATCH',

  /**
   * No `notificationTaskService({ ... })` call was found in the API.
   *
   * @dbxRuleSeverity error
   * @dbxRuleApplies APIs that declare at least one `*_NOTIFICATION_TASK_TYPE`.
   * @dbxRuleNotApplies APIs whose task service is provided by an upstream module (rare — extend the scanner's subpaths if so).
   * @dbxRuleFix Add `notificationTaskService({ validate: [...], handlers: [...] })` and bind it through the notification module.
   */
  NOTIF_TASK_SERVICE_FACTORY_MISSING = 'NOTIF_TASK_SERVICE_FACTORY_MISSING',

  /**
   * The `handlers:` array spreads an identifier that doesn't resolve to a declared array binding.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies When `notificationTaskService({ handlers: [...spread] })` spreads an identifier that isn't a typed `NotificationTaskServiceTaskHandlerConfig[]` binding or trusted external.
   * @dbxRuleNotApplies Spreads from trust-listed `@dereekb/*` modules (e.g. `storageFileProcessingNotificationTaskHandler`).
   * @dbxRuleFix Declare the spread as `const <name>: NotificationTaskServiceTaskHandlerConfig<...>[] = [...]` or import it from a trusted module.
   */
  NOTIF_TASK_HANDLER_SPREAD_UNRESOLVED = 'NOTIF_TASK_HANDLER_SPREAD_UNRESOLVED',

  /**
   * A declared `NotificationTemplateTypeInfo` is unused — its symbol isn't reachable from the metadata aggregator.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies When the info's symbol does not appear in any aggregate array or the resolved record set.
   * @dbxRuleNotApplies Infos kept around for documentation / future wiring (rare — usually rename drift).
   * @dbxRuleFix Either remove the orphan info or add it to the appropriate `ALL_*_NOTIFICATION_TEMPLATE_TYPE_INFOS` aggregate.
   */
  NOTIF_TEMPLATE_INFO_UNUSED = 'NOTIF_TEMPLATE_INFO_UNUSED',

  /**
   * Two `*_NOTIFICATION_TEMPLATE_TYPE` constants share the same string literal value.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies When more than one template-type constant resolves to the same `'<value>'` literal.
   * @dbxRuleNotApplies Constants intentionally aliased — but this defeats persisted-document discrimination, so almost always a copy-paste.
   * @dbxRuleFix Rename one of the literals so each template code is unique.
   */
  NOTIF_TEMPLATE_TYPE_CODE_DUPLICATE = 'NOTIF_TEMPLATE_TYPE_CODE_DUPLICATE',

  /**
   * Two `*_NOTIFICATION_TASK_TYPE` constants share the same string literal value.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies When more than one task-type constant resolves to the same `'<value>'` literal.
   * @dbxRuleNotApplies Constants intentionally aliased — but this defeats runtime task discrimination, so almost always a copy-paste.
   * @dbxRuleFix Rename one of the literals so each task code is unique.
   */
  NOTIF_TASK_TYPE_CODE_DUPLICATE = 'NOTIF_TASK_TYPE_CODE_DUPLICATE',

  /**
   * A task type appears in `validate:` but has no matching `handlers:` registration.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies When `notificationTaskService({ validate, handlers })` lists a task type in `validate:` that the `handlers:` traversal doesn't reach.
   * @dbxRuleNotApplies Tasks whose handler is provided by an upstream module (covered by the trust list).
   * @dbxRuleFix Add the matching `NotificationTaskServiceTaskHandlerConfig` for the task and include it in `handlers:`.
   */
  NOTIF_TASK_IN_VALIDATE_WITHOUT_HANDLER = 'NOTIF_TASK_IN_VALIDATE_WITHOUT_HANDLER',

  /**
   * A `NotificationTemplateTypeInfo` object is missing the `name` and/or `description` field.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies Every declared `NotificationTemplateTypeInfo` whose `name` or `description` is empty / missing.
   * @dbxRuleNotApplies Infos whose human-readable fields are intentionally blank (rare — most consumers surface them in admin UI).
   * @dbxRuleFix Populate `name: '...'` and `description: '...'` on the info object so admin / tooling surfaces have something to render.
   */
  NOTIF_TEMPLATE_INFO_MISSING_NAME_OR_DESCRIPTION = 'NOTIF_TEMPLATE_INFO_MISSING_NAME_OR_DESCRIPTION',

  /**
   * Multiple `notificationTaskService({ ... })` calls were found.
   *
   * @dbxRuleSeverity warning
   * @dbxRuleApplies When more than one task-service factory exists in the API.
   * @dbxRuleNotApplies Apps that intentionally compose multiple task services (rare — only the first call's config takes effect at runtime).
   * @dbxRuleFix Consolidate the calls into one — the second call's handlers are unused at runtime.
   */
  NOTIF_TASK_MULTIPLE_SERVICES = 'NOTIF_TASK_MULTIPLE_SERVICES'
}

/**
 * String-literal union derived from {@link NotificationMValidateAppCode}.
 */
export type NotificationMValidateAppCodeString = `${NotificationMValidateAppCode}`;
