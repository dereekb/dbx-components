/**
 * @module mailgun.diagnostic
 *
 * Read-only helpers over the Mailgun Suppressions, Events, Validation, and Domains APIs.
 *
 * These exist to answer "why did this recipient not get the email?" without sending
 * anything. They are all failure-tolerant: a missing suppression record or an
 * unreachable API surfaces as an absent/empty result rather than a thrown error, so a
 * diagnostic routine can report what it could learn instead of aborting.
 *
 * The one write here is {@link mailgunRemoveSuppressionForRecipient}, the remedy for a
 * suppression the diagnosis found. It is failure-tolerant in the same way, reporting what
 * happened instead of throwing.
 */
import { type EmailAddress, type Maybe, type Milliseconds, type Minutes } from '@dereekb/util';
import { type MailgunApi } from './mailgun.api';
import { type MailgunBounceSuppression, type MailgunComplaintSuppression, type MailgunDomainEvent, type MailgunEmailValidationResult, type MailgunEventsQuery, type MailgunUnsubscribeSuppression } from './mailgun.type';

/**
 * The default number of events to read back when inspecting a recipient's recent activity.
 */
export const DEFAULT_MAILGUN_RECENT_EVENTS_LIMIT = 25;

/**
 * The default window of history to inspect when reading a recipient's recent events.
 */
export const DEFAULT_MAILGUN_RECENT_EVENTS_WINDOW_DAYS = 30;

/**
 * Mailgun event names relevant to delivery diagnosis.
 *
 * Mailgun returns these as free-form strings; this enum names the ones that carry
 * delivery meaning. Unknown values are passed through untouched.
 */
export enum MailgunEventName {
  ACCEPTED = 'accepted',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  REJECTED = 'rejected',
  COMPLAINED = 'complained',
  UNSUBSCRIBED = 'unsubscribed',
  OPENED = 'opened',
  CLICKED = 'clicked',
  STORED = 'stored'
}

/**
 * Mailgun failure severities. A `permanent` failure will never succeed on retry;
 * a `temporary` one may.
 */
export enum MailgunEventSeverity {
  PERMANENT = 'permanent',
  TEMPORARY = 'temporary'
}

/**
 * The domain suppression lists an address can be on.
 *
 * The values are the list names the Mailgun Suppressions API takes.
 */
export enum MailgunSuppressionList {
  /**
   * Addresses a previous message hard-bounced from.
   */
  BOUNCES = 'bounces',
  /**
   * Addresses that reported a message as spam.
   */
  COMPLAINTS = 'complaints',
  /**
   * Addresses that unsubscribed, from all mail or from specific tags.
   */
  UNSUBSCRIBES = 'unsubscribes'
}

/**
 * The suppression records found for a single address across a domain's suppression lists.
 *
 * A `bounce` or `complaint` entry means Mailgun will silently drop every subsequent
 * message to this address until the entry is removed.
 */
export interface MailgunRecipientSuppressions {
  readonly bounce?: Maybe<MailgunBounceSuppression>;
  readonly complaint?: Maybe<MailgunComplaintSuppression>;
  readonly unsubscribe?: Maybe<MailgunUnsubscribeSuppression>;
}

/**
 * True if any suppression record was found for the address.
 *
 * @param suppressions - The suppression records to check.
 * @returns True if the address appears on any of the domain's suppression lists.
 */
export function hasAnyMailgunRecipientSuppression(suppressions: MailgunRecipientSuppressions): boolean {
  return suppressions.bounce != null || suppressions.complaint != null || suppressions.unsubscribe != null;
}

/**
 * Reads a single suppression entry, treating "not found" as an absent value.
 *
 * The Mailgun API responds 404 when the address is not on the requested list, which is the common case
 * and not an error condition here.
 *
 * @param read - Performs the suppression lookup.
 * @returns The suppression record, or undefined if the address is not on the list or the lookup failed.
 */
async function readSuppression<T>(read: () => Promise<unknown>): Promise<Maybe<T>> {
  let result: Maybe<T>;

  try {
    result = (await read()) as T;
  } catch {
    result = undefined;
  }

  return result;
}

/**
 * Looks up an address across the domain's bounce, complaint, and unsubscribe lists.
 *
 * @param api - The Mailgun API.
 * @param email - The address to look up.
 * @returns The suppression records found for the address. Absent fields mean the address is not on that list.
 *
 * @example
 * ```ts
 * const suppressions = await mailgunSuppressionsForRecipient(api, 'user@example.com');
 *
 * if (suppressions.bounce) {
 *   console.log(`suppressed by bounce: ${suppressions.bounce.error}`);
 * }
 * ```
 */
export async function mailgunSuppressionsForRecipient(api: MailgunApi, email: EmailAddress): Promise<MailgunRecipientSuppressions> {
  const { domain, suppressions } = api;

  const [bounce, complaint, unsubscribe] = await Promise.all([
    //
    readSuppression<MailgunBounceSuppression>(() => suppressions.get(domain, MailgunSuppressionList.BOUNCES, email)),
    readSuppression<MailgunComplaintSuppression>(() => suppressions.get(domain, MailgunSuppressionList.COMPLAINTS, email)),
    readSuppression<MailgunUnsubscribeSuppression>(() => suppressions.get(domain, MailgunSuppressionList.UNSUBSCRIBES, email))
  ]);

  return { bounce, complaint, unsubscribe };
}

/**
 * The outcome of {@link mailgunRemoveSuppressionForRecipient}.
 */
export interface MailgunRemoveSuppressionForRecipientResult {
  /**
   * The list the address was removed from.
   */
  readonly list: MailgunSuppressionList;
  /**
   * True when the address is no longer on the list, either because it was just removed or because it was
   * not on the list in the first place.
   */
  readonly cleared: boolean;
  /**
   * True when the address was not on the list to begin with.
   */
  readonly notFound?: Maybe<boolean>;
  /**
   * Why the removal failed, when it did.
   */
  readonly error?: Maybe<string>;
}

/**
 * Removes an address from one of the domain's suppression lists, so Mailgun delivers to it again.
 *
 * An unsubscribe record is removed in full, including every tag it covers.
 *
 * Failure-tolerant like the read helpers in this module. Mailgun responds 404 when the address is not on
 * the list, and that counts as cleared, since the goal (the address is not suppressed) is already met. Any
 * other failure is returned as `cleared: false` with the error.
 *
 * @param api - The Mailgun API.
 * @param email - The address to remove.
 * @param list - The suppression list to remove it from.
 * @returns What happened to the address on that list.
 *
 * @example
 * ```ts
 * const result = await mailgunRemoveSuppressionForRecipient(api, 'user@example.com', MailgunSuppressionList.UNSUBSCRIBES);
 *
 * if (!result.cleared) {
 *   console.log(`could not resubscribe: ${result.error}`);
 * }
 * ```
 */
export async function mailgunRemoveSuppressionForRecipient(api: MailgunApi, email: EmailAddress, list: MailgunSuppressionList): Promise<MailgunRemoveSuppressionForRecipientResult> {
  let result: MailgunRemoveSuppressionForRecipientResult;

  try {
    await api.suppressions.destroy(api.domain, list, email);
    result = { list, cleared: true };
  } catch (e) {
    const notFound = (e as Maybe<{ status?: number }>)?.status === 404;
    result = notFound ? { list, cleared: true, notFound } : { list, cleared: false, error: `${e}` };
  }

  return result;
}

/**
 * Configuration for reading a recipient's recent Mailgun events.
 */
export interface MailgunRecentEventsForRecipientConfig {
  /**
   * The maximum number of events to return.
   *
   * Defaults to {@link DEFAULT_MAILGUN_RECENT_EVENTS_LIMIT}.
   */
  readonly limit?: Maybe<number>;
  /**
   * How far back to look.
   *
   * Defaults to {@link DEFAULT_MAILGUN_RECENT_EVENTS_WINDOW_DAYS} days.
   */
  readonly begin?: Maybe<Date>;
  /**
   * Restrict results to a single event name.
   */
  readonly event?: Maybe<string>;
}

/**
 * Reads the most recent Mailgun events for a recipient address, newest first.
 *
 * @param api - The Mailgun API.
 * @param email - The recipient address to filter on.
 * @param config - Optional limit/window/event filters.
 * @returns The matching events, newest first. Empty if there is no recent activity or the lookup failed.
 *
 * @example
 * ```ts
 * const events = await mailgunRecentEventsForRecipient(api, 'user@example.com', { limit: 10 });
 * const lastDelivered = events.find((x) => x.event === MailgunEventName.DELIVERED);
 * ```
 */
export async function mailgunRecentEventsForRecipient(api: MailgunApi, email: EmailAddress, config?: Maybe<MailgunRecentEventsForRecipientConfig>): Promise<MailgunDomainEvent[]> {
  const limit = config?.limit ?? DEFAULT_MAILGUN_RECENT_EVENTS_LIMIT;
  const begin = config?.begin ?? new Date(Date.now() - DEFAULT_MAILGUN_RECENT_EVENTS_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const query: MailgunEventsQuery = {
    recipient: email,
    begin: begin.toUTCString(),
    ascending: 'no',
    limit
  };

  if (config?.event) {
    query.event = config.event;
  }

  return mailgunEventsForQuery(api, query);
}

/**
 * The default distance from the reference time that {@link mailgunEventForRecipientNear} searches.
 */
export const DEFAULT_MAILGUN_EVENT_NEAR_WINDOW_MINUTES: Minutes = 60;

/**
 * Configuration for {@link mailgunEventForRecipientNear}.
 */
export interface MailgunEventForRecipientNearConfig {
  /**
   * The event name to look for, e.g. {@link MailgunEventName.UNSUBSCRIBED}.
   */
  readonly event: string;
  /**
   * The time the event is expected to have happened.
   */
  readonly at: Date;
  /**
   * How far either side of `at` to search.
   *
   * Defaults to {@link DEFAULT_MAILGUN_EVENT_NEAR_WINDOW_MINUTES}.
   */
  readonly windowMinutes?: Maybe<Minutes>;
}

/**
 * Finds the recipient's event of a given kind closest to a point in time.
 *
 * Used to connect a suppression record to the event that created it. A suppression only records when it
 * happened, while the `unsubscribed` / `complained` event that triggered it also carries the message it
 * was triggered from, such as that message's subject.
 *
 * The search sends both `begin` and `end`, so Mailgun reads the range in ascending order and does not rely
 * on the `ascending` flag. An empty result is normal. Mailgun keeps events only for the plan's retention
 * period, and a suppression added through the API or the dashboard has no event at all.
 *
 * @param api - The Mailgun API.
 * @param email - The recipient address.
 * @param config - The event name, the time to search around, and the window.
 * @returns The matching event closest to `at`, or undefined if there is none or the lookup failed.
 */
export async function mailgunEventForRecipientNear(api: MailgunApi, email: EmailAddress, config: MailgunEventForRecipientNearConfig): Promise<Maybe<MailgunDomainEvent>> {
  const { event, at, windowMinutes: inputWindowMinutes } = config;
  const windowMs = (inputWindowMinutes ?? DEFAULT_MAILGUN_EVENT_NEAR_WINDOW_MINUTES) * 60 * 1000;
  const atTime = at.getTime();

  const events = await mailgunEventsForQuery(api, {
    recipient: email,
    event,
    begin: new Date(atTime - windowMs).toUTCString(),
    end: new Date(atTime + windowMs).toUTCString(),
    limit: 25
  });

  let closest: Maybe<MailgunDomainEvent>;
  let closestDistance = Number.POSITIVE_INFINITY;

  events.forEach((x) => {
    const distance = Math.abs(mailgunDomainEventDate(x).getTime() - atTime);

    if (distance < closestDistance) {
      closest = x;
      closestDistance = distance;
    }
  });

  return closest;
}

/**
 * Strips the angle brackets Mailgun's send response wraps a message id in.
 *
 * `messages.create()` returns an id shaped like `<20240101120000.1.abc@domain>`, while the
 * Events API `message-id` filter expects the bare `20240101120000.1.abc@domain`. Passing the
 * bracketed form matches nothing.
 *
 * @param messageId - A message id in either form.
 * @returns The message id without surrounding angle brackets.
 */
export function bareMailgunMessageId(messageId: string): string {
  return messageId.replaceAll(/^<|>$/g, '');
}

/**
 * Reads all Mailgun events recorded for a specific message id.
 *
 * Used to resolve the outcome of a message that was already sent — the Events API lags the
 * send by seconds to minutes, so an empty result means "not known yet", not "not delivered".
 *
 * @param api - The Mailgun API.
 * @param messageId - The message id, with or without angle brackets.
 * @param config - Optional additional filters (e.g. `recipient` to scope the lookup).
 * @returns The events recorded for the message. Empty if none are recorded yet or the lookup failed.
 */
export async function mailgunEventsForMessageId(api: MailgunApi, messageId: string, config?: Maybe<Pick<MailgunEventsQuery, 'recipient' | 'begin' | 'limit'>>): Promise<MailgunDomainEvent[]> {
  const query: MailgunEventsQuery = {
    'message-id': bareMailgunMessageId(messageId),
    ascending: 'no',
    ...config
  };

  return mailgunEventsForQuery(api, query);
}

/**
 * Runs an arbitrary Events API query, returning an empty list if the lookup fails.
 *
 * @param api - The Mailgun API.
 * @param query - The events query.
 * @returns The matching events, or an empty array on failure.
 */
export async function mailgunEventsForQuery(api: MailgunApi, query: MailgunEventsQuery): Promise<MailgunDomainEvent[]> {
  let events: MailgunDomainEvent[];

  try {
    const result = await api.events.get(api.domain, query);
    events = result.items ?? [];
  } catch {
    events = [];
  }

  return events;
}

/**
 * The state of a Mailgun sending domain.
 */
export interface MailgunDomainState {
  /**
   * The domain name.
   */
  readonly domain: string;
  /**
   * Mailgun's state string for the domain. `active` is healthy; `unverified` means DNS is incomplete.
   */
  readonly state?: Maybe<string>;
  /**
   * True if the domain is disabled by Mailgun.
   */
  readonly disabled?: Maybe<boolean>;
  /**
   * True if the state could not be read.
   */
  readonly unknown?: Maybe<boolean>;
}

/**
 * Reads the sending domain's state.
 *
 * A domain that is not `active` will fail to deliver regardless of recipient configuration,
 * so this distinguishes a system-wide outage from a per-recipient problem.
 *
 * @param api - The Mailgun API.
 * @returns The domain's state, with `unknown` set if it could not be read.
 */
export async function mailgunDomainState(api: MailgunApi): Promise<MailgunDomainState> {
  const domain = api.domain;
  let state: MailgunDomainState;

  try {
    const result = (await api.domains.get(domain)) as { state?: string; is_disabled?: boolean };
    state = { domain, state: result?.state, disabled: result?.is_disabled };
  } catch {
    state = { domain, unknown: true };
  }

  return state;
}

/**
 * Validates a single email address via the Mailgun Validation API.
 *
 * Note that validation consumes Mailgun validation quota, so callers should treat this as
 * an opt-in check rather than something to run on every request.
 *
 * @param api - The Mailgun API.
 * @param email - The address to validate.
 * @returns The validation result, or undefined if validation is unavailable or failed.
 */
export async function mailgunValidateEmail(api: MailgunApi, email: EmailAddress): Promise<Maybe<MailgunEmailValidationResult>> {
  let result: Maybe<MailgunEmailValidationResult>;

  try {
    result = await api.validate.get(email);
  } catch {
    result = undefined;
  }

  return result;
}

/**
 * Converts a Mailgun event's unix-seconds timestamp to a Date.
 *
 * @param event - The event.
 * @returns The event's timestamp as a Date.
 */
export function mailgunDomainEventDate(event: MailgunDomainEvent): Date {
  return new Date(event.timestamp * 1000);
}

/**
 * The age of a Mailgun event in milliseconds relative to `now`.
 *
 * @param event - The event.
 * @param now - The reference time. Defaults to the current time.
 * @returns The event's age in milliseconds.
 */
export function mailgunDomainEventAge(event: MailgunDomainEvent, now: Date = new Date()): Milliseconds {
  return now.getTime() - mailgunDomainEventDate(event).getTime();
}

/**
 * Extracts the most useful human-readable reason from a failed/rejected Mailgun event.
 *
 * Mailgun spreads the explanation across `reason`, `delivery-status.description`, and
 * `delivery-status.message` depending on how the failure occurred, and any of them may be
 * empty.
 *
 * @param event - The event.
 * @returns The best available description, or undefined if the event carries none.
 */
export function mailgunDomainEventFailureReason(event: MailgunDomainEvent): Maybe<string> {
  const deliveryStatus = event['delivery-status'];
  const description = deliveryStatus?.description || undefined;
  const message = deliveryStatus?.message || undefined;
  const reason = event.reason || undefined;

  return description ?? message ?? reason;
}
