import { type ArrayOrValue, type E164PhoneNumber, type Maybe, type PromiseOrValue, asArray, batch, mapObjectKeysToLowercase, multiValueMapBuilder, pushArrayItemsIntoArray, runAsyncTasksForValues } from '@dereekb/util';
import { type NotificationMessage, type NotificationMessageContent, type NotificationSendMessageTemplateName, type NotificationSendTextMessagesResult } from '@dereekb/firebase';
import { type TwilioMessagingServiceSid, type TwilioPhoneNumber, type TwilioSendSmsInput, type TwilioService, type TwilioStatusCallbackUrl } from '@dereekb/nestjs/twilio';

/**
 * Structural mirror of `@dereekb/firebase-server/model`'s `NotificationSendMessagesInstance`.
 *
 * Declared locally so this package can be built without pulling the firebase-server/model
 * subpackage's source through path aliases (which trips the rollup-typescript plugin's
 * `rootDir` restriction). The shape matches the upstream definition exactly, so values
 * produced here are assignment-compatible with consumers that import the real type.
 */
export type NotificationSendMessagesInstance<R> = () => Promise<R>;

/**
 * Structural mirror of `@dereekb/firebase-server/model`'s `NotificationTextSendService`.
 *
 * See the note on {@link NotificationSendMessagesInstance} for why this is re-declared
 * locally instead of imported.
 */
export interface NotificationTextSendService {
  buildSendInstanceForTextNotificationMessages(notificationMessages: NotificationMessage[]): Promise<NotificationSendMessagesInstance<NotificationSendTextMessagesResult>>;
}

/**
 * Default max-batch-size used by {@link twilioNotificationTextSendService}.
 */
export const DEFAULT_TWILIO_NOTIFICATION_TEXT_SEND_SERVICE_MAX_BATCH_SIZE_PER_REQUEST = 50;

/**
 * Sentinel template name used when a message has no `sendTemplateName`. Routed to the
 * built-in default builder unless the consumer overrides it.
 */
export const DEFAULT_TWILIO_NOTIFICATION_TEMPLATE_NAME: NotificationSendMessageTemplateName = '_twilio_default';

/**
 * Maximum SMS body length we send to Twilio. Twilio itself can accept up to 1600 characters
 * per request and will segment as needed; bodies are truncated past this length.
 */
export const TWILIO_NOTIFICATION_BODY_MAX_LENGTH = 1600;

/**
 * Input passed to a {@link TwilioNotificationTextSendServiceTemplateBuilder}.
 */
export interface TwilioNotificationTextSendServiceTemplateBuilderInput {
  /**
   * The Twilio service that will dispatch built SMS inputs.
   */
  readonly twilioService: TwilioService;
  /**
   * The resolved template name for this batch.
   */
  readonly sendTemplateName: NotificationSendMessageTemplateName;
  /**
   * Notification messages assigned to this template.
   */
  readonly messages: NotificationMessage[];
  /**
   * Defaults to apply to built SMS inputs when the builder does not specify them.
   */
  readonly defaults: TwilioNotificationDefaults;
}

/**
 * Sender / callback defaults applied to built SMS inputs unless the template builder
 * overrides them.
 */
export interface TwilioNotificationDefaults {
  readonly defaultFrom?: Maybe<TwilioPhoneNumber>;
  readonly messagingServiceSid?: Maybe<TwilioMessagingServiceSid>;
  readonly statusCallback?: Maybe<TwilioStatusCallbackUrl>;
}

/**
 * Function that converts a group of notification messages into zero or more
 * {@link TwilioSendSmsInput} values.
 */
export type TwilioNotificationTextSendServiceTemplateBuilder = (input: TwilioNotificationTextSendServiceTemplateBuilderInput) => PromiseOrValue<ArrayOrValue<TwilioSendSmsInput>>;

/**
 * Configuration for {@link twilioNotificationTextSendService}.
 */
export interface TwilioNotificationTextSendServiceConfig {
  /**
   * The Twilio service used to dispatch outbound SMS.
   */
  readonly twilioService: TwilioService;
  /**
   * Sender phone number applied to messages that do not have an explicit `from` set by a builder.
   * When omitted, the value configured on the underlying {@link TwilioServiceConfig} is used.
   */
  readonly defaultFrom?: Maybe<TwilioPhoneNumber>;
  /**
   * Twilio Messaging Service SID applied when no `from` is provided.
   */
  readonly messagingServiceSid?: Maybe<TwilioMessagingServiceSid>;
  /**
   * Status callback URL applied to outbound messages built without an explicit callback.
   */
  readonly statusCallbackUrl?: Maybe<TwilioStatusCallbackUrl>;
  /**
   * Maximum number of SMS sends issued in a single batch. Defaults to
   * {@link DEFAULT_TWILIO_NOTIFICATION_TEXT_SEND_SERVICE_MAX_BATCH_SIZE_PER_REQUEST}.
   */
  readonly maxBatchSizePerRequest?: Maybe<number>;
  /**
   * Custom template builders keyed by send-template name. When omitted (or when no builder
   * matches a message's `sendTemplateName`), the built-in default builder is used to build
   * a single SMS per recipient from the message's `textContent`/`content`.
   */
  readonly messageBuilders?: Maybe<Record<NotificationSendMessageTemplateName, TwilioNotificationTextSendServiceTemplateBuilder>>;
  /**
   * Optional override of the built-in default builder. If unset, a built-in implementation is
   * used that maps `textContent.openingMessage ?? content.title` to the SMS body.
   */
  readonly defaultMessageBuilder?: Maybe<TwilioNotificationTextSendServiceTemplateBuilder>;
}

/**
 * Twilio-backed implementation of {@link NotificationTextSendService}.
 */
export type TwilioNotificationTextSendService = NotificationTextSendService;

/**
 * Default {@link TwilioNotificationTextSendServiceTemplateBuilder} that builds one SMS per
 * recipient using the message's `textContent.openingMessage` (falling back to `content.title`)
 * as the body.
 *
 * Messages without a recipient phone number are skipped here; the calling service routes them
 * to `ignored` in the final result.
 *
 * @param input - Builder input containing the messages and shared defaults.
 * @param input.messages - Notification messages to convert to SMS inputs.
 * @param input.defaults - Shared sender/callback defaults applied to each built SMS.
 * @returns Array of {@link TwilioSendSmsInput} ready for dispatch.
 */
export const defaultTwilioNotificationTextSendServiceTemplateBuilder: TwilioNotificationTextSendServiceTemplateBuilder = ({ messages, defaults }) => {
  const inputs: TwilioSendSmsInput[] = [];

  messages.forEach((message) => {
    const phone = message.inputContext.recipient.t as E164PhoneNumber | undefined;

    if (phone) {
      const body = bodyFromNotificationMessageContent(message.textContent ?? message.content);

      if (body) {
        inputs.push({
          to: phone,
          body,
          from: defaults.defaultFrom,
          messagingServiceSid: defaults.messagingServiceSid,
          statusCallback: defaults.statusCallback
        });
      }
    }
  });

  return inputs;
};

/**
 * Creates a {@link NotificationTextSendService} that dispatches notification SMS through Twilio.
 *
 * Groups messages by their `sendTemplateName`, batches them (up to `maxBatchSizePerRequest`),
 * converts each batch to {@link TwilioSendSmsInput}s via the matching template builder
 * (or the built-in default), and dispatches them through {@link TwilioService.sendBulkSms}.
 *
 * Messages missing a recipient phone are routed to `ignored` in the result.
 *
 * @param config - Service configuration including the Twilio service, template builders, and batch size.
 * @returns A {@link NotificationTextSendService} that batches and sends SMS through Twilio.
 *
 * @example
 * ```ts
 * const textService = twilioNotificationTextSendService({ twilioService });
 *
 * const sendInstance = await textService.buildSendInstanceForTextNotificationMessages(messages);
 * const result = await sendInstance();
 * // result.success/failed/ignored are E164PhoneNumber arrays
 * ```
 */
export function twilioNotificationTextSendService(config: TwilioNotificationTextSendServiceConfig): TwilioNotificationTextSendService {
  const { twilioService, defaultFrom, messagingServiceSid, statusCallbackUrl, maxBatchSizePerRequest: inputMaxBatchSizePerRequest, messageBuilders: inputMessageBuilders, defaultMessageBuilder: inputDefaultMessageBuilder } = config;

  const defaultBuilder = inputDefaultMessageBuilder ?? defaultTwilioNotificationTextSendServiceTemplateBuilder;
  const lowercaseKeysMessageBuilders = inputMessageBuilders ? mapObjectKeysToLowercase(inputMessageBuilders) : undefined;
  const maxBatchSizePerRequest = inputMaxBatchSizePerRequest ?? DEFAULT_TWILIO_NOTIFICATION_TEXT_SEND_SERVICE_MAX_BATCH_SIZE_PER_REQUEST;

  const defaults: TwilioNotificationDefaults = {
    defaultFrom,
    messagingServiceSid,
    statusCallback: statusCallbackUrl
  };

  const sendService: TwilioNotificationTextSendService = {
    async buildSendInstanceForTextNotificationMessages(notificationMessages: NotificationMessage[]): Promise<NotificationSendMessagesInstance<NotificationSendTextMessagesResult>> {
      const groupedMessages = multiValueMapBuilder<NotificationMessage, NotificationSendMessageTemplateName>();

      // Messages without a recipient phone number are dropped here — there is nothing for
      // Twilio to do with them, and the result is keyed by E164 phone so we cannot record
      // them in `ignored` either.
      notificationMessages.forEach((message) => {
        const phone = message.inputContext.recipient.t as E164PhoneNumber | undefined;

        if (phone) {
          const sendTemplateName = message.textContent?.sendTemplateName ?? message.content.sendTemplateName ?? DEFAULT_TWILIO_NOTIFICATION_TEMPLATE_NAME;
          groupedMessages.add(sendTemplateName, message);
        }
      });

      const messageSendBatches = groupedMessages.entries().flatMap(([templateType, messages]) => batch(messages, maxBatchSizePerRequest).map((x) => [templateType as NotificationSendMessageTemplateName, x] as const));

      const buildInputArrays: ArrayOrValue<TwilioSendSmsInput>[] = await Promise.all(
        messageSendBatches.map(async ([sendTemplateName, messages]) => {
          const builder = lowercaseKeysMessageBuilders?.[sendTemplateName.toLowerCase() as keyof typeof lowercaseKeysMessageBuilders] ?? defaultBuilder;
          return builder({ twilioService, sendTemplateName, messages, defaults });
        })
      );

      const sendInputs: TwilioSendSmsInput[] = buildInputArrays.flatMap((x) => asArray(x));

      const sendFn = async () => {
        const success: E164PhoneNumber[] = [];
        const failed: E164PhoneNumber[] = [];
        const ignored: E164PhoneNumber[] = [];

        await runAsyncTasksForValues(
          batch(sendInputs, maxBatchSizePerRequest),
          async (inputBatch) => {
            const results = await twilioService.sendBulkSms(inputBatch);
            results.forEach((result) => {
              if (result.error || result.status === 'failed' || result.status === 'undelivered') {
                pushArrayItemsIntoArray(failed, [result.to]);
              } else if (result.sandboxed) {
                pushArrayItemsIntoArray(ignored, [result.to]);
              } else {
                pushArrayItemsIntoArray(success, [result.to]);
              }
            });
          },
          { maxParallelTasks: 3 }
        );

        const result: NotificationSendTextMessagesResult = {
          success,
          failed,
          ignored
        };

        return result;
      };

      return sendFn;
    }
  };

  return sendService;
}

function bodyFromNotificationMessageContent(content: NotificationMessageContent): string {
  const parts: string[] = [];

  if (content.title) {
    parts.push(content.title);
  }
  if (content.openingMessage) {
    parts.push(content.openingMessage);
  }
  if (content.closingMessage) {
    parts.push(content.closingMessage);
  }
  if (content.actionUrl) {
    parts.push(content.actionUrl);
  }

  const joined = parts.join('\n').trim();
  return joined.length > TWILIO_NOTIFICATION_BODY_MAX_LENGTH ? joined.slice(0, TWILIO_NOTIFICATION_BODY_MAX_LENGTH) : joined;
}
