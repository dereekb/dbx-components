import { DEFAULT_USER_CONFIGURABLE_NOTIFICATION_DELIVERY_METHODS, NotificationDeliveryMethod, type NotificationSettingsFallbackGroupBy, type NotificationTemplateType, type NotificationTemplateTypeInfoGroup, type NotificationTemplateTypeInfoRecord } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { type CliNotificationManifest } from '../manifest/types';

/**
 * Default name of the root notification catalog command group.
 */
export const DEFAULT_CLI_NOTIFICATION_COMMAND_NAME = 'notification';

/**
 * Default name of the CLI's model command tree, used in the "how to change" hints of `model notificationUser settings`.
 */
export const DEFAULT_CLI_NOTIFICATION_MODEL_COMMAND_NAME = 'model';

/**
 * Notification wiring for an app CLI, shared by the root `notification` catalog group ({@link createNotificationCommand}) and the
 * model-tree leaves ({@link buildNotificationModelCommands}).
 *
 * The display options match the front-end's notification settings config, so the CLI lists exactly what the settings page shows.
 */
export interface CliNotificationConfig {
  /**
   * The app's runtime template type info record, the same record the settings UI renders.
   */
  readonly templateTypeInfoRecord: NotificationTemplateTypeInfoRecord;
  /**
   * The generated notification manifest (`<NS>_NOTIFICATION_MANIFEST`), emitted by `dbx-cli-generate-notification-manifest --cli-output`.
   *
   * Required by `notification task-types`, and used to resolve the checkpoint flow of a task. Also enriches `notification types --expanded`.
   */
  readonly manifest?: Maybe<CliNotificationManifest>;
  /**
   * Template types to hide, in addition to types marked `hideFromUserSettings`.
   */
  readonly hiddenTemplateTypes?: Maybe<NotificationTemplateType[]>;
  /**
   * Delivery method columns, in order. Defaults to {@link DEFAULT_USER_CONFIGURABLE_NOTIFICATION_DELIVERY_METHODS}.
   */
  readonly deliveryMethods?: Maybe<NotificationDeliveryMethod[]>;
  /**
   * Delivery method columns to hide, such as text for an app that does not send texts.
   */
  readonly hiddenDeliveryMethods?: Maybe<NotificationDeliveryMethod[]>;
  /**
   * How to group template types that have no group. Defaults to `none`.
   */
  readonly fallbackGroupBy?: Maybe<NotificationSettingsFallbackGroupBy>;
  /**
   * Group for template types that have no group.
   */
  readonly defaultGroup?: Maybe<NotificationTemplateTypeInfoGroup>;
  /**
   * Name of the root catalog command group. Defaults to {@link DEFAULT_CLI_NOTIFICATION_COMMAND_NAME}.
   */
  readonly commandName?: Maybe<string>;
  /**
   * Name of the CLI's model command tree, used in update hints. Defaults to {@link DEFAULT_CLI_NOTIFICATION_MODEL_COMMAND_NAME}.
   */
  readonly modelCommandName?: Maybe<string>;
}

/**
 * Short labels for each delivery method, used as table column headers.
 */
export const CLI_NOTIFICATION_DELIVERY_METHOD_LABELS: Readonly<Record<NotificationDeliveryMethod, string>> = {
  [NotificationDeliveryMethod.EMAIL]: 'email',
  [NotificationDeliveryMethod.TEXT]: 'text',
  [NotificationDeliveryMethod.PUSH]: 'push',
  [NotificationDeliveryMethod.NOTIFICATION_SUMMARY]: 'summary'
};

/**
 * Returns the delivery method columns for the config, defaulting to {@link DEFAULT_USER_CONFIGURABLE_NOTIFICATION_DELIVERY_METHODS}, without
 * the hidden methods. Mirrors the settings UI's column resolution.
 *
 * @param config - The display options.
 * @returns The delivery method columns, in order.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function cliNotificationDeliveryMethods(config: Pick<CliNotificationConfig, 'deliveryMethods' | 'hiddenDeliveryMethods'>): NotificationDeliveryMethod[] {
  const hidden = new Set(config.hiddenDeliveryMethods ?? []);
  return (config.deliveryMethods ?? DEFAULT_USER_CONFIGURABLE_NOTIFICATION_DELIVERY_METHODS).filter((method) => !hidden.has(method));
}

/**
 * Returns the label for a delivery method, falling back to the method code for an unknown method.
 *
 * @param method - The delivery method.
 * @returns The label.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function cliNotificationDeliveryMethodLabel(method: NotificationDeliveryMethod): string {
  return CLI_NOTIFICATION_DELIVERY_METHOD_LABELS[method] ?? method;
}
