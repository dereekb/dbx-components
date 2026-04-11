/**
 * @module notification.message
 *
 * Defines the message factory pattern for the notification system. A {@link NotificationMessageFunctionFactory}
 * creates per-recipient {@link NotificationMessageFunction} instances that produce channel-specific content
 * (email, text, push, summary) from a {@link NotificationItem}.
 *
 * The server's notification send pipeline calls these factories to expand each notification into concrete messages
 * before dispatching them through the configured delivery channels.
 */
import { type PromiseOrValue, type Building, type Maybe, type WebsiteUrl, type NameEmailPair, type ArrayOrValue } from '@dereekb/util';
import { type NotificationRecipient, type NotificationRecipientWithConfig } from './notification.config';
import { type NotificationSendFlags, type Notification, type NotificationBox } from './notification';
import { type NotificationItem, type NotificationItemMetadata } from './notification.item';
import { type DocumentDataWithIdAndKey } from '../../common';
import { type NotificationSendEmailMessagesResult, type NotificationSendTextMessagesResult, type NotificationSendNotificationSummaryMessagesResult } from './notification.send';

/**
 * Per-recipient context passed to a {@link NotificationMessageFunction} when generating message content.
 */
export interface NotificationMessageInputContext {
  /**
   * Recipient of the notification.
   */
  readonly recipient: NotificationRecipient;
}

/**
 * Arbitrary key used by the sending configuration service for choosing a pre-configured entity.
 *
 * Typically used for customizing the "from" or "replyTo" addresses while maintaining a separation of concerns.
 */
export type NotificationMessageEntityKey = string;

/**
 * Arbitrary template name/key that is used to configure which template to use by the sending service.
 */
export type NotificationSendMessageTemplateName = string;

/**
 * Template configuration data for a notification message.
 *
 * This info is used by the sending service to configure the template, but is not passed directly to the template itself.
 */
export type NotificationMessageTemplateConfiguration = Record<string, unknown>;

/**
 * Template variables for a notification message.
 *
 * These variables may be directly passed to the template.
 */
export type NotificationMessageTemplateVariables = Record<string, unknown>;

/**
 * Generic notification message content.
 */
export interface NotificationMessageContent {
  /**
   * Explicit send template name to use, if applicable.
   *
   * The sending service determines how this template is used.
   */
  readonly sendTemplateName?: Maybe<NotificationSendMessageTemplateName>;
  /**
   * The key used to determine who to send it from.
   */
  readonly from?: Maybe<NotificationMessageEntityKey>;
  /**
   * The title/subject of the message for the recipient
   */
  readonly title: string;
  /**
   * The message for the recipient
   */
  readonly openingMessage?: Maybe<string>;
  /**
   * Bolded/Highlighted information
   */
  readonly boldHighlight?: Maybe<string>;
  /**
   * Second paragraph. Comes after the main message and bold content.
   */
  readonly closingMessage?: Maybe<string>;
  /**
   * The associated action.
   */
  readonly action?: Maybe<string>;
  /**
   * Url the action goes to.
   */
  readonly actionUrl?: Maybe<WebsiteUrl>;
  /**
   * Arbitrary template configuration data used by the sending service for configuration.
   */
  readonly templateConfig?: Maybe<NotificationMessageTemplateConfiguration>;
  /**
   * Arbitrary template data that may be directly passed to the template.
   */
  readonly templateVariables?: Maybe<NotificationMessageTemplateVariables>;
}

export interface NotificationMessageEmailContent extends NotificationMessageContent {
  /**
   * Email subject. If not defined, defaults to the title.
   */
  readonly subject?: string;
  /**
   * Email action prompt. If not defined, defaults to the title.
   */
  readonly prompt?: string;
  /**
   * Entity key to send the email from.
   */
  readonly from?: Maybe<NotificationMessageEntityKey>;
  /**
   * Entity key(s) to cc.
   */
  readonly cc?: Maybe<ArrayOrValue<NotificationMessageEntityKey>>;
  /**
   * Entity key(s) to bcc.
   */
  readonly bcc?: Maybe<ArrayOrValue<NotificationMessageEntityKey>>;
  /**
   * Entity key to reply to.
   */
  readonly replyTo?: Maybe<NotificationMessageEntityKey>;
  /**
   * A name/email pair to reply to.
   *
   * If the "replyTo" is present, this value acts as a fallback if the entity key returns no match.
   */
  readonly replyToEmail?: Maybe<NameEmailPair>;
}

export interface NotificationMessageNotificationSummaryContent {}

/**
 * Flags controlling whether a generated {@link NotificationMessage} should be delivered.
 */
export enum NotificationMessageFlag {
  /**
   * Normal delivery — message has content and should be sent.
   */
  NONE = 0,
  /**
   * Message factory produced no content for this recipient. Delivery is skipped.
   */
  NO_CONTENT = 1,
  /**
   * Explicitly suppress delivery. Used when the factory determines the notification should not be sent.
   */
  DO_NOT_SEND = 2
}

/**
 * Expanded notification content for a single recipient, produced by a {@link NotificationMessageFunction}.
 *
 * Contains the base content plus optional channel-specific overrides for email, text, and notification summary.
 * The `flag` field can suppress delivery if the factory determined no content or opted out.
 */
export interface NotificationMessage<D extends NotificationItemMetadata = {}> {
  /**
   * Delivery control flag. When set to `NO_CONTENT` or `DO_NOT_SEND`, this message is skipped.
   */
  readonly flag?: NotificationMessageFlag;
  /**
   * Associated item used to generate the content.
   *
   * Is required for sending NotificationSummary messages.
   */
  readonly item?: NotificationItem<D>;
  /**
   * The input context used to generate the message.
   */
  readonly inputContext: NotificationMessageInputContext;
  /**
   * The output content.
   */
  readonly content: NotificationMessageContent;
  /**
   * Content specific for an email.
   */
  readonly emailContent?: NotificationMessageEmailContent;
  /**
   * Content specific for a text.
   */
  readonly textContent?: NotificationMessageContent;
  /**
   * Content specific for notification summaries.
   */
  readonly notificationSummaryContent?: NotificationMessageNotificationSummaryContent;
}

/**
 * Configuration input for a {@link NotificationMessageFunctionFactory}, providing the notification context
 * needed to create a per-recipient message function.
 */
export interface NotificationMessageFunctionFactoryConfig<D extends NotificationItemMetadata = {}> {
  /**
   * The notification item containing content and metadata.
   */
  readonly item: NotificationItem<D>;
  /**
   * Parent NotificationBox context (model key for the box's associated model).
   */
  readonly notificationBox: Pick<NotificationBox, 'm'>;
  /**
   * Full Notification document data with its Firestore ID and key.
   */
  readonly notification: DocumentDataWithIdAndKey<Notification>;
}

/**
 * Async factory that creates a {@link NotificationMessageFunction} for a specific notification.
 *
 * Registered per-template-type in the application's notification configuration. The server calls this
 * factory once per notification, then invokes the returned function once per recipient.
 */
export type NotificationMessageFunctionFactory<D extends NotificationItemMetadata = {}> = (config: NotificationMessageFunctionFactoryConfig<D>) => Promise<NotificationMessageFunction>;

/**
 * Details passed to {@link NotificationMessageFunctionExtras} lifecycle callbacks after a send attempt.
 */
export interface NotificationMessageFunctionExtrasCallbackDetails {
  readonly success: boolean;
  readonly updatedSendFlags: NotificationSendFlags;
  readonly sendEmailsResult?: Maybe<NotificationSendEmailMessagesResult>;
  readonly sendTextsResult?: Maybe<NotificationSendTextMessagesResult>;
  readonly sendNotificationSummaryResult?: Maybe<NotificationSendNotificationSummaryMessagesResult>;
}

/**
 * Callback function invoked by the send pipeline with delivery results.
 */
export type NotificationMessageFunctionExtrasCallbackFunction = (callbackDetails: NotificationMessageFunctionExtrasCallbackDetails) => PromiseOrValue<unknown>;

/**
 * Optional extensions attached to a {@link NotificationMessageFunction} to customize delivery behavior.
 *
 * Allows message factories to inject additional recipients and hook into the send lifecycle
 * for side effects like logging, analytics, or cascading updates.
 */
export interface NotificationMessageFunctionExtras {
  /**
   * Additional recipients appended to every notification using this message function.
   * Useful for always-CC recipients like admin accounts or audit logs.
   */
  readonly globalRecipients?: Maybe<NotificationRecipientWithConfig[]>;
  /**
   * Called after each send attempt (whether successful or not) with the delivery results.
   */
  readonly onSendAttempted?: NotificationMessageFunctionExtrasCallbackFunction;
  /**
   * Called when all channels have completed delivery and the notification is marked done.
   */
  readonly onSendSuccess?: NotificationMessageFunctionExtrasCallbackFunction;
}

/**
 * Core message generation function that produces a {@link NotificationMessage} for a single recipient.
 */
export type NotificationMessageFunctionWithoutExtras = (inputContext: NotificationMessageInputContext) => Promise<NotificationMessage>;

/**
 * Combined message function type: a callable that generates per-recipient content,
 * plus optional {@link NotificationMessageFunctionExtras} for delivery customization.
 *
 * Created by {@link notificationMessageFunction} or returned from a {@link NotificationMessageFunctionFactory}.
 */
export type NotificationMessageFunction = NotificationMessageFunctionWithoutExtras & NotificationMessageFunctionExtras;

/**
 * Creates a {@link NotificationMessageFunction} by attaching optional {@link NotificationMessageFunctionExtras}
 * (global recipients, lifecycle callbacks) to a base message generation function.
 *
 * @param fn - base function that generates message content per recipient
 * @param extras - optional delivery customization (global recipients, send callbacks)
 * @returns a {@link NotificationMessageFunction} with the extras attached
 *
 * @example
 * ```ts
 * const msgFn = notificationMessageFunction(
 *   async (ctx) => ({
 *     inputContext: ctx,
 *     content: { title: 'New comment', openingMessage: 'Someone commented on your post' }
 *   }),
 *   { globalRecipients: [adminRecipient] }
 * );
 * ```
 */
export function notificationMessageFunction(fn: NotificationMessageFunctionWithoutExtras, extras?: NotificationMessageFunctionExtras): NotificationMessageFunction {
  if (extras) {
    const fnWithExtras = fn as Building<NotificationMessageFunction>;
    fnWithExtras.globalRecipients = extras.globalRecipients;
    fnWithExtras.onSendAttempted = extras.onSendAttempted;
    fnWithExtras.onSendSuccess = extras.onSendSuccess;
    fn = fnWithExtras as NotificationMessageFunction;
  }

  return fn;
}

/**
 * Creates a {@link NotificationMessageFunctionFactory} that always returns `NO_CONTENT` messages.
 *
 * Useful as a placeholder factory for template types that should not produce deliverable content.
 *
 * @returns a factory that produces no-content message functions
 *
 * @example
 * ```ts
 * const factory = noContentNotificationMessageFunctionFactory();
 * const msgFn = await factory(config);
 * const msg = await msgFn(inputContext);
 * // msg.flag === NotificationMessageFlag.NO_CONTENT
 * ```
 */
export function noContentNotificationMessageFunctionFactory<D extends NotificationItemMetadata = {}>(): NotificationMessageFunctionFactory<D> {
  return async (_config: NotificationMessageFunctionFactoryConfig<D>) => {
    // const { item } = config;
    return async (inputContext: NotificationMessageInputContext) => {
      const result: NotificationMessage = {
        flag: NotificationMessageFlag.NO_CONTENT,
        inputContext,
        content: {
          title: 'n/a'
        }
      };

      return result;
    };
  };
}
