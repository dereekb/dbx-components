import { type Building, type Maybe, type WebsiteUrl } from '@dereekb/util';
import { type NotificationRecipient, type NotificationRecipientWithConfig } from './notification.config';
import { type Notification, type NotificationBox } from './notification';
import { type NotificationItem, type NotificationItemMetadata } from './notification.item';
import { type DocumentDataWithIdAndKey } from '../../common';

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
 * Arbitrary template name/key that is used to configure which template to use by the sending service.
 */
export type NotificationSendMessageTemplateName = string;

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
}

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

  // TODO: ...
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

export interface NotificationMessageFunctionExtras {
  /**
   * Any additional recipients that should be added to the notification.
   *
   * This is generally also known as the global recipients as these recipients are attached to all notifications of this type.
   */
  readonly additionalRecipients?: Maybe<NotificationRecipientWithConfig[]>;
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
    fnWithExtras.additionalRecipients = extras.additionalRecipients;
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
