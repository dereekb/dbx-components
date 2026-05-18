import { type Maybe, performTasksFromFactoryInParallelFunction } from '@dereekb/util';
import { expandDaysForDateRange } from '@dereekb/date';
import { type Transaction, type FirestoreDocumentSnapshotDataPair, limitedFirestoreDocumentAccessorSnapshotCache } from '../../common';
import { type NotificationBoxDocument, type NotificationFirestoreCollections, type NotificationLoggedEventDayDocument, type NotificationLoggedEventDay } from './notification';
import { type NotificationLoggedEventDayId, notificationLoggedEventDayId, type NotificationTaskType, type NotificationTemplateType } from './notification.id';
import { type NotificationItem } from './notification.item';

/**
 * Configuration for {@link notificationLoggedEventLoader}.
 */
export interface NotificationLoggedEventLoaderConfig {
  readonly notificationFirestoreCollections: NotificationFirestoreCollections;
  readonly notificationBox: NotificationBoxDocument;
  readonly transaction?: Maybe<Transaction>;
}

/**
 * Input for {@link NotificationLoggedEventLoader.getItemsForDayRange}.
 */
export interface NotificationLoggedEventLoaderItemsForDayRangeInput {
  readonly from: Date;
  readonly to: Date;
  readonly type?: Maybe<NotificationTemplateType | NotificationTaskType>;
}

/**
 * Per-day result yielded by {@link NotificationLoggedEventLoader.forEachDayInRange}.
 */
export interface NotificationLoggedEventLoaderDayResult {
  readonly dayId: NotificationLoggedEventDayId;
  readonly items: NotificationItem[];
}

/**
 * Input for {@link NotificationLoggedEventLoader.forEachDayInRange}.
 */
export interface NotificationLoggedEventLoaderForEachDayInRangeInput {
  readonly from: Date;
  readonly to: Date;
  readonly type?: Maybe<NotificationTemplateType | NotificationTaskType>;
  readonly maxParallelTasks?: Maybe<number>;
  readonly handler: (input: NotificationLoggedEventLoaderDayResult) => Promise<void> | void;
}

/**
 * Cached, range-aware reader for the {@link NotificationLoggedEventDay} archive of a single
 * {@link NotificationBoxDocument}. Mirrors the pattern of `regionalHeirarchyForRegionalObjectModelKeyLoader`
 * — request-scoped, deduplicates reads via promise caching, and exposes both per-day and
 * date-range methods.
 */
export interface NotificationLoggedEventLoader {
  readonly notificationBox: NotificationBoxDocument;
  /**
   * Loads (and caches) the {@link NotificationLoggedEventDay} wrapper document for the given day.
   */
  getDay(dayId: NotificationLoggedEventDayId): Promise<FirestoreDocumentSnapshotDataPair<NotificationLoggedEventDayDocument>>;
  /**
   * Loads (and caches) every archived {@link NotificationItem} for the given day.
   */
  getItemsForDay(dayId: NotificationLoggedEventDayId): Promise<NotificationItem[]>;
  /**
   * Loads items for the given day, filtered to those whose `t` matches the given type.
   * Reuses the underlying day cache; no extra Firestore reads.
   */
  getItemsForDayWithType(dayId: NotificationLoggedEventDayId, type: NotificationTemplateType | NotificationTaskType): Promise<NotificationItem[]>;
  /**
   * Loads items across all days in `[from, to]` (inclusive), optionally filtered by type.
   * Days with no archive contribute zero items.
   */
  getItemsForDayRange(input: NotificationLoggedEventLoaderItemsForDayRangeInput): Promise<NotificationItem[]>;
  /**
   * Streams items per-day across `[from, to]` (inclusive). Each day is loaded via the same cache
   * as the per-day getters and passed to `handler` exactly once. Concurrency is bounded by
   * `maxParallelTasks` (defaults to unbounded — same as {@link performTasksFromFactoryInParallelFunction}).
   */
  forEachDayInRange(input: NotificationLoggedEventLoaderForEachDayInRangeInput): Promise<void>;
}

/**
 * Creates a request-scoped {@link NotificationLoggedEventLoader} that caches both day wrapper
 * snapshots (via {@link limitedFirestoreDocumentAccessorSnapshotCache}) and the per-day merged
 * `NotificationItem[]` from the paged subcollection.
 *
 * Cache lifetime is the loader instance — create one per request/transaction; do not retain.
 *
 * @param config - Notification collections, the parent {@link NotificationBoxDocument}, optional transaction.
 * @returns The cached loader.
 */
export function notificationLoggedEventLoader(config: NotificationLoggedEventLoaderConfig): NotificationLoggedEventLoader {
  const { notificationFirestoreCollections, notificationBox, transaction } = config;
  const { notificationLoggedEventDayCollectionFactory, notificationLoggedEventDayPagedItemsCollectionFactory } = notificationFirestoreCollections;

  const dayCollection = notificationLoggedEventDayCollectionFactory(notificationBox);
  const dayDocAccessor = dayCollection.documentAccessorForTransaction(transaction);
  const dayCache = limitedFirestoreDocumentAccessorSnapshotCache<NotificationLoggedEventDay, NotificationLoggedEventDayDocument>(dayDocAccessor);
  const itemsByDay = new Map<NotificationLoggedEventDayId, Promise<NotificationItem[]>>();

  function getDay(dayId: NotificationLoggedEventDayId): Promise<FirestoreDocumentSnapshotDataPair<NotificationLoggedEventDayDocument>> {
    const document = dayDocAccessor.loadDocumentForId(dayId);
    return dayCache.getDocumentSnapshotDataPairForKey(document.key);
  }

  function getItemsForDay(dayId: NotificationLoggedEventDayId): Promise<NotificationItem[]> {
    let cached = itemsByDay.get(dayId);

    if (!cached) {
      const dayDocument = dayDocAccessor.loadDocumentForId(dayId);
      const pagedItems = notificationLoggedEventDayPagedItemsCollectionFactory(dayDocument);
      cached = pagedItems.loadAllItems();
      itemsByDay.set(dayId, cached);
    }

    return cached;
  }

  async function getItemsForDayWithType(dayId: NotificationLoggedEventDayId, type: NotificationTemplateType | NotificationTaskType): Promise<NotificationItem[]> {
    const items = await getItemsForDay(dayId);
    return items.filter((item) => item.t === type);
  }

  function dayIdsForRange(from: Date, to: Date): NotificationLoggedEventDayId[] {
    return expandDaysForDateRange({ start: from, end: to }).map(notificationLoggedEventDayId);
  }

  async function getItemsForDayRange(input: NotificationLoggedEventLoaderItemsForDayRangeInput): Promise<NotificationItem[]> {
    const { from, to, type } = input;
    const dayIds = dayIdsForRange(from, to);
    const itemsPerDay = await Promise.all(dayIds.map((dayId) => getItemsForDay(dayId)));
    const allItems = itemsPerDay.flat();
    return type == null ? allItems : allItems.filter((item) => item.t === type);
  }

  async function forEachDayInRange(input: NotificationLoggedEventLoaderForEachDayInRangeInput): Promise<void> {
    const { from, to, type, maxParallelTasks, handler } = input;
    const dayIds = dayIdsForRange(from, to);
    let cursor = 0;

    const performTasks = performTasksFromFactoryInParallelFunction<NotificationLoggedEventDayId>({
      maxParallelTasks: maxParallelTasks ?? undefined,
      taskFactory: async (dayId) => {
        const items = await getItemsForDay(dayId);
        const filtered = type == null ? items : items.filter((item) => item.t === type);
        await handler({ dayId, items: filtered });
      }
    });

    await performTasks(() => {
      let next: Maybe<NotificationLoggedEventDayId> = null;

      if (cursor < dayIds.length) {
        next = dayIds[cursor];
        cursor += 1;
      }

      return next;
    });
  }

  return {
    notificationBox,
    getDay,
    getItemsForDay,
    getItemsForDayWithType,
    getItemsForDayRange,
    forEachDayInRange
  };
}
