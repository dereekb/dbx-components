import { describe, it, expect } from 'vitest';
import { type Stripe } from 'stripe';
import { type Request } from 'express';
import { BadRequestException } from '@nestjs/common';
import { StripeApi } from '../stripe.api';
import { type StripeServiceConfig } from '../stripe.config';
import { DEFAULT_STRIPE_API_VERSION } from '../stripe.module';
import { type StripeCheckoutSessionEventDataObject, type StripeWebhookEvent, StripeWebhookEventType, stripeWebhookEvent, stripeWebhookEventMapper } from './webhook.stripe';

const TEST_SECRET = 'sk_test_stripe22migration';
const TEST_WEBHOOK_SECRET = 'whsec_stripe22migration';

const TEST_CONFIG: StripeServiceConfig = {
  stripe: {
    secret: TEST_SECRET,
    webhookSecret: TEST_WEBHOOK_SECRET,
    config: { apiVersion: DEFAULT_STRIPE_API_VERSION }
  }
};

const TEST_EVENT_PAYLOAD = {
  id: 'evt_stripe22',
  object: 'event',
  api_version: DEFAULT_STRIPE_API_VERSION,
  created: 1739000000,
  livemode: false,
  pending_webhooks: 0,
  request: { id: null, idempotency_key: null },
  type: StripeWebhookEventType.CHECKOUT_SESSION_COMPLETED,
  data: {
    object: {
      id: 'cs_test_stripe22',
      object: 'checkout.session',
      mode: 'subscription'
    }
  }
};

function requestWithSignature(signature?: string): Request {
  return { get: (name: string) => (name === 'stripe-signature' ? signature : undefined) } as unknown as Request;
}

describe('StripeApi.readStripeEventFromWebhookRequest()', () => {
  const api = new StripeApi(TEST_CONFIG);
  const rawBody = Buffer.from(JSON.stringify(TEST_EVENT_PAYLOAD), 'utf8');

  it('should construct the event when the stripe signature is valid', () => {
    const signature = api.stripe.webhooks.generateTestHeaderString({ payload: rawBody.toString('utf8'), secret: TEST_WEBHOOK_SECRET });
    const event = api.readStripeEventFromWebhookRequest(requestWithSignature(signature), rawBody);

    expect(event.id).toBe('evt_stripe22');
    expect(event.type).toBe(StripeWebhookEventType.CHECKOUT_SESSION_COMPLETED);
    // Stripe.Event.Data.Object is a union in v22 (not every member has an id), so narrowing is required here
    expect((event.data.object as Stripe.Checkout.Session).id).toBe('cs_test_stripe22');
  });

  it('should throw a BadRequestException when the stripe signature header is missing', () => {
    expect(() => api.readStripeEventFromWebhookRequest(requestWithSignature(undefined), rawBody)).toThrow(BadRequestException);
  });

  it('should throw a BadRequestException when the stripe signature does not verify', () => {
    const signature = api.stripe.webhooks.generateTestHeaderString({ payload: rawBody.toString('utf8'), secret: 'whsec_wrong_secret' });
    expect(() => api.readStripeEventFromWebhookRequest(requestWithSignature(signature), rawBody)).toThrow(BadRequestException);
  });
});

describe('stripeWebhookEvent()', () => {
  const event = TEST_EVENT_PAYLOAD as unknown as Stripe.Event;

  it('should narrow the event data object to the requested type', () => {
    const result: StripeWebhookEvent<StripeCheckoutSessionEventDataObject> = stripeWebhookEvent<StripeCheckoutSessionEventDataObject>(event);

    // narrowing is real, not `any`: these read as Stripe.Checkout.Session members
    const id: string = result.data.id;
    const mode: Stripe.Checkout.Session.Mode = result.data.mode;

    expect(id).toBe('cs_test_stripe22');
    expect(mode).toBe('subscription');
    expect(result.event).toBe(event);
  });

  it('should map the event data object with stripeWebhookEventMapper()', () => {
    const mapper = stripeWebhookEventMapper((object: Stripe.Event.Data.Object, e: Stripe.Event) => `${e.type}:${(object as Stripe.Checkout.Session).id}`);
    const result = mapper(event);

    expect(result.data).toBe(`${StripeWebhookEventType.CHECKOUT_SESSION_COMPLETED}:cs_test_stripe22`);
  });
});
