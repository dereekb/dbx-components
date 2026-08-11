import { type GrantedReadRole, type GrantedUpdateRole } from '@dereekb/model';
import { type Maybe } from '@dereekb/util';
import { type OpenRouterFileAnnotation, type OpenRouterFileReference, type OpenRouterGenerationId, type OpenRouterInputMessage, type OpenRouterModelConfig, type OpenRouterPromptKey, type OpenRouterPromptVersionNumber, type OpenRouterRunError, type OpenRouterRunUsage } from '@dereekb/openrouter';
import { AbstractFirestoreDocument, type CollectionReference, type FirestoreCollection, type FirestoreContext, firestoreArray, firestoreDate, firestoreEnum, firestoreModelIdentity, firestoreNumber, firestoreString, optionalFirestoreArray, optionalFirestoreDate, optionalFirestoreField, optionalFirestoreNumber, optionalFirestoreString, snapshotConverterFunctions } from '@dereekb/firebase';

/**
 * Provides access to the {@link OpenRouterRunTask} collection.
 *
 * @dbxModelGroup OpenRouterRunTask
 */
export interface OpenRouterRunTaskFirestoreCollections {
  readonly openRouterRunTaskCollection: OpenRouterRunTaskFirestoreCollection;
}

/**
 * Union of all OpenRouterRunTask model identity types.
 */
export type OpenRouterRunTaskTypes = typeof openRouterRunTaskIdentity;

/**
 * Identity for {@link OpenRouterRunTask} documents. Collection name: `openRouterRunTask`, short code: `orrt`.
 */
export const openRouterRunTaskIdentity = firestoreModelIdentity('openRouterRunTask', 'orrt');

/**
 * State of an {@link OpenRouterRunTask}.
 */
export enum OpenRouterRunTaskState {
  /**
   * Enqueued and waiting for a sweep to claim it.
   */
  QUEUED = 0,
  /**
   * Claimed by a sweep and executing.
   *
   * A `RUNNING` document whose lease has gone stale is reclaimable — that is what makes a crashed
   * sweep recoverable instead of permanently stuck.
   */
  RUNNING = 1,
  /**
   * Finished successfully. `o` / `j` hold the result.
   */
  COMPLETE = 2,
  /**
   * Finished unsuccessfully, with the retry budget spent. `e` holds why.
   */
  FAILED = 3,
  /**
   * Paused mid-run waiting on a deferred tool result from another process.
   *
   * Resumable: the next sweep picks it up once `utr` carries the resolutions.
   */
  AWAITING_ASYNC_TOOLS = 4
}

/**
 * States a sweep considers claimable.
 */
export const OPENROUTER_RUN_TASK_CLAIMABLE_STATES: readonly OpenRouterRunTaskState[] = [OpenRouterRunTaskState.QUEUED, OpenRouterRunTaskState.AWAITING_ASYNC_TOOLS];

/**
 * States a run task will never leave.
 */
export const OPENROUTER_RUN_TASK_TERMINAL_STATES: readonly OpenRouterRunTaskState[] = [OpenRouterRunTaskState.COMPLETE, OpenRouterRunTaskState.FAILED];

/**
 * Whether a state is terminal.
 *
 * @param state - The state to check.
 * @returns True when the run will not change state again.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function isOpenRouterRunTaskStateTerminal(state: OpenRouterRunTaskState): boolean {
  return OPENROUTER_RUN_TASK_TERMINAL_STATES.includes(state);
}

/**
 * A pending deferred tool call, in persisted form.
 *
 * @dbxModelSubObject
 */
export interface OpenRouterRunTaskPendingToolCall {
  /**
   * The tool call id assigned by the SDK.
   */
  readonly callId: string;
  /**
   * The tool name.
   */
  readonly name: string;
  /**
   * The task id the resolving system quotes.
   */
  readonly taskId: string;
  /**
   * The arguments the model called with.
   */
  readonly arguments?: Maybe<Record<string, unknown>>;
}

/**
 * A tool result recorded but not yet sent to the model.
 *
 * @dbxModelSubObject
 */
export interface OpenRouterRunTaskUnsentToolResult {
  readonly callId: string;
  readonly name: string;
  readonly output?: unknown;
  readonly error?: Maybe<string>;
}

/**
 * One asynchronous OpenRouter run: both the queue entry and the conversation-state backend.
 *
 * There is deliberately only ONE model here rather than a queue document plus a conversation
 * document. OpenRouter is stateless — no `background: true`, no server-side job store, no
 * `previous_response_id` — so everything OpenAI kept on their side has to live somewhere on ours, and
 * splitting it across two documents would mean two writes to keep consistent on every state change
 * for no gain.
 *
 * The document id is the caller-supplied run key: the value stored wherever an OpenAI `responseId` is
 * stored today. Callers derive it deterministically so re-entering the checkpoint that enqueued the
 * run reuses this document instead of queueing a duplicate.
 *
 * @dbxModel
 * @dbxModelRead admin
 * @dbxModelUpdate admin
 */
export interface OpenRouterRunTask {
  /**
   * Current state.
   *
   * @dbxModelVariable state
   */
  s: OpenRouterRunTaskState;
  /**
   * Date this task was queued at. The sweep's secondary sort key, after priority.
   *
   * @dbxModelVariable queuedAt
   */
  qat: Date;
  /**
   * Date execution most recently started at.
   *
   * @dbxModelVariable startedAt
   */
  sat?: Maybe<Date>;
  /**
   * Date this task reached a terminal state at.
   *
   * @dbxModelVariable finishedAt
   */
  fat?: Maybe<Date>;
  /**
   * Date the current lease was taken at.
   *
   * A `RUNNING` task whose `lat` is older than the lease timeout is reclaimed by the next sweep. This
   * is the generalised replacement for ad-hoc "unstick anything that has been processing for over an
   * hour" logic.
   *
   * @dbxModelVariable leaseAt
   */
  lat?: Maybe<Date>;
  /**
   * Identifier of the sweep that holds the lease. Claiming is transactional, so two overlapping
   * sweeps can never both run one task.
   *
   * @dbxModelVariable leaseOwner
   */
  lo?: Maybe<string>;
  /**
   * Number of attempts made.
   *
   * @dbxModelVariable attempts
   */
  at: number;
  /**
   * Sweep priority. Lower runs first; absent sorts as the default priority.
   *
   * @dbxModelVariable priority
   */
  pr?: Maybe<number>;
  /**
   * Prompt this run uses.
   *
   * @dbxModelVariable promptKey
   */
  pk: OpenRouterPromptKey;
  /**
   * The resolved prompt version. Recorded rather than re-resolved so a retry cannot silently switch
   * prompt text mid-run, and so a replay reproduces the original call.
   *
   * @dbxModelVariable promptVersion
   */
  pv: OpenRouterPromptVersionNumber;
  /**
   * The call input. Also exactly what a replay re-enqueues.
   *
   * @dbxModelVariable input
   */
  in: OpenRouterInputMessage[];
  /**
   * Files to attach, as GCS object paths.
   *
   * NEVER signed URLs. A task can sit queued for a sweep interval, be retried, and (with deferred
   * tools) resume much later, so a URL minted at enqueue would 403 by the time it was used. The
   * sweeper signs each path fresh on every attempt.
   *
   * @dbxModelVariable files
   */
  fp?: Maybe<OpenRouterFileReference[]>;
  /**
   * Cached `file-parser` annotations, resubmitted on retries and chained calls so an already-parsed
   * PDF is not parsed again.
   *
   * @dbxModelVariable fileAnnotations
   */
  fa?: Maybe<OpenRouterFileAnnotation[]>;
  /**
   * Per-run overrides applied on top of the version's config. Passthrough JSON, for the same reason
   * the version's config is.
   *
   * @dbxModelVariable configOverrides
   */
  co?: Maybe<OpenRouterModelConfig>;
  /**
   * The output text.
   *
   * @dbxModelVariable outputText
   */
  o?: Maybe<string>;
  /**
   * The output parsed as JSON, when it parsed as an object.
   *
   * @dbxModelVariable outputJson
   */
  j?: Maybe<Record<string, unknown>>;
  /**
   * Generation ids produced, for auditing via `getGeneration` / `listGenerationContent`.
   *
   * Audit only. OpenRouter can reload a generation's content later, but that surface is tied to
   * account logging settings (nothing is retained under ZDR / logging-disabled) and its retention is
   * undocumented — so `o` / `j` here are the system of record, not those.
   *
   * @dbxModelVariable generationIds
   */
  gi?: Maybe<OpenRouterGenerationId[]>;
  /**
   * Token and cost usage.
   *
   * Written by the runner from the response, and refined later by the broadcast webhook — cost is
   * finalised server-side, so the runner's value can be provisional.
   *
   * @dbxModelVariable usage
   */
  u?: Maybe<OpenRouterRunUsage>;
  /**
   * Why the run failed.
   *
   * @dbxModelVariable error
   */
  e?: Maybe<OpenRouterRunError>;
  /**
   * Conversation history. This is what replaces `previous_response_id`, which OpenRouter rejects with
   * a 400 — continuing a conversation means resending its history.
   *
   * Only populated for multi-step or chained runs; a single-shot run leaves it empty.
   *
   * @dbxModelVariable messages
   */
  msg?: Maybe<OpenRouterInputMessage[]>;
  /**
   * Tool calls awaiting a result from another process. Only populated for deferred-tool runs.
   *
   * @dbxModelVariable pendingToolCalls
   */
  ptc?: Maybe<OpenRouterRunTaskPendingToolCall[]>;
  /**
   * Tool results recorded but not yet delivered to the model. Only populated for deferred-tool runs.
   *
   * @dbxModelVariable unsentToolResults
   */
  utr?: Maybe<OpenRouterRunTaskUnsentToolResult[]>;
  /**
   * When this task may be deleted.
   *
   * Not optional in spirit: `msg` grows without bound across a long chained conversation, so
   * something has to expire it.
   *
   * @dbxModelVariable expiresAt
   */
  x?: Maybe<Date>;
}

/**
 * Roles for an {@link OpenRouterRunTask}. Run tasks are server-owned infrastructure.
 */
export type OpenRouterRunTaskRoles = GrantedReadRole | GrantedUpdateRole;

export class OpenRouterRunTaskDocument extends AbstractFirestoreDocument<OpenRouterRunTask, OpenRouterRunTaskDocument, typeof openRouterRunTaskIdentity> {
  get modelIdentity() {
    return openRouterRunTaskIdentity;
  }
}

export const openRouterRunTaskConverter = snapshotConverterFunctions<OpenRouterRunTask>({
  fields: {
    s: firestoreEnum<OpenRouterRunTaskState>({ default: OpenRouterRunTaskState.QUEUED }),
    qat: firestoreDate({ saveDefaultAsNow: true }),
    sat: optionalFirestoreDate(),
    fat: optionalFirestoreDate(),
    lat: optionalFirestoreDate(),
    lo: optionalFirestoreString(),
    at: firestoreNumber({ default: 0 }),
    pr: optionalFirestoreNumber(),
    pk: firestoreString({ default: '' }),
    pv: firestoreNumber({ default: 0 }),
    in: firestoreArray<OpenRouterInputMessage>({}),
    fp: optionalFirestoreArray<OpenRouterFileReference>({ dontStoreIfEmpty: true }),
    fa: optionalFirestoreArray<OpenRouterFileAnnotation>({ dontStoreIfEmpty: true }),
    co: optionalFirestoreField<OpenRouterModelConfig>(),
    o: optionalFirestoreString(),
    j: optionalFirestoreField<Record<string, unknown>>(),
    gi: optionalFirestoreArray<OpenRouterGenerationId>({ filterUnique: true, dontStoreIfEmpty: true }),
    u: optionalFirestoreField<OpenRouterRunUsage>(),
    e: optionalFirestoreField<OpenRouterRunError>(),
    msg: optionalFirestoreArray<OpenRouterInputMessage>({ dontStoreIfEmpty: true }),
    ptc: optionalFirestoreArray<OpenRouterRunTaskPendingToolCall>({ dontStoreIfEmpty: true }),
    utr: optionalFirestoreArray<OpenRouterRunTaskUnsentToolResult>({ dontStoreIfEmpty: true }),
    x: optionalFirestoreDate()
  }
});

/**
 * Returns the root Firestore collection reference for {@link OpenRouterRunTask} documents.
 *
 * @param context - The FirestoreContext used to resolve the collection.
 * @returns A typed CollectionReference for the openRouterRunTask collection.
 */
export function openRouterRunTaskCollectionReference(context: FirestoreContext): CollectionReference<OpenRouterRunTask> {
  return context.collection(openRouterRunTaskIdentity.collectionName);
}

export type OpenRouterRunTaskFirestoreCollection = FirestoreCollection<OpenRouterRunTask, OpenRouterRunTaskDocument>;

/**
 * Creates the Firestore collection accessor for {@link OpenRouterRunTask} documents.
 *
 * @param firestoreContext - The FirestoreContext used to build the collection.
 * @returns An OpenRouterRunTaskFirestoreCollection.
 */
export function openRouterRunTaskFirestoreCollection(firestoreContext: FirestoreContext): OpenRouterRunTaskFirestoreCollection {
  return firestoreContext.firestoreCollection({
    modelIdentity: openRouterRunTaskIdentity,
    converter: openRouterRunTaskConverter,
    collection: openRouterRunTaskCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new OpenRouterRunTaskDocument(accessor, documentAccessor),
    firestoreContext
  });
}
