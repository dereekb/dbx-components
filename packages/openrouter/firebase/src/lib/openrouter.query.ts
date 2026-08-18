import { type FirestoreQueryConstraint, limit, orderBy, where, whereDateIsOnOrBefore } from '@dereekb/firebase';
import { OPENROUTER_RUN_TASK_CLAIMABLE_STATES, type OpenRouterPrompt, type OpenRouterPromptState, type OpenRouterRunTask, OpenRouterRunTaskState } from './openrouter.model';

/**
 * Params for {@link openRouterPromptsWithStateQuery}.
 */
export interface OpenRouterPromptsWithStateQueryParams {
  /**
   * The lifecycle state to match.
   */
  readonly state: OpenRouterPromptState;
}

/**
 * Query for the prompts in one lifecycle state.
 *
 * Needs no composite index, and is deliberately kept that way. Unordered, so pagination falls through to
 * Firestore's implicit `__name__` order — which for this model is the prompt's own readable key, already
 * the order a listing wants — and state is the only filter axis: pairing it with an `array-contains` on
 * `t` would buy a composite index for a collection measured in dozens of documents.
 *
 * @param params - The state to match.
 * @returns Firestore query constraints for the prompts in that state.
 *
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel OpenRouterPrompt
 * @dbxModelFirebaseIndexScope COLLECTION
 * @dbxModelFirebaseIndexCategory admin
 */
export function openRouterPromptsWithStateQuery(params: OpenRouterPromptsWithStateQueryParams): FirestoreQueryConstraint[] {
  return [where<OpenRouterPrompt>('s', '==', params.state)];
}

/**
 * Params for {@link openRouterRunTasksRunnableQuery}.
 */
export interface OpenRouterRunTasksRunnableQueryParams {
  /**
   * Maximum number of tasks to return.
   */
  readonly limit: number;
}

/**
 * Query for the run tasks a sweep may execute, oldest-queued first.
 *
 * Queue order is the ONLY order, and deliberately so. A priority column costs a second composite index
 * and buys a second failure mode: Firestore sorts `null` before every number, so one task written without
 * a priority jumps the entire queue. Delaying a run is `NotificationTask`'s job — it owns the delayed
 * firing — which leaves nothing for a priority here to express.
 *
 * @param params - The page limit.
 * @returns Firestore query constraints for the runnable page.
 *
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel OpenRouterRunTask
 * @dbxModelFirebaseIndexScope COLLECTION
 * @dbxModelFirebaseIndexCategory sweep
 */
export function openRouterRunTasksRunnableQuery(params: OpenRouterRunTasksRunnableQueryParams): FirestoreQueryConstraint[] {
  const { limit: pageLimit } = params;
  return [where<OpenRouterRunTask>('s', 'in', OPENROUTER_RUN_TASK_CLAIMABLE_STATES), orderBy<OpenRouterRunTask>('qat', 'asc'), limit(pageLimit)];
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
   * Tasks queued at or before this date are returned.
   */
  readonly before: Date;
  /**
   * Maximum number of tasks to return.
   */
  readonly limit: number;
}

/**
 * Query for run tasks past their retention age, for deletion. Matches EVERY state, `RUNNING` included —
 * see {@link OPENROUTER_RUN_TASK_MAX_AGE} for why the ceiling is the whole requirement.
 *
 * Ordered by `qat` with no state filter, so it needs no composite index at all: a single-field range with
 * a matching order is served by Firestore's automatic single-field index.
 *
 * Firestore's NATIVE TTL policy cannot do this job, for the same reason the cutoff goes through
 * `whereDateIsOnOrBefore` rather than a bare `where('qat', '<=', date)`: `firestoreDate` persists an
 * ISO8601 STRING, and a TTL policy only deletes on a `Timestamp` field. Pointed at `qat` it would
 * silently never fire. The app-level sweep is the mechanism here, not a stopgap for one.
 *
 * @param params - The retention cutoff and page limit.
 * @returns Firestore query constraints for the expired page.
 *
 * @dbxModelFirebaseIndex
 * @dbxModelFirebaseIndexModel OpenRouterRunTask
 * @dbxModelFirebaseIndexScope COLLECTION
 * @dbxModelFirebaseIndexCategory cleanup
 */
export function openRouterRunTasksExpiredQuery(params: OpenRouterRunTasksExpiredQueryParams): FirestoreQueryConstraint[] {
  const { before, limit: pageLimit } = params;
  return [whereDateIsOnOrBefore<OpenRouterRunTask>('qat', before), orderBy<OpenRouterRunTask>('qat', 'asc'), limit(pageLimit)];
}
