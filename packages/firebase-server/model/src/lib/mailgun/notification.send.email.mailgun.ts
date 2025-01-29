import { Maybe, batch, build, multiValueMapBuilder, PromiseOrValue, useAsync, runAsyncTasksForValues, IndexedBatch } from '@dereekb/util';
import { MailgunRecipient, MailgunTemplateEmailRequest, type MailgunService } from '@dereekb/nestjs/mailgun';
import { NotificationMessage, NotificationTemplateType } from '@dereekb/firebase';
import { NotificationEmailSendService } from '../notification/notification.send.service';
import { NotificationSendMessagesInstance } from '../notification/notification.send';

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
  readonly templateType: NotificationTemplateType;
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
  readonly defaultTemplateType?: Maybe<NotificationTemplateType>;
  /**
   * The maximum number of messages to batch together.
   *
   * Defaults to 50.
   */
  readonly maxBatchSizePerRequest?: Maybe<number>;
  /**
   * A Record of MailgunNotificationEmailSendServiceTemplateBuilder functions keyed by the template type used to convert messages.
   */
  readonly messageBuilders: Record<NotificationTemplateType, MailgunNotificationEmailSendServiceTemplateBuilder>;
}

export const MAILGUN_NOTIFICATION_EMAIL_SEND_SERVICE_DEFAULT_MAX_BATCH_SIZE_PER_REQUEST = 50;

/**
 * Function that converts the input into a MailgunTemplateEmailRequest.
 */
export type MailgunNotificationEmailSendServiceTemplateBuilder = (input: MailgunNotificationEmailSendServiceTemplateBuilderInput) => PromiseOrValue<MailgunTemplateEmailRequest>;

export interface MailgunNotificationEmailSendService extends NotificationEmailSendService {}

export function mailgunNotificationEmailSendService(config: MailgunNotificationEmailSendServiceConfig): MailgunNotificationEmailSendService {
  const { mailgunService, defaultTemplateType, maxBatchSizePerRequest: inputMaxBatchSizePerRequest, messageBuilders } = config;
  const maxBatchSizePerRequest = inputMaxBatchSizePerRequest ?? MAILGUN_NOTIFICATION_EMAIL_SEND_SERVICE_DEFAULT_MAX_BATCH_SIZE_PER_REQUEST;

  const sendService: MailgunNotificationEmailSendService = {
    async buildSendInstanceForEmailNotificationMessages(notificationMessages: NotificationMessage[]): Promise<NotificationSendMessagesInstance> {
      const templateMap = multiValueMapBuilder<NotificationMessage, NotificationTemplateType>();

      // group by templates
      notificationMessages.forEach((x) => {
        const templateType = x.emailContent?.templateType ?? x.content.templateType ?? defaultTemplateType;

        if (templateType == null) {
          throw new Error(`mailgunNotificationEmailSendService(): A template type for a message was not available and no default was provided. Consider configuring a default template type.`);
        }

        templateMap.add(templateType, x);
      });

      // build send batches
      const messageSendBatches = templateMap.entries().flatMap(([templateType, messages]) => {
        return batch(messages, maxBatchSizePerRequest).map((x) => [templateType as NotificationTemplateType, x] as const);
      });

      // create the template requests
      const templateRequests = await Promise.all(
        messageSendBatches.map(([templateType, messages]) => {
          const builderForKey = messageBuilders[templateType as string];

          if (!builderForKey) {
            throw new Error(`mailgunNotificationEmailSendService(): A template builder was not available for template type "${templateType}".`);
          } else {
            const input = { mailgunService, templateType, messages };
            return builderForKey(input);
          }
        })
      );

      const sendFn = async () => {
        // send the template emails
        await runAsyncTasksForValues(templateRequests, (x) => mailgunService.sendTemplateEmail(x), { maxParallelTasks: 3 });
      };

      return sendFn;
    }
  };

  return sendService;
}
