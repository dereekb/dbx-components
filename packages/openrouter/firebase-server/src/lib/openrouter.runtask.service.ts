import { type FirebaseStorageContext } from '@dereekb/firebase';
import { type FirebaseServerEnvService } from '@dereekb/firebase-server';
import { type Maybe, type Milliseconds, MS_IN_MINUTE, addMilliseconds, concatArraysUnique, filterMaybeArrayValues, filterUndefinedValues, filterUniqueValues, mergeArrays } from '@dereekb/util';
import {
  type OpenRouterAttachedFileReference,
  type OpenRouterCallResult,
  type OpenRouterCore,
  type OpenRouterDeferredToolResolution,
  type OpenRouterFileReference,
  type OpenRouterInput,
  type OpenRouterInputMessage,
  type OpenRouterModelConfig,
  type OpenRouterPromptKey,
  type OpenRouterPromptVersionNumber,
  type OpenRouterRequestTrace,
  type OpenRouterRunError,
  type OpenRouterRunTaskKey,
  type Tool,
  callModelForOpenRouterRequest,
  openRouterFunctionCallOutputItems,
  openRouterInputMessages,
  openRouterPromptRequest
} from '@dereekb/openrouter';
import { OPENROUTER_RUN_TASK_MAX_AGE, type OpenRouterRunTask, type OpenRouterRunTaskDocument, type OpenRouterRunTaskFirestoreCollections, type OpenRouterRunTaskPendingToolCall, OpenRouterRunTaskState, type OpenRouterRunTaskUnsentToolResult, isOpenRouterRunTaskStateTerminal, openRouterRunTasksExpiredQuery, openRouterRunTasksReclaimableQuery, openRouterRunTasksRunnableQuery } from '@dereekb/openrouter/firebase';
import { type OpenRouterFileAttachmentMode, openRouterFileAttachmentResolver } from './openrouter.file.attachment';
import { OpenRouterPromptResolutionError, type OpenRouterPromptService } from './openrouter.prompt.service';
import { firestoreOpenRouterStateAccessor } from './openrouter.state.accessor';

/**
 * Default lease duration. A `RUNNING` task whose lease is older than this is reclaimable.
 *
 * Comfortably longer than any single inference plus its retries, so a healthy run is never stolen from
 * itself, and short enough that a crashed sweep's work resumes on the next tick or two.
 */
export const DEFAULT_OPENROUTER_LEASE_DURATION: Milliseconds = MS_IN_MINUTE * 10;

/**
 * Default number of attempts before a task is marked FAILED.
 *
 * Spent only on a failure {@link isRetryableOpenRouterError} classifies as transient; a deterministic
 * failure reaches `FAILED` on its first attempt.
 */
export const DEFAULT_OPENROUTER_MAX_ATTEMPTS = 3;

/**
 * Maximum tasks one retention page may delete.
 *
 * A page's deletes go out as a single Firestore write batch, and a batch takes at most 500 writes.
 */
export const OPENROUTER_MAX_EXPIRED_RUN_TASK_DELETE_PAGE_SIZE = 500;

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
   * A prior run task to continue from — its history seeds this run's `msg`.
   *
   * This is what replaces `previous_response_id`, which OpenRouter rejects with a 400.
   */
  readonly continueFrom?: Maybe<OpenRouterRunTaskKey>;
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
   * Lease duration. Defaults to {@link DEFAULT_OPENROUTER_LEASE_DURATION}.
   */
  readonly leaseDuration?: Maybe<Milliseconds>;
}

/**
 * Params for deleting the run tasks past their retention age.
 */
export interface OpenRouterDeleteExpiredRunTasksParams {
  /**
   * Maximum number of tasks to delete. Clamped to {@link OPENROUTER_MAX_EXPIRED_RUN_TASK_DELETE_PAGE_SIZE}.
   */
  readonly limit: number;
  /**
   * Tasks queued at or before this date are deleted. Defaults to `now - OPENROUTER_RUN_TASK_MAX_AGE`.
   *
   * A parameter rather than always-derived so a sweep can pin one cutoff across every page of a run, and
   * so a test can assert against a fixed clock.
   */
  readonly before?: Maybe<Date>;
}

/**
 * Result of one retention page.
 */
export interface OpenRouterDeleteExpiredRunTasksResult {
  readonly deleted: number;
  /**
   * The keys deleted — once the document is gone this is the only record the run existed.
   */
  readonly keys: OpenRouterRunTaskKey[];
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
   * Deletes one page of run tasks older than {@link OPENROUTER_RUN_TASK_MAX_AGE}, in every state.
   */
  abstract deleteExpiredRunTasks(params: OpenRouterDeleteExpiredRunTasksParams): Promise<OpenRouterDeleteExpiredRunTasksResult>;
  /**
   * Resolves the files of a task into the attachments for one attempt. Exposed for tests, which is
   * where the "does a retry get a NEW url" question actually gets answered.
   */
  abstract attachFilesForAttempt(files: Maybe<OpenRouterFileReference[]>): Promise<OpenRouterAttachedFileReference[]>;
}

/**
 * Notified when a run task reaches a terminal state.
 *
 * This is the in-process replacement for OpenAI's completion webhook: because we hold the HTTP
 * connection during inference, the runner already knows the moment a run finishes, so it can advance
 * the owning work directly. No inbound round-trip, nothing to authenticate, and impossible to miss.
 *
 * A handler MUST NOT write to the run task document. It is still invoked with `FAILED` for a task the
 * retention sweep deleted mid-flight — correctly, since the owning NotificationTask has to learn the run
 * is not coming — and by then there is no document left to update.
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
   * Storage context used to read/sign the files of a task. Required only when tasks carry files.
   */
  readonly storageContext?: Maybe<FirebaseStorageContext>;
  /**
   * Environment service that selects how files are attached: a non-production environment attaches them inline.
   *
   * This is the whole gate. A signed url is unreachable from OpenRouter when the object lives in the
   * Firebase storage emulator, so an emulator run has to carry the bytes — and an app should not have
   * to remember to say so twice.
   */
  readonly envService?: Maybe<FirebaseServerEnvService>;
  /**
   * Explicit file attachment mode, overriding whatever `envService` would select.
   */
  readonly fileAttachmentMode?: Maybe<OpenRouterFileAttachmentMode>;
  /**
   * Inline size cap. Defaults to {@link DEFAULT_OPENROUTER_MAX_INLINE_FILE_SIZE_BYTES}.
   */
  readonly maxInlineFileSizeBytes?: Maybe<number>;
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
   * Signed-url lifetime. Defaults to {@link DEFAULT_OPENROUTER_SIGNED_URL_TTL}.
   */
  readonly signedUrlTtl?: Maybe<Milliseconds>;
  /**
   * Attempts a RETRYABLE failure may spend before a task is FAILED. Defaults to
   * {@link DEFAULT_OPENROUTER_MAX_ATTEMPTS}.
   */
  readonly maxAttempts?: Maybe<number>;
  /**
   * Default lease duration. Defaults to {@link DEFAULT_OPENROUTER_LEASE_DURATION}.
   */
  readonly leaseDuration?: Maybe<Milliseconds>;
}

/**
 * Creates an {@link OpenRouterRunTaskService}.
 *
 * @param config - The collections, prompt service, client, and execution settings.
 * @returns The service.
 */
export function openRouterRunTaskService(config: OpenRouterRunTaskServiceConfig): OpenRouterRunTaskService {
  const { collections, promptService, client, storageContext, envService, fileAttachmentMode, maxInlineFileSizeBytes, tools, onTerminalState, signedUrlTtl, maxAttempts: inputMaxAttempts, leaseDuration: inputLeaseDuration } = config;
  const { openRouterRunTaskCollection } = collections;

  const attachFilesForAttempt = openRouterFileAttachmentResolver({ storageContext, envService, mode: fileAttachmentMode, signedUrlTtl, maxInlineFileSizeBytes });
  const maxAttempts = inputMaxAttempts ?? DEFAULT_OPENROUTER_MAX_ATTEMPTS;
  const defaultLeaseDuration = inputLeaseDuration ?? DEFAULT_OPENROUTER_LEASE_DURATION;

  function runTaskDocument(key: OpenRouterRunTaskKey): OpenRouterRunTaskDocument {
    return openRouterRunTaskCollection.documentAccessor().loadDocumentForId(key);
  }

  async function readRunTask(key: OpenRouterRunTaskKey): Promise<Maybe<OpenRouterRunTask>> {
    return runTaskDocument(key).snapshotData();
  }

  async function enqueueRunTask(params: OpenRouterEnqueueRunTaskParams): Promise<OpenRouterEnqueueRunTaskResult> {
    const { key, promptKey, version, input, files, configOverrides, continueFrom, restart } = params;
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

      task = {
        s: OpenRouterRunTaskState.QUEUED,
        // Write-once from here on: the retention ceiling and the claim order both read it as the task's age.
        qat: new Date(),
        at: 0,
        pk: promptKey,
        pv: resolved.version,
        in: openRouterInputMessages(input),
        fp: files,
        co: configOverrides,
        msg: history
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
    const { limit: pageLimit, leaseOwner, leaseDuration } = params;
    const now = new Date();
    const leaseCutoff = addMilliseconds(now, -(leaseDuration ?? defaultLeaseDuration));

    // Two queries rather than one. "QUEUED or resumable" and "RUNNING with a stale lease" cannot share a
    // single Firestore query — the second needs an inequality on `lat`, and Firestore allows the range
    // filter on only one field, which the ordering must then lead with. Each query has its own index.
    const [runnable, reclaimable] = await Promise.all([openRouterRunTaskCollection.queryDocument(openRouterRunTasksRunnableQuery({ limit: pageLimit })).getDocs(), openRouterRunTaskCollection.queryDocument(openRouterRunTasksReclaimableQuery({ limit: pageLimit, leaseCutoff })).getDocs()]);

    // A task can appear in both pages, so the merged list is de-duplicated by id. First occurrence wins,
    // which keeps the runnable page's queue order ahead of the reclaimable page's lease order.
    const candidates = filterUniqueValues(mergeArrays([runnable, reclaimable]), (x) => x.id).slice(0, pageLimit);
    const claimed = await Promise.all(candidates.map((document) => claimRunTask(document, leaseOwner, now, leaseCutoff)));

    return filterMaybeArrayValues(claimed);
  }

  async function deleteExpiredRunTasks(params: OpenRouterDeleteExpiredRunTasksParams): Promise<OpenRouterDeleteExpiredRunTasksResult> {
    const { limit: inputLimit, before } = params;
    const pageLimit = Math.min(inputLimit, OPENROUTER_MAX_EXPIRED_RUN_TASK_DELETE_PAGE_SIZE);
    const cutoff = before ?? addMilliseconds(new Date(), -OPENROUTER_RUN_TASK_MAX_AGE);

    // No transaction and no lease check. `qat` is write-once, so nothing can move a task's age between the
    // query and the commit — a read-modify-write transaction would buy nothing and add a contention point
    // on documents a drain sweep may be running.
    const documents = await openRouterRunTaskCollection.queryDocument(openRouterRunTasksExpiredQuery({ before: cutoff, limit: pageLimit })).getDocs();
    const keys = documents.map((x) => x.id);

    if (documents.length > 0) {
      // One write batch per page rather than N loose deletes: a page either goes away or it does not, and
      // one round trip replaces up to 500.
      const writeBatch = openRouterRunTaskCollection.firestoreContext.batch();
      const writeBatchAccessor = openRouterRunTaskCollection.documentAccessorForWriteBatch(writeBatch);

      await Promise.all(documents.map((document) => writeBatchAccessor.loadDocumentFrom(document).accessor.delete()));
      await writeBatch.commit();
    }

    return { deleted: keys.length, keys };
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
      try {
        executionResult = await executeRunTaskData(document, task);
      } catch (e) {
        // A task deleted mid-flight by the retention sweep is the expected cause: every write in
        // executeRunTaskData goes through `document.update()`, which throws NOT_FOUND on a deleted document —
        // including the write recordFailure() makes while handling the first throw, which is outside any try
        // and would otherwise reject the whole sweep and discard every result already collected.
        //
        // The existence re-read is what keeps this from swallowing real defects: anything thrown while the
        // document is still there is rethrown untouched.
        if (await document.accessor.exists()) {
          throw e;
        }

        executionResult = { key, state: OpenRouterRunTaskState.FAILED, error: e };
      }
    }

    if (onTerminalState != null && isOpenRouterRunTaskStateTerminal(executionResult.state)) {
      await onTerminalState(document, executionResult);
    }

    return executionResult;
  }

  async function executeRunTaskData(document: OpenRouterRunTaskDocument, task: OpenRouterRunTask): Promise<OpenRouterRunTaskExecutionResult> {
    const key = document.id;
    let executionResult: OpenRouterRunTaskExecutionResult;

    try {
      const resolved = await promptService.resolvePrompt({ promptKey: task.pk, version: task.pv });
      // Resolved fresh on EVERY attempt — see `OpenRouterFileReference` for why a url cannot be reused.
      const attachedFiles = await attachFilesForAttempt(task.fp);
      const hasTools = tools != null && tools.length > 0;

      const request = openRouterPromptRequest({
        prompt: resolved,
        input: task.in,
        overrides: task.co,
        files: attachedFiles,
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
        state: hasTools ? firestoreOpenRouterStateAccessor(document, { initialMessages: request.input, attachedFiles }) : undefined
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
          // Appended rather than replaced: a retried task produced real generations on its earlier attempts
          // too, and those are exactly what an audit of a flaky run needs.
          gi: concatArraysUnique(task.gi, result.generationIds),
          u: result.usage,
          e: null,
          lat: null,
          lo: null
        });
        executionResult = { key, state: OpenRouterRunTaskState.COMPLETE, result };
      } else {
        executionResult = await recordFailure({ document, task, error: result.error, cause: result.error, at: finishedAt, result });
      }
    } catch (e) {
      const failure = await recordFailure({ document, task, error: { code: openRouterErrorCode(e), message: openRouterErrorMessage(e) }, cause: e, at: new Date() });
      executionResult = { ...failure, error: e };
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
    // The length guard means "and there is something to send" — an empty `ptc` satisfies the predicate
    // vacuously, and appending nothing would clear `ptc` / `utr` for no reason.
    const allResolved = pending.length > 0 && !hasUnresolvedOpenRouterPendingToolCalls(pending, unsent);

    if (allResolved) {
      const outputItems = openRouterFunctionCallOutputItems(unsent);
      await document.update({ msg: [...(task.msg ?? []), ...(outputItems as unknown as OpenRouterInputMessage[])], ptc: null, utr: null });
    }
  }

  async function recordFailure(params: RecordOpenRouterRunTaskFailureParams): Promise<OpenRouterRunTaskExecutionResult> {
    const { document, task, error, cause, at, result } = params;

    // A deterministic failure — a bad key, a 402, a model id that does not exist — cannot succeed on a
    // second attempt, so it spends none of the budget and goes straight to FAILED.
    const retryable = isRetryableOpenRouterError(cause);
    // The attempt counter was already incremented by the claim, so `task.at` is the number of attempts made
    // INCLUDING this one — which is why nothing is added to it here. Adding one would spend the budget a
    // tick early and mark a task FAILED with a retry still owed to it.
    const attemptsExhausted = task.at >= maxAttempts;
    const finished = !retryable || attemptsExhausted;
    const state = finished ? OpenRouterRunTaskState.FAILED : OpenRouterRunTaskState.QUEUED;

    await document.update({
      s: state,
      // Releasing the lease is what makes the task claimable again on the next sweep.
      lat: null,
      lo: null,
      fat: finished ? at : null,
      e: error,
      gi: result == null ? undefined : concatArraysUnique(task.gi, result.generationIds),
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
        const alreadySettled = (task.utr ?? []).some((x) => x.callId === call?.callId);

        if (call != null && !alreadySettled) {
          // Preserves today's semantics exactly: an `output` of `null` is a real result and is kept, while an
          // absent `error` is dropped rather than written as `undefined`, which Firestore rejects outright.
          const unsent = [...(task.utr ?? []), filterUndefinedValues({ callId: call.callId, name: call.name, output, error: error ?? undefined })];
          const ready = !hasUnresolvedOpenRouterPendingToolCalls(pending, unsent);

          // `qat` is deliberately NOT moved. It is the task's age for retention, so a task cycling through
          // tool resolutions would otherwise keep pushing its own age forward and never age out — and keeping
          // the original also orders correctly: a run waiting on a tool since yesterday should be claimed
          // ahead of one queued a minute ago.
          await document.update({ utr: unsent, ...(ready ? { s: OpenRouterRunTaskState.QUEUED } : undefined) });
          result = { resolved: true, ready };
        }
      }

      return result;
    });
  }

  return { enqueueRunTask, readRunTask, runTaskDocument, claimNextRunTasks, executeRunTask, resolveDeferredTool, deleteExpiredRunTasks, attachFilesForAttempt };
}

/**
 * Params for the internal failure recorder.
 */
interface RecordOpenRouterRunTaskFailureParams {
  readonly document: OpenRouterRunTaskDocument;
  readonly task: OpenRouterRunTask;
  /**
   * The error to persist on the task.
   */
  readonly error: OpenRouterRunError;
  /**
   * The value the failure is CLASSIFIED from: the thrown value on the throw path, and the response's
   * reported error on the path that returns a failure without throwing.
   */
  readonly cause: unknown;
  /**
   * When the failure happened.
   */
  readonly at: Date;
  readonly result?: Maybe<OpenRouterCallResult>;
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
      //
      // Vacuously true for an EMPTY `ptc`, deliberately. Such a task gets claimed, no-ops the append, and can
      // still complete — whereas refusing to claim it would strand it permanently with nothing able to move it.
      result = !hasUnresolvedOpenRouterPendingToolCalls(task.ptc, task.utr);
      break;
    default:
      result = false;
      break;
  }

  return result;
}

/**
 * Whether any pending deferred tool call is still missing its recorded result.
 *
 * The one predicate behind "is this run ready to resume": the claim check, the resolution's `ready` flag,
 * and the conversation append all ask it, and three hand-written copies had already drifted apart.
 *
 * @param pending - The pending deferred tool calls.
 * @param unsent - The recorded-but-unsent tool results.
 * @returns True when at least one pending call has no recorded result.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function hasUnresolvedOpenRouterPendingToolCalls(pending: Maybe<readonly OpenRouterRunTaskPendingToolCall[]>, unsent: Maybe<readonly OpenRouterRunTaskUnsentToolResult[]>): boolean {
  return (pending ?? []).some((call) => !(unsent ?? []).some((result) => result.callId === call.callId));
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
 * HTTP statuses a retry cannot fix.
 *
 * 400 is a malformed request (an invalid model id, a JSON schema the provider rejects), 401/403 are a
 * credential problem, 402 is an empty account, and 404 is a route or resource that does not exist. Each of
 * them answers identically on every attempt, so spending the budget on them only delays the FAILED that
 * the owning work is waiting for.
 */
export const OPENROUTER_PERMANENT_ERROR_STATUSES: readonly number[] = [400, 401, 402, 403, 404];

/**
 * Whether a failure is worth another attempt.
 *
 * What this encodes is a whitelist of the KNOWN-PERMANENT, not a whitelist of the retryable: anything
 * unrecognized defaults to RETRYABLE. An unknown failure is far more likely to be a transient upstream blip
 * than a permanent one, and the attempt budget bounds the cost of being wrong either way — whereas
 * defaulting the other way would turn one bad minute at a provider into a definitively failed run.
 *
 * So the retryable side needs no list of its own. 408 / 409 / 429 and every 5xx, socket-level failures
 * (`ECONNRESET`, `ETIMEDOUT`, `ECONNREFUSED`, `EAI_AGAIN`), and the Google-infrastructure transients
 * (`UNAVAILABLE`, `DEADLINE_EXCEEDED`, `ABORTED`) a Firestore or GCS call raises mid-run all reach the
 * default and are retried.
 *
 * Permanent is two cases. {@link OPENROUTER_PERMANENT_ERROR_STATUSES}, read off `status` / `statusCode` /
 * `code` — which covers both routes into `recordFailure`: a thrown SDK/HTTP error, and the numeric
 * `error.code` OpenRouter reports in a response body without throwing at all. And an
 * {@link OpenRouterPromptResolutionError}, which is deterministic by construction: the prompt either exists
 * at that version or it never will, so re-resolving it is guaranteed to fail identically.
 *
 * @param e - The thrown value, or the error reported on a response.
 * @returns True when another attempt could plausibly succeed.
 *
 * @__NO_SIDE_EFFECTS__
 */
export function isRetryableOpenRouterError(e: unknown): boolean {
  const status = openRouterErrorStatus(e);
  return !(e instanceof OpenRouterPromptResolutionError) && (status == null || !OPENROUTER_PERMANENT_ERROR_STATUSES.includes(status));
}

/**
 * Extracts an HTTP status from a thrown value or a reported response error.
 *
 * `code` is read as a status too, because OpenRouter reports a NUMERIC code in a response body's `error`
 * object where an SDK error would carry `status`.
 *
 * @param e - The thrown value.
 * @returns The status, when the value carries a numeric one.
 *
 * @__NO_SIDE_EFFECTS__
 */
function openRouterErrorStatus(e: unknown): Maybe<number> {
  let result: Maybe<number>;

  if (e != null && typeof e === 'object') {
    const candidate = (e as { status?: unknown; statusCode?: unknown; code?: unknown }).status ?? (e as { statusCode?: unknown }).statusCode ?? (e as { code?: unknown }).code;

    if (typeof candidate === 'number') {
      result = candidate;
    } else if (typeof candidate === 'string' && /^\d{3}$/.test(candidate)) {
      // A three-digit string is a status OpenRouter reported as text; anything else is a symbolic code
      // (`ECONNRESET`, `server_error`) and is left for the default-retryable path.
      result = Number(candidate);
    }
  }

  return result;
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
