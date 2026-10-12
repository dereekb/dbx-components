/**
 * @module notification.taskbot.util
 *
 * Pure state transitions for a {@link NotificationTaskBot}.
 *
 * Every bot write goes through {@link applyNotificationTaskBotChange}: the server reads the bot inside a transaction,
 * applies one or more changes, creates the requested run tasks, deletes the superseded ones, and writes the bot back.
 * Keeping the transitions pure keeps the fence, the run counter and the `nat` bookkeeping in one testable place.
 *
 * Run timing. Every run has a scheduled time (`sa` on the run task, also its first send time):
 * - No run except a FORCED one starts its first step before `sa`. The run handler enforces this before the first step,
 *   so it holds even for scripts that never call the due-check helper.
 * - A run is either "not before" (the default) or explicit. A not-before run starts at `sa` or later and the script's
 *   due check still applies. An explicit run starts at `sa` and skips the due check. A run with no time is due now and
 *   also runs the due check.
 * - A Date alone always means "not before". Explicit is opt-in: `explicit: true` on `ensure` and `schedule`, and
 *   `nextRunAtExplicit` on cleanup instructions and the `update:entry` API.
 * - MANUAL runs are always due now. When the due check finds one not due, it hands over to a SCHEDULED not-before run at
 *   the due time ({@link NotificationTaskBotDeferRunChange}).
 * - The next run a cleanup schedules is never sooner than now plus the script's `minimumRunInterval`.
 *
 * Pausing. A paused entry has no live run, except when it is paused until a time (`pu`): it then keeps a not-before
 * resume run at `pu`, which resumes the entry when it starts ({@link NotificationTaskBotExpirePauseChange}).
 *
 * Resuming. Every resume stamps the cleared pause reason on the entry (`rpr`) until the next run completes, so a
 * script can undo its own pause's side effects (e.g. reset a counter) in its first step.
 */
import { addMilliseconds, type Maybe, type Milliseconds, stripObject, takeLast } from '@dereekb/util';
import { earliestDate, isSameDate, latestDate } from '@dereekb/date';
import { type ClearableObjectUpdate, mergeClearableObjectUpdate } from '@dereekb/model';
import { type FirebaseAuthOwnershipKey, type FirestoreModelKey } from '../../common';
import { type NotificationTaskBotEntryId, type NotificationTaskBotRunNumber, type NotificationTaskBotScriptGroupKey, type NotificationTaskKey, isNotificationTaskBotEntryId, notificationTaskBotIdForModel } from './notification.id';
import {
  type NotificationTaskBot,
  type NotificationTaskBotEmbeddedScriptEntry,
  type NotificationTaskBotEntryData,
  type NotificationTaskBotEntryHistoryItem,
  NotificationTaskBotEntryState,
  NotificationTaskBotEntryStatus,
  NOTIFICATION_TASK_BOT_PAUSE_REASON_FAILED,
  type NotificationTaskBotPauseReason,
  NotificationTaskBotRunOutcome,
  NotificationTaskBotRunTrigger,
  type NotificationTaskBotScriptType
} from './notification.taskbot';
import { DEFAULT_NOTIFICATION_TASK_BOT_SCRIPT_HISTORY_LIMIT, DEFAULT_NOTIFICATION_TASK_BOT_SCRIPT_MAX_CONSECUTIVE_FAILURES, DEFAULT_NOTIFICATION_TASK_BOT_SCRIPT_MINIMUM_RUN_INTERVAL } from './notification.taskbot.script';
import { notificationTaskBotRunNotificationTaskKey } from './notification.taskbot.task';

// MARK: Entry Utilities
/**
 * Returns the entry with the given id, if it exists on the bot.
 *
 * @param bot - The bot to search.
 * @param entryId - The entry id.
 * @returns The entry, or undefined.
 */
export function notificationTaskBotEntry<D extends NotificationTaskBotEntryData = NotificationTaskBotEntryData>(bot: Maybe<Pick<NotificationTaskBot, 'e'>>, entryId: NotificationTaskBotEntryId): Maybe<NotificationTaskBotEmbeddedScriptEntry<D>> {
  return bot?.e.find((x) => x.i === entryId) as Maybe<NotificationTaskBotEmbeddedScriptEntry<D>>;
}

/**
 * Computes the status of an entry.
 *
 * A paused entry reports PAUSED even while it holds its resume run (see {@link NotificationTaskBotEmbeddedScriptEntry.pu}).
 *
 * @param entry - The entry.
 * @returns OPTED_OUT, DISABLED, PAUSED, SCHEDULED (has a live run) or IDLE.
 */
export function notificationTaskBotEntryStatus(entry: Pick<NotificationTaskBotEmbeddedScriptEntry, 's' | 'pat' | 'rn' | 'oat'>): NotificationTaskBotEntryStatus {
  let status: NotificationTaskBotEntryStatus;

  if (entry.oat != null) {
    status = NotificationTaskBotEntryStatus.OPTED_OUT;
  } else if (entry.s === NotificationTaskBotEntryState.DISABLED) {
    status = NotificationTaskBotEntryStatus.DISABLED;
  } else if (entry.pat != null) {
    status = NotificationTaskBotEntryStatus.PAUSED;
  } else if (entry.rn == null) {
    status = NotificationTaskBotEntryStatus.IDLE;
  } else {
    status = NotificationTaskBotEntryStatus.SCHEDULED;
  }

  return status;
}

/**
 * Returns true if the entry is enabled, not paused and not opted out, meaning it may have a live run.
 *
 * @param entry - The entry.
 * @returns True if the entry is runnable.
 */
export function isNotificationTaskBotEntryRunnable(entry: Pick<NotificationTaskBotEmbeddedScriptEntry, 's' | 'pat' | 'oat'>): boolean {
  return entry.s !== NotificationTaskBotEntryState.DISABLED && entry.pat == null && entry.oat == null;
}

/**
 * Returns the soonest `nat` among entries with a live run.
 *
 * @param entries - The bot's entries.
 * @returns The soonest next run date, or undefined when no entry has a live run.
 */
export function notificationTaskBotNextRunAt(entries: Pick<NotificationTaskBotEmbeddedScriptEntry, 'rn' | 'nat'>[]): Maybe<Date> {
  return earliestDate(entries.map((x) => (x.rn == null ? undefined : x.nat)));
}

/**
 * Merges a data update into an entry's data using {@link mergeClearableObjectUpdate}. A `null` value deletes the key; `undefined` values are ignored.
 *
 * @param current - The current data.
 * @param update - The update to merge in.
 * @returns The merged data, or undefined when no keys remain. The current data is returned as-is when there is no update.
 */
export function mergeNotificationTaskBotEntryData<D extends NotificationTaskBotEntryData = NotificationTaskBotEntryData>(current: Maybe<D>, update: Maybe<NotificationTaskBotEntryDataUpdate<D>>): Maybe<D> {
  return update == null ? current : (stripObject(mergeClearableObjectUpdate<D>(current, update), false) as Maybe<D>);
}

/**
 * An update to an entry's data. A `null` value deletes the key.
 */
export type NotificationTaskBotEntryDataUpdate<D extends NotificationTaskBotEntryData = NotificationTaskBotEntryData> = ClearableObjectUpdate<D>;

/**
 * Appends a history item, keeping at most `limit` items (oldest are dropped).
 *
 * @param history - The current history, oldest first.
 * @param item - The item to append.
 * @param limit - Maximum number of items to keep.
 * @param replaceLast - When true and the history is not empty, the last item is replaced instead of appending.
 * @returns The new history.
 */
export function appendNotificationTaskBotEntryHistoryItem<HD extends NotificationTaskBotEntryData = NotificationTaskBotEntryData>(history: NotificationTaskBotEntryHistoryItem<HD>[], item: NotificationTaskBotEntryHistoryItem<HD>, limit: number, replaceLast?: Maybe<boolean>): NotificationTaskBotEntryHistoryItem<HD>[] {
  const base = replaceLast && history.length > 0 ? history.slice(0, history.length - 1) : history;
  return takeLast([...base, item], Math.max(0, limit));
}

// MARK: Changes
/**
 * A pause applied to an entry.
 */
export interface NotificationTaskBotPause {
  readonly reason: NotificationTaskBotPauseReason;
  /**
   * When set, the entry resumes on its own at this time. A time in the past resumes it on the next queue pass.
   */
  readonly until?: Maybe<Date>;
}

/**
 * A history item seeded by {@link NotificationTaskBotEntrySeed}. Seeded items are stamped with run number `0`, which
 * never collides with a real run.
 *
 * @template HD - history item data type
 */
export type NotificationTaskBotEntrySeedHistoryItem<HD extends NotificationTaskBotEntryData = NotificationTaskBotEntryData> = Omit<NotificationTaskBotEntryHistoryItem<HD>, 'rn'>;

/**
 * A pause seeded by {@link NotificationTaskBotEntrySeed}.
 */
export interface NotificationTaskBotEntrySeedPause extends NotificationTaskBotPause {
  /**
   * When the entry was paused. Defaults to now.
   */
  readonly at?: Maybe<Date>;
}

/**
 * Values an entry is created with, only used when `ensure` creates the entry. For carrying over the state of an
 * earlier, app-specific bot. Never touches the fence (`rn`/`nk`) or the bot's run counter.
 *
 * `lsr` is not seedable: it is the per-run idempotency marker, so a seeded value would either mean nothing or make a
 * future run think it already submitted.
 *
 * @template HD - history item data type
 */
export interface NotificationTaskBotEntrySeed<HD extends NotificationTaskBotEntryData = NotificationTaskBotEntryData> {
  /**
   * The cadence anchor (last submitted at).
   */
  readonly lsat?: Maybe<Date>;
  /**
   * When the last run finished.
   */
  readonly lat?: Maybe<Date>;
  /**
   * Lifetime submission count. Must be a non-negative integer.
   */
  readonly sc?: Maybe<number>;
  /**
   * History, in any order. Sorted by `at`, capped to the history limit (newest kept) and stamped with run number `0`.
   */
  readonly h?: Maybe<NotificationTaskBotEntrySeedHistoryItem<HD>[]>;
  /**
   * Creates the entry paused. With `until`, the entry also gets its resume run.
   */
  readonly pause?: Maybe<NotificationTaskBotEntrySeedPause>;
}

/**
 * When to schedule a run as part of {@link NotificationTaskBotEnsureChange}.
 *
 * - `'ifIdle'`: schedule a run due now only if the entry is enabled, not paused, and has no live run.
 * - `'now'`: supersede any live run with a run due now.
 * - `Date`: supersede any live run with a run that starts no sooner than that time. The script's due check still
 *   applies, unless {@link NotificationTaskBotEnsureChange.explicit} is true.
 * - `false`: do not schedule.
 */
export type NotificationTaskBotEnsureSchedule = 'ifIdle' | 'now' | Date | false;

/**
 * Creates the entry when it does not exist, reconciles its owner opt-out, then optionally schedules it.
 *
 * Also re-issues the resume run of an entry paused until a time when that run went missing.
 *
 * When {@link ApplyNotificationTaskBotChangeInput.optOutGroupKeyForScriptType} is provided:
 * - an entry whose script allows owner opt-out joins its group opted out when another entry in the group is opted out
 *   (a new entry is then created with no run), so the owner's group toggle holds as entries come and go;
 * - an entry whose script no longer allows owner opt-out has its `oat` cleared, since neither the owner nor an admin
 *   could otherwise reach it.
 */
export interface NotificationTaskBotEnsureChange<D extends NotificationTaskBotEntryData = NotificationTaskBotEntryData> {
  readonly type: 'ensure';
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
   * Defaults to `'ifIdle'`.
   */
  readonly schedule?: Maybe<NotificationTaskBotEnsureSchedule>;
  /**
   * When true and {@link schedule} is a Date, the run is explicit: it starts at that time and skips the script's due
   * check. Defaults to false (not before).
   */
  readonly explicit?: Maybe<boolean>;
  /**
   * Values the entry is created with. Ignored when the entry already exists, so a migration can be re-run safely.
   */
  readonly seed?: Maybe<NotificationTaskBotEntrySeed>;
  /**
   * Caps the seeded history. Defaults to {@link DEFAULT_NOTIFICATION_TASK_BOT_SCRIPT_HISTORY_LIMIT}. The server fills
   * it from the script registry.
   */
  readonly historyLimit?: Maybe<number>;
  /**
   * When provided, sets the bot's owner key (`o`), so each ensure keeps the owner in sync with the attached model's
   * owner. Null clears it.
   */
  readonly owner?: Maybe<FirebaseAuthOwnershipKey>;
}

/**
 * Supersedes any live run with a new run. No-op when the entry is disabled or paused.
 */
export interface NotificationTaskBotScheduleChange {
  readonly type: 'schedule';
  readonly entryId: NotificationTaskBotEntryId;
  /**
   * When to run. The run starts no sooner than this time and the script's due check still applies, unless
   * {@link explicit} is true. When unset the run is due now and the script computes the real due time.
   */
  readonly at?: Maybe<Date>;
  /**
   * When true and {@link at} is set, the run is explicit: it starts at {@link at} and skips the script's due check.
   * Defaults to false.
   */
  readonly explicit?: Maybe<boolean>;
  /**
   * Defaults to SCHEDULED.
   */
  readonly trigger?: Maybe<NotificationTaskBotRunTrigger>;
  /**
   * When true, only schedules if the entry has no live run.
   */
  readonly ifIdle?: Maybe<boolean>;
}

/**
 * Cancels the live run, if any. The entry goes idle.
 */
export interface NotificationTaskBotCancelChange {
  readonly type: 'cancel';
  readonly entryId: NotificationTaskBotEntryId;
}

/**
 * Enables or disables the entry. Disabling cancels the live run; enabling schedules a run when the entry becomes idle,
 * and re-issues the resume run of an entry paused until a time.
 */
export interface NotificationTaskBotStateChange {
  readonly type: 'state';
  readonly entryId: NotificationTaskBotEntryId;
  readonly state: NotificationTaskBotEntryState;
  /**
   * Whether to schedule a run due now when enabling leaves the entry idle. Defaults to true.
   */
  readonly reschedule?: Maybe<boolean>;
}

/**
 * Pauses or resumes the entry.
 *
 * Pausing cancels the live run. With `until`, the entry also gets a resume run at that time; a plain pause on an entry
 * paused until a time clears `pu` and cancels its resume run.
 *
 * Resuming cancels the resume run, if any, resets the failure count, stamps the cleared reason on `rpr`, and schedules a
 * run due now.
 */
export interface NotificationTaskBotPauseChange {
  readonly type: 'pause';
  readonly entryId: NotificationTaskBotEntryId;
  /**
   * The pause to apply, or false to resume.
   */
  readonly pause: NotificationTaskBotPause | false;
  /**
   * Whether to schedule a run due now when resuming leaves the entry idle. Defaults to true.
   */
  readonly reschedule?: Maybe<boolean>;
}

/**
 * Sets or clears the entry's last submitted at time.
 */
export interface NotificationTaskBotLastSubmittedAtChange {
  readonly type: 'lsat';
  readonly entryId: NotificationTaskBotEntryId;
  readonly lsat: Maybe<Date>;
}

/**
 * Merges data into the entry's data. A `null` value deletes the key.
 */
export interface NotificationTaskBotDataChange<D extends NotificationTaskBotEntryData = NotificationTaskBotEntryData> {
  readonly type: 'data';
  readonly entryId: NotificationTaskBotEntryId;
  readonly data: NotificationTaskBotEntryDataUpdate<D>;
}

/**
 * Removes the entry and deletes its live run.
 */
export interface NotificationTaskBotRemoveChange {
  readonly type: 'remove';
  readonly entryId: NotificationTaskBotEntryId;
}

/**
 * History instructions for {@link NotificationTaskBotCompleteRunChange}.
 */
export interface NotificationTaskBotCompleteRunHistory<HD extends NotificationTaskBotEntryData = NotificationTaskBotEntryData> {
  readonly d?: Maybe<HD>;
  /**
   * Replace the last history item instead of appending.
   */
  readonly replaceLast?: Maybe<boolean>;
}

/**
 * Records the outcome of the live run and optionally schedules the next one. Fenced on the run number.
 *
 * Applies, in order: the data update and history, `disable`, `pause`, a `'failed'` pause when a FAILED outcome spends
 * the failure budget, then the next run. A disabled entry never gets a resume run, and a paused one never gets a next
 * run. Clears `rpr`: the run had its chance to react to the resume.
 */
export interface NotificationTaskBotCompleteRunChange<D extends NotificationTaskBotEntryData = NotificationTaskBotEntryData, HD extends NotificationTaskBotEntryData = NotificationTaskBotEntryData> {
  readonly type: 'completeRun';
  readonly entryId: NotificationTaskBotEntryId;
  readonly runNumber: NotificationTaskBotRunNumber;
  readonly trigger: NotificationTaskBotRunTrigger;
  /**
   * Defaults to COMPLETED.
   *
   * FAILED adds 1 to the entry's failure count; any other outcome resets it.
   */
  readonly outcome?: Maybe<NotificationTaskBotRunOutcome>;
  /**
   * False skips the history item. Defaults to appending an item without data.
   */
  readonly history?: Maybe<false | NotificationTaskBotCompleteRunHistory<HD>>;
  readonly updateData?: Maybe<NotificationTaskBotEntryDataUpdate<D>>;
  /**
   * When to schedule the next run. It starts no sooner than this time and the script computes the real due time when
   * it runs.
   */
  readonly nextRunAt?: Maybe<Date>;
  /**
   * Explicit time for the next run. Takes priority over {@link nextRunAt}.
   */
  readonly nextRunAtExplicit?: Maybe<Date>;
  readonly pause?: Maybe<NotificationTaskBotPause>;
  readonly disable?: Maybe<boolean>;
  /**
   * Removes the entry, e.g. when the attached model was deleted. Every other instruction is ignored: no history is
   * recorded and no next run is scheduled.
   */
  readonly remove?: Maybe<boolean>;
  /**
   * Defaults to {@link DEFAULT_NOTIFICATION_TASK_BOT_SCRIPT_HISTORY_LIMIT}.
   */
  readonly historyLimit?: Maybe<number>;
  /**
   * The next run, explicit or not, is scheduled no sooner than now plus this interval. Defaults to
   * {@link DEFAULT_NOTIFICATION_TASK_BOT_SCRIPT_MINIMUM_RUN_INTERVAL}; `0` turns it off.
   */
  readonly minimumRunInterval?: Maybe<Milliseconds>;
  /**
   * The failure count at which a FAILED outcome pauses the entry with the `'failed'` reason. A pause requested by the
   * script wins. Defaults to {@link DEFAULT_NOTIFICATION_TASK_BOT_SCRIPT_MAX_CONSECUTIVE_FAILURES}.
   */
  readonly maxConsecutiveFailures?: Maybe<number>;
}

/**
 * Ends the live run without history and hands over to a SCHEDULED run that starts no sooner than `at`. Fenced on the run
 * number.
 *
 * Used when the due check finds a MANUAL run not due yet, so the run that later goes ahead on cadence records
 * SCHEDULED. The failure count and `rpr` are kept. The deferred run's own task is marked done by the handler, never
 * deleted here.
 */
export interface NotificationTaskBotDeferRunChange {
  readonly type: 'deferRun';
  readonly entryId: NotificationTaskBotEntryId;
  readonly runNumber: NotificationTaskBotRunNumber;
  readonly at: Date;
}

/**
 * Resumes an entry whose pause expired, when its resume run starts. Fenced on the run number.
 *
 * Resumes the entry (stamping `rpr`) and keeps the live run going when `pu` is now or in the past. A no-op while `pu`
 * is still in the future.
 */
export interface NotificationTaskBotExpirePauseChange {
  readonly type: 'expirePause';
  readonly entryId: NotificationTaskBotEntryId;
  readonly runNumber: NotificationTaskBotRunNumber;
}

/**
 * Marks the live run as having submitted its side effect. Fenced on the run number, and a no-op when the run already submitted.
 */
export interface NotificationTaskBotMarkSubmittedChange {
  readonly type: 'markSubmitted';
  readonly entryId: NotificationTaskBotEntryId;
  readonly runNumber: NotificationTaskBotRunNumber;
}

/**
 * Syncs the entry's `nat` to the live run's actual send time. Fenced on the run number.
 */
export interface NotificationTaskBotSyncNextRunAtChange {
  readonly type: 'syncNat';
  readonly entryId: NotificationTaskBotEntryId;
  readonly runNumber: NotificationTaskBotRunNumber;
  readonly nat: Date;
}

/**
 * Repairs an overdue entry after its run task was inspected. Fenced on the run number.
 *
 * - When the task is still pending, the entry's `nat` is synced to the task's send time.
 * - When the task is missing or done, the run is recorded as LOST, the failure count goes up, and a new run due now is
 *   scheduled, unless the failure count reached the maximum, in which case the entry is paused with the `'failed'` reason.
 * - When the missing run was the resume run of an entry paused until a time, the resume run is re-issued instead. A lost
 *   resume run is not a script failure: nothing is recorded and the failure count is unchanged.
 */
export interface NotificationTaskBotRepairChange {
  readonly type: 'repair';
  readonly entryId: NotificationTaskBotEntryId;
  readonly runNumber: NotificationTaskBotRunNumber;
  /**
   * The pending task's send time, or null/undefined when the task is missing or done.
   */
  readonly pendingTaskSendAt?: Maybe<Date>;
  /**
   * The trigger of the lost run. Defaults to SCHEDULED.
   */
  readonly trigger?: Maybe<NotificationTaskBotRunTrigger>;
  /**
   * Defaults to {@link DEFAULT_NOTIFICATION_TASK_BOT_SCRIPT_MAX_CONSECUTIVE_FAILURES}.
   */
  readonly maxConsecutiveFailures?: Maybe<number>;
  /**
   * Defaults to {@link DEFAULT_NOTIFICATION_TASK_BOT_SCRIPT_HISTORY_LIMIT}.
   */
  readonly historyLimit?: Maybe<number>;
}

/**
 * Opts every entry in the group out (or back in), on behalf of the bot's owner.
 *
 * Applies to every entry whose resolved opt-out group (see {@link ApplyNotificationTaskBotChangeInput.optOutGroupKeyForScriptType})
 * is {@link group}. Opting out sets `oat` and cancels the live run; opting in clears `oat` and schedules a run due now
 * when the entry is enabled, not paused and idle (the script's due check still applies), or re-issues the resume run of
 * an entry paused until a time.
 *
 * Bot-level: a no-op on a missing bot, and a no-op without the resolver.
 */
export interface NotificationTaskBotOptOutChange {
  readonly type: 'optOut';
  readonly group: NotificationTaskBotScriptGroupKey;
  /**
   * True to opt out, false to opt back in.
   */
  readonly optOut: boolean;
}

/**
 * Sets or clears the bot's owner key (`o`). Leaves every `oat` alone, since an opt-out does not record who made it.
 *
 * Bot-level: a no-op on a missing bot.
 */
export interface NotificationTaskBotOwnerChange {
  readonly type: 'owner';
  readonly owner: Maybe<FirebaseAuthOwnershipKey>;
}

/**
 * A change that applies to the whole bot rather than a single entry.
 */
export type NotificationTaskBotBotLevelChange = NotificationTaskBotOptOutChange | NotificationTaskBotOwnerChange;

/**
 * Returns true if the change applies to the whole bot rather than a single entry.
 *
 * @param change - The change.
 * @returns True for {@link NotificationTaskBotBotLevelChange} values.
 */
export function isNotificationTaskBotBotLevelChange(change: NotificationTaskBotChange): change is NotificationTaskBotBotLevelChange {
  return change.type === 'optOut' || change.type === 'owner';
}

/**
 * Resolves the group key the owner can opt out of for a script type, or undefined when the script can't be opted out of.
 *
 * Usually `AppNotificationTaskBotScriptConfigService.optOutGroupKeyForScriptType`.
 */
export type NotificationTaskBotOptOutGroupKeyForScriptTypeFunction = (scriptType: NotificationTaskBotScriptType) => Maybe<NotificationTaskBotScriptGroupKey>;

/**
 * Any change that can be applied with {@link applyNotificationTaskBotChange}.
 */
export type NotificationTaskBotChange =
  | NotificationTaskBotEnsureChange
  | NotificationTaskBotScheduleChange
  | NotificationTaskBotCancelChange
  | NotificationTaskBotStateChange
  | NotificationTaskBotPauseChange
  | NotificationTaskBotLastSubmittedAtChange
  | NotificationTaskBotDataChange
  | NotificationTaskBotRemoveChange
  | NotificationTaskBotCompleteRunChange
  | NotificationTaskBotDeferRunChange
  | NotificationTaskBotExpirePauseChange
  | NotificationTaskBotMarkSubmittedChange
  | NotificationTaskBotSyncNextRunAtChange
  | NotificationTaskBotRepairChange
  | NotificationTaskBotOptOutChange
  | NotificationTaskBotOwnerChange;

/**
 * A run that must be created as a result of a change.
 */
export interface NotificationTaskBotRunRequest {
  readonly entryId: NotificationTaskBotEntryId;
  readonly scriptType: NotificationTaskBotScriptType;
  readonly runNumber: NotificationTaskBotRunNumber;
  readonly trigger: NotificationTaskBotRunTrigger;
  readonly sendAt: Date;
  readonly explicit: boolean;
  readonly taskKey: NotificationTaskKey;
}

/**
 * Input for {@link applyNotificationTaskBotChange}.
 */
export interface ApplyNotificationTaskBotChangeInput {
  /**
   * The current bot, or null/undefined when it does not exist yet.
   */
  readonly bot: Maybe<NotificationTaskBot>;
  /**
   * Key of the model the bot is attached to.
   */
  readonly model: FirestoreModelKey;
  readonly change: NotificationTaskBotChange;
  readonly now?: Maybe<Date>;
  /**
   * Resolves the owner opt-out group of a script type. The server always passes it from the script registry.
   *
   * Without it, `oat` is never touched: `ensure` does not reconcile opt-outs and `optOut` changes are no-ops.
   */
  readonly optOutGroupKeyForScriptType?: Maybe<NotificationTaskBotOptOutGroupKeyForScriptTypeFunction>;
}

/**
 * Result of {@link applyNotificationTaskBotChange}.
 */
export interface ApplyNotificationTaskBotChangeResult {
  /**
   * The bot after the change. Null/undefined only when the bot did not exist and the change did not create it.
   */
  readonly bot: Maybe<NotificationTaskBot>;
  /**
   * True if the bot changed and must be written.
   */
  readonly changed: boolean;
  /**
   * The affected entry after the change, if it exists. Always undefined for a bot-level change.
   */
  readonly entry: Maybe<NotificationTaskBotEmbeddedScriptEntry>;
  /**
   * True if the change targeted an entry that does not exist. Always false for a bot-level change.
   */
  readonly unknownEntry: boolean;
  /**
   * True if the change was fenced off because the run number did not match the entry's live run.
   */
  readonly fenced: boolean;
  /**
   * Runs that must be created in the same transaction.
   */
  readonly createRuns: NotificationTaskBotRunRequest[];
  /**
   * Task keys of superseded or cancelled runs that must be deleted in the same transaction.
   */
  readonly deleteTaskKeys: NotificationTaskKey[];
}

/**
 * Applies a single change to a bot.
 *
 * Pure: the input bot is never mutated. The caller must create {@link ApplyNotificationTaskBotChangeResult.createRuns}
 * and delete {@link ApplyNotificationTaskBotChangeResult.deleteTaskKeys} in the same transaction it writes the bot in.
 *
 * @param input - The bot, the attached model key, the change and the current time.
 * @returns The new bot, plus the runs to create and the tasks to delete.
 * @throws {Error} When an `ensure` change that creates the entry uses an invalid entry id or seeds an invalid `sc`.
 *
 * @example
 * ```ts
 * const result = applyNotificationTaskBotChange({ bot, model: 'profile/abc', change: { type: 'pause', entryId: 'ping', pause: { reason: 'manual', until: tomorrow } } });
 * // result.createRuns holds the resume run at `tomorrow`; result.deleteTaskKeys holds the cancelled live run
 * ```
 */
export function applyNotificationTaskBotChange(input: ApplyNotificationTaskBotChangeInput): ApplyNotificationTaskBotChangeResult {
  const { bot: inputBot, model, change, optOutGroupKeyForScriptType } = input;
  const now = input.now ?? new Date();
  const botId = notificationTaskBotIdForModel(model);
  const botLevelChange = isNotificationTaskBotBotLevelChange(change) ? change : undefined;
  const entryChange = botLevelChange ? undefined : (change as Exclude<NotificationTaskBotChange, NotificationTaskBotBotLevelChange>);

  const createRuns: NotificationTaskBotRunRequest[] = [];
  const deleteTaskKeys: NotificationTaskKey[] = [];

  let rc = inputBot?.rc ?? 0;
  let entries: NotificationTaskBotEmbeddedScriptEntry[] = [...(inputBot?.e ?? [])];
  let entryIndex = entryChange ? entries.findIndex((x) => x.i === entryChange.entryId) : -1;
  let entry: Maybe<NotificationTaskBotEmbeddedScriptEntry> = entryIndex === -1 ? undefined : { ...entries[entryIndex] };
  let owner: Maybe<FirebaseAuthOwnershipKey> = inputBot?.o;
  let ownerChanged = false;
  let createBot = false;
  let changed = false;
  let fenced = false;
  let removed = false;

  function setOwner(nextOwner: Maybe<FirebaseAuthOwnershipKey>) {
    if ((owner ?? null) !== (nextOwner ?? null)) {
      owner = nextOwner ?? null;
      ownerChanged = true;
      changed = true;
    }
  }

  function cancelRun(x: NotificationTaskBotEmbeddedScriptEntry) {
    if (x.nk) {
      deleteTaskKeys.push(x.nk);
    }

    x.rn = null;
    x.nk = null;
    x.nat = null;
    changed = true;
  }

  function issueRun(x: NotificationTaskBotEmbeddedScriptEntry, trigger: NotificationTaskBotRunTrigger, at: Maybe<Date>, explicit: boolean) {
    if (x.nk) {
      deleteTaskKeys.push(x.nk);
    }

    rc += 1;

    const runNumber = rc;
    const sendAt = at ?? now;
    const taskKey = notificationTaskBotRunNotificationTaskKey({ model, botId, entryId: x.i, runNumber });

    x.rn = runNumber;
    x.nk = taskKey;
    x.nat = sendAt;

    createRuns.push({ entryId: x.i, scriptType: x.t, runNumber, trigger, sendAt, explicit, taskKey });
    changed = true;
  }

  function scheduleIfIdle(x: NotificationTaskBotEmbeddedScriptEntry) {
    if (isNotificationTaskBotEntryRunnable(x) && x.rn == null) {
      issueRun(x, NotificationTaskBotRunTrigger.SCHEDULED, undefined, false);
    }
  }

  function issueResumeRunIfNeeded(x: NotificationTaskBotEmbeddedScriptEntry) {
    if (x.pat != null && x.pu != null && x.rn == null && x.s !== NotificationTaskBotEntryState.DISABLED && x.oat == null) {
      // a not-before run; the run handler resumes the entry when it starts
      issueRun(x, NotificationTaskBotRunTrigger.SCHEDULED, x.pu, false);
    }
  }

  function applyPause(x: NotificationTaskBotEmbeddedScriptEntry, pause: NotificationTaskBotPause) {
    x.pat = x.pat ?? now;
    x.pr = pause.reason;
    x.pu = pause.until ?? null;
    changed = true;

    if (x.rn != null || x.nk != null) {
      cancelRun(x); // also the old resume run, when re-pausing
    }

    issueResumeRunIfNeeded(x);
  }

  function resumeEntry(x: NotificationTaskBotEmbeddedScriptEntry) {
    x.rpr = x.pr ?? null;
    x.pat = null;
    x.pr = null;
    x.pu = null;
    x.fc = 0;
    changed = true;
  }

  function optOutEntry(x: NotificationTaskBotEmbeddedScriptEntry, at: Date) {
    x.oat = at;
    changed = true;

    if (x.rn != null || x.nk != null) {
      cancelRun(x);
    }
  }

  function optInEntry(x: NotificationTaskBotEmbeddedScriptEntry) {
    x.oat = null;
    changed = true;
    scheduleIfIdle(x);
    issueResumeRunIfNeeded(x);
  }

  function appendHistory(x: NotificationTaskBotEmbeddedScriptEntry, item: Omit<NotificationTaskBotEntryHistoryItem, 'at'>, limit: Maybe<number>, replaceLast?: Maybe<boolean>) {
    x.h = appendNotificationTaskBotEntryHistoryItem(x.h ?? [], { at: now, ...item }, limit ?? DEFAULT_NOTIFICATION_TASK_BOT_SCRIPT_HISTORY_LIMIT, replaceLast);
  }

  if (change.type === 'ensure') {
    if (!entry) {
      if (!isNotificationTaskBotEntryId(change.entryId)) {
        throw new Error(`applyNotificationTaskBotChange(): invalid entry id "${change.entryId}".`);
      }

      const { seed } = change;
      const seedSc = seed?.sc;

      if (seedSc != null && (!Number.isInteger(seedSc) || seedSc < 0)) {
        throw new Error(`applyNotificationTaskBotChange(): invalid seed sc "${seedSc}" for entry "${change.entryId}". It must be a non-negative integer.`);
      }

      const seedHistory: NotificationTaskBotEntryHistoryItem[] = takeLast(
        [...(seed?.h ?? [])].sort((a, b) => a.at.getTime() - b.at.getTime()).map((x) => ({ ...x, rn: 0 })),
        Math.max(0, change.historyLimit ?? DEFAULT_NOTIFICATION_TASK_BOT_SCRIPT_HISTORY_LIMIT)
      );

      entry = {
        i: change.entryId,
        t: change.scriptType,
        s: change.state ?? NotificationTaskBotEntryState.ENABLED,
        cat: now,
        d: mergeNotificationTaskBotEntryData(undefined, change.data),
        sc: seedSc ?? 0,
        fc: 0,
        h: seedHistory
      };

      if (seed?.lsat != null) {
        entry.lsat = seed.lsat;
      }

      if (seed?.lat != null) {
        entry.lat = seed.lat;
      }

      if (seed?.pause != null) {
        entry.pat = seed.pause.at ?? now;
        entry.pr = seed.pause.reason;
        entry.pu = seed.pause.until ?? null;
      }

      entries = [...entries, entry];
      entryIndex = entries.length - 1;
      createBot = inputBot == null;
      changed = true;
    }

    if (change.owner !== undefined) {
      setOwner(change.owner);
    }

    if (optOutGroupKeyForScriptType) {
      const groupKey = optOutGroupKeyForScriptType(entry.t);

      if (groupKey == null) {
        // the script no longer allows owner opt-out, so nobody could clear the opt-out
        if (entry.oat != null) {
          entry.oat = null;
          changed = true;
        }
      } else if (entry.oat == null) {
        // join the group's opt-out so the owner's toggle holds as entries come and go
        const siblingOptOutAt = earliestDate(entries.filter((x, i) => i !== entryIndex && x.oat != null && optOutGroupKeyForScriptType(x.t) === groupKey).map((x) => x.oat));

        if (siblingOptOutAt != null) {
          optOutEntry(entry, siblingOptOutAt);
        }
      }
    }

    const schedule = change.schedule ?? 'ifIdle';

    if (schedule === 'ifIdle') {
      scheduleIfIdle(entry);
    } else if (schedule !== false && isNotificationTaskBotEntryRunnable(entry)) {
      const at = schedule === 'now' ? undefined : schedule;
      issueRun(entry, NotificationTaskBotRunTrigger.SCHEDULED, at, at != null && Boolean(change.explicit));
    }

    // re-issues a resume run that went missing; a no-op otherwise
    issueResumeRunIfNeeded(entry);
  } else if (entry) {
    const x = entry;

    switch (change.type) {
      case 'schedule':
        if (isNotificationTaskBotEntryRunnable(x) && !(change.ifIdle && x.rn != null)) {
          issueRun(x, change.trigger ?? NotificationTaskBotRunTrigger.SCHEDULED, change.at, change.at != null && Boolean(change.explicit));
        }
        break;
      case 'cancel':
        if (x.rn != null || x.nk != null) {
          cancelRun(x);
        }
        break;
      case 'state':
        if (x.s !== change.state) {
          x.s = change.state;
          changed = true;
        }

        if (change.state === NotificationTaskBotEntryState.DISABLED) {
          if (x.rn != null || x.nk != null) {
            cancelRun(x);
          }
        } else {
          if (change.reschedule !== false) {
            scheduleIfIdle(x);
          }

          issueResumeRunIfNeeded(x);
        }
        break;
      case 'pause':
        if (change.pause) {
          applyPause(x, change.pause);
        } else {
          if (x.pat != null || x.pr != null) {
            if (x.rn != null || x.nk != null) {
              cancelRun(x); // a paused entry's only live run is its resume run
            }

            resumeEntry(x);
          }

          if (change.reschedule !== false) {
            scheduleIfIdle(x);
          }
        }
        break;
      case 'lsat':
        x.lsat = change.lsat ?? null;
        changed = true;
        break;
      case 'data':
        x.d = mergeNotificationTaskBotEntryData(x.d, change.data) ?? null;
        changed = true;
        break;
      case 'remove':
        if (x.nk) {
          deleteTaskKeys.push(x.nk);
        }

        removed = true;
        changed = true;
        break;
      case 'completeRun':
        if (x.rn === change.runNumber) {
          x.rn = null;
          x.nk = null; // the run's own task is marked done by the handler, never deleted here
          x.nat = null;
          changed = true;

          if (change.remove) {
            removed = true;
          } else {
            const outcome = change.outcome ?? NotificationTaskBotRunOutcome.COMPLETED;
            const failed = outcome === NotificationTaskBotRunOutcome.FAILED;

            x.lat = now;
            x.fc = failed ? (x.fc ?? 0) + 1 : 0;
            x.rpr = null; // the run had its chance to react to the resume

            if (change.updateData) {
              x.d = mergeNotificationTaskBotEntryData(x.d, change.updateData) ?? null;
            }

            if (change.history !== false) {
              appendHistory(x, { rn: change.runNumber, tr: change.trigger, o: outcome, d: change.history?.d }, change.historyLimit, change.history?.replaceLast);
            }

            if (change.disable) {
              x.s = NotificationTaskBotEntryState.DISABLED;
            }

            if (change.pause) {
              applyPause(x, change.pause);
            }

            // the script's own pause reason wins, since it is more specific
            if (failed && x.pat == null && x.fc >= (change.maxConsecutiveFailures ?? DEFAULT_NOTIFICATION_TASK_BOT_SCRIPT_MAX_CONSECUTIVE_FAILURES)) {
              applyPause(x, { reason: NOTIFICATION_TASK_BOT_PAUSE_REASON_FAILED });
            }

            const requestedAt = change.nextRunAtExplicit ?? change.nextRunAt;

            if (requestedAt != null && isNotificationTaskBotEntryRunnable(x)) {
              // never sooner than now plus the minimum run interval, explicit or not
              const sendAt = latestDate([requestedAt, addMilliseconds(now, change.minimumRunInterval ?? DEFAULT_NOTIFICATION_TASK_BOT_SCRIPT_MINIMUM_RUN_INTERVAL)], requestedAt);
              issueRun(x, NotificationTaskBotRunTrigger.SCHEDULED, sendAt, change.nextRunAtExplicit != null);
            }
          }
        } else {
          fenced = true;
        }
        break;
      case 'deferRun':
        if (x.rn === change.runNumber) {
          // clear the fence first, so issueRun does not delete the deferred run's own task
          x.rn = null;
          x.nk = null;
          x.nat = null;
          changed = true;

          if (isNotificationTaskBotEntryRunnable(x)) {
            issueRun(x, NotificationTaskBotRunTrigger.SCHEDULED, change.at, false);
          }
        } else {
          fenced = true;
        }
        break;
      case 'expirePause':
        if (x.rn !== change.runNumber) {
          fenced = true;
        } else if (x.pat != null && x.pu != null && x.pu.getTime() <= now.getTime()) {
          resumeEntry(x); // the live run keeps going as a normal run
        }
        break;
      case 'markSubmitted':
        if (x.rn !== change.runNumber) {
          fenced = true;
        } else if (x.lsr !== change.runNumber) {
          x.lsat = now;
          x.lsr = change.runNumber;
          x.sc = (x.sc ?? 0) + 1;
          changed = true;
        }
        break;
      case 'syncNat':
        if (x.rn !== change.runNumber) {
          fenced = true;
        } else if (!isSameDate(x.nat, change.nat)) {
          x.nat = change.nat;
          changed = true;
        }
        break;
      case 'repair':
        if (x.rn !== change.runNumber) {
          fenced = true;
        } else if (change.pendingTaskSendAt == null) {
          x.rn = null;
          x.nk = null; // the task is already missing or done
          x.nat = null;
          changed = true;

          if (x.pat == null) {
            appendHistory(x, { rn: change.runNumber, tr: change.trigger ?? NotificationTaskBotRunTrigger.SCHEDULED, o: NotificationTaskBotRunOutcome.LOST }, change.historyLimit);
            x.fc = (x.fc ?? 0) + 1;

            if (x.fc >= (change.maxConsecutiveFailures ?? DEFAULT_NOTIFICATION_TASK_BOT_SCRIPT_MAX_CONSECUTIVE_FAILURES)) {
              applyPause(x, { reason: NOTIFICATION_TASK_BOT_PAUSE_REASON_FAILED });
            } else if (isNotificationTaskBotEntryRunnable(x)) {
              issueRun(x, NotificationTaskBotRunTrigger.SCHEDULED, undefined, false);
            }
          } else {
            // a lost resume run is not a script failure
            issueResumeRunIfNeeded(x);
          }
        } else if (!isSameDate(x.nat, change.pendingTaskSendAt)) {
          x.nat = change.pendingTaskSendAt;
          changed = true;
        }
        break;
      case 'optOut':
      case 'owner':
        // bot-level changes are applied below
        break;
    }
  } else if (botLevelChange && inputBot) {
    switch (botLevelChange.type) {
      case 'optOut':
        if (optOutGroupKeyForScriptType) {
          entries = entries.map((x) => {
            let result = x;

            if (optOutGroupKeyForScriptType(x.t) === botLevelChange.group) {
              if (botLevelChange.optOut && x.oat == null) {
                result = { ...x };
                optOutEntry(result, now);
              } else if (!botLevelChange.optOut && x.oat != null) {
                result = { ...x };
                optInEntry(result);
              }
            }

            return result;
          });
        }
        break;
      case 'owner':
        setOwner(botLevelChange.owner);
        break;
    }
  }

  let bot: Maybe<NotificationTaskBot> = inputBot;

  if (changed) {
    if (entry) {
      if (removed) {
        entries = entries.filter((_, i) => i !== entryIndex);
      } else {
        entries[entryIndex] = entry;
      }
    }

    const base: NotificationTaskBot = createBot || !inputBot ? { cat: now, m: model, rc: 0, e: [] } : inputBot;
    const nextBot: NotificationTaskBot = { ...base, rc, e: entries, nat: notificationTaskBotNextRunAt(entries) ?? null };

    if (ownerChanged) {
      nextBot.o = owner ?? null;
    }

    bot = nextBot;
  }

  return {
    bot,
    changed,
    entry: removed ? undefined : entry,
    unknownEntry: entryChange != null && entry == null,
    fenced,
    createRuns,
    deleteTaskKeys
  };
}

/**
 * Applies a list of changes in order, accumulating the runs to create and the tasks to delete.
 *
 * A run created by an earlier change and superseded by a later one is dropped from `createRuns` rather than listed in
 * `deleteTaskKeys`, since it was never written.
 *
 * @param input - The bot, the attached model key, the changes and the current time.
 * @returns The combined result. `unknownEntry` and `fenced` describe the last entry-level change, and `entry` is that
 * change's entry as it is after every change.
 */
export function applyNotificationTaskBotChanges(input: Omit<ApplyNotificationTaskBotChangeInput, 'change'> & { readonly changes: NotificationTaskBotChange[] }): ApplyNotificationTaskBotChangeResult {
  const { model, changes, now, optOutGroupKeyForScriptType } = input;

  let result: ApplyNotificationTaskBotChangeResult = { bot: input.bot, changed: false, entry: undefined, unknownEntry: false, fenced: false, createRuns: [], deleteTaskKeys: [] };
  let entryResult: Pick<ApplyNotificationTaskBotChangeResult, 'entry' | 'unknownEntry' | 'fenced'> = { entry: undefined, unknownEntry: false, fenced: false };
  let createRuns: NotificationTaskBotRunRequest[] = [];
  let deleteTaskKeys: NotificationTaskKey[] = [];
  let changed = false;

  changes.forEach((change) => {
    const next = applyNotificationTaskBotChange({ bot: result.bot, model, change, now, optOutGroupKeyForScriptType });

    if (isNotificationTaskBotBotLevelChange(change)) {
      // a trailing bot-level change may have touched the entry, so read it back from the new bot
      entryResult = { ...entryResult, entry: entryResult.entry ? notificationTaskBotEntry(next.bot, entryResult.entry.i) : undefined };
    } else {
      entryResult = { entry: next.entry, unknownEntry: next.unknownEntry, fenced: next.fenced };
    }

    const pendingCreatedKeys = new Set(createRuns.map((x) => x.taskKey));

    next.deleteTaskKeys.forEach((key) => {
      if (pendingCreatedKeys.has(key)) {
        createRuns = createRuns.filter((x) => x.taskKey !== key);
      } else {
        deleteTaskKeys = [...deleteTaskKeys, key];
      }
    });

    createRuns = [...createRuns, ...next.createRuns];
    changed = changed || next.changed;
    result = next;
  });

  return { ...result, ...entryResult, changed, createRuns, deleteTaskKeys };
}
