import { type Maybe, type Handler, type HandlerBindAccessor, type HandlerMappedSetFunction, handlerFactory, handlerConfigurerFactory, handlerMappedSetFunctionFactory } from '@dereekb/util';
import { type TwilioAccountSid, type TwilioMessageSid, type TwilioMessageStatus, type TwilioPhoneNumber } from '../twilio.type';

/**
 * Twilio webhook event type.
 */
export type TwilioWebhookEventType = 'status' | 'incoming';

/**
 * Parameters delivered by Twilio for a Message status callback.
 *
 * https://www.twilio.com/docs/messaging/api/message-resource#message-status-callback-parameters
 */
export interface TwilioStatusCallbackPayload {
  readonly MessageSid: TwilioMessageSid;
  readonly MessageStatus: TwilioMessageStatus;
  readonly AccountSid: TwilioAccountSid;
  readonly From?: Maybe<TwilioPhoneNumber>;
  readonly To?: Maybe<TwilioPhoneNumber>;
  readonly ApiVersion?: Maybe<string>;
  readonly ErrorCode?: Maybe<string>;
  readonly ErrorMessage?: Maybe<string>;
  /**
   * The full set of fields Twilio sent, in case the consumer needs non-standard ones.
   */
  readonly raw: Readonly<Record<string, string>>;
}

/**
 * Parameters delivered by Twilio for an incoming SMS / MMS.
 *
 * https://www.twilio.com/docs/messaging/guides/webhook-request#incoming-message-parameters
 */
export interface TwilioIncomingMessagePayload {
  readonly MessageSid: TwilioMessageSid;
  readonly AccountSid: TwilioAccountSid;
  readonly From: TwilioPhoneNumber;
  readonly To: TwilioPhoneNumber;
  readonly Body: string;
  readonly NumMedia: number;
  readonly NumSegments?: Maybe<number>;
  readonly FromCity?: Maybe<string>;
  readonly FromState?: Maybe<string>;
  readonly FromZip?: Maybe<string>;
  readonly FromCountry?: Maybe<string>;
  /**
   * Resolved MediaUrl0..MediaUrlN entries, ordered by index. Empty array when no media.
   */
  readonly mediaUrls: readonly string[];
  /**
   * The full set of fields Twilio sent.
   */
  readonly raw: Readonly<Record<string, string>>;
}

export type TwilioStatusCallbackEvent = {
  readonly type: 'status';
  readonly payload: TwilioStatusCallbackPayload;
};

export type TwilioIncomingMessageEvent = {
  readonly type: 'incoming';
  readonly payload: TwilioIncomingMessagePayload;
};

export type TwilioWebhookEvent = TwilioStatusCallbackEvent | TwilioIncomingMessageEvent;

export const twilioWebhookEventHandlerFactory = handlerFactory<TwilioWebhookEvent, TwilioWebhookEventType>((x) => x.type);

export type TwilioHandlerMappedSetFunction<T extends TwilioWebhookEvent = TwilioWebhookEvent> = HandlerMappedSetFunction<T>;

export interface TwilioWebhookEventHandlerConfigurer extends HandlerBindAccessor<TwilioWebhookEvent, TwilioWebhookEventType> {
  readonly handleStatusCallback: TwilioHandlerMappedSetFunction<TwilioStatusCallbackEvent>;
  readonly handleIncomingMessage: TwilioHandlerMappedSetFunction<TwilioIncomingMessageEvent>;
}

export const twilioWebhookEventHandlerConfigurerFactory = handlerConfigurerFactory<TwilioWebhookEventHandlerConfigurer, TwilioWebhookEvent, TwilioWebhookEventType>({
  configurerForAccessor: (accessor: HandlerBindAccessor<TwilioWebhookEvent, TwilioWebhookEventType>) => {
    // The `any` generics mirror the loose typing used by `openai`/`stripe` webhook configurers:
    // each `handle*` field is typed for a specific event subtype, but the underlying handler
    // set is keyed on the union type. The `any` widens the input position so the assignments
    // below type-check without per-field unsafe casts.
    const fnWithKey = handlerMappedSetFunctionFactory<any, any, TwilioWebhookEventType>(accessor, (x: TwilioWebhookEvent) => x);

    const configurer: TwilioWebhookEventHandlerConfigurer = {
      ...accessor,
      handleStatusCallback: fnWithKey('status'),
      handleIncomingMessage: fnWithKey('incoming')
    };

    return configurer;
  }
});

export type TwilioWebhookEventHandler = Handler<TwilioWebhookEvent, TwilioWebhookEventType>;
