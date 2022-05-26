import { HandlerBindAccessor, HandlerMappedSetFunction, Handler, handlerFactory, handlerConfigurerFactory, handlerMappedSetFunctionFactory } from '@dereekb/util';
import Stripe from 'stripe';
import '../stripe.type';

export enum StripeWebhookEventType {
  CUSTOMER_SUBSCRIPTION_TRIAL_WILL_END = 'customer.subscription.trial_will_end',
  CUSTOMER_SUBSCRIPTION_DELETED = 'customer.subscription.deleted',
  CUSTOMER_SUBSCRIPTION_CREATED = 'customer.subscription.created',
  CUSTOMER_SUBSCRIPTION_UPDATED = 'customer.subscription.updated',
  CHECKOUT_SESSION_COMPLETED = 'checkout.session.completed',
  CHECKOUT_SESSION_ASYNC_PAYMENT_FAILED = 'checkout.session.async_payment_failed',
  CHECKOUT_SESSION_ASYNC_PAYMENT_SUCCEEDED = 'checkout.session.async_payment_suceeded',
  SUBSCRIPTION_SCHEDULE_ABORTED = 'subscription_schedule.aborted',
  SUBSCRIPTION_SCHEDULE_CANCELLED = 'subscription_schedule.canceled',
  SUBSCRIPTION_SCHEDULE_COMPLETED = 'subscription_schedule.completed',
  SUBSCRIPTION_SCHEDULE_CREATED = 'subscription_schedule.created',
  SUBSCRIPTION_SCHEDULE_EXPIRING = 'subscription_schedule.expiring',
  SUBSCRIPTION_SCHEDULE_RELEASED = 'subscription_schedule.released',
  SUBSCRIPTION_SCHEDULE_UPDATED = 'subscription_schedule.updated'
}

/**
 * A parsed Stripe.Event that contains the relevant data and the original event.
 */
export interface StripeWebhookEvent<T = any> {
  /**
   * The event
   */
  readonly event: Stripe.Event;
  /**
   * The relevant data associated with this type of event.
   */
  readonly data: Stripe.TypedEventDataObject<T>;
}

/**
 * Creates a StripeWebhookEvent and treats the data as the input type.
 *
 * @param event
 * @returns
 */
export function stripeWebhookEvent<T>(event: Stripe.Event): StripeWebhookEvent<T> {
  return {
    event,
    data: event.data.object as unknown as T
  };
}

export function stripeWebhookEventMapper<T>(mapFn: (object: Stripe.Event.Data.Object, event: Stripe.Event) => T): (event: Stripe.Event) => StripeWebhookEvent<T> {
  return (event: Stripe.Event) => ({
    event,
    data: mapFn(event.data.object, event)
  });
}

export type StripeCheckoutSessionEventDataObject = Stripe.TypedEventDataObject<Stripe.Checkout.Session>;
export type StripeCustomerSubscriptionEventDataObject = Stripe.TypedEventDataObject<Stripe.Subscription>;
export type StripeSubscriptionScheduleEventDataObject = Stripe.TypedEventDataObject<Stripe.SubscriptionSchedule>;

// MARK: Handler
export type StripeEventHandler = Handler<Stripe.Event, string>;
export const stripeEventHandlerFactory = handlerFactory<Stripe.Event>((x) => x.type);

export type StripeHandlerMappedSetFunction<T> = HandlerMappedSetFunction<StripeWebhookEvent<T>>;

export interface StripeEventHandlerConfigurer extends HandlerBindAccessor<Stripe.Event, string> {
  readonly handleCheckoutSessionComplete: StripeHandlerMappedSetFunction<StripeCheckoutSessionEventDataObject>;
  readonly handleCheckoutSessionAsyncPaymentFailed: StripeHandlerMappedSetFunction<StripeCheckoutSessionEventDataObject>;
  readonly handleCheckoutSessionAsyncPaymentSuccess: StripeHandlerMappedSetFunction<StripeCheckoutSessionEventDataObject>;
  readonly handleCustomerSubscriptionCreated: StripeHandlerMappedSetFunction<StripeCustomerSubscriptionEventDataObject>;
  readonly handleCustomerSubscriptionUpdated: StripeHandlerMappedSetFunction<StripeCustomerSubscriptionEventDataObject>;
  readonly handleCustomerSubscriptionDeleted: StripeHandlerMappedSetFunction<StripeCustomerSubscriptionEventDataObject>;
  readonly handleSubscriptionScheduleAborted: StripeHandlerMappedSetFunction<StripeSubscriptionScheduleEventDataObject>;
  readonly handleSubscriptionScheduleCancelled: StripeHandlerMappedSetFunction<StripeSubscriptionScheduleEventDataObject>;
  readonly handleSubscriptionScheduleCompleted: StripeHandlerMappedSetFunction<StripeSubscriptionScheduleEventDataObject>;
  readonly handleSubscriptionScheduleCreated: StripeHandlerMappedSetFunction<StripeSubscriptionScheduleEventDataObject>;
  readonly handleSubscriptionScheduleExpiring: StripeHandlerMappedSetFunction<StripeSubscriptionScheduleEventDataObject>;
  readonly handleSubscriptionScheduleReleased: StripeHandlerMappedSetFunction<StripeSubscriptionScheduleEventDataObject>;
  readonly handleSubscriptionScheduleUpdated: StripeHandlerMappedSetFunction<StripeSubscriptionScheduleEventDataObject>;
}

export const stripeEventHandlerConfigurerFactory = handlerConfigurerFactory<StripeEventHandlerConfigurer, Stripe.Event>({
  configurerForAccessor: (accessor: HandlerBindAccessor<Stripe.Event>) => {
    const fnWithKey = handlerMappedSetFunctionFactory<StripeWebhookEvent<any>, any>(accessor, stripeWebhookEvent);

    const configurer: StripeEventHandlerConfigurer = {
      ...accessor,
      handleCheckoutSessionComplete: fnWithKey(StripeWebhookEventType.CHECKOUT_SESSION_COMPLETED),
      handleCheckoutSessionAsyncPaymentFailed: fnWithKey(StripeWebhookEventType.CHECKOUT_SESSION_ASYNC_PAYMENT_FAILED),
      handleCheckoutSessionAsyncPaymentSuccess: fnWithKey(StripeWebhookEventType.CHECKOUT_SESSION_ASYNC_PAYMENT_SUCCEEDED),
      handleCustomerSubscriptionCreated: fnWithKey(StripeWebhookEventType.CUSTOMER_SUBSCRIPTION_CREATED),
      handleCustomerSubscriptionUpdated: fnWithKey(StripeWebhookEventType.CUSTOMER_SUBSCRIPTION_UPDATED),
      handleCustomerSubscriptionDeleted: fnWithKey(StripeWebhookEventType.CUSTOMER_SUBSCRIPTION_DELETED),
      handleSubscriptionScheduleAborted: fnWithKey(StripeWebhookEventType.SUBSCRIPTION_SCHEDULE_ABORTED),
      handleSubscriptionScheduleCancelled: fnWithKey(StripeWebhookEventType.SUBSCRIPTION_SCHEDULE_CANCELLED),
      handleSubscriptionScheduleCompleted: fnWithKey(StripeWebhookEventType.SUBSCRIPTION_SCHEDULE_COMPLETED),
      handleSubscriptionScheduleCreated: fnWithKey(StripeWebhookEventType.SUBSCRIPTION_SCHEDULE_CREATED),
      handleSubscriptionScheduleExpiring: fnWithKey(StripeWebhookEventType.SUBSCRIPTION_SCHEDULE_EXPIRING),
      handleSubscriptionScheduleReleased: fnWithKey(StripeWebhookEventType.SUBSCRIPTION_SCHEDULE_RELEASED),
      handleSubscriptionScheduleUpdated: fnWithKey(StripeWebhookEventType.SUBSCRIPTION_SCHEDULE_UPDATED)
    };

    return configurer;
  }
});
