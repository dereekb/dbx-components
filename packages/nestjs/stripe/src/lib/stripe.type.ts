import { type Stripe } from 'stripe';

// Stripe 22 removed the top-level "stripe" ambient module (stripe-node#2619), so these helpers can
// no longer be merged into the Stripe namespace via `declare module 'stripe'`. Augmenting it now
// shadows the real Stripe class/namespace export instead of merging with it, which is why they are
// declared here as ordinary exported types.

/**
 * The data object carried by a StripeTypedEvent.
 *
 * Marks the point where an untyped Stripe.Event.Data.Object has been narrowed to a known type.
 */
export type StripeTypedEventDataObject<T> = T;

/**
 * Stripe.Event.Data narrowed to a known data object type.
 */
export interface StripeTypedEventData<T extends object> extends Stripe.Event.Data {
  object: T;
  previous_attributes?: Partial<T>;
}

/**
 * A Stripe.Event narrowed to a known data object type.
 */
export interface StripeTypedEvent<T extends object = object> extends Stripe.EventBase {
  data: StripeTypedEventData<T>;
  type: Exclude<Stripe.WebhookEndpointCreateParams.EnabledEvent, '*'>;
}
