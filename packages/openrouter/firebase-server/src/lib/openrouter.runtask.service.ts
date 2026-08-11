import { type FirebaseStorageContext, type StoragePath } from '@dereekb/firebase';
import { type Maybe, type Milliseconds, MS_IN_MINUTE, type Seconds, addMilliseconds, filterMaybeArrayValues } from '@dereekb/util';
import {
  type OpenRouterCallResult,
  type OpenRouterCore,
  type OpenRouterDeferredToolResolution,
  type OpenRouterFileAnnotation,
  type OpenRouterFileReference,
  type OpenRouterInput,
  type OpenRouterInputMessage,
  type OpenRouterModelConfig,
  type OpenRouterPromptKey,
  type OpenRouterPromptVersionNumber,
  type OpenRouterRequestTrace,
  type OpenRouterRunTaskKey,
  type OpenRouterSignedFileReference,
  type Tool,
  callModelForOpenRouterRequest,
  openRouterFunctionCallOutputItems,
  openRouterInputMessages,
  openRouterPromptRequest
} from '@dereekb/openrouter';
import { type OpenRouterRunTask, type OpenRouterRunTaskDocument, type OpenRouterRunTaskFirestoreCollections, OpenRouterRunTaskState, openRouterRunTasksReclaimableQuery, openRouterRunTasksRunnableQuery } from '@dereekb/openrouter/firebase';
import { type OpenRouterPromptService } from './openrouter.prompt.service';
import { firestoreOpenRouterStateAccessor } from './openrouter.state.accessor';

/**
 * Default lifetime of a signed url minted for one attempt.
 *
 * Deliberately short. The url only has to survive the single request it is attached to, and every
 * attempt gets a freshly signed one — so a short TTL costs nothing and narrows the window in which a
 * third party holds a bearer credential to the object.
 */
export const OPENROUTER_DEFAULT_SIGNED_URL_TTL: Milliseconds = MS_IN_MINUTE * 5;

/**
 * Default lease duration. A `RUNNING` task whose lease is older than this is reclaimable.
 *
 * Comfortably longer than any single inference plus its retries, so a healthy run is never stolen from
 * itself, and short enough that a crashed sweep's work resumes on the next tick or two.
 */
export const OPENROUTER_DEFAULT_LEASE_DURATION: Milliseconds = MS_IN_MINUTE * 10;

/**
 * Default number of attempts before a task is marked FAILED.
 */
export const OPENROUTER_DEFAULT_MAX_ATTEMPTS = 3;

/**
 * Priority recorded on a task whose caller named none. Lower runs first.
 *
 * Written rather than left absent so a priority-ordered sweep behaves: `orderBy` puts a `null` ahead of
 * every number, so an unset priority would silently mean "run this before everything else" — the exact
 * inverse of what leaving it out is meant to say.
 */
export const OPENROUTER_DEFAULT_RUN_TASK_PRIORITY = 100;

/**
 * Params for enqueueing a run task.
 */
export interface OpenRouterEnqueueRunTaskParams {
  /**
   * The run key, which becomes the document id.
   *
   * Derive it deterministically (e.g. from the owning NotificationTask's model key) so re-entering the
   * checkpoint that enqueued the run reuses this document instead of queueing a duplicate.
   */
  readonly key: OpenRouterRunTaskKey;
  /**
   * The prompt to run.
   */
  readonly promptKey: OpenRouterPromptKey;
  /**
   * Version to pin. Omit to resolve the prompt's active version.
   */
  readonly version?: Maybe<OpenRouterPromptVersionNumber>;
  /**
   * The call input.
   */
  readonly input?: Maybe<OpenRouterInput>;
  /**
   * Files to attach, as GCS object paths. Never signed urls.
   */
  readonly files?: Maybe<OpenRouterFileReference[]>;
  /**
   * Per-run config overrides.
   */
  readonly configOverrides?: Maybe<OpenRouterModelConfig>;
  /**
   * Sweep priority. Lower runs first.
   */
  readonly priority?: Maybe<number>;
  /**
   * A prior run task to continue from — its history seeds this run's `msg`.
   *
   * This is what replaces `previous_response_id`, which OpenRouter rejects with a 400.
   */
  readonly continueFrom?: Maybe<OpenRouterRunTaskKey>;
  /**
   * When this task may be deleted. Defaults to the service's configured TTL.
   */
  readonly expiresAt?: Maybe<Date>;
  /**
   * Whether an existing document for this key is reset back to QUEUED.
   *
   * Defaults to false — the enqueue is IDEMPOTENT, so a re-entered checkpoint does not restart a run
   * that is already in flight or already finished.
   */
  readonly restart?: Maybe<boolean>;
}

/**
 * Result of enqueueing a run task.
 */
export interface OpenRouterEnqueueRunTaskResult {
  readonly key: OpenRouterRunTaskKey;
  readonly document: OpenRouterRunTaskDocument;
  /**
   * Whether a new document was written. False when an existing run was reused.
   */
  readonly created: boolean;
  readonly task: OpenRouterRunTask;
}

/**
 * Params for claiming run tasks.
 */
export interface OpenRouterClaimRunTasksParams {
  /**
   * Maximum number of tasks to claim.
   */
  readonly limit: number;
  /**
   * Identifier recorded as the lease owner.
   */
  readonly leaseOwner: string;
  /**
   * Lease duration. Defaults to {@link OPENROUTER_DEFAULT_LEASE_DURATION}.
   */
  readonly leaseDuration?: Maybe<Milliseconds>;
  /**
   * Whether tasks are ordered by priority before queue time.
   *
   * Defaults to false. Every enqueued task carries a `pr` ({@link OPENROUTER_DEFAULT_RUN_TASK_PRIORITY}
   * when the caller names none), but a task written by any other route may not — and a `null` priority
   * sorts BEFORE every number, so such a task would jump the whole queue.
   */
  readonly usePriorityOrder?: Maybe<boolean>;
}

/**
 * Params for resolving a deferred tool call.
 */
export interface OpenRouterResolveDeferredToolParams {
  /**
   * The run task holding the pending call.
   */
  readonly key: OpenRouterRunTaskKey;
  /**
   * The task id the pending call was registered under.
   */
  readonly taskId: string;
  /**
   * The successful output, when the task succeeded.
   */
  readonly output?: unknown;
  /**
   * The error, when it did not.
   */
  readonly error?: Maybe<string>;
}

/**
 * Result of resolving a deferred tool call.
 */
export interface OpenRouterResolveDeferredToolResult {
  /**
   * Whether a pending call matched and was resolved.
   *
   * False for a replayed or already-settled resolution. That is a no-op, not an error — resolutions
   * arrive from outside this process and can be delivered more than once.
   */
  readonly resolved: boolean;
  /**
   * Whether every pending call is now resolved, so the run is ready to continue.
   */
  readonly ready: boolean;
}

/**
 * Result of running one task.
 */
export interface OpenRouterRunTaskExecutionResult {
  readonly key: OpenRouterRunTaskKey;
  readonly state: OpenRouterRunTaskState;
  readonly result?: Maybe<OpenRouterCallResult>;
  readonly error?: Maybe<unknown>;
}

/**
 * Manages the app-owned run-task queue: the replacement for OpenAI's `background: true` plus its
 * server-side job store, neither of which OpenRouter has.
 */
export abstract class OpenRouterRunTaskService {
  /**
   * Writes one QUEUED document and returns. Nothing blocks on inference.
   */
  abstract enqueueRunTask(params: OpenRouterEnqueueRunTaskParams): Promise<OpenRouterEnqueueRunTaskResult>;
  /**
   * Reads a run task by key.
   */
  abstract readRunTask(key: OpenRouterRunTaskKey): Promise<Maybe<OpenRouterRunTask>>;
  /**
   * Loads a run task document by key.
   */
  abstract runTaskDocument(key: OpenRouterRunTaskKey): OpenRouterRunTaskDocument;
  /**
   * Claims up to `limit` runnable tasks by lease, transactionally.
   *
   * Claiming in a transaction is what makes two overlapping sweeps safe: only one can move a document
   * out of QUEUED, so a task is never executed twice.
   */
  abstract claimNextRunTasks(params: OpenRouterClaimRunTasksParams): Promise<OpenRouterRunTaskDocument[]>;
  /**
   * Executes one already-claimed task and writes its result.
   */
  abstract executeRunTask(document: OpenRouterRunTaskDocument): Promise<OpenRouterRunTaskExecutionResult>;
  /**
   * Delivers a deferred tool result from another process.
   */
  abstract resolveDeferredTool(params: OpenRouterResolveDeferredToolParams): Promise<OpenRouterResolveDeferredToolResult>;
  /**
   * Re-enqueues a historical run against its stored input and config.
   */
  abstract replayRunTask(key: OpenRouterRunTaskKey, replayKey?: Maybe<OpenRouterRunTaskKey>): Promise<OpenRouterEnqueueRunTaskResult>;
  /**
   * Signs the files of a task for one attempt. Exposed for tests, which is where the
   * "does a retry get a NEW url" question actually gets answered.
   */
  abstract signFilesForAttempt(files: Maybe<OpenRouterFileReference[]>): Promise<OpenRouterSignedFileReference[]>;
}

/**
 * Notified when a run task reaches a terminal state.
 *
 * This is the in-process replacement for OpenAI's completion webhook: because we hold the HTTP
 * connection during inference, the runner already knows the moment a run finishes, so it can advance
 * the owning work directly. No inbound round-trip, nothing to authenticate, and impossible to miss.
 */
export type OpenRouterRunTaskTerminalStateHandler = (document: OpenRouterRunTaskDocument, result: OpenRouterRunTaskExecutionResult) => Promise<void>;

/**
 * Config for {@link openRouterRunTaskService}.
 */
export interface OpenRouterRunTaskServiceConfig {
  /**
   * The run task collections.
   */
  readonly collections: OpenRouterRunTaskFirestoreCollections;
  /**
   * The prompt service used to resolve a run's prompt version.
   */
  readonly promptService: OpenRouterPromptService;
  /**
   * The OpenRouter client.
   */
  readonly client: OpenRouterCore;
  /**
   * Storage context used to sign file urls. Required only when tasks carry files.
   */
  readonly storageContext?: Maybe<FirebaseStorageContext>;
  /**
   * Client-side tools available to every run. Manual (`execute: false`) tools here are what produce a
   * deferred pause.
   */
  readonly tools?: Maybe<readonly Tool[]>;
  /**
   * Called when a run reaches a terminal state.
   */
  readonly onTerminalState?: Maybe<OpenRouterRunTaskTerminalStateHandler>;
  /**
   * Signed-url lifetime. Defaults to {@link OPENROUTER_DEFAULT_SIGNED_URL_TTL}.
   */
  readonly signedUrlTtl?: Maybe<Milliseconds>;
  /**
   * Attempts before a task is FAILED. Defaults to {@link OPENROUTER_DEFAULT_MAX_ATTEMPTS}.
   */
  readonly maxAttempts?: Maybe<number>;
  /**
   * Default lease duration. Defaults to {@link OPENROUTER_DEFAULT_LEASE_DURATION}.
   */
  readonly leaseDuration?: Maybe<Milliseconds>;
  /**
   * Default time-to-live for a new run task, in seconds. Omit for no expiration.
   *
   * Worth setting: `msg` grows without bound across a long chained conversation.
   */
  readonly defaultTtlSeconds?: Maybe<Seconds>;
}

/**
 * Creates an {@link OpenRouterRunTaskService}.
 *
 * @param config - The collections, prompt service, client, and execution settings.
 * @returns The service.
 */
export function openRouterRunTaskService(config: OpenRouterRunTaskServiceConfig): OpenRouterRunTaskService {
  const { collections, promptService, client, storageContext, tools, onTerminalState, signedUrlTtl, maxAttempts: inputMaxAttempts, leaseDuration: inputLeaseDuration, defaultTtlSeconds } = config;
  const { openRouterRunTaskCollection } = collections;

  const urlTtl = signedUrlTtl ?? OPENROUTER_DEFAULT_SIGNED_URL_TTL;
  const maxAttempts = inputMaxAttempts ?? OPENROUTER_DEFAULT_MAX_ATTEMPTS;
  const defaultLeaseDuration = inputLeaseDuration ?? OPENROUTER_DEFAULT_LEASE_DURATION;

  function runTaskDocument(key: OpenRouterRunTaskKey): OpenRouterRunTaskDocument {
    return openRouterRunTaskCollection.documentAccessor().loadDocumentForId(key);
  }

  async function readRunTask(key: OpenRouterRunTaskKey): Promise<Maybe<OpenRouterRunTask>> {
    return runTaskDocument(key).snapshotData();
  }

  async function signFilesForAttempt(files: Maybe<OpenRouterFileReference[]>): Promise<OpenRouterSignedFileReference[]> {
    let result: OpenRouterSignedFileReference[] = [];

    if (files != null && files.length > 0) {
      if (storageContext == null) {
        throw new Error('An OpenRouterRunTask carries files but the OpenRouterRunTaskService has no storageContext to sign them with.');
      }

      const defaultBucketId = storageContext.defaultBucket();

      result = await Promise.all(
        files.map(async (file) => {
          const path: StoragePath = { bucketId: file.bucket ?? defaultBucketId, pathString: file.storagePath };
          const accessorFile = storageContext.file(path);

          if (accessorFile.getSignedUrl == null) {
            throw new Error('The configured FirebaseStorageContext cannot mint signed urls.');
          }

          const signedUrl = await accessorFile.getSignedUrl({ action: 'read', expiresIn: urlTtl });
          return { file, signedUrl };
        })
      );
    }

    return result;
  }

  async function enqueueRunTask(params: OpenRouterEnqueueRunTaskParams): Promise<OpenRouterEnqueueRunTaskResult> {
    const { key, promptKey, version, input, files, configOverrides, priority, continueFrom, expiresAt, restart } = params;
    const document = runTaskDocument(key);
    const existing = await document.snapshotData();

    let created: boolean;
    let task: OpenRouterRunTask;

    if (existing != null && !restart) {
      created = false;
      task = existing;
    } else {
      // The version is resolved and RECORDED at enqueue time, not at dispatch: a retry hours later must
      // reproduce the same prompt text, and a promotion in between must not silently change what a
      // queued run is going to say.
      const resolved = await promptService.resolvePrompt({ promptKey, version });
      const history = continueFrom == null ? undefined : await historyForRunTask(continueFrom);
      const queuedAt = new Date();

      task = {
        s: OpenRouterRunTaskState.QUEUED,
        qat: queuedAt,
        at: 0,
        pr: priority ?? OPENROUTER_DEFAULT_RUN_TASK_PRIORITY,
        pk: promptKey,
        pv: resolved.version,
        in: openRouterInputMessages(input),
        fp: files,
        co: configOverrides,
        msg: history,
        x: expiresAt ?? (defaultTtlSeconds == null ? undefined : addMilliseconds(queuedAt, defaultTtlSeconds * 1000))
      };

      created = true;
      await document.accessor.set(task);
    }

    return { key, document, created, task };
  }

  async function historyForRunTask(key: OpenRouterRunTaskKey): Promise<Maybe<OpenRouterInputMessage[]>> {
    const prior = await readRunTask(key);
    let result: Maybe<OpenRouterInputMessage[]>;

    if (prior != null) {
      // Prefer the recorded conversation history; a single-shot prior run has none, in which case its
      // input plus its output text is the history.
      if (prior.msg != null && prior.msg.length > 0) {
        result = prior.msg;
      } else {
        const messages: OpenRouterInputMessage[] = [...(prior.in ?? [])];

        if (prior.o) {
          messages.push({ role: 'assistant', content: prior.o });
        }

        result = messages.length > 0 ? messages : undefined;
      }
    }

    return result;
  }

  async function claimNextRunTasks(params: OpenRouterClaimRunTasksParams): Promise<OpenRouterRunTaskDocument[]> {
    const { limit: pageLimit, leaseOwner, leaseDuration, usePriorityOrder } = params;
    const now = new Date();
    const leaseCutoff = addMilliseconds(now, -(leaseDuration ?? defaultLeaseDuration));

    // Two queries rather than one. "QUEUED or resumable" and "RUNNING with a stale lease" cannot share a
    // single Firestore query — the second needs an inequality on `lat`, and Firestore allows the range
    // filter on only one field, which the ordering must then lead with. Each query has its own index.
    const [runnable, reclaimable] = await Promise.all([openRouterRunTaskCollection.queryDocument(openRouterRunTasksRunnableQuery({ limit: pageLimit, usePriorityOrder: usePriorityOrder ?? false })).getDocs(), openRouterRunTaskCollection.queryDocument(openRouterRunTasksReclaimableQuery({ limit: pageLimit, leaseCutoff })).getDocs()]);

    const candidates = new Map<string, OpenRouterRunTaskDocument>();
    [...runnable, ...reclaimable].forEach((document) => candidates.set(document.id, document));

    const claimed = await Promise.all(
      Array.from(candidates.values())
        .slice(0, pageLimit)
        .map((document) => claimRunTask(document, leaseOwner, now, leaseCutoff))
    );

    return filterMaybeArrayValues(claimed);
  }

  async function claimRunTask(document: OpenRouterRunTaskDocument, leaseOwner: string, now: Date, leaseCutoff: Date): Promise<Maybe<OpenRouterRunTaskDocument>> {
    return openRouterRunTaskCollection.firestoreContext.runTransaction(async (transaction) => {
      const transactionDocument = runTaskDocumentInTransaction(document, transaction);
      const task = await transactionDocument.snapshotData();
      let result: Maybe<OpenRouterRunTaskDocument>;

      if (task != null && isOpenRouterRunTaskClaimable(task, leaseCutoff)) {
        await transactionDocument.update({ s: OpenRouterRunTaskState.RUNNING, sat: now, lat: now, lo: leaseOwner, at: task.at + 1 });
        result = document;
      }

      return result;
    });
  }

  function runTaskDocumentInTransaction(document: OpenRouterRunTaskDocument, transaction: Parameters<Parameters<typeof openRouterRunTaskCollection.firestoreContext.runTransaction>[0]>[0]): OpenRouterRunTaskDocument {
    return openRouterRunTaskCollection.documentAccessorForTransaction(transaction).loadDocumentFrom(document);
  }

  async function executeRunTask(document: OpenRouterRunTaskDocument): Promise<OpenRouterRunTaskExecutionResult> {
    const key = document.id;
    const task = await document.snapshotData();
    let executionResult: OpenRouterRunTaskExecutionResult;

    if (task == null) {
      executionResult = { key, state: OpenRouterRunTaskState.FAILED, error: new Error('The run task no longer exists.') };
    } else {
      executionResult = await executeRunTaskData(document, task);
    }

    if (onTerminalState != null && (executionResult.state === OpenRouterRunTaskState.COMPLETE || executionResult.state === OpenRouterRunTaskState.FAILED)) {
      await onTerminalState(document, executionResult);
    }

    return executionResult;
  }

  async function executeRunTaskData(document: OpenRouterRunTaskDocument, task: OpenRouterRunTask): Promise<OpenRouterRunTaskExecutionResult> {
    const key = document.id;
    let executionResult: OpenRouterRunTaskExecutionResult;

    try {
      const resolved = await promptService.resolvePrompt({ promptKey: task.pk, version: task.pv });
      // Signed fresh on EVERY attempt. A url minted at enqueue would 403 by the time a third retry ran.
      const signedFiles = await signFilesForAttempt(task.fp);
      const hasTools = tools != null && tools.length > 0;

      const request = openRouterPromptRequest({
        prompt: resolved,
        input: task.in,
        overrides: task.co,
        files: signedFiles,
        fileAnnotations: task.fa,
        // With tools in play the conversation lives in the state accessor, which appends to it across
        // turns; passing it here as well would send every prior turn twice.
        history: hasTools ? undefined : task.msg,
        trace: { runTaskKey: key } satisfies OpenRouterRequestTrace
      });

      if (hasTools) {
        await appendDeferredToolResultsToConversation(document, task);
      }

      const result = await callModelForOpenRouterRequest({
        client,
        // The whole conversation is supplied through the state accessor, so the request carries no input
        // of its own — the SDK appends `input` to the loaded state, and the seeded state already is it.
        request: hasTools ? { ...request, input: [] } : request,
        tools: tools ?? undefined,
        // The state accessor is only wired when tools are in play. For a single-shot run it would write
        // conversation history nobody reads, and on a doc whose state the runner is about to set anyway.
        state: hasTools ? firestoreOpenRouterStateAccessor(document, { initialMessages: request.input, signedFiles }) : undefined
      });

      // Re-read: with tools configured, the state accessor may have moved the document to
      // AWAITING_ASYNC_TOOLS mid-call, and that must not be overwritten with COMPLETE.
      const afterCall = hasTools ? await document.snapshotData() : task;
      const pausedForTools = afterCall?.s === OpenRouterRunTaskState.AWAITING_ASYNC_TOOLS;
      const finishedAt = new Date();

      if (pausedForTools) {
        await document.update({ lat: null, lo: null });
        executionResult = { key, state: OpenRouterRunTaskState.AWAITING_ASYNC_TOOLS, result };
      } else if (result.error == null) {
        await document.update({
          s: OpenRouterRunTaskState.COMPLETE,
          fat: finishedAt,
          o: result.outputText,
          j: result.outputJson,
          gi: mergedGenerationIds(task.gi, result.generationIds),
          u: result.usage,
          e: null,
          lat: null,
          lo: null
        });
        executionResult = { key, state: OpenRouterRunTaskState.COMPLETE, result };
      } else {
        executionResult = await recordFailure(document, task, result.error, finishedAt, result);
      }
    } catch (e) {
      executionResult = await recordFailure(document, task, { code: openRouterErrorCode(e), message: openRouterErrorMessage(e) }, new Date());
      executionResult = { ...executionResult, error: e };
    }

    return executionResult;
  }

  /**
   * Folds resolved deferred-tool results into the persisted conversation, so the resumed call sends the
   * model the answers it was waiting on.
   *
   * Done here rather than through the SDK because `@openrouter/sdk@1.2.x` has no route back in for a
   * result produced by another process: its only resume path re-runs the tool locally (a manual tool has
   * no `execute`) or rejects it. Appending the `function_call_output` items to the conversation and
   * re-sending it is the same thing the SDK would have put on the wire, minus the API it does not have.
   *
   * A no-op unless every pending call has a recorded result — a partially-resolved run has nothing new
   * to say and must stay parked.
   */
  async function appendDeferredToolResultsToConversation(document: OpenRouterRunTaskDocument, task: OpenRouterRunTask): Promise<void> {
    const pending = task.ptc ?? [];
    const unsent = task.utr ?? [];
    const allResolved = pending.length > 0 && pending.every((call) => unsent.some((result) => result.callId === call.callId));

    if (allResolved) {
      const outputItems = openRouterFunctionCallOutputItems(unsent);
      await document.update({ msg: [...(task.msg ?? []), ...(outputItems as unknown as OpenRouterInputMessage[])], ptc: null, utr: null });
    }
  }

  async function recordFailure(document: OpenRouterRunTaskDocument, task: OpenRouterRunTask, error: { code?: Maybe<string>; message?: Maybe<string> }, at: Date, result?: Maybe<OpenRouterCallResult>): Promise<OpenRouterRunTaskExecutionResult> {
    // The attempt counter was already incremented by the claim, so `at` is the number of attempts made
    // INCLUDING this one — which is why nothing is added to it here. Adding one would spend the budget a
    // tick early and mark a task FAILED with a retry still owed to it.
    const attemptsExhausted = task.at >= maxAttempts;
    const state = attemptsExhausted ? OpenRouterRunTaskState.FAILED : OpenRouterRunTaskState.QUEUED;

    await document.update({
      s: state,
      // Releasing the lease is what makes the task claimable again on the next sweep.
      lat: null,
      lo: null,
      fat: attemptsExhausted ? at : null,
      e: error,
      gi: result == null ? undefined : mergedGenerationIds(task.gi, result.generationIds),
      u: result?.usage
    });

    return { key: document.id, state, result };
  }

  async function resolveDeferredTool(params: OpenRouterResolveDeferredToolParams): Promise<OpenRouterResolveDeferredToolResult> {
    const { key, taskId, output, error } = params;

    return openRouterRunTaskCollection.firestoreContext.runTransaction(async (transaction) => {
      const document = openRouterRunTaskCollection.documentAccessorForTransaction(transaction).loadDocumentForId(key);
      const task = await document.snapshotData();
      let result: OpenRouterResolveDeferredToolResult = { resolved: false, ready: false };

      if (task != null) {
        const pending = task.ptc ?? [];
        const call = pending.find((x) => x.taskId === taskId);
        const alreadySettled = (task.utr ?? []).some((x) => pending.every((p) => p.callId !== x.callId) || x.callId === call?.callId);

        if (call != null && !alreadySettled) {
          // `error` and `output` are spread conditionally rather than assigned: Firestore rejects an
          // explicit `undefined` outright, and a success carries no error while a failure carries no
          // output, so one of the two is always absent.
          const unsent = [...(task.utr ?? []), { callId: call.callId, name: call.name, ...(output === undefined ? undefined : { output }), ...(error == null ? undefined : { error }) }];
          const ready = pending.every((p) => unsent.some((u) => u.callId === p.callId));

          await document.update({ utr: unsent, ...(ready ? { s: OpenRouterRunTaskState.QUEUED, qat: new Date() } : undefined) });
          result = { resolved: true, ready };
        }
      }

      return result;
    });
  }

  async function replayRunTask(key: OpenRouterRunTaskKey, replayKey?: Maybe<OpenRouterRunTaskKey>): Promise<OpenRouterEnqueueRunTaskResult> {
    const task = await readRunTask(key);

    if (task == null) {
      throw new Error(`Cannot replay OpenRouterRunTask "${key}": it does not exist.`);
    }

    return enqueueRunTask({
      key: replayKey ?? `${key}_replay_${Date.now()}`,
      promptKey: task.pk,
      // Pinned to the ORIGINAL version: a replay that silently used a newer prompt would not be a replay.
      version: task.pv,
      input: task.in,
      files: task.fp,
      configOverrides: task.co,
      priority: task.pr,
      restart: true
    });
  }

  return { enqueueRunTask, readRunTask, runTaskDocument, claimNextRunTasks, executeRunTask, resolveDeferredTool, replayRunTask, signFilesForAttempt };
}

/**
 * Whether a task may be claimed by a sweep running at the given lease cutoff.
 *
 * A `RUNNING` task is claimable exactly when its lease has gone stale — that is crash recovery, and it
 * generalises the ad-hoc "unstick anything processing for over an hour" logic it replaces.
 *
 * @param task - The task to check.
 * @param leaseCutoff - Leases taken at or before this date are stale.
 * @returns True when the task may be claimed.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function isOpenRouterRunTaskClaimable(task: OpenRouterRunTask, leaseCutoff: Date): boolean {
  let result: boolean;

  switch (task.s) {
    case OpenRouterRunTaskState.QUEUED:
      result = true;
      break;
    case OpenRouterRunTaskState.RUNNING:
      result = task.lat == null || task.lat.getTime() <= leaseCutoff.getTime();
      break;
    case OpenRouterRunTaskState.AWAITING_ASYNC_TOOLS:
      // Only once every pending call has a recorded result; otherwise there is nothing new to send.
      result = (task.ptc ?? []).every((call) => (task.utr ?? []).some((unsent) => unsent.callId === call.callId));
      break;
    default:
      result = false;
      break;
  }

  return result;
}

/**
 * Merges newly-produced generation ids into the stored list.
 *
 * Appends rather than replaces: a retried task produced real generations on its earlier attempts too,
 * and those are exactly what an audit of a flaky run needs.
 *
 * @param existing - Already-stored ids.
 * @param produced - Ids produced by this attempt.
 * @returns The merged list.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function mergedGenerationIds(existing: Maybe<string[]>, produced: Maybe<string[]>): string[] {
  return Array.from(new Set([...(existing ?? []), ...(produced ?? [])]));
}

/**
 * Extracts an error code from a thrown value.
 *
 * @param e - The thrown value.
 * @returns The code, when one is discernible.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function openRouterErrorCode(e: unknown): Maybe<string> {
  let result: Maybe<string>;

  if (e != null && typeof e === 'object') {
    const candidate = (e as { code?: unknown; name?: unknown }).code ?? (e as { name?: unknown }).name;

    if (candidate != null) {
      result = String(candidate);
    }
  }

  return result;
}

/**
 * Extracts an error message from a thrown value.
 *
 * @param e - The thrown value.
 * @returns The message.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function openRouterErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * The deferred-tool resolutions recorded on a task, in the form the core package's resolver consumes.
 *
 * @param task - The run task.
 * @returns The resolutions.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function openRouterDeferredToolResolutionsForRunTask(task: OpenRouterRunTask): OpenRouterDeferredToolResolution[] {
  const pending = task.ptc ?? [];

  return filterMaybeArrayValues(
    (task.utr ?? []).map((unsent) => {
      const call = pending.find((x) => x.callId === unsent.callId);
      let result: Maybe<OpenRouterDeferredToolResolution>;

      if (call != null) {
        result = unsent.error == null ? { taskId: call.taskId, output: unsent.output } : { taskId: call.taskId, error: unsent.error };
      }

      return result;
    })
  );
}

/**
 * The cached file annotations of a task, for resubmission on a retry or a chained call.
 *
 * @param task - The run task.
 * @returns The annotations.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function openRouterFileAnnotationsForRunTask(task: OpenRouterRunTask): Maybe<OpenRouterFileAnnotation[]> {
  return task.fa;
}
