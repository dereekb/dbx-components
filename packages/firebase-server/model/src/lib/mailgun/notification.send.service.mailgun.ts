import { type Maybe, batch, multiValueMapBuilder, type PromiseOrValue, runAsyncTasksForValues, mapObjectKeysToLowercase, type EmailAddress, asArray, pushArrayItemsIntoArray, type ArrayOrValue } from '@dereekb/util';
import { type MailgunFileAttachment, type MailgunTemplateEmailRequest, type MailgunService } from '@dereekb/nestjs/mailgun';
import { iCalendarITipContentType } from '@dereekb/date';
import { DEFAULT_NOTIFICATION_MESSAGE_CALENDAR_ATTACHMENT_FILENAME, type NotificationMessageCalendarAttachment, type NotificationSendEmailMessagesResult, type NotificationMessage, type NotificationSendMessageTemplateName } from '@dereekb/firebase';
import { type NotificationEmailSendService } from '../notification/notification.send.service';
import { type NotificationSendMessagesInstance } from '../notification/notification.send';

/**
 * Converts a message's iTIP calendar payload into the Mailgun attachment that carries it.
 *
 * The `contentType` is the whole point: a calendar part typed `text/calendar; method=REQUEST; charset=utf-8`
 * is auto-processed as an invitation by Gmail, Outlook and Apple Mail, while the same bytes under Mailgun's
 * default type render as an ordinary paperclip.
 *
 * A builder that uses this MUST emit one request per message rather than folding its recipients into a
 * single batched `to[]`: attachments live on the REQUEST, `MailgunRecipient` has no per-recipient
 * attachment slot, and a `METHOD:REQUEST` invite is only rendered inline by a client that finds its OWN
 * address in the payload's ATTENDEE.
 *
 * @param calendarAttachment - The rendered payload from the message's email content.
 * @returns The Mailgun attachment.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function notificationMessageCalendarAttachmentToMailgunFileAttachment(calendarAttachment: NotificationMessageCalendarAttachment): MailgunFileAttachment {
  const { ics, method, filename } = calendarAttachment;

  return {
    filename: filename || DEFAULT_NOTIFICATION_MESSAGE_CALENDAR_ATTACHMENT_FILENAME,
    data: ics,
    contentType: iCalendarITipContentType(method)
  };
}

/**
 * Input for a MailgunNotificationEmailSendServiceTemplateBuilder.
 */
export interface MailgunNotificationEmailSendServiceTemplateBuilderInput {
  /**
   * The mailgun service.
   */
  readonly mailgunService: MailgunService;
  /**
   * The determined template type for all email messages provided.
   */
  readonly sendTemplateName: NotificationSendMessageTemplateName;
  /**
   * The set of email messages to be built into the email request.
   */
  readonly messages: NotificationMessage[];
}

/**
 * Configuration for creating a {@link MailgunNotificationEmailSendService} via {@link mailgunNotificationEmailSendService}.
 */
export interface MailgunNotificationEmailSendServiceConfig {
  /**
   * The mailgun service.
   */
  readonly mailgunService: MailgunService;
  /**
   * The default template type to use for messages, if applicable.
   */
  readonly defaultSendTemplateName?: Maybe<NotificationSendMessageTemplateName>;
  /**
   * The maximum number of messages to batch together.
   *
   * Defaults to 50.
   */
  readonly maxBatchSizePerRequest?: Maybe<number>;
  /**
   * A Record of MailgunNotificationEmailSendServiceTemplateBuilder functions keyed by the template type used to convert messages.
   */
  readonly messageBuilders: Record<NotificationSendMessageTemplateName, MailgunNotificationEmailSendServiceTemplateBuilder>;
}

export const DEFAULT_MAILGUN_NOTIFICATION_EMAIL_SEND_SERVICE_MAX_BATCH_SIZE_PER_REQUEST = 50;

/**
 * Function that converts the input into zero or more MailgunTemplateEmailRequests.
 */
export type MailgunNotificationEmailSendServiceTemplateBuilder = (input: MailgunNotificationEmailSendServiceTemplateBuilderInput) => PromiseOrValue<ArrayOrValue<MailgunTemplateEmailRequest>>;

/**
 * Mailgun-backed implementation of {@link NotificationEmailSendService}.
 */
export type MailgunNotificationEmailSendService = NotificationEmailSendService;

/**
 * Creates a {@link NotificationEmailSendService} that sends notification emails via Mailgun.
 *
 * Groups messages by their send template name, batches them (up to `maxBatchSizePerRequest`),
 * converts each batch to a {@link MailgunTemplateEmailRequest} using the configured template builders,
 * and dispatches them through the Mailgun API.
 *
 * @param config - Service configuration including the Mailgun service, template builders, and batch size.
 * @returns A {@link NotificationEmailSendService} that batches and sends emails through Mailgun.
 *
 * @example
 * ```ts
 * const emailService = mailgunNotificationEmailSendService({
 *   mailgunService,
 *   defaultSendTemplateName: 'notification',
 *   messageBuilders: {
 *     notification: buildNotificationTemplate
 *   }
 * });
 *
 * const sendInstance = await emailService.buildSendInstanceForEmailNotificationMessages(messages);
 * const result = await sendInstance();
 * ```
 */
export function mailgunNotificationEmailSendService(config: MailgunNotificationEmailSendServiceConfig): MailgunNotificationEmailSendService {
  const { mailgunService, defaultSendTemplateName, maxBatchSizePerRequest: inputMaxBatchSizePerRequest, messageBuilders: inputMessageBuilders } = config;
  const lowercaseKeysMessageBuilders = mapObjectKeysToLowercase(inputMessageBuilders);
  const maxBatchSizePerRequest = inputMaxBatchSizePerRequest ?? DEFAULT_MAILGUN_NOTIFICATION_EMAIL_SEND_SERVICE_MAX_BATCH_SIZE_PER_REQUEST;

  const sendService: MailgunNotificationEmailSendService = {
    async buildSendInstanceForEmailNotificationMessages(notificationMessages: NotificationMessage[]): Promise<NotificationSendMessagesInstance<NotificationSendEmailMessagesResult>> {
      const templateMap = multiValueMapBuilder<NotificationMessage, NotificationSendMessageTemplateName>();

      // group by templates
      notificationMessages.forEach((x) => {
        const sendTemplateName = x.emailContent?.sendTemplateName ?? x.content.sendTemplateName ?? defaultSendTemplateName;

        if (sendTemplateName == null) {
          throw new Error(`mailgunNotificationEmailSendService(): A sendTemplateName for a message was not available and no default was provided. Consider configuring a default send template.`);
        }

        templateMap.add(sendTemplateName, x);
      });

      // build send batches
      const messageSendBatches = templateMap.entries().flatMap(([templateType, messages]) => {
        return batch(messages, maxBatchSizePerRequest).map((x) => [templateType as NotificationSendMessageTemplateName, x] as const);
      });

      // create the template requests
      const templateRequestArrays: ArrayOrValue<MailgunTemplateEmailRequest>[] = await Promise.all(
        messageSendBatches.map(async ([sendTemplateName, messages]) => {
          const sendTemplateNameToLowercase = sendTemplateName.toLowerCase();
          const builderForKey = lowercaseKeysMessageBuilders[sendTemplateNameToLowercase as any];

          if (builderForKey) {
            const input = { mailgunService, sendTemplateName, messages };
            return builderForKey(input);
          }
          throw new Error(`mailgunNotificationEmailSendService(): A template builder was not available for template type "${sendTemplateName}".`);
        })
      );

      const templateRequests: MailgunTemplateEmailRequest[] = templateRequestArrays.flat();

      const sendFn = async () => {
        const success: EmailAddress[] = [];
        const failed: EmailAddress[] = [];

        // send the template emails
        await runAsyncTasksForValues(
          templateRequests,
          (x) => {
            const recipients = asArray(x.to).map((z) => z.email);

            return mailgunService
              .sendTemplateEmail(x)
              .then(() => {
                pushArrayItemsIntoArray(success, recipients);
              })
              .catch((e) => {
                pushArrayItemsIntoArray(failed, recipients);
                console.error('mailgunNotificationEmailSendService(): failed sending template emails', e);
                // suppress error
              });
          },
          { maxParallelTasks: 3 }
        );

        const result: NotificationSendEmailMessagesResult = {
          success,
          failed,
          ignored: []
        };

        return result;
      };

      return sendFn;
    }
  };

  return sendService;
}
