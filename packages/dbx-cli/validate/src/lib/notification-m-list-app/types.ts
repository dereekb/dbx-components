/**
 * Report shapes for `dbx_notification_m_list_app`. Built from the same
 * {@link ExtractedAppNotifications} the validator produces — this tool
 * reshapes the cross-file extraction into a human-friendly summary: the
 * templates, the tasks, and the NotificationTaskBot wiring (`taskBot`).
 */

import type {
  ExtractedSourceLocation,
  ExtractedTaskBotProcessor,
  ExtractedTaskBotRegistryWiring,
  ExtractedTaskBotScriptConfigDataTypeSource,
  ExtractedTaskBotScriptTypeRef,
  ExtractedTaskBotSide,
  ExtractedTaskServiceValidateStatus,
  ForcedDeliveryMethodsSource,
  NotificationDeliveryMethodName,
  UserConfigurableDeliveryMethodsSource
} from '../notification-m-validate-app/index.js';

export interface TemplateSummary {
  readonly typeCode: string | undefined;
  readonly symbolName: string;
  readonly infoSymbolName: string | undefined;
  readonly humanName: string | undefined;
  readonly description: string | undefined;
  readonly notificationModelIdentity: string | undefined;
  readonly targetModelIdentity: string | undefined;
  /**
   * The info's statically read `userConfigurableDeliveryMethods`, as `NotificationDeliveryMethod` member names. Only set when {@link userConfigurableDeliveryMethodsSource} is `declared`.
   */
  readonly userConfigurableDeliveryMethods: readonly NotificationDeliveryMethodName[] | undefined;
  /**
   * `default` (property absent, so the runtime default applies: the default methods, or none when the info forces a method), `declared`, or `unresolved` (not statically readable). `undefined` when the template has no info.
   */
  readonly userConfigurableDeliveryMethodsSource: UserConfigurableDeliveryMethodsSource | undefined;
  /**
   * The info's statically read `forcedDeliveryMethods` (always on for every user), as `NotificationDeliveryMethod` member names. Only set when {@link forcedDeliveryMethodsSource} is `declared`.
   */
  readonly forcedDeliveryMethods: readonly NotificationDeliveryMethodName[] | undefined;
  /**
   * `default` (property absent, no method is forced), `declared`, or `unresolved` (not statically readable). `undefined` when the template has no info.
   */
  readonly forcedDeliveryMethodsSource: ForcedDeliveryMethodsSource | undefined;
  /**
   * Delivery methods the template's handler factories build channel content for. Empty when there is no factory.
   */
  readonly factoryContentDeliveryMethods: readonly NotificationDeliveryMethodName[];
  /**
   * Reachable from the `<APP>_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD` aggregator.
   */
  readonly inInfoRecord: boolean;
  /**
   * Handled by a `NotificationTemplateServiceTypeConfig` reachable from the configs-array factory.
   */
  readonly hasFactory: boolean;
  /**
   * Name of the factory function that produced the handler (leaf factory, may live in a sub-file).
   */
  readonly factoryFunctionName: string | undefined;
  readonly sourceFile: string;
}

export interface TaskSummary {
  readonly typeCode: string | undefined;
  readonly symbolName: string;
  readonly dataInterfaceName: string | undefined;
  readonly checkpoints: readonly string[];
  readonly inAllArray: boolean;
  /**
   * Listed by a `notificationTaskService({ validate })` call, directly or inside one of the app's own
   * `ALL_*_NOTIFICATION_TASK_TYPES` aggregates it spreads (followed through any nesting).
   */
  readonly inValidateList: boolean;
  readonly hasHandler: boolean;
  readonly handlerFlowStepCount: number | undefined;
  readonly sourceFile: string;
}

/**
 * One NotificationTaskBot script type, joined across its `NotificationTaskBotScriptType` constant, its
 * `NotificationTaskBotScriptConfig`, the script registry the app wires, and the NTBR handler's processors and `validate`.
 */
export interface TaskBotScriptSummary {
  /**
   * The script type code, e.g. `demo_ping`, when statically known.
   */
  readonly scriptType: string | undefined;
  /**
   * The constant that declares it, or the identifier a reference names.
   */
  readonly symbolName: string | undefined;
  /**
   * The side that declares the script (its constant, else its config). `undefined` for a script only a processor or the handler's `validate` names.
   */
  readonly side: ExtractedTaskBotSide | undefined;
  /**
   * The side-relative file that declares the script (its constant, else its config). `undefined` for a script only a processor or the handler's `validate` names.
   */
  readonly sourceFile: string | undefined;
  readonly hasConfig: boolean;
  /**
   * The config constant; `undefined` for an inline registry entry or when there is no config.
   */
  readonly configSymbolName: string | undefined;
  /**
   * The config's `name`.
   */
  readonly humanName: string | undefined;
  readonly description: string | undefined;
  /**
   * The `key` of the config's `group`.
   */
  readonly groupKey: string | undefined;
  readonly allowOwnerOptOut: boolean | undefined;
  /**
   * Whether the config sets `dataType`. `none` is an info marker: `update:entry` refuses data patches for the script. `undefined` without a config.
   */
  readonly dataTypeSource: ExtractedTaskBotScriptConfigDataTypeSource | undefined;
  /**
   * In the script registry the app wires (the one the `NOTIF_TASK_BOT_*` processor checks compare against).
   */
  readonly inRegistry: boolean;
  /**
   * Listed by the NTBR handler's `validate` (directly, or through `getAllKnownScriptTypes()`). `undefined` when no considered handler's `validate` could be read (absent / unresolved) or there is no handler.
   */
  readonly inHandlerValidate: boolean | undefined;
  readonly hasProcessor: boolean;
  /**
   * Labels of the processors targeting the script. More than one means duplicate targets.
   */
  readonly processorLabels: readonly string[];
}

/**
 * A `notificationTaskBotScriptConfigRecord(...)` call.
 */
export interface TaskBotRegistrySummary {
  /**
   * The variable the record is assigned to; `undefined` for an inline record.
   */
  readonly symbolName: string | undefined;
  readonly side: ExtractedTaskBotSide;
  readonly sourceFile: string;
  readonly line: number;
  /**
   * The script types of the record's configs, in order (configs without a `scriptType` are left out).
   */
  readonly scriptTypes: readonly ExtractedTaskBotScriptTypeRef[];
  readonly unresolvedReferences: readonly string[];
  readonly trustedReferences: readonly string[];
  /**
   * An `appNotificationTaskBotScriptConfigService(...)` call passes this record (by name, or inline).
   */
  readonly wired: boolean;
}

/**
 * A `notificationTaskBotRunNotificationTaskHandler(...)` call.
 */
export interface TaskBotHandlerSummary extends ExtractedSourceLocation {
  /**
   * Reached from a `notificationTaskService({ handlers })` call.
   */
  readonly reachable: boolean;
  readonly processorsResolved: boolean;
  readonly processors: readonly ExtractedTaskBotProcessor[];
  readonly validateStatus: ExtractedTaskServiceValidateStatus;
  readonly validateUsesRegistry: boolean;
  readonly validate: readonly ExtractedTaskBotScriptTypeRef[];
  readonly validateUnresolvedReason: string | undefined;
}

/**
 * The app's NotificationTaskBot wiring. Always present; `inUse: false` with empty lists for an app without bots.
 */
export interface TaskBotSummary {
  /**
   * The app uses bots — the same gate the `NOTIF_TASK_BOT_*` checks use.
   */
  readonly inUse: boolean;
  readonly registries: readonly TaskBotRegistrySummary[];
  /**
   * Every `appNotificationTaskBotScriptConfigService(...)` call in the API.
   */
  readonly registryWirings: readonly ExtractedTaskBotRegistryWiring[];
  readonly handlers: readonly TaskBotHandlerSummary[];
  /**
   * A `notificationTaskService({ validate })` lists the NotificationTaskBot task types.
   */
  readonly taskTypesInTaskServiceValidate: boolean;
  /**
   * Every `repairAllNotificationTaskBots(...)` / `repairAllNotificationTaskBotsFactory(...)` call in the API.
   */
  readonly repairCalls: readonly ExtractedSourceLocation[];
  readonly scripts: readonly TaskBotScriptSummary[];
}

export interface AppNotificationsReport {
  readonly componentDir: string;
  readonly apiDir: string;
  readonly aggregatorRecordName: string | undefined;
  readonly aggregatorWiredInApi: boolean;
  readonly templateConfigsArrayFactoryName: string | undefined;
  readonly templateConfigsArrayWiredInApi: boolean;
  readonly taskServiceCallCount: number;
  readonly templates: readonly TemplateSummary[];
  readonly tasks: readonly TaskSummary[];
  /**
   * The NotificationTaskBot wiring; `inUse: false` and empty lists for an app without bots.
   */
  readonly taskBot: TaskBotSummary;
}
