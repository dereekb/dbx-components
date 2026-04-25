/**
 * Report shapes for `dbx_notification_m_list_app`. Built from the same
 * {@link ExtractedAppNotifications} the validator produces — this tool
 * reshapes the cross-file extraction into a human-friendly summary.
 */

export interface TemplateSummary {
  readonly typeCode: string | undefined;
  readonly symbolName: string;
  readonly infoSymbolName: string | undefined;
  readonly humanName: string | undefined;
  readonly description: string | undefined;
  readonly notificationMIdentity: string | undefined;
  readonly targetModelIdentity: string | undefined;
  /** Reachable from the `<APP>_FIREBASE_NOTIFICATION_TEMPLATE_TYPE_INFO_RECORD` aggregator. */
  readonly inInfoRecord: boolean;
  /** Handled by a `NotificationTemplateServiceTypeConfig` reachable from the configs-array factory. */
  readonly hasFactory: boolean;
  /** Name of the factory function that produced the handler (leaf factory, may live in a sub-file). */
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
