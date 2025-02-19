import { type Maybe, batch, multiValueMapBuilder, type PromiseOrValue, runAsyncTasksForValues, mapObjectKeysToLowercase, EmailAddress, asArray, pushArrayItemsIntoArray } from '@dereekb/util';
import { type MailgunTemplateEmailRequest, type MailgunService } from '@dereekb/nestjs/mailgun';
import { NotificationSendEmailMessagesResult, type NotificationMessage, type NotificationSendMessageTemplateName } from '@dereekb/firebase';
import { type NotificationEmailSendService } from '../notification/notification.send.service';
import { type NotificationSendMessagesInstance } from '../notification/notification.send';

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
 * Config for a mailgunNotificationEmailSendService()
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

export const MAILGUN_NOTIFICATION_EMAIL_SEND_SERVICE_DEFAULT_MAX_BATCH_SIZE_PER_REQUEST = 50;

/**
 * Function that converts the input into a MailgunTemplateEmailRequest.
 */
export type MailgunNotificationEmailSendServiceTemplateBuilder = (input: MailgunNotificationEmailSendServiceTemplateBuilderInput) => PromiseOrValue<MailgunTemplateEmailRequest>;

export type MailgunNotificationEmailSendService = NotificationEmailSendService;

export function mailgunNotificationEmailSendService(config: MailgunNotificationEmailSendServiceConfig): MailgunNotificationEmailSendService {
  const { mailgunService, defaultSendTemplateName, maxBatchSizePerRequest: inputMaxBatchSizePerRequest, messageBuilders: inputMessageBuilders } = config;
  const lowercaseKeysMessageBuilders = mapObjectKeysToLowercase(inputMessageBuilders);
  const maxBatchSizePerRequest = inputMaxBatchSizePerRequest ?? MAILGUN_NOTIFICATION_EMAIL_SEND_SERVICE_DEFAULT_MAX_BATCH_SIZE_PER_REQUEST;

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
      const templateRequests = await Promise.all(
        messageSendBatches.map(([sendTemplateName, messages]) => {
          const sendTemplateNameToLowercase = sendTemplateName.toLowerCase();
          const builderForKey = lowercaseKeysMessageBuilders[sendTemplateNameToLowercase as any];

          if (!builderForKey) {
            throw new Error(`mailgunNotificationEmailSendService(): A template builder was not available for template type "${sendTemplateName}".`);
          } else {
            const input = { mailgunService, sendTemplateName, messages };
            return builderForKey(input);
          }
        })
      );

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
