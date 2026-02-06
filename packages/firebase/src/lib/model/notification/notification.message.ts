import { type PromiseOrValue, type Building, type Maybe, type WebsiteUrl, type NameEmailPair, type ArrayOrValue } from '@dereekb/util';
import { type NotificationRecipient, type NotificationRecipientWithConfig } from './notification.config';
import { type NotificationSendFlags, type Notification, type NotificationBox } from './notification';
import { type NotificationItem, type NotificationItemMetadata } from './notification.item';
import { type DocumentDataWithIdAndKey } from '../../common';
import { type NotificationSendEmailMessagesResult, type NotificationSendTextMessagesResult, type NotificationSendNotificationSummaryMessagesResult } from './notification.send';

/**
 * Contextual information when
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
export type NotificationMessageTemplateConfiguration = Record<string, any>;

/**
 * Template variables for a notification message.
 *
 * These variables may be directly passed to the template.
 */
export type NotificationMessageTemplateVariables = Record<string, any>;

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

export enum NotificationMessageFlag {
  /**
   * No flag
   */
  NONE = 0,
  /**
   * Special flag to indicate there is no content. Should not be sent.
   */
  NO_CONTENT = 1,
  /**
   * Special flag to not send the notification.
   */
  DO_NOT_SEND = 2
}

/**
 * A NotificationMessage is the final result of the expanded notification.
 */
export interface NotificationMessage<D extends NotificationItemMetadata = {}> {
  /**
   * Optional flag
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

export interface NotificationMessageFunctionFactoryConfig<D extends NotificationItemMetadata = {}> {
  /**
   * Notification item.
   */
  readonly item: NotificationItem<D>;
  /**
   * NotificationBox details for this message.
   */
  readonly notificationBox: Pick<NotificationBox, 'm'>;
  /**
   * Full Notification for this message.
   */
  readonly notification: DocumentDataWithIdAndKey<Notification>;
}

/**
 * Creates a NotificationMessageFunction from the input config.
 */
export type NotificationMessageFunctionFactory<D extends NotificationItemMetadata = {}> = (config: NotificationMessageFunctionFactoryConfig<D>) => Promise<NotificationMessageFunction>;

export interface NotificationMessageFunctionExtrasCallbackDetails {
  readonly success: boolean;
  readonly updatedSendFlags: NotificationSendFlags;
  readonly sendEmailsResult?: Maybe<NotificationSendEmailMessagesResult>;
  readonly sendTextsResult?: Maybe<NotificationSendTextMessagesResult>;
  readonly sendNotificationSummaryResult?: Maybe<NotificationSendNotificationSummaryMessagesResult>;
}

export type NotificationMessageFunctionExtrasCallbackFunction = (callbackDetails: NotificationMessageFunctionExtrasCallbackDetails) => PromiseOrValue<unknown>;

export interface NotificationMessageFunctionExtras {
  /**
   * Any global/additional recipient(s) that should be added to all Notifications associated with this NotificationMessageFunctionExtras.
   */
  readonly globalRecipients?: Maybe<NotificationRecipientWithConfig[]>;
  /**
   * Called each time the notification attempts to send something.
   */
  readonly onSendAttempted?: NotificationMessageFunctionExtrasCallbackFunction;
  /**
   * Called when the notification has is marked as done after sending to all recipients.
   */
  readonly onSendSuccess?: NotificationMessageFunctionExtrasCallbackFunction;
}

export type NotificationMessageFunctionWithoutExtras = (inputContext: NotificationMessageInputContext) => Promise<NotificationMessage>;

/**
 * Converts a NotificationMessageContext to a NotificationMessage.
 */
export type NotificationMessageFunction = NotificationMessageFunctionWithoutExtras & NotificationMessageFunctionExtras;

/**
 * Creates a NotificationMessageFunction from the input.
 *
 * @param fn
 * @param extras
 * @returns
 */
export function notificationMessageFunction(fn: NotificationMessageFunctionWithoutExtras, extras?: NotificationMessageFunctionExtras): NotificationMessageFunction {
  if (extras) {
    const fnWithExtras = fn as Building<NotificationMessageFunction>;
    fnWithExtras.globalRecipients = extras.globalRecipients;
    fnWithExtras.onSendAttempted = extras.onSendAttempted;
    fnWithExtras.onSendSuccess = extras.onSendSuccess;
    return fnWithExtras as NotificationMessageFunction;
  } else {
    return fn;
  }
}

export function noContentNotificationMessageFunctionFactory<D extends NotificationItemMetadata = any>(): NotificationMessageFunctionFactory<D> {
  return async (config: NotificationMessageFunctionFactoryConfig<D>) => {
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
