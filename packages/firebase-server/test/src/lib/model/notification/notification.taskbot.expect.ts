import { type NotificationTaskBotEmbeddedScriptEntry, type NotificationTaskBotEntryHistoryItem, type NotificationTaskBotEntryStatus, notificationTaskBotEntryStatus, type NotificationTaskBotRunOutcome } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';

/**
 * Expects the entry to have the status. A missing entry fails the expectation.
 *
 * @param entry - The entry, if it exists.
 * @param status - The expected status.
 */
export function expectNotificationTaskBotEntryStatus(entry: Maybe<Pick<NotificationTaskBotEmbeddedScriptEntry, 's' | 'pat' | 'rn' | 'oat' | 'stl'>>, status: NotificationTaskBotEntryStatus): void {
  expect(entry == null ? undefined : notificationTaskBotEntryStatus(entry)).toBe(status);
}

/**
 * One position of {@link expectNotificationTaskBotEntryHistory}: the run's outcome, or the fields the history item must match.
 */
export type NotificationTaskBotEntryHistoryExpectation = NotificationTaskBotRunOutcome | Partial<NotificationTaskBotEntryHistoryItem>;

/**
 * Expects the entry's history to have exactly the expected items, oldest first. Each position is the run's outcome, or a
 * partial history item that the item must match.
 *
 * @param entry - The entry, if it exists. A missing entry has an empty history.
 * @param expected - The expected items, oldest first.
 */
export function expectNotificationTaskBotEntryHistory(entry: Maybe<Pick<NotificationTaskBotEmbeddedScriptEntry, 'h'>>, expected: NotificationTaskBotEntryHistoryExpectation[]): void {
  expect(entry?.h ?? []).toMatchObject(expected.map((x) => (typeof x === 'number' ? { o: x } : x)));
}
