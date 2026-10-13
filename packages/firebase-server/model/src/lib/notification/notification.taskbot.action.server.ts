import {
  type AppNotificationTaskBotScriptConfigServiceRef,
  type ApplyNotificationTaskBotChangeResult,
  type ContextGrantedModelRolesReader,
  type FirebaseAuthOwnershipKey,
  type FirebasePermissionErrorContext,
  type NotificationTaskBotOptOutsResult,
  type NotificationTaskBotRoles,
  notificationTaskBotEntryStatus,
  notificationTaskBotOwnerOptOutGroups,
  type ReadNotificationTaskBotOptOutsParams,
  readNotificationTaskBotOptOutsParamsType,
  type UpdateNotificationTaskBotOptOutParams,
  updateNotificationTaskBotOptOutParamsType,
  appNotificationTaskBotScriptConfigService,
  applyNotificationTaskBotChanges,
  assertNotificationTaskBotEntryDataPatchAllowed,
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
  notificationTaskBotEntry,
  type NotificationTaskBotEntryData,
  type NotificationTaskBotEntryDataUpdate,
  type NotificationTaskBotEntryId,
  type NotificationTaskBotEntrySeed,
  type NotificationTaskBotEnsureSchedule,
  type NotificationTaskBotEntryState,
  type NotificationTaskBotRepairChange,
  type NotificationTaskBotRunNotificationTaskData,
  type NotificationTaskBotRunNumber,
  NotificationTaskBotRunTrigger,
  type NotificationTaskBotScriptType,
  NOTIFICATION_TASK_BOT_PAUSE_REASON_FAILED,
  NOTIFICATION_TASK_BOT_PAUSE_REASON_MANUAL,
  notificationTaskBotIdForModel,
  notificationTaskBotRunNotificationTaskTemplate,
  notificationTaskBotsDueForRepairQuery,
  type NotificationTaskKey,
  type RepairAllNotificationTaskBotsResult,
  type RunNotificationTaskBotEntryParams,
  type RunNotificationTaskBotEntryResult,
  runNotificationTaskBotEntryParamsType,
  type SendNotificationResult,
  type Transaction,
  type UpdateNotificationTaskBotEntryParams,
  type UpdateNotificationTaskBotEntryResult,
  updateNotificationTaskBotEntryParamsType,
  firestoreDummyKey
} from '@dereekb/firebase';
import { type FirebaseServerActionsContext } from '@dereekb/firebase-server';
import { addMilliseconds, filterMaybeArrayValues, filterUndefinedValues, isPast, type Maybe, type Milliseconds, MS_IN_HOUR, objectHasNoKeys } from '@dereekb/util';
import { type NotificationServerActions } from './notification.action.server';
import {
  notificationTaskBotEntryDataPatchInvalidError,
  notificationTaskBotEntryDataPatchNotAllowedError,
  notificationTaskBotEntryDoesNotExistError,
  notificationTaskBotEntryNotRunnableError,
  notificationTaskBotEntryOptedOutError,
  notificationTaskBotOptOutNotAllowedError,
  notificationTaskBotOptOutRequiresOwnerError
} from './notification.error';

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
 *
 * The script registry is required: every write resolves each entry's owner opt-out group from it, so opt-outs are
 * reconciled on every write path.
 */
export interface NotificationTaskBotServerActionsContext extends FirestoreContextReference, Pick<NotificationFirestoreCollections, 'notificationTaskBotCollection' | 'notificationBoxCollection' | 'notificationCollectionFactory' | 'notificationCollectionGroup'>, AppNotificationTaskBotScriptConfigServiceRef {}

/**
 * Returns a ref to the script config service from the context, falling back to an empty registry.
 *
 * Spread it into a context that only optionally carries the registry to build a {@link NotificationTaskBotServerActionsContext}.
 *
 * @param context - The context.
 * @returns The script config service ref.
 */
export function notificationTaskBotScriptConfigServiceForContext(context: Partial<AppNotificationTaskBotScriptConfigServiceRef>): AppNotificationTaskBotScriptConfigServiceRef {
  return { appNotificationTaskBotScriptConfigService: context.appNotificationTaskBotScriptConfigService ?? appNotificationTaskBotScriptConfigService() };
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
  const { notificationTaskBotCollection, notificationCollectionGroup, appNotificationTaskBotScriptConfigService } = context;
  const optOutGroupKeyForScriptType = (scriptType: NotificationTaskBotScriptType) => appNotificationTaskBotScriptConfigService.optOutGroupKeyForScriptType(scriptType);

  return async (input) => {
    const { transaction, model, changes, now: inputNow } = input;
    const now = inputNow ?? new Date();
    const botDocument = notificationTaskBotCollection.documentAccessorForTransaction(transaction).loadDocumentForId(notificationTaskBotIdForModel(model));
    const bot = input.bot === undefined ? await getDocumentSnapshotData(botDocument) : input.bot;

    const result = applyNotificationTaskBotChanges({ bot, model, changes, now, optOutGroupKeyForScriptType });

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
   * When to schedule a run. Defaults to `'ifIdle'`. A Date schedules a run that starts no sooner than that time, and the
   * script's due check still applies, unless {@link explicit} is true.
   */
  readonly schedule?: Maybe<NotificationTaskBotEnsureSchedule>;
  /**
   * When true and {@link schedule} is a Date, the run starts at exactly that time and skips the script's due check.
   */
  readonly explicit?: Maybe<boolean>;
  /**
   * Values the entry is created with, for carrying over the state of an earlier, app-specific bot. Ignored when the
   * entry already exists, so a migration can be re-run safely. Seeded history is capped to the script's history limit.
   */
  readonly seed?: Maybe<NotificationTaskBotEntrySeed>;
  /**
   * When provided, sets the bot's owner key. Pass the key the attached model's NotificationBox uses (e.g. `'pr/<uid>'`)
   * on every ensure so the owner stays in sync. Null clears it.
   */
  readonly owner?: Maybe<FirebaseAuthOwnershipKey>;
  readonly now?: Maybe<Date>;
}

/**
 * Input for {@link ensureNotificationTaskBotEntryInTransactionFactory}.
 */
export interface EnsureNotificationTaskBotEntryInTransactionInput<D extends NotificationTaskBotEntryData = NotificationTaskBotEntryData> extends EnsureNotificationTaskBotEntryInput<D>, Pick<ApplyNotificationTaskBotChangesInTransactionInput, 'transaction' | 'bot'> {}

/**
 * Creates a function that ensures an entry exists inside an existing transaction.
 *
 * @param context - The NotificationTaskBot context.
 * @returns The function.
 */
export function ensureNotificationTaskBotEntryInTransactionFactory(context: NotificationTaskBotServerActionsContext) {
  const { appNotificationTaskBotScriptConfigService } = context;
  const applyInTransaction = applyNotificationTaskBotChangesInTransactionFactory(context);

  return (input: EnsureNotificationTaskBotEntryInTransactionInput) => {
    const { transaction, bot, model, entryId, scriptType, data, state, schedule, explicit, seed, owner, now } = input;
    const historyLimit = appNotificationTaskBotScriptConfigService.configForScriptType(scriptType).historyLimit; // caps the seeded history
    return applyInTransaction({ transaction, bot, model, now, changes: [{ type: 'ensure', entryId, scriptType, data, state, schedule, explicit, seed, historyLimit, owner }] });
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
   * When to run. The run starts no sooner than this time and the script's due check still applies, unless
   * {@link explicit} is true. When unset the run is due now.
   */
  readonly at?: Maybe<Date>;
  /**
   * When true and {@link at} is set, the run starts at exactly that time and skips the script's due check.
   */
  readonly explicit?: Maybe<boolean>;
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
    const { model, entryId, at, explicit, trigger, ifIdle, now } = input;
    return applyChanges({ model, now, changes: [{ type: 'schedule', entryId, at, explicit, trigger, ifIdle }] });
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
 * Input for {@link setNotificationTaskBotOwnerFactory}.
 */
export interface SetNotificationTaskBotOwnerInput {
  readonly model: FirestoreModelKey;
  /**
   * The new owner key, or null to clear it. Existing opt-outs are kept.
   */
  readonly owner: Maybe<FirebaseAuthOwnershipKey>;
  readonly now?: Maybe<Date>;
}

/**
 * Creates a function that sets or clears the owner key of the bot attached to a model. A no-op when the bot does not
 * exist.
 *
 * Existing opt-outs are kept, since an opt-out does not record who made it.
 *
 * @param context - The NotificationTaskBot context.
 * @returns The function.
 */
export function setNotificationTaskBotOwnerFactory(context: NotificationTaskBotServerActionsContext) {
  const applyChanges = applyNotificationTaskBotChangesFactory(context);
  return (input: SetNotificationTaskBotOwnerInput) => applyChanges({ model: input.model, now: input.now, changes: [{ type: 'owner', owner: input.owner }] });
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
      const deletedTaskKeys: NotificationTaskKey[] = filterMaybeArrayValues(bot?.e.map((x) => x.nk) ?? []);

      if (bot) {
        const notificationAccessor = notificationCollectionGroup.documentAccessorForTransaction(transaction);
        await Promise.all(deletedTaskKeys.map((key) => notificationAccessor.loadDocumentForKey(key).accessor.delete()));
        await botDocument.accessor.delete();
      }

      return { deleted: bot != null, deletedTaskKeys };
    });
}

// MARK: API Actions
/**
 * Function that sends/runs a notification. Same as `NotificationServerActions.sendNotification`.
 */
export type NotificationTaskBotSendNotificationFunction = NotificationServerActions['sendNotification'];

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
 * Creates the `updateNotificationTaskBotEntry` API action: changes an entry's data, state, pause, schedule and last
 * submitted at.
 *
 * Changes apply in order, all in one transaction: data, state, pause, last submitted at, then schedule.
 * `nextRunAtExplicit` wins over `nextRunAt`, and `pause: false` wins over `pauseUntil`. `runImmediately` is skipped when
 * this same request scheduled the live run in the future.
 *
 * A data patch (`updateData`) is checked with `assertNotificationTaskBotEntryDataPatchAllowed()` against the entry read
 * inside the same transaction: the script must set a `dataType`, and the data after the patch must satisfy it. A refused
 * patch refuses the whole request. A patch with no keys is ignored. A patch never issues, cancels or supersedes a run.
 *
 * @param context - The API context.
 * @returns The transform-and-validate action.
 */
export function updateNotificationTaskBotEntryFactory(context: NotificationTaskBotApiServerActionsContext) {
  const { firebaseServerActionTransformFunctionFactory, firestoreContext, notificationTaskBotCollection, appNotificationTaskBotScriptConfigService: scriptConfigService } = context;
  const applyInTransaction = applyNotificationTaskBotChangesInTransactionFactory(context);

  return firebaseServerActionTransformFunctionFactory(updateNotificationTaskBotEntryParamsType, async (params: UpdateNotificationTaskBotEntryParams) => {
    const { i: entryId, s, pause, pauseUntil, nextRunAt, nextRunAtExplicit, lsat, runImmediately, updateData: inputUpdateData } = params;
    const updateData = inputUpdateData == null ? undefined : filterUndefinedValues(inputUpdateData); // keeps the nulls, which delete keys
    const dataPatch = updateData != null && !objectHasNoKeys(updateData) ? updateData : undefined; // a patch with no keys is ignored

    return async (botDocument: NotificationTaskBotDocument): Promise<UpdateNotificationTaskBotEntryResult> => {
      const changes: NotificationTaskBotChange[] = [];

      if (dataPatch) {
        changes.push({ type: 'data', entryId, data: dataPatch });
      }

      if (s != null) {
        changes.push({ type: 'state', entryId, state: s });
      }

      if (pause === false) {
        changes.push({ type: 'pause', entryId, pause: false });
      } else if (pauseUntil != null) {
        changes.push({ type: 'pause', entryId, pause: { reason: NOTIFICATION_TASK_BOT_PAUSE_REASON_MANUAL, until: pauseUntil } });
      } else if (pause === true) {
        changes.push({ type: 'pause', entryId, pause: { reason: NOTIFICATION_TASK_BOT_PAUSE_REASON_MANUAL } });
      }

      if (lsat !== undefined) {
        changes.push({ type: 'lsat', entryId, lsat });
      }

      if (nextRunAtExplicit != null) {
        changes.push({ type: 'schedule', entryId, at: nextRunAtExplicit, explicit: true });
      } else if (nextRunAt !== undefined) {
        changes.push({ type: 'schedule', entryId, at: nextRunAt, explicit: false });
      }

      // a run this request scheduled in the future must wait for its time
      const requestedNextRunAt = nextRunAtExplicit ?? nextRunAt;
      const scheduledInTheFuture = (requestedNextRunAt != null && !isPast(requestedNextRunAt)) || (pause !== false && pauseUntil != null);

      const entry = await firestoreContext.runTransaction(async (transaction) => {
        const botDocumentInTransaction = notificationTaskBotCollection.documentAccessorForTransaction(transaction).loadDocumentFrom(botDocument);
        const bot = await getDocumentSnapshotData(botDocumentInTransaction);
        const currentEntry = notificationTaskBotEntry(bot, entryId);

        if (!bot || !currentEntry) {
          throw notificationTaskBotEntryDoesNotExistError(botDocument.key, entryId);
        }

        if (dataPatch) {
          const patch = assertNotificationTaskBotEntryDataPatchAllowed({ scriptConfig: scriptConfigService.configForScriptType(currentEntry.t), data: currentEntry.d, update: dataPatch });

          if (!patch.allowed) {
            const errorInput = { key: botDocument.key, entryId, scriptType: currentEntry.t, problems: patch.problems };
            throw patch.reason === 'not_allowed' ? notificationTaskBotEntryDataPatchNotAllowedError(errorInput) : notificationTaskBotEntryDataPatchInvalidError(errorInput);
          }
        }

        const result = await applyInTransaction({ transaction, model: bot.m, bot, changes });
        return result.entry ?? currentEntry;
      });

      // an opted-out entry reports opted_out, since a resume, enable or reschedule can't take effect until the owner opts back in
      const status = notificationTaskBotEntryStatus(entry);
      const taskKey = entry.nk;
      let runResult: Maybe<SendNotificationResult>;

      if (runImmediately && taskKey && !scheduledInTheFuture) {
        runResult = await runNotificationTaskBotRunTaskImmediately(context, taskKey);
      }

      return { status, taskKey, runResult };
    };
  });
}

/**
 * Creates the `runNotificationTaskBotEntry` API action: supersedes an entry's live run with a MANUAL or FORCED run due
 * now, and runs it immediately after the transaction commits.
 *
 * Disabled, paused and opted-out entries are refused, except that a FORCED run resumes an entry paused with the
 * `'failed'` reason first (stamping `rpr: 'failed'` and resetting `fc`). A stalled run is superseded like any other live
 * run: its task is deleted, and the new run clears `stl`.
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
        const entry = notificationTaskBotEntry(bot, entryId);
        // FORCED is how an admin restarts an entry the bot stopped: it clears a 'failed' pause first
        const resumeFailedPause = trigger === NotificationTaskBotRunTrigger.FORCED && entry?.pat != null && entry.pr === NOTIFICATION_TASK_BOT_PAUSE_REASON_FAILED;

        if (!bot || !entry) {
          throw notificationTaskBotEntryDoesNotExistError(botDocument.key, entryId);
        } else if (entry.oat != null) {
          throw notificationTaskBotEntryOptedOutError(botDocument.key, entryId, entry.oat);
        } else if (!isNotificationTaskBotEntryRunnable(resumeFailedPause ? { ...entry, pat: null } : entry)) {
          throw notificationTaskBotEntryNotRunnableError(botDocument.key, entryId);
        }

        const scheduleChange: NotificationTaskBotChange = { type: 'schedule', entryId, trigger };
        const changes: NotificationTaskBotChange[] = resumeFailedPause ? [{ type: 'pause', entryId, pause: false, reschedule: false }, scheduleChange] : [scheduleChange];

        return applyInTransaction({ transaction, model: bot.m, bot, changes });
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

// MARK: Owner Opt-Outs
/**
 * The roles reader the opt-out actions take, as produced by the app's `useModel('notificationTaskBot', ...)`.
 *
 * The actions take the reader rather than the bare document so a handler can't forge ownership: the `optOut` role is
 * checked against the reader's granted roles, and the reader's already-loaded data is reused.
 */
export type NotificationTaskBotOptOutRolesReader = Pick<ContextGrantedModelRolesReader<FirebasePermissionErrorContext, NotificationTaskBot, NotificationTaskBotDocument, NotificationTaskBotRoles>, 'data' | 'document' | 'containsRoles'>;

/**
 * Creates the `readNotificationTaskBotOptOuts` API action: lists the script groups the bot's owner can opt out of.
 *
 * Built from the roles reader's already-loaded data, so there is no second read. Use it with the `optOut` role, which
 * the owner holds explicitly and admins hold through full access.
 *
 * @param context - The API context.
 * @returns The transform-and-validate action.
 */
export function readNotificationTaskBotOptOutsFactory(context: NotificationTaskBotApiServerActionsContext) {
  const { firebaseServerActionTransformFunctionFactory, appNotificationTaskBotScriptConfigService: scriptConfigService } = context;

  return firebaseServerActionTransformFunctionFactory(readNotificationTaskBotOptOutsParamsType, async (_params: ReadNotificationTaskBotOptOutsParams) => {
    return async (rolesReader: NotificationTaskBotOptOutRolesReader): Promise<NotificationTaskBotOptOutsResult> => {
      return { groups: notificationTaskBotOwnerOptOutGroups({ bot: rolesReader.data, scriptConfigService }) };
    };
  });
}

/**
 * Creates the `updateNotificationTaskBotOptOut` API action: opts the bot's owner out of (or back into) script groups.
 *
 * Requires the `optOut` role to be granted EXPLICITLY (full access doesn't count), so admins can read opt-outs but never
 * change them in either direction: an admin has no way to undo an owner's opt-out.
 *
 * Inside one transaction it re-reads the bot, validates each group against the owner view of that bot, applies one
 * `optOut` change per group and returns the new view.
 *
 * - A notification created before the opt-out commits is still delivered.
 * - Opting in wakes idle entries, the same as an admin resume.
 * - Removing an entry drops its opt-out; a later ensure only re-applies it while a sibling in the group is opted out.
 *
 * @param context - The API context.
 * @returns The transform-and-validate action.
 */
export function updateNotificationTaskBotOptOutFactory(context: NotificationTaskBotApiServerActionsContext) {
  const { firebaseServerActionTransformFunctionFactory, firestoreContext, notificationTaskBotCollection, appNotificationTaskBotScriptConfigService: scriptConfigService } = context;
  const applyInTransaction = applyNotificationTaskBotChangesInTransactionFactory(context);

  return firebaseServerActionTransformFunctionFactory(updateNotificationTaskBotOptOutParamsType, async (params: UpdateNotificationTaskBotOptOutParams) => {
    const optOut = params.optOut ?? [];
    const optIn = params.optIn ?? [];

    return async (rolesReader: NotificationTaskBotOptOutRolesReader): Promise<NotificationTaskBotOptOutsResult> => {
      const botDocument = rolesReader.document;

      if (!rolesReader.containsRoles('any', 'optOut')) {
        throw notificationTaskBotOptOutRequiresOwnerError(botDocument.key);
      }

      return firestoreContext.runTransaction(async (transaction) => {
        const botDocumentInTransaction = notificationTaskBotCollection.documentAccessorForTransaction(transaction).loadDocumentFrom(botDocument);
        const bot = await getDocumentSnapshotData(botDocumentInTransaction);
        const allowedGroupKeys = new Set(notificationTaskBotOwnerOptOutGroups({ bot, scriptConfigService }).map((x) => x.key));
        const optInSet = new Set(optIn);
        const notAllowed = [...optOut.filter((x) => optInSet.has(x)), ...[...optOut, ...optIn].filter((x) => !allowedGroupKeys.has(x))];

        if (notAllowed.length > 0) {
          throw notificationTaskBotOptOutNotAllowedError(botDocument.key, Array.from(new Set(notAllowed)));
        }

        let nextBot: Maybe<NotificationTaskBot> = bot;

        if (bot && (optOut.length > 0 || optIn.length > 0)) {
          const changes: NotificationTaskBotChange[] = [...optOut.map((group) => ({ type: 'optOut' as const, group, optOut: true })), ...optIn.map((group) => ({ type: 'optOut' as const, group, optOut: false }))];
          const result = await applyInTransaction({ transaction, model: bot.m, bot, changes });
          nextBot = result.bot;
        }

        return { groups: notificationTaskBotOwnerOptOutGroups({ bot: nextBot, scriptConfigService }) };
      });
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
   *
   * Also the stall threshold: a pending run task whose send time is this far in the past has not been picked up, and its
   * entry is marked stalled.
   */
  readonly overdueThreshold?: Maybe<Milliseconds>;
}

/**
 * Default for {@link RepairAllNotificationTaskBotsParams.overdueThreshold}, which is also the stall threshold.
 */
export const DEFAULT_NOTIFICATION_TASK_BOT_REPAIR_OVERDUE_THRESHOLD: Milliseconds = MS_IN_HOUR;

/**
 * Creates the repair sweep. Call it from the app's notification cron, after `sendQueuedNotifications`.
 *
 * For every entry whose `nat` is overdue, the run task is read:
 * - a pending task syncs `nat`, and marks the entry stalled (`stl`) when the task has failed attempts or its send time is
 *   past the overdue threshold (nothing has picked it up);
 * - a missing or finished task is recorded as LOST, then the script's `lostRunPolicy` applies: `'stop'` (the default)
 *   pauses the entry with `'failed'`, `'idle'` leaves it idle, and `'retry'` issues a new run. Under `'idle'` and
 *   `'retry'` the entry is paused instead once the script's maximum consecutive failures is reached.
 *
 * The result counts the entries newly marked stalled (`entriesStalled`), for the cron to log or alert on.
 *
 * @param context - The NotificationTaskBot context.
 * @returns The repair function.
 */
export function repairAllNotificationTaskBotsFactory(context: NotificationTaskBotServerActionsContext) {
  const { firestoreContext, notificationTaskBotCollection, notificationCollectionGroup, appNotificationTaskBotScriptConfigService: scriptConfigService } = context;
  const applyInTransaction = applyNotificationTaskBotChangesInTransactionFactory(context);

  return async (params?: Maybe<RepairAllNotificationTaskBotsParams>): Promise<RepairAllNotificationTaskBotsResult> => {
    const now = params?.now ?? new Date();
    const overdueBefore = addMilliseconds(now, -(params?.overdueThreshold ?? DEFAULT_NOTIFICATION_TASK_BOT_REPAIR_OVERDUE_THRESHOLD));

    let entriesSynced = 0;
    let entriesStalled = 0;
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
          let stalled = 0;
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
                runNumber: entry.rn as NotificationTaskBotRunNumber,
                pendingTaskSendAt,
                pendingTaskAttempts: task?.a,
                stalledBefore: overdueBefore,
                lostRunPolicy: scriptConfig.lostRunPolicy,
                trigger: (task?.n.d as Maybe<NotificationTaskBotRunNotificationTaskData>)?.tr,
                maxConsecutiveFailures: scriptConfig.maxConsecutiveFailures,
                historyLimit: scriptConfig.historyLimit
              };
            });

            // the pure apply is the only judge of a stall, so count the entries it newly marked
            const stalledEntryIds = new Set(bot.e.filter((x) => x.stl != null).map((x) => x.i));
            const applied = await applyInTransaction({ transaction, model: bot.m, bot, changes, now });
            stalled = applied.bot?.e.filter((x) => x.stl != null && !stalledEntryIds.has(x.i)).length ?? 0;
          }

          return { synced, stalled, repaired };
        });

        entriesSynced += result.synced;
        entriesStalled += result.stalled;
        entriesRepaired += result.repaired;
      }
    });

    return {
      botsChecked: iterateResult.totalSnapshotsVisited,
      entriesSynced,
      entriesStalled,
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
