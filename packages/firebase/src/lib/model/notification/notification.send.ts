/**
 * @module notification.send
 *
 * Result types for notification delivery across each channel (email, text/SMS, in-app summary).
 * These types are returned by the server's send pipeline and used to update {@link NotificationSendCheckpoints}
 * for idempotent retry tracking.
 */
import { type Maybe, type EmailAddress, type E164PhoneNumber } from '@dereekb/util';
import { type NotificationSummaryId } from './notification.id';

/**
 * Per-channel delivery result tracking which recipients succeeded, failed, or were ignored.
 *
 * - `success` — delivery confirmed for these recipients
 * - `failed` — temporary failure; these recipients should be retried on the next send attempt
 * - `ignored` — recipients that were skipped (e.g., invalid address, duplicate, opted out)
 *
 * @template K - recipient identifier type (email address, phone number, or summary ID)
 */
export interface NotificationSendMessagesResult<K> {
  /**
   * Recipients where delivery succeeded.
   */
  readonly success: K[];
  /**
   * Recipients where delivery failed due to a temporary error. Will be retried on subsequent attempts.
   */
  readonly failed: K[];
  /**
   * Recipients that were skipped (invalid, duplicate, or opted out).
   */
  readonly ignored: K[];
}

/**
 * Merges two {@link NotificationSendMessagesResult} objects by concatenating their recipient lists.
 *
 * Used when combining results from multiple send batches within the same channel.
 *
 * @param a - first result to merge
 * @param b - second result to merge
 * @returns a new result with all recipient lists concatenated from both inputs
 *
 * @example
 * ```ts
 * const combined = mergeNotificationSendMessagesResult(firstBatchResult, secondBatchResult);
 * ```
 */
export function mergeNotificationSendMessagesResult<K>(a: Maybe<NotificationSendMessagesResult<K>>, b: Maybe<NotificationSendMessagesResult<K>>): NotificationSendMessagesResult<K> {
  return {
    success: [...(a?.success ?? []), ...(b?.success ?? [])],
    failed: [...(a?.failed ?? []), ...(b?.failed ?? [])],
    ignored: [...(a?.ignored ?? []), ...(b?.ignored ?? [])]
  };
}

/**
 * Email channel delivery result, keyed by recipient email address.
 */
export type NotificationSendEmailMessagesResult = NotificationSendMessagesResult<EmailAddress>;

/**
 * Text/SMS channel delivery result, keyed by recipient phone number in E.164 format.
 */
export type NotificationSendTextMessagesResult = NotificationSendMessagesResult<E164PhoneNumber>;

/**
 * In-app notification summary channel delivery result, keyed by {@link NotificationSummaryId}.
 */
export type NotificationSendNotificationSummaryMessagesResult = NotificationSendMessagesResult<NotificationSummaryId>;
