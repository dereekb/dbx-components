import { type GrantedReadRole, type GrantedUpdateRole } from '@dereekb/model';
import { MS_IN_DAY, type Maybe, type Milliseconds, filterOnlyUndefinedValues } from '@dereekb/util';
import { type OpenRouterFileAnnotation, type OpenRouterFileReference, type OpenRouterGenerationId, type OpenRouterInputMessage, type OpenRouterInputRole, type OpenRouterModelConfig, type OpenRouterPromptKey, type OpenRouterPromptVersionNumber, type OpenRouterResolvedPrompt, type OpenRouterRunError, type OpenRouterRunUsage } from '@dereekb/openrouter';
import {
  AbstractFirestoreDocument,
  type CollectionGroup,
  type CollectionReference,
  type FirestoreCollection,
  type FirestoreCollectionGroup,
  type FirestoreCollectionWithParent,
  type FirestoreContext,
  type FirestoreModelFieldMapFunctionsConfig,
  type FirestoreModelKey,
  firestoreArray,
  firestoreDate,
  firestoreEnum,
  firestoreModelIdentity,
  firestoreNumber,
  firestoreString,
  optionalFirestoreArray,
  optionalFirestoreDate,
  optionalFirestoreField,
  optionalFirestoreNumber,
  optionalFirestoreString,
  snapshotConverterFunctions
} from '@dereekb/firebase';
import { openRouterPromptVersionId } from './openrouter.prompt.id';

// MARK: OpenRouterPrompt
/**
 * Provides access to the {@link OpenRouterPrompt} collection and its version subcollection.
 *
 * @dbxModelGroup OpenRouterPrompt
 */
export interface OpenRouterPromptFirestoreCollections {
  readonly openRouterPromptCollection: OpenRouterPromptFirestoreCollection;
  readonly openRouterPromptVersionCollectionFactory: OpenRouterPromptVersionFirestoreCollectionFactory;
  readonly openRouterPromptVersionCollectionGroup: OpenRouterPromptVersionFirestoreCollectionGroup;
}

/**
 * Union of all OpenRouterPrompt model identity types.
 */
export type OpenRouterPromptTypes = typeof openRouterPromptIdentity | typeof openRouterPromptVersionIdentity;
/**
 * Identity for {@link OpenRouterPrompt} documents. Model type: `openRouterPrompt`, collection: `orp`.
 */
export const openRouterPromptIdentity = firestoreModelIdentity('openRouterPrompt', 'orp');

/**
 * Lifecycle state of an {@link OpenRouterPrompt}.
 */
export enum OpenRouterPromptState {
  /**
   * Created but not yet servable. A caller resolving this prompt gets an error rather than a guess.
   */
  DRAFT = 0,
  /**
   * Servable.
   */
  ACTIVE = 1,
  /**
   * Retired. Retained so historical runs stay explicable, but no longer servable.
   */
  ARCHIVED = 2
}

/**
 * A reusable prompt.
 *
 * This is the replacement for an OpenAI Prompt Object. The document id IS the prompt's key
 * (`kaia-resume-parser`), so a call site names the prompt in readable text instead of quoting an
 * opaque `pmpt_…`, and the content, model, reasoning effort, and output format live here rather than
 * in a vendor dashboard.
 *
 * The prompt document holds only identity and version pointers; everything servable lives on an
 * {@link OpenRouterPromptVersion}.
 *
 * @dbxModel
 * @dbxModelRead admin
 * @dbxModelUpdate admin
 */
export interface OpenRouterPrompt {
  /**
   * Date this prompt was created at.
   *
   * @dbxModelVariable createdAt
   */
  cat: Date;
  /**
   * Date this prompt was last updated at.
   *
   * @dbxModelVariable updatedAt
   */
  uat?: Maybe<Date>;
  /**
   * Human-readable name.
   *
   * @dbxModelVariable name
   */
  n: string;
  /**
   * What this prompt is for.
   *
   * @dbxModelVariable description
   */
  d?: Maybe<string>;
  /**
   * Lifecycle state.
   *
   * @dbxModelVariable state
   */
  s: OpenRouterPromptState;
  /**
   * Version served when a caller does not pin one.
   *
   * Absent until a version is published and promoted, which is what keeps an unfinished prompt from
   * being served by accident.
   *
   * @dbxModelVariable activeVersion
   */
  av?: Maybe<OpenRouterPromptVersionNumber>;
  /**
   * Highest version number allocated so far — the allocator for the next one.
   *
   * @dbxModelVariable latestVersion
   */
  lv: OpenRouterPromptVersionNumber;
  /**
   * Free-form tags for grouping.
   *
   * @dbxModelVariable tags
   */
  t?: Maybe<string[]>;
}

/**
 * Roles for an {@link OpenRouterPrompt}. Prompts are operational configuration, so reads and writes
 * are administrative.
 */
export type OpenRouterPromptRoles = GrantedReadRole | GrantedUpdateRole | 'publish';

export class OpenRouterPromptDocument extends AbstractFirestoreDocument<OpenRouterPrompt, OpenRouterPromptDocument, typeof openRouterPromptIdentity> {
  get modelIdentity() {
    return openRouterPromptIdentity;
  }
}

export const openRouterPromptConverter = snapshotConverterFunctions<OpenRouterPrompt>({
  fields: {
    cat: firestoreDate({ saveDefaultAsNow: true }),
    uat: optionalFirestoreDate(),
    n: firestoreString({ default: '' }),
    d: optionalFirestoreString(),
    s: firestoreEnum<OpenRouterPromptState>({ default: OpenRouterPromptState.DRAFT }),
    av: optionalFirestoreNumber(),
    lv: firestoreNumber({ default: 0 }),
    t: optionalFirestoreArray<string>({ filterUnique: true, dontStoreIfEmpty: true })
  }
});

/**
 * Returns the root Firestore collection reference for {@link OpenRouterPrompt} documents.
 *
 * @param context - The FirestoreContext used to resolve the collection.
 * @returns A typed CollectionReference for the openRouterPrompt collection.
 */
export function openRouterPromptCollectionReference(context: FirestoreContext): CollectionReference<OpenRouterPrompt> {
  return context.collection(openRouterPromptIdentity.collectionName);
}

export type OpenRouterPromptFirestoreCollection = FirestoreCollection<OpenRouterPrompt, OpenRouterPromptDocument>;

/**
 * Creates the Firestore collection accessor for {@link OpenRouterPrompt} documents.
 *
 * @param firestoreContext - The FirestoreContext used to build the collection.
 * @returns An OpenRouterPromptFirestoreCollection.
 */
export function openRouterPromptFirestoreCollection(firestoreContext: FirestoreContext): OpenRouterPromptFirestoreCollection {
  return firestoreContext.firestoreCollection({
    modelIdentity: openRouterPromptIdentity,
    converter: openRouterPromptConverter,
    collection: openRouterPromptCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new OpenRouterPromptDocument(accessor, documentAccessor),
    firestoreContext
  });
}

// MARK: OpenRouterPromptVersion
/**
 * Identity for {@link OpenRouterPromptVersion} documents. Subcollection of {@link OpenRouterPrompt}.
 * Model type: `openRouterPromptVersion`, collection: `orpv`.
 */
export const openRouterPromptVersionIdentity = firestoreModelIdentity(openRouterPromptIdentity, 'openRouterPromptVersion', 'orpv');

/**
 * A seed message stored on a version, in short-key persisted form.
 *
 * @dbxModelSubObject
 */
export interface OpenRouterPromptVersionMessage {
  /**
   * Message role.
   *
   * @dbxModelVariable role
   */
  r: OpenRouterInputRole;
  /**
   * Message content.
   *
   * @dbxModelVariable content
   */
  c: string;
}

/**
 * One published, immutable version of a prompt.
 *
 * Version pinning is the one thing OpenRouter Presets structurally cannot do — a preset always
 * resolves to latest — so it is the reason this model exists rather than deferring to a preset. A run
 * records the version it used, so a result is always traceable to the exact prompt text that produced
 * it, and a historical run can be replayed against that same text.
 *
 * Versions are treated as immutable once published: editing one would silently change the meaning of
 * every past run that cites it.
 *
 * @dbxModel
 * @dbxModelRead admin
 */
export interface OpenRouterPromptVersion {
  /**
   * Date this version was published at.
   *
   * @dbxModelVariable createdAt
   */
  cat: Date;
  /**
   * The version number. Matches the (unpadded) document id.
   *
   * @dbxModelVariable version
   */
  v: OpenRouterPromptVersionNumber;
  /**
   * System prompt.
   *
   * @dbxModelVariable instructions
   */
  i?: Maybe<string>;
  /**
   * Static seed messages, emitted before the caller's dynamic input.
   *
   * @dbxModelVariable messages
   */
  m?: Maybe<OpenRouterPromptVersionMessage[]>;
  /**
   * Model configuration.
   *
   * Stored as PASSTHROUGH JSON, deliberately not a strict converter. OpenRouter's parameter surface
   * moves fast, and a strict converter would silently drop any field it did not know about — turning
   * every OpenRouter release into a config-corrupting event. `OpenRouterModelConfig` types it in
   * TypeScript for autocomplete and call-time validation instead: strict types in code, loose storage.
   *
   * @dbxModelVariable config
   */
  c?: Maybe<OpenRouterModelConfig>;
  /**
   * Why this version was published.
   *
   * @dbxModelVariable notes
   */
  nt?: Maybe<string>;
  /**
   * Model key of whoever published it.
   *
   * @dbxModelVariable createdBy
   */
  by?: Maybe<FirestoreModelKey>;
}

/**
 * Roles for an {@link OpenRouterPromptVersion}. Versions are immutable once published, so there is no
 * update role.
 */
export type OpenRouterPromptVersionRoles = GrantedReadRole;

export class OpenRouterPromptVersionDocument extends AbstractFirestoreDocument<OpenRouterPromptVersion, OpenRouterPromptVersionDocument, typeof openRouterPromptVersionIdentity> {
  get modelIdentity() {
    return openRouterPromptVersionIdentity;
  }
}

export const openRouterPromptVersionConverter = snapshotConverterFunctions<OpenRouterPromptVersion>({
  fields: {
    cat: firestoreDate({ saveDefaultAsNow: true }),
    v: firestoreNumber({ default: 0 }),
    i: optionalFirestoreString(),
    m: optionalFirestoreArray<OpenRouterPromptVersionMessage>({ dontStoreIfEmpty: true }),
    c: optionalFirestoreField<OpenRouterModelConfig>(),
    nt: optionalFirestoreString(),
    by: optionalFirestoreString()
  }
});

/**
 * Creates a factory that produces {@link OpenRouterPromptVersion} subcollection references for a given
 * {@link OpenRouterPromptDocument} parent.
 *
 * @param context - Firestore context to create subcollection references from.
 * @returns A factory function that creates collection references for a given prompt parent.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function openRouterPromptVersionCollectionReferenceFactory(context: FirestoreContext): (prompt: OpenRouterPromptDocument) => CollectionReference<OpenRouterPromptVersion> {
  return (prompt: OpenRouterPromptDocument) => {
    return context.subcollection(prompt.documentRef, openRouterPromptVersionIdentity.collectionName);
  };
}

export type OpenRouterPromptVersionFirestoreCollection = FirestoreCollectionWithParent<OpenRouterPromptVersion, OpenRouterPrompt, OpenRouterPromptVersionDocument, OpenRouterPromptDocument>;
export type OpenRouterPromptVersionFirestoreCollectionFactory = (parent: OpenRouterPromptDocument) => OpenRouterPromptVersionFirestoreCollection;

/**
 * Creates an {@link OpenRouterPromptVersionFirestoreCollectionFactory} bound to the given context.
 *
 * @param firestoreContext - Firestore context to bind the collection factory to.
 * @returns A factory that creates typed subcollections for version documents.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function openRouterPromptVersionFirestoreCollectionFactory(firestoreContext: FirestoreContext): OpenRouterPromptVersionFirestoreCollectionFactory {
  const factory = openRouterPromptVersionCollectionReferenceFactory(firestoreContext);

  return (parent: OpenRouterPromptDocument) => {
    return firestoreContext.firestoreCollectionWithParent({
      modelIdentity: openRouterPromptVersionIdentity,
      converter: openRouterPromptVersionConverter,
      collection: factory(parent),
      makeDocument: (accessor, documentAccessor) => new OpenRouterPromptVersionDocument(accessor, documentAccessor),
      firestoreContext,
      parent
    });
  };
}

/**
 * Creates a collection group reference for querying every {@link OpenRouterPromptVersion} across all
 * prompts.
 *
 * @param context - Firestore context to create the collection group reference from.
 * @returns A typed collection group.
 */
export function openRouterPromptVersionCollectionReference(context: FirestoreContext): CollectionGroup<OpenRouterPromptVersion> {
  return context.collectionGroup(openRouterPromptVersionIdentity.collectionName);
}

export type OpenRouterPromptVersionFirestoreCollectionGroup = FirestoreCollectionGroup<OpenRouterPromptVersion, OpenRouterPromptVersionDocument>;

/**
 * Creates a typed {@link OpenRouterPromptVersionFirestoreCollectionGroup} bound to the given context.
 *
 * @param firestoreContext - Firestore context to bind the collection group to.
 * @returns A typed Firestore collection group.
 */
export function openRouterPromptVersionFirestoreCollectionGroup(firestoreContext: FirestoreContext): OpenRouterPromptVersionFirestoreCollectionGroup {
  return firestoreContext.firestoreCollectionGroup({
    modelIdentity: openRouterPromptVersionIdentity,
    converter: openRouterPromptVersionConverter,
    queryLike: openRouterPromptVersionCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new OpenRouterPromptVersionDocument(accessor, documentAccessor),
    firestoreContext
  });
}

// MARK: OpenRouterRunTask
/**
 * How long an OpenRouterRunTask lives before it is deleted, measured from `qat`.
 *
 * A design requirement rather than a tuning knob. NotificationTask already owns retrying, durable
 * persistence, and delayed execution, so a run task is a short-lived execution record — letting one
 * outlive a week would make it a second system of record with a second retention policy to reason about,
 * for no gain.
 *
 * Measured from `qat` rather than a per-task expiration field because there is nothing to configure:
 * a queued task runs essentially immediately, so its queue time IS its age. No field to forget to
 * write, no document excluded from the retention query for lacking one.
 */
export const OPENROUTER_RUN_TASK_MAX_AGE: Milliseconds = MS_IN_DAY * 7;

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
 * Identity for {@link OpenRouterRunTask} documents. Model type: `openRouterRunTask`, collection: `orrt`.
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
 *
 * `AWAITING_ASYNC_TOOLS` is in here alongside `QUEUED` because a task parked on a deferred tool whose
 * results have since arrived is runnable again; `isOpenRouterRunTaskClaimable` is what decides whether
 * the results actually did arrive.
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
   * Date this task was queued at. The sweep's ONLY sort key.
   *
   * WRITE-ONCE: set at enqueue and never moved, not even when a deferred-tool resume returns the task to
   * `QUEUED`. Two things depend on that. It is what makes `qat` a valid retention age — a rolling value
   * would let a task cycling through tool resolutions keep pushing its own age forward and never reach
   * {@link OPENROUTER_RUN_TASK_MAX_AGE}. And it is the more correct ORDER: a task that has been waiting on
   * a deferred tool since yesterday should be claimed before one queued a minute ago.
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
   * Prompt this run uses.
   *
   * @dbxModelVariable promptKey
   */
  pk: OpenRouterPromptKey;
  /**
   * The resolved prompt version. Recorded rather than re-resolved so a retry cannot silently switch
   * prompt text mid-run.
   *
   * @dbxModelVariable promptVersion
   */
  pv: OpenRouterPromptVersionNumber;
  /**
   * The call input.
   *
   * @dbxModelVariable input
   */
  in: OpenRouterInputMessage[];
  /**
   * Files to attach, as GCS object paths — never signed URLs. See {@link OpenRouterFileReference} for why.
   *
   * @dbxModelVariable files
   */
  fp?: Maybe<OpenRouterFileReference[]>;
  /**
   * Cached `file-parser` annotations, resubmitted on retries and chained calls so an already-parsed
   * PDF is not parsed again. See {@link OpenRouterFileAnnotation} for what a re-parse costs.
   *
   * @dbxModelVariable fileAnnotations
   */
  fa?: Maybe<OpenRouterFileAnnotation[]>;
  /**
   * Per-run overrides applied on top of the version's config. Passthrough JSON, for the reason
   * {@link OpenRouterModelConfig} states.
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

/**
 * An optional passthrough-JSON object field whose `undefined` values are stripped on the way in.
 *
 * This is the ONE place the constraint lives. Firestore rejects an explicit `undefined` outright, and
 * each of these fields is assembled from optional upstream values — a usage object built from whichever
 * token counts a response happened to report, a config a caller spread a `Maybe` into. Solved per-writer
 * it has to be remembered four times; solved here it cannot be forgotten.
 *
 * SHALLOW, deliberately: it covers the top-level keys of the object it is given. It does NOT reach into
 * a nested sub-object, and it does NOT apply to array element interiors — `msg` / `ptc` / `utr` carry
 * SDK-shaped JSON of arbitrary depth, which is what `openRouterConversationValueForFirestore` is for.
 *
 * `transformToData` rather than `transformData`: the latter is applied in both directions and would
 * deep-copy the field on every READ. With only the write direction set, reads are byte-identical to the
 * plain passthrough field.
 *
 * A top-level `null` still clears the field: `optionalFirestoreField` short-circuits `x == null` before
 * the transform runs, so `update({ e: null })` is untouched by this.
 *
 * @returns The field mapping config.
 *
 * @__NO_SIDE_EFFECTS__
 */
function optionalFirestorePassthroughJsonField<T extends object>(): FirestoreModelFieldMapFunctionsConfig<Maybe<T>, Maybe<T>> {
  return optionalFirestoreField<T>({ transformToData: filterOnlyUndefinedValues });
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
    pk: firestoreString({ default: '' }),
    pv: firestoreNumber({ default: 0 }),
    in: firestoreArray<OpenRouterInputMessage>({}),
    fp: optionalFirestoreArray<OpenRouterFileReference>({ dontStoreIfEmpty: true }),
    fa: optionalFirestoreArray<OpenRouterFileAnnotation>({ dontStoreIfEmpty: true }),
    co: optionalFirestorePassthroughJsonField<OpenRouterModelConfig>(),
    o: optionalFirestoreString(),
    j: optionalFirestorePassthroughJsonField<Record<string, unknown>>(),
    gi: optionalFirestoreArray<OpenRouterGenerationId>({ filterUnique: true, dontStoreIfEmpty: true }),
    u: optionalFirestorePassthroughJsonField<OpenRouterRunUsage>(),
    e: optionalFirestorePassthroughJsonField<OpenRouterRunError>(),
    msg: optionalFirestoreArray<OpenRouterInputMessage>({ dontStoreIfEmpty: true }),
    ptc: optionalFirestoreArray<OpenRouterRunTaskPendingToolCall>({ dontStoreIfEmpty: true }),
    utr: optionalFirestoreArray<OpenRouterRunTaskUnsentToolResult>({ dontStoreIfEmpty: true })
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

// MARK: Utility
/**
 * Converts a stored version document into the resolved prompt the request builder consumes.
 *
 * @param promptKey - The prompt key the version belongs to.
 * @param version - The stored version.
 * @returns The resolved prompt.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function openRouterResolvedPromptForVersion(promptKey: OpenRouterPromptKey, version: OpenRouterPromptVersion): OpenRouterResolvedPrompt {
  return {
    promptKey,
    version: version.v,
    instructions: version.i,
    messages: version.m?.map(({ r, c }) => ({ role: r, content: c })),
    config: version.c ?? {}
  };
}

/**
 * The document id of a version, from its number.
 *
 * Re-exported here so a caller reading a version does not need to reach for the id module separately.
 */
export const openRouterPromptVersionDocumentId = openRouterPromptVersionId;
