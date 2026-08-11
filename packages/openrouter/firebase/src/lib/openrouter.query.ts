import { type FirestoreQueryConstraint, limit, orderBy, where } from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { type OpenRouterPromptKey } from '@dereekb/openrouter';
import { type OpenRouterRunTask, OpenRouterRunTaskState } from './openrouter.runtask';

/**
 * Params for {@link openRouterRunTasksRunnableQuery}.
 */
export interface OpenRouterRunTasksRunnableQueryParams {
  /**
   * Maximum number of tasks to return.
   */
  readonly limit: number;
  /**
   * Whether to order by priority before queue time.
   *
   * Defaults to false, which is not the obvious default but is the correct one: Firestore excludes a
   * document from an `orderBy` on a field it does not have, so ordering by the optional `pr` silently
   * drops every task that never set a priority. Only turn it on when priorities are actually in use —
   * and note it needs the three-field index rather than the two-field one.
   */
  readonly usePriorityOrder?: Maybe<boolean>;
}

/**
 * Query for the run tasks a sweep may execute: freshly QUEUED ones, plus ones parked on a deferred tool
 * whose results have since arrived.
 *
 * @param params - The page limit and ordering preference.
 * @returns Firestore query constraints for the runnable page.
 *
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel OpenRouterRunTask
 * @dbxModelFirebaseIndexScope COLLECTION
 */
export function openRouterRunTasksRunnableQuery(params: OpenRouterRunTasksRunnableQueryParams): FirestoreQueryConstraint[] {
  const { limit: pageLimit, usePriorityOrder } = params;

  return [where<OpenRouterRunTask>('s', 'in', [OpenRouterRunTaskState.QUEUED, OpenRouterRunTaskState.AWAITING_ASYNC_TOOLS]), ...(usePriorityOrder ? [orderBy<OpenRouterRunTask>('pr', 'asc')] : []), orderBy<OpenRouterRunTask>('qat', 'asc'), limit(pageLimit)];
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
 * @param params - The page limit and lease cutoff.
 * @returns Firestore query constraints for the reclaimable page.
 *
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel OpenRouterRunTask
 * @dbxModelFirebaseIndexScope COLLECTION
 */
export function openRouterRunTasksReclaimableQuery(params: OpenRouterRunTasksReclaimableQueryParams): FirestoreQueryConstraint[] {
  const { limit: pageLimit, leaseCutoff } = params;
  return [where<OpenRouterRunTask>('s', '==', OpenRouterRunTaskState.RUNNING), where<OpenRouterRunTask>('lat', '<=', leaseCutoff), orderBy<OpenRouterRunTask>('lat', 'asc'), limit(pageLimit)];
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
 */
export function openRouterRunTasksExpiredQuery(params: OpenRouterRunTasksExpiredQueryParams): FirestoreQueryConstraint[] {
  const { before, limit: pageLimit } = params;
  return [where<OpenRouterRunTask>('x', '<=', before), orderBy<OpenRouterRunTask>('x', 'asc'), limit(pageLimit)];
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
