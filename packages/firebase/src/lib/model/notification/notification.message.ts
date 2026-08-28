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
import { type ICalendarIcsString, type ICalendarMethod } from '@dereekb/date';
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
 *
 * @semanticType
 * @semanticTopic identifier
 * @semanticTopic string
 * @semanticTopic dereekb-firebase:notification
 */
export type NotificationMessageEntityKey = string;

/**
 * Arbitrary template name/key that is used to configure which template to use by the sending service.
 *
 * @semanticType
 * @semanticTopic identifier
 * @semanticTopic string
 * @semanticTopic dereekb-firebase:notification
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

/**
 * The iTIP method a {@link NotificationMessageCalendarAttachment} may carry.
 *
 * Deliberately the whole of {@link ICalendarMethod}, including its open string branch. A notification
 * USUALLY speaks as the organizer -- PUBLISH for an informational copy, REQUEST for an invitation or an
 * update to one, ADD for extra instances of a recurring event, CANCEL to withdraw one, and DECLINECOUNTER
 * to reject a proposed change -- but an app that sends ON BEHALF of an attendee has an equally real use
 * for the attendee-to-organizer methods: REPLY to RSVP, REFRESH to ask for the latest copy, and COUNTER
 * to propose one. Narrowing to the organizer set would put that behind a library change, and closing the
 * union would also drop the `X-` extension methods {@link ICalendarMethod} intentionally leaves room for.
 *
 * The invariant worth enforcing is not WHICH method but that it agrees with the METHOD property inside
 * the payload, which no type can express -- so this alias exists to document the choice rather than to
 * constrain it.
 */
export type NotificationMessageCalendarAttachmentMethod = ICalendarMethod;

/**
 * A rendered iTIP calendar payload for a single recipient, for the sending service to bundle as a calendar
 * MIME part on the outgoing email.
 *
 * Produced by a {@link NotificationMessageCalendarAttachmentFactory} at SEND time and never stored: it is
 * not on `NotificationItem.d`, because the item is re-embedded verbatim into `NotificationSummary.n[]`
 * (capped at 1000 items) and `NotificationWeek.n[]`, which each share a single 1 MiB document — an ICS
 * blob in `d` would consume the summary's whole budget. Store the IDENTIFIERS in `d` and render the ICS
 * from the message factory, which is async and holds the notification document.
 */
export interface NotificationMessageCalendarAttachment {
  /**
   * The rendered ICS document.
   */
  readonly ics: ICalendarIcsString;
  /**
   * The iTIP method the document carries. Duplicated onto the part's Content-Type by the sending service,
   * as RFC 6047 requires, and it MUST agree with the METHOD property inside {@link ics}.
   */
  readonly method: NotificationMessageCalendarAttachmentMethod;
  /**
   * File name of the part. Defaults to "invite.ics" when the sending service is given none.
   */
  readonly filename?: Maybe<string>;
}

/**
 * The file name given to a {@link NotificationMessageCalendarAttachment} that carries none.
 */
export const DEFAULT_NOTIFICATION_MESSAGE_CALENDAR_ATTACHMENT_FILENAME = 'invite.ics';

/**
 * Input for a {@link NotificationMessageCalendarAttachmentFactory}.
 */
export interface NotificationMessageCalendarAttachmentFactoryInput {
  /**
   * The message the part is being built for.
   */
  readonly message: NotificationMessage;
  /**
   * The address the sending service has resolved for this recipient, and the address the payload's
   * ATTENDEE must name.
   *
   * Load-bearing for a REQUEST: a client only renders an invitation inline when it finds ITS OWN address
   * in the ATTENDEE, which is why the payload is built here rather than once per notification.
   */
  readonly recipient: NameEmailPair;
}

/**
 * Renders the iTIP calendar payload for one recipient of a message.
 *
 * A factory rather than a value because the payload is per-recipient and transient: it is never
 * serialized, it is only meaningful to a sending service that delivers email, and the ATTENDEE varies by
 * recipient. Deferring the render to the sending service means one of these can be built once per
 * notification, closing over the event, and the ICS is only produced for the recipients that actually
 * receive an email.
 *
 * Return `undefined` to send the email without a calendar part.
 */
export type NotificationMessageCalendarAttachmentFactory = (input: NotificationMessageCalendarAttachmentFactoryInput) => PromiseOrValue<Maybe<NotificationMessageCalendarAttachment>>;

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
  /**
   * Renders an iTIP calendar payload to bundle onto the email as a calendar MIME part.
   *
   * Opt-in per sending service, like every other field here: a builder that does not call it simply sends
   * the email without the invite. A builder that DOES call it must emit one request per message when the
   * payload names a per-recipient ATTENDEE, since attachments live on the request rather than the
   * recipient.
   */
  readonly calendarAttachmentFactory?: Maybe<NotificationMessageCalendarAttachmentFactory>;
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
 * @param fn - Base function that generates message content per recipient.
 * @param extras - Optional delivery customization (global recipients, send callbacks)
 * @returns A {@link NotificationMessageFunction} with the extras attached.
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
 *
 * @__NO_SIDE_EFFECTS__
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
 * @returns A factory that produces no-content message functions.
 *
 * @example
 * ```ts
 * const factory = noContentNotificationMessageFunctionFactory();
 * const msgFn = await factory(config);
 * const msg = await msgFn(inputContext);
 * // msg.flag === NotificationMessageFlag.NO_CONTENT
 * ```
 *
 * @__NO_SIDE_EFFECTS__
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
