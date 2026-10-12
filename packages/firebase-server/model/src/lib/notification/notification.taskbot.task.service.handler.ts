import {
  type FirestoreModelKey,
  getDocumentSnapshotData,
  type NotificationTaskBot,
  type NotificationTaskBotChange,
  type NotificationTaskBotDocument,
  type NotificationTaskBotEmbeddedScriptEntry,
  type NotificationTaskBotEntryData,
  type NotificationTaskBotEntryDataUpdate,
  type NotificationTaskBotPause,
  type NotificationTaskBotRunNotificationTaskData,
  type NotificationTaskBotRunNumber,
  NotificationTaskBotRunOutcome,
  type NotificationTaskBotRunSubtask,
  type NotificationTaskBotRunSubtaskMetadata,
  NotificationTaskBotRunTrigger,
  type NotificationTaskBotScriptConfig,
  type NotificationTaskBotScriptType,
  NOTIFICATION_TASK_BOT_RUN_NOTIFICATION_TASK_TYPE,
  notificationTaskBotEntry,
  notificationTaskComplete,
  notificationTaskDelayRetry,
  type Transaction
} from '@dereekb/firebase';
import { filterMaybeArrayValues, type Maybe } from '@dereekb/util';
import { BaseError } from 'make-error';
import { type NotificationTaskServiceTaskHandlerConfig } from './notification.task.service.handler';
import {
  type NotificationTaskSubtaskCleanupFunctionInput,
  type NotificationTaskSubtaskCleanupInstructions,
  type NotificationTaskSubtaskFlowEntry,
  type NotificationTaskSubtaskInput,
  type NotificationTaskSubtaskNotificationTaskHandlerConfig,
  type NotificationTaskSubtaskProcessorConfig,
  type NotificationTaskSubtaskResult,
  notificationTaskSubTaskMissingRequiredDataTermination,
  notificationTaskSubtaskNotificationTaskHandlerFactory
} from './notification.task.subtask.handler';
import { applyNotificationTaskBotChangesInTransactionFactory, type NotificationTaskBotServerActionsContext } from './notification.taskbot.action.server';

/**
 * @module notification.taskbot.task.service.handler
 *
 * The NotificationTask handler for NotificationTaskBot runs (`NTBR`).
 *
 * One task type dispatches to app-registered processors by script type. A script's custom steps form the "processing"
 * flow; the library "cleanup" writes the outcome back to the entry and schedules the next run in one transaction.
 *
 * Every run is fenced on its run number in three places: the input function (on every part), the side-effect
 * transaction ({@link runNotificationTaskBotEntryTransaction}), and cleanup. A stale or superseded run terminates
 * without writing anything.
 *
 * Run timing. Before a run's first step, the handler holds it until its scheduled time (`sa`), unless it is FORCED.
 * This holds for every script, including scripts that never call {@link notificationTaskBotDelayUntilDue}, and also
 * when a run is woken early (e.g. sent with `ignoreSendAtThrottle`). A not-before run then runs the script's due check;
 * an explicit run skips it. When the due check finds a MANUAL run not due yet, the run hands over to a SCHEDULED run at
 * the due time and ends, so history only records MANUAL for a run that went ahead right away.
 *
 * Pause until. The resume run of an entry paused until a time (`pu`) is held until `pu`, then resumes the entry before
 * the first step runs.
 *
 * Failures. A step that returns a failed result (`notificationTaskFailed()`) is a real failure: the handler throws
 * {@link NotificationTaskBotRunStepFailedError}, so the attempt is counted and the task is retried after the failure
 * delay. Once the task runs out of attempts it is deleted, and the repair sweep records the run as LOST, which counts
 * toward the script's `maxConsecutiveFailures`. A cleanup that reports a FAILED outcome counts toward it as well.
 *
 * Resume side effects. Every resume stamps the cleared pause reason on the entry (`rpr`) until the next run completes.
 * In its first step, a script checks `entry.rpr` and undoes what its own pause did inside
 * {@link runNotificationTaskBotEntryTransaction} (e.g. `updateEntryData({ npc: null })`). Make it idempotent: the first
 * step re-runs when the due check delays the run.
 */

// MARK: Types
/**
 * Input passed to each NotificationTaskBot script step.
 *
 * @template D - entry data type
 * @template M - subtask metadata type
 * @template S - subtask checkpoint string type
 */
export interface NotificationTaskBotRunSubtaskInput<
  D extends NotificationTaskBotEntryData = NotificationTaskBotEntryData,
  M extends NotificationTaskBotRunSubtaskMetadata = NotificationTaskBotRunSubtaskMetadata,
  S extends NotificationTaskBotRunSubtask = NotificationTaskBotRunSubtask
> extends NotificationTaskSubtaskInput<NotificationTaskBotRunNotificationTaskData<M, S>, M, S> {
  /**
   * The NotificationTaskBot context, used for fenced transactions.
   */
  readonly notificationTaskBotContext: NotificationTaskBotServerActionsContext;
  readonly botDocument: NotificationTaskBotDocument;
  /**
   * The bot as read when this part of the run started.
   */
  readonly bot: NotificationTaskBot;
  /**
   * Key of the model the bot is attached to.
   */
  readonly model: FirestoreModelKey;
  /**
   * The entry as read when this part of the run started.
   */
  readonly entry: NotificationTaskBotEmbeddedScriptEntry<D>;
  readonly scriptConfig: NotificationTaskBotScriptConfig;
  readonly runNumber: NotificationTaskBotRunNumber;
  readonly trigger: NotificationTaskBotRunTrigger;
  /**
   * When the run was scheduled to run. The handler never starts the first step of a run before this time, unless the
   * run is FORCED.
   */
  readonly scheduledAt: Date;
  /**
   * True if the run was scheduled at an explicit time. The script's due check is skipped.
   *
   * Otherwise the run is "not before" and the script's due check still applies.
   */
  readonly explicit: boolean;
}

export type NotificationTaskBotRunSubtaskResult<M extends NotificationTaskBotRunSubtaskMetadata = NotificationTaskBotRunSubtaskMetadata, S extends NotificationTaskBotRunSubtask = NotificationTaskBotRunSubtask> = NotificationTaskSubtaskResult<M, S>;

export type NotificationTaskBotRunSubtaskFlowEntry<D extends NotificationTaskBotEntryData = NotificationTaskBotEntryData, M extends NotificationTaskBotRunSubtaskMetadata = NotificationTaskBotRunSubtaskMetadata, S extends NotificationTaskBotRunSubtask = NotificationTaskBotRunSubtask> = NotificationTaskSubtaskFlowEntry<
  NotificationTaskBotRunSubtaskInput<D, M, S>,
  NotificationTaskBotRunNotificationTaskData<M, S>,
  M,
  S
>;

/**
 * Cleanup instructions returned by a script's cleanup. The default is a COMPLETED outcome and going idle.
 *
 * @template D - entry data type
 * @template HD - history item data type
 */
export interface NotificationTaskBotRunCleanupInstructions<D extends NotificationTaskBotEntryData = NotificationTaskBotEntryData, HD extends NotificationTaskBotEntryData = NotificationTaskBotEntryData> extends NotificationTaskSubtaskCleanupInstructions {
  /**
   * Outcome recorded in history. Defaults to SUBMITTED when the run submitted, otherwise COMPLETED.
   */
  readonly outcome?: Maybe<NotificationTaskBotRunOutcome>;
  /**
   * False skips the history item. Defaults to an item without data.
   */
  readonly history?: Maybe<false | { readonly d?: Maybe<HD>; readonly replaceLast?: Maybe<boolean> }>;
  /**
   * Data to merge into the entry's data. A `null` value deletes the key.
   */
  readonly updateData?: Maybe<NotificationTaskBotEntryDataUpdate<D>>;
  /**
   * When to schedule the next run. The run starts no sooner than this time and the script computes the real due time
   * when it runs. Unset goes idle.
   *
   * Never sooner than now plus the script's `minimumRunInterval`.
   */
  readonly nextRunAt?: Maybe<Date>;
  /**
   * Explicit time for the next run. Takes priority over {@link nextRunAt}.
   *
   * Never sooner than now plus the script's `minimumRunInterval`.
   */
  readonly nextRunAtExplicit?: Maybe<Date>;
  /**
   * Pauses the entry. With `until`, the entry resumes on its own at that time.
   */
  readonly pause?: Maybe<NotificationTaskBotPause>;
  readonly disable?: Maybe<boolean>;
  /**
   * Removes the entry, e.g. when the attached model was deleted. Every other instruction is ignored: no history is
   * recorded and no next run is scheduled.
   */
  readonly remove?: Maybe<boolean>;
}

/**
 * Server-side processor for a single NotificationTaskBot script. The `target` is the script type.
 *
 * A step that returns a failed result (`notificationTaskFailed()`) is a real failure: the attempt is counted, the run
 * is retried after the failure delay, and once the task runs out of attempts the repair sweep records the run as LOST.
 * On a failed step, `updateMetadata` and `removeFromCompletedCheckpoints` are ignored and the same step retries. A step
 * reads `input.notificationTask.totalSendAttempts` to see how many times this run has failed.
 */
export type NotificationTaskBotScriptProcessorConfig<D extends NotificationTaskBotEntryData = any, M extends NotificationTaskBotRunSubtaskMetadata = any, S extends NotificationTaskBotRunSubtask = NotificationTaskBotRunSubtask> = NotificationTaskSubtaskProcessorConfig<
  NotificationTaskBotRunSubtaskInput<D, M, S>,
  NotificationTaskBotRunCleanupInstructions<D>,
  NotificationTaskBotRunNotificationTaskData<M, S>,
  M,
  S
>;

/**
 * Config for {@link notificationTaskBotRunNotificationTaskHandler}.
 */
export interface NotificationTaskBotRunNotificationTaskHandlerConfig extends Omit<NotificationTaskSubtaskNotificationTaskHandlerConfig<NotificationTaskBotRunSubtaskInput, NotificationTaskBotRunCleanupInstructions, NotificationTaskBotRunNotificationTaskData>, 'processors'> {
  readonly processors: NotificationTaskBotScriptProcessorConfig[];
  /**
   * The NotificationTaskBot context. Its optional script config service supplies each script's history limit,
   * minimum run interval and failure budget.
   */
  readonly notificationTaskBotContext: NotificationTaskBotServerActionsContext;
}

/**
 * Default cleanup instructions: COMPLETED and idle.
 *
 * @returns The default cleanup instructions.
 */
export const notificationTaskBotRunNotificationTaskHandlerDefaultCleanup = (): NotificationTaskBotRunCleanupInstructions => {
  return {
    cleanupSuccess: true
  };
};

/**
 * Cleanup for an entry whose script has no processor (e.g. a script that was removed): records SKIPPED and goes idle.
 *
 * @param input - The cleanup input.
 * @returns The cleanup instructions.
 */
function notificationTaskBotRunNotificationTaskHandlerUnknownScriptCleanup(input: NotificationTaskSubtaskCleanupFunctionInput<NotificationTaskBotRunSubtaskInput, NotificationTaskBotRunNotificationTaskData>): NotificationTaskBotRunCleanupInstructions {
  console.warn(`notificationTaskBotRunNotificationTaskHandler(): no processor is configured for NotificationTaskBot script type "${input.entry.t}" (entry "${input.entry.i}" of "${input.botDocument.key}"). The run is recorded as SKIPPED.`);

  return {
    cleanupSuccess: true,
    outcome: NotificationTaskBotRunOutcome.SKIPPED
  };
}

// MARK: Errors
/**
 * Thrown by the NotificationTaskBot run handler when a script step returns a failed result (`notificationTaskFailed()`).
 *
 * The send runner counts it as a failed attempt: the attempt count goes up and the task is retried after the failure
 * delay. Once the task runs out of attempts it is deleted, and the repair sweep records the run as LOST.
 */
export class NotificationTaskBotRunStepFailedError extends BaseError {
  readonly scriptType: NotificationTaskBotScriptType;
  readonly subtask: Maybe<NotificationTaskBotRunSubtask>;

  constructor(scriptType: NotificationTaskBotScriptType, subtask: Maybe<NotificationTaskBotRunSubtask>) {
    super(`NotificationTaskBot script "${scriptType}" failed at step "${subtask ?? '(default)'}".`);
    this.scriptType = scriptType;
    this.subtask = subtask;
  }
}

// MARK: Run Gate
/**
 * Result of {@link notificationTaskBotRunStartGate}.
 */
interface NotificationTaskBotRunStartGateResult {
  /**
   * When set, the run must not start yet and this result is returned instead of running the step.
   */
  readonly result?: Maybe<NotificationTaskBotRunSubtaskResult>;
  /**
   * When set, the input to run the step with, refreshed after the entry was resumed.
   */
  readonly input?: Maybe<NotificationTaskBotRunSubtaskInput>;
}

/**
 * Checks whether a run may start its first step.
 *
 * - The resume run of an entry paused until a time is held until `pu`, then resumes the entry in a fenced transaction.
 * - No run except a FORCED one starts before its scheduled time.
 *
 * @param input - The first step's input.
 * @returns The gate result.
 * @throws {NotificationTaskSubTaskMissingRequiredDataTermination} When the entry is paused with no resume time, or the run was fenced off.
 */
async function notificationTaskBotRunStartGate(input: NotificationTaskBotRunSubtaskInput): Promise<NotificationTaskBotRunStartGateResult> {
  const { entry, trigger, scheduledAt } = input;
  const now = new Date();

  let result: Maybe<NotificationTaskBotRunSubtaskResult>;
  let nextInput: Maybe<NotificationTaskBotRunSubtaskInput>;

  if (entry.pat != null) {
    // a paused entry's only possible live run is its resume run
    if (entry.pu == null) {
      throw notificationTaskSubTaskMissingRequiredDataTermination();
    } else if (entry.pu.getTime() > now.getTime()) {
      result = notificationTaskDelayRetry(entry.pu);
    } else {
      const { notificationTaskBotContext, model, runNumber } = input;
      const applyInTransaction = applyNotificationTaskBotChangesInTransactionFactory(notificationTaskBotContext);
      const applied = await notificationTaskBotContext.firestoreContext.runTransaction((transaction) => applyInTransaction({ transaction, model, changes: [{ type: 'expirePause', entryId: entry.i, runNumber }] }));
      const resumedEntry = applied.entry;

      if (applied.fenced || !applied.bot || !resumedEntry || (resumedEntry.pat != null && resumedEntry.pu == null)) {
        throw notificationTaskSubTaskMissingRequiredDataTermination();
      } else if (resumedEntry.pat == null) {
        nextInput = { ...input, bot: applied.bot, entry: resumedEntry };
      } else {
        result = notificationTaskDelayRetry(resumedEntry.pu as Date); // still paused until a later time
      }
    }
  }

  // the floor: never before the run's own time
  if (!result && trigger !== NotificationTaskBotRunTrigger.FORCED && scheduledAt.getTime() > now.getTime()) {
    result = notificationTaskDelayRetry(scheduledAt);
  }

  return { result, input: nextInput };
}

/**
 * Wraps a script step with the run gate (before the first step) and the failure conversion.
 *
 * @param scriptType - The script type, for the failure message.
 * @param step - The script step.
 * @returns The wrapped step function.
 */
function notificationTaskBotRunStepFunction(scriptType: NotificationTaskBotScriptType, step: NotificationTaskBotRunSubtaskFlowEntry): NotificationTaskBotRunSubtaskFlowEntry['fn'] {
  return async (input) => {
    const gate: NotificationTaskBotRunStartGateResult = input.completedSubtasks.length === 0 ? await notificationTaskBotRunStartGate(input) : {};
    let result = gate.result;

    if (!result) {
      result = await step.fn(gate.input ?? input);

      if (result.completion === false) {
        throw new NotificationTaskBotRunStepFailedError(scriptType, step.subtask);
      }
    }

    return result;
  };
}

// MARK: Handler
/**
 * Creates the NotificationTask handler for NotificationTaskBot runs. Register it with the app's NotificationTaskService.
 *
 * The processors must match the context's script registry: every registered script type needs a processor, and every
 * processor's target must be a registered script type. At runtime, an entry whose script has no processor (e.g. a
 * script that was removed) records SKIPPED and goes idle.
 *
 * @param config - The processors and the NotificationTaskBot context.
 * @returns The task handler config.
 * @throws {Error} When the processors do not match the script registry, or a target listed in `validate` has no processor.
 *
 * @example
 * ```ts
 * notificationTaskBotRunNotificationTaskHandler({ processors: [demoPingProcessor], notificationTaskBotContext: context });
 * ```
 */
export function notificationTaskBotRunNotificationTaskHandler(config: NotificationTaskBotRunNotificationTaskHandlerConfig): NotificationTaskServiceTaskHandlerConfig<NotificationTaskBotRunNotificationTaskData> {
  const { notificationTaskBotContext, processors: inputProcessors } = config;
  const { notificationTaskBotCollection } = notificationTaskBotContext;
  const scriptConfigService = notificationTaskBotContext.appNotificationTaskBotScriptConfigService;
  const applyInTransaction = applyNotificationTaskBotChangesInTransactionFactory(notificationTaskBotContext);

  const processorTargets = inputProcessors.map((x) => x.target);
  const processorTargetsSet = new Set(processorTargets);
  const scriptTypesWithoutProcessor = scriptConfigService.getAllKnownScriptTypes().filter((x) => !processorTargetsSet.has(x));
  const unregisteredProcessorTargets = processorTargets.filter((x) => scriptConfigService.registeredConfigForScriptType(x) == null);

  if (scriptTypesWithoutProcessor.length > 0 || unregisteredProcessorTargets.length > 0) {
    const problems = filterMaybeArrayValues([
      scriptTypesWithoutProcessor.length > 0 ? `No processor is configured for these registered script types: ${scriptTypesWithoutProcessor.join(', ')}.` : undefined,
      unregisteredProcessorTargets.length > 0 ? `These processor targets are not registered script types: ${unregisteredProcessorTargets.join(', ')}.` : undefined
    ]);
    throw new Error(`notificationTaskBotRunNotificationTaskHandler(): the processors do not match the script registry. ${problems.join(' ')}`);
  }

  // wrap every processor: each step gets the run gate and the failure conversion, and the cleanup always receives the
  // subtask data, even when a script defines no cleanup of its own
  const processors: NotificationTaskBotScriptProcessorConfig[] = inputProcessors.map((processor) => ({
    ...processor,
    flow: processor.flow.map((step) => ({ ...step, fn: notificationTaskBotRunStepFunction(processor.target, step) })),
    cleanup: async (input) => (await processor.cleanup?.(input, notificationTaskBotRunNotificationTaskHandlerDefaultCleanup)) ?? notificationTaskBotRunNotificationTaskHandlerDefaultCleanup()
  }));

  return notificationTaskSubtaskNotificationTaskHandlerFactory<NotificationTaskBotRunSubtaskInput, NotificationTaskBotRunCleanupInstructions, NotificationTaskBotRunNotificationTaskData, NotificationTaskBotRunSubtaskMetadata, NotificationTaskBotRunSubtask>({
    taskType: NOTIFICATION_TASK_BOT_RUN_NOTIFICATION_TASK_TYPE,
    subtaskHandlerFunctionName: 'notificationTaskBotRunNotificationTaskHandler',
    inputFunction: async (data: NotificationTaskBotRunNotificationTaskData) => {
      const botDocument = notificationTaskBotCollection.documentAccessor().loadDocumentForId(data.b);
      const bot = await getDocumentSnapshotData(botDocument, true);
      const entry = notificationTaskBotEntry(bot, data.i);

      // THE RUN FENCE. Only the entry's live run may do anything. A superseded, cancelled or stale run terminates.
      if (!bot || !entry || entry.rn !== data.rn) {
        throw notificationTaskSubTaskMissingRequiredDataTermination();
      }

      return {
        target: entry.t,
        notificationTaskBotContext,
        botDocument,
        bot,
        model: bot.m,
        entry,
        scriptConfig: scriptConfigService.configForScriptType(entry.t),
        runNumber: data.rn,
        trigger: data.tr ?? NotificationTaskBotRunTrigger.SCHEDULED,
        scheduledAt: new Date(data.sa),
        explicit: Boolean(data.x)
      };
    },
    // only reached for an entry whose script has no processor, since every known processor is wrapped with its own cleanup
    defaultCleanup: notificationTaskBotRunNotificationTaskHandlerUnknownScriptCleanup,
    cleanupFunction: async function (input, cleanupInstructions: NotificationTaskBotRunCleanupInstructions) {
      const { botDocument, model, entry, runNumber, trigger, scriptConfig } = input;
      const { outcome, history, updateData, nextRunAt, nextRunAtExplicit, pause, disable, remove } = cleanupInstructions;

      await notificationTaskBotContext.firestoreContext.runTransaction(async (transaction) => {
        const bot = await getDocumentSnapshotData(notificationTaskBotCollection.documentAccessorForTransaction(transaction).loadDocumentFrom(botDocument));
        const currentEntry = notificationTaskBotEntry(bot, entry.i);
        const submitted = currentEntry?.lsr === runNumber;

        await applyInTransaction({
          transaction,
          model,
          bot,
          changes: [
            {
              type: 'completeRun',
              entryId: entry.i,
              runNumber,
              trigger,
              outcome: outcome ?? (submitted ? NotificationTaskBotRunOutcome.SUBMITTED : NotificationTaskBotRunOutcome.COMPLETED),
              history,
              updateData,
              nextRunAt,
              nextRunAtExplicit,
              pause,
              disable,
              remove,
              historyLimit: scriptConfig.historyLimit,
              minimumRunInterval: scriptConfig.minimumRunInterval,
              maxConsecutiveFailures: scriptConfig.maxConsecutiveFailures
            }
          ]
        });
      });

      // cleanup never expedites the next run: that would recurse inside the handler, and the send queue picks it up anyway
      return notificationTaskComplete();
    }
  })({ ...config, processors, defaultAllowRunMultipleParts: config.defaultAllowRunMultipleParts ?? true });
}

// MARK: Script Utilities
/**
 * Delays the run until the script's computed due time.
 *
 * Returns undefined when the run should proceed now: the due time is unset or not in the future, the run was FORCED,
 * the run was scheduled at an explicit time, or the run already submitted (`lsr === rn`, e.g. a step re-run after a
 * crash, whose `lsat` would otherwise push the due time out).
 *
 * Otherwise the run must wait:
 * - a SCHEDULED run syncs the entry's `nat` in a fenced transaction and returns a delay result. The task's attempt count
 *   is untouched.
 * - a MANUAL run hands over to a SCHEDULED not-before run at the due time (see `NotificationTaskBotDeferRunChange`) and
 *   ends: its task is marked done, and cleanup and history are skipped. History only records MANUAL for a run that
 *   went ahead right away.
 *
 * @param input - The script step's input.
 * @param due - The computed due time.
 * @returns A delay result, or undefined when the run should proceed.
 * @throws {NotificationTaskSubTaskMissingRequiredDataTermination} When the run was fenced off, or a MANUAL run handed over.
 *
 * @example
 * ```ts
 * fn: async (input) => (await notificationTaskBotDelayUntilDue(input, computeDue(input.entry))) ?? notificationTaskComplete()
 * ```
 */
export async function notificationTaskBotDelayUntilDue(input: NotificationTaskBotRunSubtaskInput<any, any, any>, due: Maybe<Date>): Promise<Maybe<NotificationTaskBotRunSubtaskResult>> {
  let result: Maybe<NotificationTaskBotRunSubtaskResult>;

  const alreadySubmitted = input.entry.lsr === input.runNumber;

  if (due != null && input.trigger !== NotificationTaskBotRunTrigger.FORCED && !input.explicit && !alreadySubmitted && due.getTime() > Date.now()) {
    const { notificationTaskBotContext, model, entry, runNumber, trigger } = input;
    const applyInTransaction = applyNotificationTaskBotChangesInTransactionFactory(notificationTaskBotContext);
    const deferred = trigger === NotificationTaskBotRunTrigger.MANUAL;
    const change: NotificationTaskBotChange = deferred ? { type: 'deferRun', entryId: entry.i, runNumber, at: due } : { type: 'syncNat', entryId: entry.i, runNumber, nat: due };
    const applied = await notificationTaskBotContext.firestoreContext.runTransaction((transaction) => applyInTransaction({ transaction, model, changes: [change] }));

    // a deferred MANUAL run is over: the SCHEDULED hand-over goes ahead on cadence
    if (applied.fenced || applied.unknownEntry || deferred) {
      throw notificationTaskSubTaskMissingRequiredDataTermination();
    }

    result = notificationTaskDelayRetry(due);
  }

  return result;
}

/**
 * Context exposed to the function passed to {@link runNotificationTaskBotEntryTransaction}.
 */
export interface NotificationTaskBotEntryTransactionContext<D extends NotificationTaskBotEntryData = NotificationTaskBotEntryData> {
  readonly transaction: Transaction;
  readonly bot: NotificationTaskBot;
  readonly entry: NotificationTaskBotEmbeddedScriptEntry<D>;
  /**
   * True if this run already submitted (`lsr === rn`). Check it before creating the side effect.
   */
  readonly alreadySubmitted: boolean;
  /**
   * Marks the run as submitted: sets `lsat` and `lsr` and increments `sc`. Written after the function returns.
   */
  markSubmitted(): void;
  /**
   * Merges data into the entry's data. A `null` value deletes the key. Written after the function returns.
   */
  updateEntryData(update: NotificationTaskBotEntryDataUpdate<D>): void;
}

/**
 * Runs a fenced transaction for the current run.
 *
 * The bot is read and fenced first; a stale run terminates the task. The app creates its side effect (e.g. an email)
 * inside `fn` and calls `markSubmitted()`; the bot is written after `fn` returns, in the same transaction. Because the
 * run lock is only a short send-at bump, a long step can run twice; checking `alreadySubmitted` inside this transaction
 * is what keeps a re-run step from submitting twice.
 *
 * @param input - The script step's input.
 * @param fn - The function to run inside the transaction. It may read, but must not read after writing.
 * @returns The value returned by `fn`.
 */
export async function runNotificationTaskBotEntryTransaction<T, D extends NotificationTaskBotEntryData = NotificationTaskBotEntryData>(input: NotificationTaskBotRunSubtaskInput<D, any, any>, fn: (context: NotificationTaskBotEntryTransactionContext<D>) => Promise<T>): Promise<T> {
  const { notificationTaskBotContext, botDocument, model, entry: inputEntry, runNumber } = input;
  const { firestoreContext, notificationTaskBotCollection } = notificationTaskBotContext;
  const applyInTransaction = applyNotificationTaskBotChangesInTransactionFactory(notificationTaskBotContext);

  return firestoreContext.runTransaction(async (transaction) => {
    const bot = await getDocumentSnapshotData(notificationTaskBotCollection.documentAccessorForTransaction(transaction).loadDocumentFrom(botDocument));
    const entry = notificationTaskBotEntry<D>(bot, inputEntry.i);

    if (!bot || !entry || entry.rn !== runNumber) {
      throw notificationTaskSubTaskMissingRequiredDataTermination();
    }

    const changes: NotificationTaskBotChange[] = [];

    const value = await fn({
      transaction,
      bot,
      entry,
      alreadySubmitted: entry.lsr === runNumber,
      markSubmitted: () => {
        changes.push({ type: 'markSubmitted', entryId: entry.i, runNumber });
      },
      updateEntryData: (update) => {
        changes.push({ type: 'data', entryId: entry.i, data: update as NotificationTaskBotEntryDataUpdate });
      }
    });

    if (changes.length > 0) {
      await applyInTransaction({ transaction, model, bot, changes });
    }

    return value;
  });
}
