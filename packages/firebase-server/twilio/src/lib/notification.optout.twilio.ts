import { isE164PhoneNumber, type Maybe, type PromiseOrValue } from '@dereekb/util';
import { NotificationUserTextOptOutType } from '@dereekb/firebase';
import { type ApplyNotificationUserTextOptOutResult, type NotificationServerActions } from '@dereekb/firebase-server/model';
import { type TwilioIncomingMessagePayload, type TwilioIncomingMessageOptOutTypeConfig, TwilioOptOutType, twilioIncomingMessageOptOutType } from '@dereekb/nestjs/twilio';
import { Logger } from '@nestjs/common';

/**
 * A STOP, START or HELP text that reached the app, after its opt-out was applied.
 */
export interface TwilioTextKeywordEvent {
  /**
   * The keyword the text matched.
   */
  readonly type: TwilioOptOutType;
  /**
   * The incoming text.
   */
  readonly payload: TwilioIncomingMessagePayload;
  /**
   * The applied STOP or START. Unset for HELP, and for senders that are not E.164 phone numbers.
   */
  readonly applied?: Maybe<ApplyNotificationUserTextOptOutResult>;
}

/**
 * Reacts to a {@link TwilioTextKeywordEvent}, such as by sending analytics. See {@link notificationUserTwilioTextKeywordHandler}.
 */
export type TwilioTextKeywordHandler = (event: TwilioTextKeywordEvent) => PromiseOrValue<void>;

/**
 * Config for {@link twilioNotificationTextOptOutHandler}.
 */
export interface TwilioNotificationTextOptOutHandlerConfig extends TwilioIncomingMessageOptOutTypeConfig {
  readonly notificationServerActions: Pick<NotificationServerActions, 'applyNotificationUserTextOptOut'>;
  /**
   * Called for every STOP, START and HELP text, after the opt-out is applied. Not called for texts that are not keywords.
   *
   * Best-effort: errors are logged and never fail the webhook. Use {@link notificationUserTwilioTextKeywordHandler} to react per matched
   * NotificationUser.
   */
  readonly onTextKeyword?: Maybe<TwilioTextKeywordHandler>;
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
 * not change anything. Senders that are not E.164 phone numbers, such as `whatsapp:+…`, are ignored.
 *
 * Every STOP, START and HELP text is then passed to the optional `onTextKeyword` callback, such as for analytics. The callback is awaited
 * before the handler returns, and is best-effort: its errors are logged and never fail the webhook.
 *
 * The handler never replies, HELP included, since Twilio's Advanced Opt-Out already replies to keywords. Errors from applying the opt-out
 * propagate, so Twilio logs the webhook as failed.
 *
 * @param config - The notification server actions, whether to only trust Twilio's `OptOutType`, and the optional keyword callback.
 * @returns The handler.
 *
 * @example
 * ```ts
 * const handleTextOptOut = twilioNotificationTextOptOutHandler({
 *   notificationServerActions,
 *   onTextKeyword: notificationUserTwilioTextKeywordHandler({
 *     context,
 *     onNotificationUserLoaded: ({ event, uid }) => analyticsService.sendEventData(uid, 'Text Keyword', { keyword: event.type })
 *   })
 * });
 *
 * twilioWebhookService.configure(this, (x) => {
 *   x.handleIncomingMessage(async ({ payload }) => {
 *     await handleTextOptOut(payload);
 *   });
 * });
 * ```
 */
export function twilioNotificationTextOptOutHandler(config: TwilioNotificationTextOptOutHandlerConfig): TwilioNotificationTextOptOutHandler {
  const { notificationServerActions, optOutTypeOnly, onTextKeyword } = config;
  const logger = new Logger('TwilioNotificationTextOptOutHandler');

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

    if (optOutType != null && onTextKeyword != null) {
      try {
        await onTextKeyword({ type: optOutType, payload, applied });
      } catch (e) {
        // best-effort; never log the sender's phone number
        logger.warn(`onTextKeyword failed for a ${optOutType} text.`, e);
      }
    }

    const result: TwilioNotificationTextOptOutHandlerResult = { optOutType, applied };
    return result;
  };
}
