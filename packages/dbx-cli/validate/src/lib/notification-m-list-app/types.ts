/**
 * Report shapes for `dbx_notification_m_list_app`. Built from the same
 * {@link ExtractedAppNotifications} the validator produces — this tool
 * reshapes the cross-file extraction into a human-friendly summary.
 */

import type { ForcedDeliveryMethodsSource, NotificationDeliveryMethodName, UserConfigurableDeliveryMethodsSource } from '../notification-m-validate-app/index.js';

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
  readonly inValidateList: boolean;
  readonly hasHandler: boolean;
  readonly handlerFlowStepCount: number | undefined;
  readonly sourceFile: string;
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
}
