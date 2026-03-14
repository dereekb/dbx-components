/**
 * A pre-configured function that sends notification messages through a specific channel (email, SMS, or summary)
 * and returns the channel-specific result.
 *
 * Created by the `buildSendInstance*` methods on the various send services
 * (e.g., {@link NotificationEmailSendService}, {@link NotificationTextSendService}).
 * The messages and routing are captured at build time, so calling the instance simply triggers delivery.
 *
 * @template R - the channel-specific result type (e.g., {@link NotificationSendEmailMessagesResult})
 */
export type NotificationSendMessagesInstance<R> = () => Promise<R>;
