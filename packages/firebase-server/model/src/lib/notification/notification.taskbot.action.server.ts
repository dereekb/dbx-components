import {
  type AppNotificationTaskBotScriptConfigServiceRef,
  type ApplyNotificationTaskBotChangeResult,
  appNotificationTaskBotScriptConfigService,
  applyNotificationTaskBotChanges,
  createNotificationDocument,
  type FirestoreContextReference,
  type FirestoreModelKey,
  getDocumentSnapshotData,
  iterateFirestoreDocumentSnapshotPairs,
  isNotificationTaskBotEntryRunnable,
  type NotificationFirestoreCollections,
  type NotificationTaskBot,
  type NotificationTaskBotChange,
  type NotificationTaskBotDocument,
  type NotificationTaskBotEntryData,
  type NotificationTaskBotEntryDataUpdate,
  type NotificationTaskBotEntryId,
  type NotificationTaskBotEnsureSchedule,
  type NotificationTaskBotEntryState,
  type NotificationTaskBotRepairChange,
  NotificationTaskBotRunTrigger,
  type NotificationTaskBotScriptType,
  NOTIFICATION_TASK_BOT_PAUSE_REASON_MANUAL,
  notificationTaskBotIdForModel,
  notificationTaskBotRunNotificationTaskTemplate,
  notificationTaskBotsDueForRepairQuery,
  type NotificationTaskKey,
  type RepairAllNotificationTaskBotsResult,
  type RunNotificationTaskBotEntryParams,
  type RunNotificationTaskBotEntryResult,
  runNotificationTaskBotEntryParamsType,
  type SendNotificationParams,
  type SendNotificationResult,
  type Transaction,
  type UpdateNotificationTaskBotEntryParams,
  type UpdateNotificationTaskBotEntryResult,
  updateNotificationTaskBotEntryParamsType,
  type NotificationDocument,
  firestoreDummyKey
} from '@dereekb/firebase';
import { type FirebaseServerActionsContext } from '@dereekb/firebase-server';
import { type TransformAndValidateFunctionResult } from '@dereekb/model';
import { type Maybe, type Milliseconds, MS_IN_HOUR } from '@dereekb/util';
import { notificationTaskBotEntryDoesNotExistError, notificationTaskBotEntryNotRunnableError } from './notification.error';

/**
 * @module notification.taskbot.action.server
 *
 * Server-side actions for {@link NotificationTaskBot}.
 *
 * Every bot write is a read-modify-write inside a transaction, routed through the pure `applyNotificationTaskBotChanges()`.
 * The runs that a change issues are created, and the runs it supersedes or cancels are deleted, in the same transaction.
 *
 * App domain code imports these factory functions directly; it never needs `NotificationServerActions`.
 */

// MARK: Context
/**
 * Narrow context the NotificationTaskBot actions need.
 */
export interface NotificationTaskBotServerActionsContext extends FirestoreContextReference, Pick<NotificationFirestoreCollections, 'notificationTaskBotCollection' | 'notificationBoxCollection' | 'notificationCollectionFactory' | 'notificationCollectionGroup'>, Partial<AppNotificationTaskBotScriptConfigServiceRef> {}

/**
 * Returns the script config service from the context, falling back to an empty registry.
 *
 * @param context - The context.
 * @returns The script config service.
 */
export function notificationTaskBotScriptConfigServiceForContext(context: Partial<AppNotificationTaskBotScriptConfigServiceRef>) {
  return context.appNotificationTaskBotScriptConfigService ?? appNotificationTaskBotScriptConfigService();
}

// MARK: Apply Changes
/**
 * Input for writing changes to a bot inside an existing transaction.
 */
export interface ApplyNotificationTaskBotChangesInTransactionInput {
  readonly transaction: Transaction;
  /**
   * Key of the model the bot is attached to.
   */
  readonly model: FirestoreModelKey;
  readonly changes: NotificationTaskBotChange[];
  readonly now?: Maybe<Date>;
  /**
   * The bot as already read in this transaction. When provided the bot is not read again, which lets a caller perform
   * its own reads first and still write afterwards.
   *
   * Null means the bot was read and does not exist.
   */
  readonly bot?: Maybe<Maybe<NotificationTaskBot>>;
}

/**
 * Result of {@link ApplyNotificationTaskBotChangesInTransactionFunction}.
 */
export interface ApplyNotificationTaskBotChangesInTransactionResult extends ApplyNotificationTaskBotChangeResult {
  readonly botDocument: NotificationTaskBotDocument;
}

export type ApplyNotificationTaskBotChangesInTransactionFunction = (input: ApplyNotificationTaskBotChangesInTransactionInput) => Promise<ApplyNotificationTaskBotChangesInTransactionResult>;

/**
 * Creates a function that reads a bot in a transaction (unless already read), applies changes, creates the issued
 * runs, deletes the superseded runs and writes the bot back.
 *
 * @param context - The NotificationTaskBot context.
 * @returns The function.
 */
export function applyNotificationTaskBotChangesInTransactionFactory(context: NotificationTaskBotServerActionsContext): ApplyNotificationTaskBotChangesInTransactionFunction {
  const { notificationTaskBotCollection, notificationCollectionGroup } = context;

  return async (input) => {
    const { transaction, model, changes, now: inputNow } = input;
    const now = inputNow ?? new Date();
    const botDocument = notificationTaskBotCollection.documentAccessorForTransaction(transaction).loadDocumentForId(notificationTaskBotIdForModel(model));
    const bot = input.bot === undefined ? await getDocumentSnapshotData(botDocument) : input.bot;

    const result = applyNotificationTaskBotChanges({ bot, model, changes, now });

    if (result.changed && result.bot) {
      const nextBot = result.bot;
      const notificationAccessor = notificationCollectionGroup.documentAccessorForTransaction(transaction);

      await Promise.all(result.deleteTaskKeys.map((key) => notificationAccessor.loadDocumentForKey(key).accessor.delete()));

      await Promise.all(
        result.createRuns.map((run) =>
          createNotificationDocument({
            context,
            transaction,
            now,
            template: notificationTaskBotRunNotificationTaskTemplate({
              model: nextBot.m,
              botKey: botDocument.key,
              botId: botDocument.id,
              entryId: run.entryId,
              scriptType: run.scriptType,
              runNumber: run.runNumber,
              trigger: run.trigger,
              sendAt: run.sendAt,
              explicit: run.explicit
            })
          })
        )
      );

      await botDocument.accessor.set(nextBot);
    }

    return { ...result, botDocument };
  };
}

/**
 * Input for {@link applyNotificationTaskBotChangesFactory}.
 */
export type ApplyNotificationTaskBotChangesInput = Omit<ApplyNotificationTaskBotChangesInTransactionInput, 'transaction' | 'bot'>;

/**
 * Creates a function that applies changes to a bot in a new transaction.
 *
 * @param context - The NotificationTaskBot context.
 * @returns The function.
 */
export function applyNotificationTaskBotChangesFactory(context: NotificationTaskBotServerActionsContext) {
  const { firestoreContext } = context;
  const applyInTransaction = applyNotificationTaskBotChangesInTransactionFactory(context);
  return (input: ApplyNotificationTaskBotChangesInput) => firestoreContext.runTransaction((transaction) => applyInTransaction({ ...input, transaction }));
}

// MARK: Library Helpers
/**
 * Input for ensuring an entry exists on the bot attached to a model.
 */
export interface EnsureNotificationTaskBotEntryInput<D extends NotificationTaskBotEntryData = NotificationTaskBotEntryData> {
  /**
   * Key of the model the bot is attached to. The bot is created when it does not exist.
   */
  readonly model: FirestoreModelKey;
  readonly entryId: NotificationTaskBotEntryId;
  readonly scriptType: NotificationTaskBotScriptType;
  /**
   * Initial data, only used when the entry is created.
   */
  readonly data?: Maybe<D>;
  /**
   * Initial state, only used when the entry is created. Defaults to ENABLED.
   */
  readonly state?: Maybe<NotificationTaskBotEntryState>;
  /**
   * When to schedule a run. Defaults to `'ifIdle'`.
   */
  readonly schedule?: Maybe<NotificationTaskBotEnsureSchedule>;
  readonly now?: Maybe<Date>;
}

/**
 * Creates a function that ensures an entry exists inside an existing transaction.
 *
 * @param context - The NotificationTaskBot context.
 * @returns The function.
 */
export function ensureNotificationTaskBotEntryInTransactionFactory(context: NotificationTaskBotServerActionsContext) {
  const applyInTransaction = applyNotificationTaskBotChangesInTransactionFactory(context);

  return (input: EnsureNotificationTaskBotEntryInput & { readonly transaction: Transaction }) => {
    const { transaction, model, entryId, scriptType, data, state, schedule, now } = input;
    return applyInTransaction({ transaction, model, now, changes: [{ type: 'ensure', entryId, scriptType, data, state, schedule }] });
  };
}

/**
 * Creates a function that ensures an entry exists in a new transaction.
 *
 * @param context - The NotificationTaskBot context.
 * @returns The function.
 */
export function ensureNotificationTaskBotEntryFactory(context: NotificationTaskBotServerActionsContext) {
  const { firestoreContext } = context;
  const ensureInTransaction = ensureNotificationTaskBotEntryInTransactionFactory(context);
  return (input: EnsureNotificationTaskBotEntryInput) => firestoreContext.runTransaction((transaction) => ensureInTransaction({ ...input, transaction }));
}

/**
 * Input for scheduling an entry.
 */
export interface ScheduleNotificationTaskBotEntryInput {
  readonly model: FirestoreModelKey;
  readonly entryId: NotificationTaskBotEntryId;
  /**
   * Explicit time to run at. When unset the run is due now.
   */
  readonly at?: Maybe<Date>;
  readonly trigger?: Maybe<NotificationTaskBotRunTrigger>;
  /**
   * Only schedules when the entry has no live run.
   */
  readonly ifIdle?: Maybe<boolean>;
  readonly now?: Maybe<Date>;
}

/**
 * Creates a function that supersedes an entry's live run with a new run.
 *
 * @param context - The NotificationTaskBot context.
 * @returns The function.
 */
export function scheduleNotificationTaskBotEntryFactory(context: NotificationTaskBotServerActionsContext) {
  const applyChanges = applyNotificationTaskBotChangesFactory(context);
  return (input: ScheduleNotificationTaskBotEntryInput) => {
    const { model, entryId, at, trigger, ifIdle, now } = input;
    return applyChanges({ model, now, changes: [{ type: 'schedule', entryId, at, trigger, ifIdle }] });
  };
}

/**
 * Input for updating an entry's data.
 */
export interface UpdateNotificationTaskBotEntryDataInput<D extends NotificationTaskBotEntryData = NotificationTaskBotEntryData> {
  readonly model: FirestoreModelKey;
  readonly entryId: NotificationTaskBotEntryId;
  /**
   * Data to merge in. A `null` value deletes the key.
   */
  readonly data: NotificationTaskBotEntryDataUpdate<D>;
  readonly now?: Maybe<Date>;
}

/**
 * Creates a function that merges data into an entry's data.
 *
 * @param context - The NotificationTaskBot context.
 * @returns The function.
 */
export function updateNotificationTaskBotEntryDataFactory(context: NotificationTaskBotServerActionsContext) {
  const applyChanges = applyNotificationTaskBotChangesFactory(context);
  return <D extends NotificationTaskBotEntryData = NotificationTaskBotEntryData>(input: UpdateNotificationTaskBotEntryDataInput<D>) => {
    const { model, entryId, data, now } = input;
    return applyChanges({ model, now, changes: [{ type: 'data', entryId, data }] });
  };
}

/**
 * Input for removing an entry.
 */
export interface RemoveNotificationTaskBotEntryInput {
  readonly model: FirestoreModelKey;
  readonly entryId: NotificationTaskBotEntryId;
}

/**
 * Creates a function that removes an entry and deletes its live run.
 *
 * Prefer removing and re-ensuring an entry over deleting the bot: the bot's run counter survives, so run ids never repeat.
 *
 * @param context - The NotificationTaskBot context.
 * @returns The function.
 */
export function removeNotificationTaskBotEntryFactory(context: NotificationTaskBotServerActionsContext) {
  const applyChanges = applyNotificationTaskBotChangesFactory(context);
  return (input: RemoveNotificationTaskBotEntryInput) => applyChanges({ model: input.model, changes: [{ type: 'remove', entryId: input.entryId }] });
}

/**
 * Input for deleting a bot.
 */
export interface DeleteNotificationTaskBotInput {
  readonly model: FirestoreModelKey;
}

/**
 * Result of deleting a bot.
 */
export interface DeleteNotificationTaskBotResult {
  readonly deleted: boolean;
  readonly deletedTaskKeys: NotificationTaskKey[];
}

/**
 * Creates a function that deletes the bot attached to a model, along with every entry's live run.
 *
 * Deleting a bot resets its run counter, so a recreated bot reuses run ids. Prefer removing entries instead.
 *
 * @param context - The NotificationTaskBot context.
 * @returns The function.
 */
export function deleteNotificationTaskBotFactory(context: NotificationTaskBotServerActionsContext) {
  const { firestoreContext, notificationTaskBotCollection, notificationCollectionGroup } = context;

  return (input: DeleteNotificationTaskBotInput): Promise<DeleteNotificationTaskBotResult> =>
    firestoreContext.runTransaction(async (transaction) => {
      const botDocument = notificationTaskBotCollection.documentAccessorForTransaction(transaction).loadDocumentForId(notificationTaskBotIdForModel(input.model));
      const bot = await getDocumentSnapshotData(botDocument);
      const deletedTaskKeys: NotificationTaskKey[] = [];

      if (bot) {
        const notificationAccessor = notificationCollectionGroup.documentAccessorForTransaction(transaction);

        bot.e.forEach((x) => {
          if (x.nk) {
            deletedTaskKeys.push(x.nk);
          }
        });

        await Promise.all(deletedTaskKeys.map((key) => notificationAccessor.loadDocumentForKey(key).accessor.delete()));
        await botDocument.accessor.delete();
      }

      return { deleted: bot != null, deletedTaskKeys };
    });
}

// MARK: API Actions
/**
 * Function that sends/runs a notification. Matches `NotificationServerActions.sendNotification`.
 */
export type NotificationTaskBotSendNotificationFunction = (params: SendNotificationParams) => Promise<TransformAndValidateFunctionResult<SendNotificationParams, (notificationDocument: NotificationDocument) => Promise<SendNotificationResult>>>;

/**
 * Context for the NotificationTaskBot API actions.
 */
export interface NotificationTaskBotApiServerActionsContext extends NotificationTaskBotServerActionsContext, Pick<FirebaseServerActionsContext, 'firebaseServerActionTransformFunctionFactory'> {
  /**
   * Used to run a run task immediately after the bot transaction commits. Passed in to avoid an import cycle.
   */
  readonly sendNotification: NotificationTaskBotSendNotificationFunction;
}

/**
 * Runs the given run task immediately, ignoring its send-at throttle.
 *
 * @param context - The API context.
 * @param taskKey - The run task's key.
 * @returns The send result.
 */
async function runNotificationTaskBotRunTaskImmediately(context: NotificationTaskBotApiServerActionsContext, taskKey: NotificationTaskKey): Promise<SendNotificationResult> {
  const send = await context.sendNotification({ key: firestoreDummyKey(), ignoreSendAtThrottle: true });
  return send(context.notificationCollectionGroup.documentAccessor().loadDocumentForKey(taskKey));
}

/**
 * Creates the `updateNotificationTaskBotEntry` API action: changes an entry's state, pause, schedule and last submitted at.
 *
 * @param context - The API context.
 * @returns The transform-and-validate action.
 */
export function updateNotificationTaskBotEntryFactory(context: NotificationTaskBotApiServerActionsContext) {
  const { firebaseServerActionTransformFunctionFactory, firestoreContext, notificationTaskBotCollection } = context;
  const applyInTransaction = applyNotificationTaskBotChangesInTransactionFactory(context);

  return firebaseServerActionTransformFunctionFactory(updateNotificationTaskBotEntryParamsType, async (params: UpdateNotificationTaskBotEntryParams) => {
    const { i: entryId, s, pause, nextRunAt, lsat, runImmediately } = params;

    return async (botDocument: NotificationTaskBotDocument): Promise<UpdateNotificationTaskBotEntryResult> => {
      const changes: NotificationTaskBotChange[] = [];

      if (s != null) {
        changes.push({ type: 'state', entryId, state: s });
      }

      if (pause != null) {
        changes.push({ type: 'pause', entryId, pause: pause ? { reason: NOTIFICATION_TASK_BOT_PAUSE_REASON_MANUAL } : false });
      }

      if (lsat !== undefined) {
        changes.push({ type: 'lsat', entryId, lsat });
      }

      if (nextRunAt !== undefined) {
        changes.push({ type: 'schedule', entryId, at: nextRunAt });
      }

      const result = await firestoreContext.runTransaction(async (transaction) => {
        const botDocumentInTransaction = notificationTaskBotCollection.documentAccessorForTransaction(transaction).loadDocumentFrom(botDocument);
        const bot = await getDocumentSnapshotData(botDocumentInTransaction);
        const entryExists = bot?.e.some((x) => x.i === entryId);

        if (!bot || !entryExists) {
          throw notificationTaskBotEntryDoesNotExistError(botDocument.key, entryId);
        }

        return applyInTransaction({ transaction, model: bot.m, bot, changes });
      });

      const taskKey = result.entry?.nk;
      let runResult: Maybe<SendNotificationResult>;

      if (runImmediately && taskKey) {
        runResult = await runNotificationTaskBotRunTaskImmediately(context, taskKey);
      }

      return { taskKey, runResult };
    };
  });
}

/**
 * Creates the `runNotificationTaskBotEntry` API action: supersedes an entry's live run with a MANUAL or FORCED run due
 * now, and runs it immediately after the transaction commits.
 *
 * @param context - The API context.
 * @returns The transform-and-validate action.
 */
export function runNotificationTaskBotEntryFactory(context: NotificationTaskBotApiServerActionsContext) {
  const { firebaseServerActionTransformFunctionFactory, firestoreContext, notificationTaskBotCollection } = context;
  const applyInTransaction = applyNotificationTaskBotChangesInTransactionFactory(context);

  return firebaseServerActionTransformFunctionFactory(runNotificationTaskBotEntryParamsType, async (params: RunNotificationTaskBotEntryParams) => {
    const { i: entryId, trigger: inputTrigger, runImmediately } = params;
    const trigger = inputTrigger ?? NotificationTaskBotRunTrigger.MANUAL;

    return async (botDocument: NotificationTaskBotDocument): Promise<RunNotificationTaskBotEntryResult> => {
      const result = await firestoreContext.runTransaction(async (transaction) => {
        const botDocumentInTransaction = notificationTaskBotCollection.documentAccessorForTransaction(transaction).loadDocumentFrom(botDocument);
        const bot = await getDocumentSnapshotData(botDocumentInTransaction);
        const entry = bot?.e.find((x) => x.i === entryId);

        if (!bot || !entry) {
          throw notificationTaskBotEntryDoesNotExistError(botDocument.key, entryId);
        } else if (!isNotificationTaskBotEntryRunnable(entry)) {
          throw notificationTaskBotEntryNotRunnableError(botDocument.key, entryId);
        }

        return applyInTransaction({ transaction, model: bot.m, bot, changes: [{ type: 'schedule', entryId, trigger }] });
      });

      const taskKey = result.createRuns[0].taskKey;
      let runResult: Maybe<SendNotificationResult>;

      if (runImmediately !== false) {
        runResult = await runNotificationTaskBotRunTaskImmediately(context, taskKey);
      }

      return { taskKey, runResult };
    };
  });
}

// MARK: Repair
/**
 * Params for {@link repairAllNotificationTaskBotsFactory}.
 */
export interface RepairAllNotificationTaskBotsParams {
  readonly now?: Maybe<Date>;
  /**
   * How long past its `nat` an entry must be before it is inspected. Defaults to one hour.
   */
  readonly overdueThreshold?: Maybe<Milliseconds>;
}

/**
 * Default for {@link RepairAllNotificationTaskBotsParams.overdueThreshold}.
 */
export const DEFAULT_NOTIFICATION_TASK_BOT_REPAIR_OVERDUE_THRESHOLD: Milliseconds = MS_IN_HOUR;

/**
 * Creates the repair sweep. Call it from the app's notification cron, after `sendQueuedNotifications`.
 *
 * For every entry whose `nat` is overdue, the run task is read: a pending task only syncs `nat`; a missing or finished
 * task is recorded as LOST and rescheduled, or paused once the script's maximum consecutive failures is reached.
 *
 * @param context - The NotificationTaskBot context.
 * @returns The repair function.
 */
export function repairAllNotificationTaskBotsFactory(context: NotificationTaskBotServerActionsContext) {
  const { firestoreContext, notificationTaskBotCollection, notificationCollectionGroup } = context;
  const scriptConfigService = notificationTaskBotScriptConfigServiceForContext(context);
  const applyInTransaction = applyNotificationTaskBotChangesInTransactionFactory(context);

  return async (params?: Maybe<RepairAllNotificationTaskBotsParams>): Promise<RepairAllNotificationTaskBotsResult> => {
    const now = params?.now ?? new Date();
    const overdueBefore = new Date(now.getTime() - (params?.overdueThreshold ?? DEFAULT_NOTIFICATION_TASK_BOT_REPAIR_OVERDUE_THRESHOLD));

    let entriesSynced = 0;
    let entriesRepaired = 0;

    const iterateResult = await iterateFirestoreDocumentSnapshotPairs({
      documentAccessor: notificationTaskBotCollection.documentAccessor(),
      queryFactory: notificationTaskBotCollection,
      constraintsFactory: () => notificationTaskBotsDueForRepairQuery(overdueBefore),
      batchSize: undefined,
      performTasksConfig: {
        maxParallelTasks: 10
      },
      iterateSnapshotPair: async (snapshotPair) => {
        const { document } = snapshotPair;

        const result = await firestoreContext.runTransaction(async (transaction) => {
          const botDocument = notificationTaskBotCollection.documentAccessorForTransaction(transaction).loadDocumentFrom(document);
          const bot = await getDocumentSnapshotData(botDocument);
          const overdueEntries = bot?.e.filter((x) => x.rn != null && x.nat != null && x.nat.getTime() <= overdueBefore.getTime()) ?? [];

          let synced = 0;
          let repaired = 0;

          if (bot && overdueEntries.length > 0) {
            const notificationAccessor = notificationCollectionGroup.documentAccessorForTransaction(transaction);
            const tasks = await Promise.all(overdueEntries.map((x) => (x.nk ? getDocumentSnapshotData(notificationAccessor.loadDocumentForKey(x.nk)) : undefined)));

            const changes: NotificationTaskBotRepairChange[] = overdueEntries.map((entry, i) => {
              const task = tasks[i];
              const pendingTaskSendAt = task && !task.d ? task.sat : undefined;
              const scriptConfig = scriptConfigService.configForScriptType(entry.t);

              if (pendingTaskSendAt) {
                synced += 1;
              } else {
                repaired += 1;
              }

              return {
                type: 'repair',
                entryId: entry.i,
                runNumber: entry.rn as number,
                pendingTaskSendAt,
                trigger: (task?.n.d as Maybe<{ tr?: NotificationTaskBotRunTrigger }>)?.tr,
                maxConsecutiveFailures: scriptConfig.maxConsecutiveFailures,
                historyLimit: scriptConfig.historyLimit
              };
            });

            await applyInTransaction({ transaction, model: bot.m, bot, changes, now });
          }

          return { synced, repaired };
        });

        entriesSynced += result.synced;
        entriesRepaired += result.repaired;
      }
    });

    return {
      botsChecked: iterateResult.totalSnapshotsVisited,
      entriesSynced,
      entriesRepaired
    };
  };
}

/**
 * Convenience: disables or enables an entry.
 *
 * @param context - The NotificationTaskBot context.
 * @returns The function.
 */
export function setNotificationTaskBotEntryStateFactory(context: NotificationTaskBotServerActionsContext) {
  const applyChanges = applyNotificationTaskBotChangesFactory(context);
  return (input: { readonly model: FirestoreModelKey; readonly entryId: NotificationTaskBotEntryId; readonly state: NotificationTaskBotEntryState }) => applyChanges({ model: input.model, changes: [{ type: 'state', entryId: input.entryId, state: input.state }] });
}
