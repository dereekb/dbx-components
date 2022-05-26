// https://github.com/stripe/stripe-node/issues/758#issuecomment-672185830
// Declare this typing to access types within the Stripe module.
declare module 'stripe' {
  namespace Stripe {
    type TypedEventDataObject<T> = T;

    interface TypedEventData<T> extends Stripe.Event.Data {
      object: T;
      previous_attributes?: Partial<T>;
    }

    interface TypedEvent<T = any> extends Stripe.Event {
      data: TypedEventData<T>;
      type: Exclude<Stripe.WebhookEndpointCreateParams.EnabledEvent, '*'>;
    }
  }
}
