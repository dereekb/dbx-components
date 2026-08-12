import { type WebsiteUrl, type Maybe, type ISO8601DateString, type TimeDuration, type TimeUnit } from '@dereekb/util';
import { type CalcomContext } from './calcom.config';
import { type CalcomWebhookId, type CalcomResponseStatus, type CalcomUserId, type CalcomId, type CalcomEventTypeId } from '../calcom.type';

/**
 * The triggers that fire a set amount of time after the booking, rather than on an event.
 *
 * These are the only triggers a {@link CalcomWebhookTimeOffset} applies to.
 */
export type CalcomWebhookTimeRelativeTrigger = 'AFTER_HOSTS_CAL_VIDEO_NO_SHOW' | 'AFTER_GUESTS_CAL_VIDEO_NO_SHOW';

/**
 * All {@link CalcomWebhookTimeRelativeTrigger} values.
 */
export const ALL_CALCOM_WEBHOOK_TIME_RELATIVE_TRIGGERS: readonly CalcomWebhookTimeRelativeTrigger[] = ['AFTER_HOSTS_CAL_VIDEO_NO_SHOW', 'AFTER_GUESTS_CAL_VIDEO_NO_SHOW'];

/**
 * The events a webhook may subscribe to.
 *
 * Enumerated by the API itself: posting an unknown trigger returns the full accepted set.
 */
export type CalcomWebhookTrigger =
  | CalcomWebhookTimeRelativeTrigger
  | 'BOOKING_CREATED'
  | 'BOOKING_PAYMENT_INITIATED'
  | 'BOOKING_PAID'
  | 'BOOKING_RESCHEDULED'
  | 'BOOKING_REQUESTED'
  | 'BOOKING_CANCELLED'
  | 'BOOKING_REJECTED'
  | 'BOOKING_NO_SHOW_UPDATED'
  | 'BOOKING_LOCATION_UPDATED'
  | 'FORM_SUBMITTED'
  | 'FORM_SUBMITTED_NO_EVENT'
  | 'MEETING_STARTED'
  | 'MEETING_ENDED'
  | 'RECORDING_READY'
  | 'RECORDING_TRANSCRIPTION_GENERATED'
  | 'INSTANT_MEETING'
  | 'INSTANT_MEETING_ACCEPTED'
  | 'OOO_CREATED'
  | 'ROUTING_FORM_FALLBACK_HIT'
  | 'WRONG_ASSIGNMENT_REPORT'
  | 'CALENDAR_ENTRY_REJECTED'
  | 'DELEGATION_CREDENTIAL_ERROR'
  | 'DELEGATION_CREDENTIAL_ROTATION_REQUIRED'
  | 'DELEGATION_CREDENTIAL_SECRET_ROTATED'
  | 'DELEGATION_CREDENTIAL_SECRET_ROTATION_FAILED';

/**
 * The payload format Cal.com sends to the subscriber.
 *
 * Enumerated by the API: posting an unknown value returns "version must be one of the following
 * values: 2021-10-20, 2026-07-27". Distinct from the `cal-api-version` header, which the webhook
 * endpoints do not use at all.
 */
export type CalcomWebhookVersion = '2021-10-20' | '2026-07-27';

/**
 * All {@link CalcomWebhookVersion} values, oldest first.
 */
export const ALL_CALCOM_WEBHOOK_VERSIONS: readonly CalcomWebhookVersion[] = ['2021-10-20', '2026-07-27'];

/**
 * The unit a {@link CalcomWebhookTimeOffset} is counted in.
 *
 * Enumerated by the API: posting an unknown value returns "timeUnit must be one of the following
 * values: DAY, HOUR, MINUTE". These are UPPERCASE and unrelated to the lowercase `@dereekb/util`
 * {@link TimeUnit} strings — map between them with {@link CALCOM_WEBHOOK_TIME_UNIT_TIME_UNIT_MAP}.
 */
export type CalcomWebhookTimeUnit = 'MINUTE' | 'HOUR' | 'DAY';

/**
 * All {@link CalcomWebhookTimeUnit} values, smallest first.
 */
export const ALL_CALCOM_WEBHOOK_TIME_UNITS: readonly CalcomWebhookTimeUnit[] = ['MINUTE', 'HOUR', 'DAY'];

/**
 * Maps each {@link CalcomWebhookTimeUnit} to the equivalent `@dereekb/util` {@link TimeUnit}.
 */
export const CALCOM_WEBHOOK_TIME_UNIT_TIME_UNIT_MAP: Readonly<Record<CalcomWebhookTimeUnit, TimeUnit>> = {
  MINUTE: 'min',
  HOUR: 'h',
  DAY: 'd'
};

/**
 * How many {@link CalcomWebhookTimeUnit} units after the booking start the trigger is evaluated.
 *
 * A whole number of at least 1 — the API rejects 0 with "time must not be less than 1".
 */
export type CalcomWebhookTimeAmount = number;

/**
 * How long after the booking start a {@link CalcomWebhookTimeRelativeTrigger} is evaluated.
 *
 * Carried on the wire as the sibling `time` + `timeUnit` fields; convert to a `@dereekb/util`
 * {@link TimeDuration} with {@link calcomWebhookTimeOffsetToTimeDuration} to do arithmetic on it.
 */
export interface CalcomWebhookTimeOffset {
  readonly time: CalcomWebhookTimeAmount;
  readonly timeUnit: CalcomWebhookTimeUnit;
}

/**
 * Either both halves of a {@link CalcomWebhookTimeOffset}, or neither.
 *
 * The API does not enforce the pairing itself — it accepts a `time` with no `timeUnit` and then
 * has no unit to apply it in — so this input type is what keeps a caller from sending half of one.
 */
export type CalcomWebhookTimeOffsetInput = CalcomWebhookTimeOffset | { readonly time?: never; readonly timeUnit?: never };

export interface CalcomWebhook {
  readonly id: CalcomWebhookId;
  readonly subscriberUrl: WebsiteUrl;
  readonly triggers: CalcomWebhookTrigger[];
  readonly active: boolean;
  readonly payloadTemplate: Maybe<string>;
  readonly secret: Maybe<string>;
  readonly userId: Maybe<CalcomUserId>;
  readonly version: Maybe<CalcomWebhookVersion>;
  /**
   * The magnitude of the webhook's {@link CalcomWebhookTimeOffset}, null unless it subscribes to a
   * {@link CalcomWebhookTimeRelativeTrigger}. Read both halves together with
   * {@link calcomWebhookTimeOffsetFromWebhook}.
   */
  readonly time: Maybe<CalcomWebhookTimeAmount>;
  readonly timeUnit: Maybe<CalcomWebhookTimeUnit>;
  /**
   * Returned when reading a webhook, but not on the create response.
   */
  readonly createdAt?: Maybe<ISO8601DateString>;
  readonly teamId?: Maybe<CalcomId>;
  readonly eventTypeId?: Maybe<CalcomEventTypeId>;
  readonly appId?: Maybe<string>;
  readonly platform?: Maybe<boolean>;
  readonly oAuthClientId?: Maybe<string>;
}

export interface CalcomCreateWebhookInputBase {
  readonly subscriberUrl: WebsiteUrl;
  readonly triggers: CalcomWebhookTrigger[];
  /**
   * Required: a create with no `active` is rejected with "active must be a boolean value".
   */
  readonly active: boolean;
  readonly payloadTemplate?: string;
  readonly secret?: string;
  readonly version?: CalcomWebhookVersion;
}

export type CalcomCreateWebhookInput = CalcomCreateWebhookInputBase & CalcomWebhookTimeOffsetInput;

export interface CalcomUpdateWebhookInputBase {
  readonly subscriberUrl?: WebsiteUrl;
  readonly triggers?: CalcomWebhookTrigger[];
  readonly active?: boolean;
  readonly payloadTemplate?: string;
  readonly secret?: string;
  readonly version?: CalcomWebhookVersion;
}

export type CalcomUpdateWebhookInput = CalcomUpdateWebhookInputBase & CalcomWebhookTimeOffsetInput;

export interface CalcomWebhookResponse {
  readonly status: CalcomResponseStatus;
  readonly data: CalcomWebhook;
}

export interface CalcomGetWebhooksResponse {
  readonly status: CalcomResponseStatus;
  readonly data: CalcomWebhook[];
}

/**
 * Converts a Cal.com webhook time offset to a `@dereekb/util` {@link TimeDuration}, so the
 * duration utilities (`timeDurationToMilliseconds()`, `convertTimeDuration()`, ...) apply to it.
 *
 * @param offset - The webhook time offset to convert.
 * @returns The equivalent TimeDuration.
 *
 * @example
 * ```ts
 * timeDurationToMilliseconds(calcomWebhookTimeOffsetToTimeDuration({ time: 5, timeUnit: 'MINUTE' })); // 300000
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function calcomWebhookTimeOffsetToTimeDuration(offset: CalcomWebhookTimeOffset): TimeDuration {
  return { amount: offset.time, unit: CALCOM_WEBHOOK_TIME_UNIT_TIME_UNIT_MAP[offset.timeUnit] };
}

/**
 * Reads a webhook's {@link CalcomWebhookTimeOffset} out of the sibling `time`/`timeUnit` fields.
 *
 * Returns undefined unless both halves are present, as the API returns them null on a webhook
 * with no {@link CalcomWebhookTimeRelativeTrigger} and a magnitude with no unit means nothing.
 *
 * @param webhook - The webhook to read the offset from.
 * @returns The webhook's time offset, or undefined when it has none.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function calcomWebhookTimeOffsetFromWebhook(webhook: Pick<CalcomWebhook, 'time' | 'timeUnit'>): Maybe<CalcomWebhookTimeOffset> {
  const { time, timeUnit } = webhook;
  return time != null && timeUnit != null ? { time, timeUnit } : undefined;
}

/**
 * Creates a webhook subscription for the authenticated user. Webhooks notify your app
 * when specified events occur (e.g., bookings created, cancelled, rescheduled).
 *
 * @param context - The Cal.com API context providing authentication and fetch capabilities.
 * @returns Creates a webhook subscription from the given input.
 *
 * @see https://cal.com/docs/api-reference/v2/webhooks/create-a-webhook
 *
 * @example
 * ```ts
 * const response = await createWebhook(context)({
 *   subscriberUrl: 'https://example.com/webhook/calcom',
 *   triggers: ['BOOKING_CREATED', 'BOOKING_CANCELLED'],
 *   active: true
 * });
 * console.log(response.data.id);
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function createWebhook(context: CalcomContext): (input: CalcomCreateWebhookInput) => Promise<CalcomWebhookResponse> {
  return (input) =>
    context.fetchJson('/webhooks', {
      method: 'POST',
      body: JSON.stringify(input)
    });
}

/**
 * Retrieves all webhooks for the authenticated user.
 *
 * @param context - The Cal.com API context providing authentication and fetch capabilities.
 * @returns Retrieves all webhooks.
 *
 * @see https://cal.com/docs/api-reference/v2/webhooks/get-all-webhooks
 *
 * @example
 * ```ts
 * const response = await getWebhooks(context)();
 * response.data.forEach(wh => console.log(wh.subscriberUrl, wh.triggers));
 * ```
 */
export function getWebhooks(context: CalcomContext): () => Promise<CalcomGetWebhooksResponse> {
  return () =>
    context.fetchJson('/webhooks', {
      method: 'GET'
    });
}

/**
 * Retrieves a specific webhook by ID.
 *
 * @param context - The Cal.com API context providing authentication and fetch capabilities.
 * @returns Retrieves a specific webhook by ID.
 *
 * @see https://cal.com/docs/api-reference/v2/webhooks/get-a-webhook
 *
 * @example
 * ```ts
 * const response = await getWebhook(context)(42);
 * console.log(response.data.subscriberUrl);
 * ```
 */
export function getWebhook(context: CalcomContext): (webhookId: CalcomWebhookId) => Promise<CalcomWebhookResponse> {
  return (webhookId) =>
    context.fetchJson(`/webhooks/${webhookId}`, {
      method: 'GET'
    });
}

/**
 * Updates an existing webhook by ID.
 *
 * @param context - The Cal.com API context providing authentication and fetch capabilities.
 * @returns Updates an existing webhook by ID.
 *
 * @see https://cal.com/docs/api-reference/v2/webhooks/update-a-webhook
 *
 * @example
 * ```ts
 * await updateWebhook(context)(42, { active: false });
 * ```
 */
export function updateWebhook(context: CalcomContext): (webhookId: CalcomWebhookId, input: CalcomUpdateWebhookInput) => Promise<CalcomWebhookResponse> {
  return (webhookId, input) =>
    context.fetchJson(`/webhooks/${webhookId}`, {
      method: 'PATCH',
      body: JSON.stringify(input)
    });
}

/**
 * Deletes a webhook by ID.
 *
 * @param context - The Cal.com API context providing authentication and fetch capabilities.
 * @returns Deletes a webhook by ID.
 *
 * @see https://cal.com/docs/api-reference/v2/webhooks/delete-a-webhook
 *
 * @example
 * ```ts
 * await deleteWebhook(context)(42);
 * ```
 */
export function deleteWebhook(context: CalcomContext): (webhookId: CalcomWebhookId) => Promise<CalcomWebhookResponse> {
  return (webhookId) =>
    context.fetchJson(`/webhooks/${webhookId}`, {
      method: 'DELETE'
    });
}
