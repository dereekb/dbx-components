import { type HandlerBindAccessor, type HandlerMappedSetFunction, type Handler, handlerFactory, handlerConfigurerFactory, handlerMappedSetFunctionFactory } from '@dereekb/util';
import { type CalcomWebhookEventType, type UntypedCalcomWebhookEvent, type CalcomWebhookEvent, type CalcomWebhookBookingPayload, CALCOM_WEBHOOK_BOOKING_CREATED, CALCOM_WEBHOOK_BOOKING_CANCELLED, CALCOM_WEBHOOK_BOOKING_RESCHEDULED, CALCOM_WEBHOOK_BOOKING_CONFIRMED } from './webhook.calcom.type';

/**
 * Creates a CalcomWebhookEvent and treats the data as the input type.
 */
export function calcomWebhookEvent<T>(event: UntypedCalcomWebhookEvent): CalcomWebhookEvent<T> {
  return {
    triggerEvent: event.triggerEvent,
    createdAt: event.createdAt,
    payload: event.payload as unknown as T
  };
}

// MARK: Handler
export type CalcomEventHandler = Handler<UntypedCalcomWebhookEvent, CalcomWebhookEventType>;
export const calcomEventHandlerFactory = handlerFactory<UntypedCalcomWebhookEvent>((x) => x.triggerEvent);

export type CalcomHandlerMappedSetFunction<T> = HandlerMappedSetFunction<CalcomWebhookEvent<T>>;

export interface CalcomEventHandlerConfigurer extends HandlerBindAccessor<UntypedCalcomWebhookEvent, CalcomWebhookEventType> {
  handleBookingCreated: CalcomHandlerMappedSetFunction<CalcomWebhookBookingPayload>;
  handleBookingCancelled: CalcomHandlerMappedSetFunction<CalcomWebhookBookingPayload>;
  handleBookingRescheduled: CalcomHandlerMappedSetFunction<CalcomWebhookBookingPayload>;
  handleBookingConfirmed: CalcomHandlerMappedSetFunction<CalcomWebhookBookingPayload>;
}

export const calcomEventHandlerConfigurerFactory = handlerConfigurerFactory<CalcomEventHandlerConfigurer, UntypedCalcomWebhookEvent>({
  configurerForAccessor: (accessor: HandlerBindAccessor<UntypedCalcomWebhookEvent, CalcomWebhookEventType>) => {
    // eslint-disable-next-line
    const fnWithKey = handlerMappedSetFunctionFactory<CalcomWebhookEvent<any>, any>(accessor, calcomWebhookEvent);

    const configurer: CalcomEventHandlerConfigurer = {
      ...accessor,
      handleBookingCreated: fnWithKey(CALCOM_WEBHOOK_BOOKING_CREATED),
      handleBookingCancelled: fnWithKey(CALCOM_WEBHOOK_BOOKING_CANCELLED),
      handleBookingRescheduled: fnWithKey(CALCOM_WEBHOOK_BOOKING_RESCHEDULED),
      handleBookingConfirmed: fnWithKey(CALCOM_WEBHOOK_BOOKING_CONFIRMED)
    };

    return configurer;
  }
});
