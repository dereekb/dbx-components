import { type FirestoreQueryConstraint, limit, orderBy, where, whereDateIsOnOrBefore } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { type OpenRouterPromptKey } from '@dereekb/openrouter';
import { type OpenRouterRunTask, OpenRouterRunTaskState } from './openrouter.runtask';

/**
 * The states a sweep is allowed to pull a task out of.
 *
 * `AWAITING_ASYNC_TOOLS` is in here alongside `QUEUED` because a task parked on a deferred tool whose
 * results have since arrived is runnable again; `isOpenRouterRunTaskClaimable` is what decides whether
 * the results actually did arrive.
 */
export const OPENROUTER_RUN_TASK_RUNNABLE_STATES: readonly OpenRouterRunTaskState[] = [OpenRouterRunTaskState.QUEUED, OpenRouterRunTaskState.AWAITING_ASYNC_TOOLS];

/**
 * Params for a runnable-page query.
 */
export interface OpenRouterRunTasksRunnablePageQueryParams {
  /**
   * Maximum number of tasks to return.
   */
  readonly limit: number;
}

/**
 * Query for the run tasks a sweep may execute, oldest-queued first.
 *
 * @param params - The page limit.
 * @returns Firestore query constraints for the runnable page.
 *
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel OpenRouterRunTask
 * @dbxModelFirebaseIndexScope COLLECTION
 * @dbxModelFirebaseIndexCategory sweep
 */
export function openRouterRunTasksRunnableByQueuedAtQuery(params: OpenRouterRunTasksRunnablePageQueryParams): FirestoreQueryConstraint[] {
  const { limit: pageLimit } = params;
  return [where<OpenRouterRunTask>('s', 'in', OPENROUTER_RUN_TASK_RUNNABLE_STATES), orderBy<OpenRouterRunTask>('qat', 'asc'), limit(pageLimit)];
}

/**
 * Query for the run tasks a sweep may execute, highest-priority first and oldest-queued within a
 * priority.
 *
 * Separate factory rather than a flag on the one above, because the two need DIFFERENT composite
 * indexes — `(s, qat)` versus `(s, pr, qat)` — and one factory per index is what lets the index
 * generator see both. A conditional `orderBy` inside a single factory is invisible to it, which is how
 * a query ships with no index behind it and 400s only in production.
 *
 * @param params - The page limit.
 * @returns Firestore query constraints for the runnable page.
 *
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel OpenRouterRunTask
 * @dbxModelFirebaseIndexScope COLLECTION
 * @dbxModelFirebaseIndexCategory sweep
 */
export function openRouterRunTasksRunnableByPriorityQuery(params: OpenRouterRunTasksRunnablePageQueryParams): FirestoreQueryConstraint[] {
  const { limit: pageLimit } = params;
  return [where<OpenRouterRunTask>('s', 'in', OPENROUTER_RUN_TASK_RUNNABLE_STATES), orderBy<OpenRouterRunTask>('pr', 'asc'), orderBy<OpenRouterRunTask>('qat', 'asc'), limit(pageLimit)];
}

/**
 * Params for {@link openRouterRunTasksRunnableQuery}.
 */
export interface OpenRouterRunTasksRunnableQueryParams extends OpenRouterRunTasksRunnablePageQueryParams {
  /**
   * Whether to order by priority before queue time.
   *
   * Defaults to false, and the reason is worth stating precisely because the obvious reason is wrong.
   * Firestore excludes a document from an `orderBy` on a field it does not HAVE — but `pr` is written
   * on every enqueued task (as {@link OPENROUTER_DEFAULT_RUN_TASK_PRIORITY}), so nothing is dropped.
   * What does bite is the opposite: a `pr` of `null` sorts BEFORE every number, so a task written
   * without one jumps ahead of a priority-1 task. Turn this on only where every writer sets a
   * priority — and note it needs the three-field `(s, pr, qat)` index rather than the two-field one.
   */
  readonly usePriorityOrder?: Maybe<boolean>;
}

/**
 * Picks the runnable-page query for a sweep's ordering preference.
 *
 * @param params - The page limit and ordering preference.
 * @returns Firestore query constraints for the runnable page.
 *
 * `Skip` rides along with `Dispatcher` because a dispatcher body has no constraint calls of its own by
 * design, and `require-dbx-model-firebase-index-companion-tags` only exempts `Skip`. Both tags together
 * keep the delegate tracking the generator wants while telling the lint rule the empty body is intended.
 *
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexDispatcher
 * @dbxModelFirebaseIndexSkip true
 * @dbxModelFirebaseIndexModel OpenRouterRunTask
 * @dbxModelFirebaseIndexScope COLLECTION
 * @dbxModelFirebaseIndexCategory sweep
 */
export function openRouterRunTasksRunnableQuery(params: OpenRouterRunTasksRunnableQueryParams): FirestoreQueryConstraint[] {
  const { limit: pageLimit, usePriorityOrder } = params;
  return usePriorityOrder ? openRouterRunTasksRunnableByPriorityQuery({ limit: pageLimit }) : openRouterRunTasksRunnableByQueuedAtQuery({ limit: pageLimit });
}

/**
 * Params for {@link openRouterRunTasksReclaimableQuery}.
 */
export interface OpenRouterRunTasksReclaimableQueryParams {
  /**
   * Maximum number of tasks to return.
   */
  readonly limit: number;
  /**
   * Leases taken at or before this date are stale.
   */
  readonly leaseCutoff: Date;
}

/**
 * Query for RUNNING run tasks whose lease has gone stale — crash recovery.
 *
 * Separate from {@link openRouterRunTasksRunnableQuery} because it needs a range filter on `lat`, and
 * Firestore allows the range filter on only one field, which the ordering must then lead with.
 *
 * The cutoff goes through `whereDateIsOnOrBefore` rather than a bare `where('lat', '<=', date)`:
 * `firestoreDate` persists an ISO8601 STRING, so comparing the field against a `Date` compares a string
 * to a timestamp and matches nothing — silently, with no error and an empty page, which reads exactly
 * like "no crashed sweeps to recover".
 *
 * @param params - The page limit and lease cutoff.
 * @returns Firestore query constraints for the reclaimable page.
 *
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel OpenRouterRunTask
 * @dbxModelFirebaseIndexScope COLLECTION
 * @dbxModelFirebaseIndexCategory sweep
 */
export function openRouterRunTasksReclaimableQuery(params: OpenRouterRunTasksReclaimableQueryParams): FirestoreQueryConstraint[] {
  const { limit: pageLimit, leaseCutoff } = params;
  return [where<OpenRouterRunTask>('s', '==', OpenRouterRunTaskState.RUNNING), whereDateIsOnOrBefore<OpenRouterRunTask>('lat', leaseCutoff), orderBy<OpenRouterRunTask>('lat', 'asc'), limit(pageLimit)];
}

/**
 * Params for {@link openRouterRunTasksExpiredQuery}.
 */
export interface OpenRouterRunTasksExpiredQueryParams {
  /**
   * Tasks expiring at or before this date are returned.
   */
  readonly before: Date;
  /**
   * Maximum number of tasks to return.
   */
  readonly limit: number;
}

/**
 * Query for run tasks past their expiration, for cleanup.
 *
 * Cleanup matters here rather than being hygiene: `msg` grows without bound across a long chained
 * conversation.
 *
 * @param params - The expiration cutoff and page limit.
 * @returns Firestore query constraints for the expired page.
 *
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel OpenRouterRunTask
 * @dbxModelFirebaseIndexScope COLLECTION
 * @dbxModelFirebaseIndexCategory cleanup
 */
export function openRouterRunTasksExpiredQuery(params: OpenRouterRunTasksExpiredQueryParams): FirestoreQueryConstraint[] {
  const { before, limit: pageLimit } = params;
  // ISO-string comparison, for the same reason as the reclaimable query above.
  return [whereDateIsOnOrBefore<OpenRouterRunTask>('x', before), orderBy<OpenRouterRunTask>('x', 'asc'), limit(pageLimit)];
}

/**
 * Params for {@link openRouterRunTasksForPromptQuery}.
 */
export interface OpenRouterRunTasksForPromptQueryParams {
  /**
   * The prompt whose runs to return.
   */
  readonly promptKey: OpenRouterPromptKey;
  /**
   * Maximum number of tasks to return.
   */
  readonly limit: number;
}

/**
 * Query for the run tasks belonging to one prompt, newest first.
 *
 * @param params - The prompt key and page limit.
 * @returns Firestore query constraints.
 *
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel OpenRouterRunTask
 * @dbxModelFirebaseIndexScope COLLECTION
 */
export function openRouterRunTasksForPromptQuery(params: OpenRouterRunTasksForPromptQueryParams): FirestoreQueryConstraint[] {
  const { promptKey, limit: pageLimit } = params;
  return [where<OpenRouterRunTask>('pk', '==', promptKey), orderBy<OpenRouterRunTask>('qat', 'desc'), limit(pageLimit)];
}
