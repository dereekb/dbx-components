import { isE164PhoneNumber, type Maybe } from '@dereekb/util';
import { NotificationUserTextOptOutType } from '@dereekb/firebase';
import { type ApplyNotificationUserTextOptOutResult, type NotificationServerActions } from '@dereekb/firebase-server/model';
import { type TwilioIncomingMessagePayload, type TwilioIncomingMessageOptOutTypeConfig, TwilioOptOutType, twilioIncomingMessageOptOutType } from '@dereekb/nestjs/twilio';

/**
 * Config for {@link twilioNotificationTextOptOutHandler}.
 */
export interface TwilioNotificationTextOptOutHandlerConfig extends TwilioIncomingMessageOptOutTypeConfig {
  readonly notificationServerActions: Pick<NotificationServerActions, 'applyNotificationUserTextOptOut'>;
}

/**
 * Result of a {@link TwilioNotificationTextOptOutHandler} call.
 */
export interface TwilioNotificationTextOptOutHandlerResult {
  /**
   * The opt-out keyword type of the message, if it is one.
   */
  readonly optOutType: Maybe<TwilioOptOutType>;
  /**
   * The applied STOP or START. Unset for HELP, for messages that are not keywords, and for senders that are not E.164 phone numbers.
   */
  readonly applied?: Maybe<ApplyNotificationUserTextOptOutResult>;
}

/**
 * Syncs the STOP/START keyword of an incoming text back to the NotificationUsers it came from.
 */
export type TwilioNotificationTextOptOutHandler = (payload: TwilioIncomingMessagePayload) => Promise<TwilioNotificationTextOptOutHandlerResult>;

/**
 * Creates a {@link TwilioNotificationTextOptOutHandler} for an app's Twilio incoming-message webhook.
 *
 * A STOP or START reply calls `applyNotificationUserTextOptOut`, so texts to that number turn off or back on. HELP and other messages do
 * nothing. Senders that are not E.164 phone numbers, such as `whatsapp:+…`, are ignored.
 *
 * The handler never replies, since Twilio already confirms keywords. Errors propagate, so Twilio logs the webhook as failed.
 *
 * @param config - The notification server actions, and whether to only trust Twilio's `OptOutType`.
 * @returns The handler.
 *
 * @example
 * ```ts
 * const handleTextOptOut = twilioNotificationTextOptOutHandler({ notificationServerActions });
 *
 * twilioWebhookService.configure(this, (x) => {
 *   x.handleIncomingMessage(async ({ payload }) => {
 *     await handleTextOptOut(payload);
 *   });
 * });
 * ```
 */
export function twilioNotificationTextOptOutHandler(config: TwilioNotificationTextOptOutHandlerConfig): TwilioNotificationTextOptOutHandler {
  const { notificationServerActions, optOutTypeOnly } = config;

  return async (payload: TwilioIncomingMessagePayload) => {
    const optOutType = twilioIncomingMessageOptOutType(payload, { optOutTypeOnly });
    const phoneNumber = payload.From;

    let type: Maybe<NotificationUserTextOptOutType>;

    switch (optOutType) {
      case TwilioOptOutType.STOP:
        type = NotificationUserTextOptOutType.STOP;
        break;
      case TwilioOptOutType.START:
        type = NotificationUserTextOptOutType.START;
        break;
      default:
        // HELP replies and other messages do not change the user's opt-out state
        break;
    }

    let applied: Maybe<ApplyNotificationUserTextOptOutResult>;

    if (type != null && phoneNumber != null && isE164PhoneNumber(phoneNumber, false)) {
      applied = await notificationServerActions.applyNotificationUserTextOptOut({ phoneNumber, type });
    }

    const result: TwilioNotificationTextOptOutHandlerResult = { optOutType, applied };
    return result;
  };
}
