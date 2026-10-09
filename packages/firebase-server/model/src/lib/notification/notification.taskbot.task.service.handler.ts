import {
  type FirestoreModelKey,
  getDocumentSnapshotData,
  type NotificationTaskBot,
  type NotificationTaskBotChange,
  type NotificationTaskBotDocument,
  type NotificationTaskBotEmbeddedScriptEntry,
  type NotificationTaskBotEntryData,
  type NotificationTaskBotEntryDataUpdate,
  type NotificationTaskBotPauseReason,
  type NotificationTaskBotRunNotificationTaskData,
  type NotificationTaskBotRunNumber,
  NotificationTaskBotRunOutcome,
  type NotificationTaskBotRunSubtask,
  type NotificationTaskBotRunSubtaskMetadata,
  NotificationTaskBotRunTrigger,
  type NotificationTaskBotScriptConfig,
  NOTIFICATION_TASK_BOT_RUN_NOTIFICATION_TASK_TYPE,
  notificationTaskBotEntry,
  notificationTaskComplete,
  notificationTaskDelayRetry,
  type Transaction
} from '@dereekb/firebase';
import { type Maybe } from '@dereekb/util';
import { type NotificationTaskServiceTaskHandlerConfig } from './notification.task.service.handler';
import {
  type NotificationTaskSubtaskCleanupInstructions,
  type NotificationTaskSubtaskFlowEntry,
  type NotificationTaskSubtaskInput,
  type NotificationTaskSubtaskNotificationTaskHandlerConfig,
  type NotificationTaskSubtaskProcessorConfig,
  type NotificationTaskSubtaskResult,
  notificationTaskSubTaskMissingRequiredDataTermination,
  notificationTaskSubtaskNotificationTaskHandlerFactory
} from './notification.task.subtask.handler';
import { applyNotificationTaskBotChangesInTransactionFactory, type NotificationTaskBotServerActionsContext, notificationTaskBotScriptConfigServiceForContext } from './notification.taskbot.action.server';

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
   * When the run was scheduled to run.
   */
  readonly scheduledAt: Date;
  /**
   * True if the run was scheduled at an explicit time. The script's due check is skipped.
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
   * When to schedule the next run. The script computes the real due time when it runs. Unset goes idle.
   */
  readonly nextRunAt?: Maybe<Date>;
  /**
   * Explicit time for the next run. Takes priority over {@link nextRunAt}.
   */
  readonly nextRunAtExplicit?: Maybe<Date>;
  readonly pause?: Maybe<{ readonly reason: NotificationTaskBotPauseReason }>;
  readonly disable?: Maybe<boolean>;
}

/**
 * Server-side processor for a single NotificationTaskBot script. The `target` is the script type.
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

// MARK: Handler
/**
 * Creates the NotificationTask handler for NotificationTaskBot runs. Register it with the app's NotificationTaskService.
 *
 * @param config - The processors and the NotificationTaskBot context.
 * @returns The task handler config.
 */
export function notificationTaskBotRunNotificationTaskHandler(config: NotificationTaskBotRunNotificationTaskHandlerConfig): NotificationTaskServiceTaskHandlerConfig<NotificationTaskBotRunNotificationTaskData> {
  const { notificationTaskBotContext, processors: inputProcessors } = config;
  const { notificationTaskBotCollection } = notificationTaskBotContext;
  const scriptConfigService = notificationTaskBotScriptConfigServiceForContext(notificationTaskBotContext);
  const applyInTransaction = applyNotificationTaskBotChangesInTransactionFactory(notificationTaskBotContext);

  // wrap every processor so the cleanup always receives the subtask data, even when a script defines no cleanup of its own
  const processors: NotificationTaskBotScriptProcessorConfig[] = inputProcessors.map((processor) => ({
    ...processor,
    cleanup: (input, defaultCleanup) => (processor.cleanup ? processor.cleanup(input, defaultCleanup) : defaultCleanup(input))
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
    defaultCleanup: notificationTaskBotRunNotificationTaskHandlerDefaultCleanup,
    cleanupFunction: async function (input, cleanupInstructions: NotificationTaskBotRunCleanupInstructions) {
      const { botDocument, model, entry, runNumber, trigger, scriptConfig } = input;
      const { outcome, history, updateData, nextRunAt, nextRunAtExplicit, pause, disable } = cleanupInstructions;

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
              historyLimit: scriptConfig.historyLimit,
              minimumRunInterval: scriptConfig.minimumRunInterval
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
 * crash, whose `lsat` would otherwise push the due time out). Otherwise the entry's `nat` is synced in a fenced
 * transaction and a delay result is returned. The task's attempt count is untouched.
 *
 * @param input - The script step's input.
 * @param due - The computed due time.
 * @returns A delay result, or undefined when the run should proceed.
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
    const { notificationTaskBotContext, model, entry, runNumber } = input;
    const applyInTransaction = applyNotificationTaskBotChangesInTransactionFactory(notificationTaskBotContext);
    const applied = await notificationTaskBotContext.firestoreContext.runTransaction((transaction) => applyInTransaction({ transaction, model, changes: [{ type: 'syncNat', entryId: entry.i, runNumber, nat: due }] }));

    if (applied.fenced || applied.unknownEntry) {
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
