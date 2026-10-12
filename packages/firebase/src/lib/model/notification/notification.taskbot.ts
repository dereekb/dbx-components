/**
 * @module notification.taskbot
 *
 * The {@link NotificationTaskBot} model: a generic, per-model container of "bot" script entries.
 *
 * A bot attaches to any model (the doc id is the two-way flat key of that model, like {@link NotificationBox}) and holds
 * a list of embedded {@link NotificationTaskBotEmbeddedScriptEntry} values. Each entry points at a script type registered
 * by the app (see `notification.taskbot.script.ts`) and keeps the DURABLE state for that script: permanent data, the
 * enabled/paused state, the cadence anchors, the live run fence and a bounded run history.
 *
 * Every run of an entry is its own unique NotificationTask (see `notification.taskbot.task.ts`), fenced by a run number
 * taken from the bot's monotonic run counter. The entry, not the task, owns the durable state, so recreating a task can
 * never reset a counter, and a stale or superseded run can never write back.
 */
import { type Maybe } from '@dereekb/util';
import { type GrantedReadRole, type GrantedUpdateRole } from '@dereekb/model';
import {
  AbstractFirestoreDocument,
  type CollectionReference,
  type FirebaseAuthOwnershipKey,
  type FirestoreCollection,
  type FirestoreContext,
  type FirestoreModelKey,
  firestoreDate,
  firestoreEnum,
  firestoreModelIdentity,
  firestoreModelKey,
  firestoreModelKeyString,
  firestoreNumber,
  firestoreObjectArray,
  firestoreString,
  firestoreSubObject,
  optionalFirestoreDate,
  optionalFirestoreNumber,
  optionalFirestorePassthroughJsonField,
  optionalFirestoreString,
  snapshotConverterFunctions,
  type ReadFirestoreModelKeyInput,
  readFirestoreModelKey
} from '../../common';
import { type NotificationTaskBotEntryId, type NotificationTaskBotKey, type NotificationTaskBotRunNumber, type NotificationTaskKey, notificationTaskBotIdForModel } from './notification.id';

// MARK: Identity
/**
 * Identity for {@link NotificationTaskBot} documents. Collection name: `'notificationTaskBot'`, short code: `'ntb'`.
 */
export const notificationTaskBotIdentity = firestoreModelIdentity('notificationTaskBot', 'ntb');

/**
 * Returns the {@link NotificationTaskBotKey} for the bot attached to the input model.
 *
 * @param model - The model (or its key) the bot is attached to.
 * @returns The bot's full model key.
 *
 * @example
 * ```ts
 * notificationTaskBotKeyForModel('profile/abc123'); // 'ntb/profile_abc123'
 * ```
 */
export function notificationTaskBotKeyForModel(model: ReadFirestoreModelKeyInput): NotificationTaskBotKey {
  return firestoreModelKey(notificationTaskBotIdentity, notificationTaskBotIdForModel(readFirestoreModelKey(model, true)));
}

// MARK: Types
/**
 * Type of a NotificationTaskBot script, registered by the app. Selects the server-side processor that runs an entry.
 *
 * @semanticType
 * @semanticTopic string
 * @semanticTopic dereekb-firebase:notification
 */
export type NotificationTaskBotScriptType = string;

/**
 * Reason an entry was paused. The library defines {@link NOTIFICATION_TASK_BOT_PAUSE_REASON_MANUAL} and
 * {@link NOTIFICATION_TASK_BOT_PAUSE_REASON_FAILED}; scripts may add their own (e.g. `'no_progress'`).
 *
 * @semanticType
 * @semanticTopic string
 * @semanticTopic dereekb-firebase:notification
 */
export type NotificationTaskBotPauseReason = string;

/**
 * Pause reason used when an admin pauses an entry.
 */
export const NOTIFICATION_TASK_BOT_PAUSE_REASON_MANUAL: NotificationTaskBotPauseReason = 'manual';

/**
 * Pause reason used when an entry reaches its script's maximum number of consecutive failures.
 */
export const NOTIFICATION_TASK_BOT_PAUSE_REASON_FAILED: NotificationTaskBotPauseReason = 'failed';

/**
 * Arbitrary permanent data stored on an entry or a history item.
 */
export type NotificationTaskBotEntryData = Readonly<Record<string, any>>;

/**
 * Stored enabled/disabled state of a {@link NotificationTaskBotEmbeddedScriptEntry}.
 */
export enum NotificationTaskBotEntryState {
  /**
   * The entry is enabled and runs on its schedule.
   */
  ENABLED = 0,
  /**
   * The entry is disabled and never runs.
   */
  DISABLED = 1
}

/**
 * What triggered a single run.
 *
 * Values match the `BotSendTrigger` used by earlier app-specific bots, so history maps across one-to-one.
 */
export enum NotificationTaskBotRunTrigger {
  /**
   * The run was scheduled by the bot itself.
   */
  SCHEDULED = 0,
  /**
   * The run was requested manually. The script's due check still applies.
   *
   * History only records MANUAL for a run that went ahead right away. When the due check finds a MANUAL run not due yet,
   * the run hands over to a SCHEDULED run at the due time, so the run that later goes ahead on cadence records SCHEDULED.
   */
  MANUAL = 1,
  /**
   * The run was forced. The script's due check is skipped.
   */
  FORCED = 2
}

/**
 * Outcome of a single run, recorded in the entry's history.
 */
export enum NotificationTaskBotRunOutcome {
  /**
   * The run completed without submitting anything.
   */
  COMPLETED = 0,
  /**
   * The run submitted its side effect (e.g. sent an email).
   */
  SUBMITTED = 1,
  /**
   * The run decided a submission should be suppressed.
   */
  SUPPRESSED = 2,
  /**
   * The run was skipped. Also recorded for an entry whose script has no processor.
   */
  SKIPPED = 3,
  /**
   * The run failed. Counts toward the script's `maxConsecutiveFailures`, the same as a LOST run.
   */
  FAILED = 4,
  /**
   * The run's task went missing before it could finish (found by the repair sweep).
   */
  LOST = 5
}

/**
 * Computed status of an entry. Never stored; see `notificationTaskBotEntryStatus()`.
 */
export enum NotificationTaskBotEntryStatus {
  /**
   * The bot's owner opted out of the entry's script group. See {@link NotificationTaskBotEmbeddedScriptEntry.oat}.
   */
  OPTED_OUT = 'opted_out',
  DISABLED = 'disabled',
  PAUSED = 'paused',
  SCHEDULED = 'scheduled',
  IDLE = 'idle'
}

// MARK: History
/**
 * A single item in an entry's bounded run history.
 *
 * @template HD - history item data type
 */
export interface NotificationTaskBotEntryHistoryItem<HD extends NotificationTaskBotEntryData = NotificationTaskBotEntryData> {
  /**
   * When the run finished.
   *
   * @dbxModelVariable at
   */
  at: Date;
  /**
   * Run number of the run.
   *
   * @dbxModelVariable runNumber
   */
  rn: NotificationTaskBotRunNumber;
  /**
   * What triggered the run.
   *
   * @dbxModelVariable trigger
   */
  tr: NotificationTaskBotRunTrigger;
  /**
   * Outcome of the run.
   *
   * @dbxModelVariable outcome
   */
  o: NotificationTaskBotRunOutcome;
  /**
   * Script-specific data for the run. Keep it small: document size grows with entries × history.
   *
   * @dbxModelVariable data
   */
  d?: Maybe<HD>;
}

/**
 * Firestore sub-object converter for {@link NotificationTaskBotEntryHistoryItem}.
 */
export const firestoreNotificationTaskBotEntryHistoryItem = firestoreSubObject<NotificationTaskBotEntryHistoryItem>({
  objectField: {
    fields: {
      at: firestoreDate(),
      rn: firestoreNumber({ default: 0 }),
      tr: firestoreEnum<NotificationTaskBotRunTrigger>({ default: NotificationTaskBotRunTrigger.SCHEDULED }),
      o: firestoreEnum<NotificationTaskBotRunOutcome>({ default: NotificationTaskBotRunOutcome.COMPLETED }),
      d: optionalFirestorePassthroughJsonField()
    }
  }
});

// MARK: Entry
/**
 * An embedded script entry on a {@link NotificationTaskBot}.
 *
 * Holds the DURABLE state of one script attached to the bot's model. Every run is a fresh unique NotificationTask
 * fenced by {@link rn}; only the run whose number matches {@link rn} may write back.
 *
 * @template D - entry data type
 * @template HD - history item data type
 */
export interface NotificationTaskBotEmbeddedScriptEntry<D extends NotificationTaskBotEntryData = NotificationTaskBotEntryData, HD extends NotificationTaskBotEntryData = NotificationTaskBotEntryData> {
  /**
   * Entry id, unique within the bot. Must match `NOTIFICATION_TASK_BOT_ENTRY_ID_REGEX`.
   *
   * @dbxModelVariable entryId
   */
  i: NotificationTaskBotEntryId;
  /**
   * Script type that runs this entry.
   *
   * @dbxModelVariable scriptType
   */
  t: NotificationTaskBotScriptType;
  /**
   * Enabled/disabled state.
   *
   * @dbxModelVariable state
   */
  s: NotificationTaskBotEntryState;
  /**
   * When the entry was created.
   *
   * @dbxModelVariable createdAt
   */
  cat: Date;
  /**
   * Arbitrary permanent data owned by the script.
   *
   * @dbxModelVariable data
   */
  d?: Maybe<D>;
  /**
   * When the entry was paused.
   *
   * A paused entry's only possible live run is its resume run at {@link pu}. A paused entry without {@link pu} has no
   * live run.
   *
   * @dbxModelVariable pausedAt
   */
  pat?: Maybe<Date>;
  /**
   * Why the entry was paused.
   *
   * @dbxModelVariable pauseReason
   */
  pr?: Maybe<NotificationTaskBotPauseReason>;
  /**
   * When a paused entry resumes on its own. Only set together with {@link pat}.
   *
   * The entry keeps a not-before resume run at this time. When that run starts, the entry is resumed and the run goes
   * ahead as a normal SCHEDULED run.
   *
   * @dbxModelVariable pausedUntil
   */
  pu?: Maybe<Date>;
  /**
   * The pause reason the entry was last resumed from, kept until the next run completes.
   *
   * Set by every resume (an admin resume, a pause that expired at {@link pu}), and cleared when the next run completes.
   * A script checks it in its first step to undo what its own pause did (e.g. reset a counter or remove a tag), inside
   * `runNotificationTaskBotEntryTransaction()`. Make that idempotent: the first step re-runs when the due check delays
   * the run.
   *
   * @dbxModelVariable resumedPauseReason
   */
  rpr?: Maybe<NotificationTaskBotPauseReason>;
  /**
   * When the bot's owner opted out of this entry's script group. Set means opted out; this is the only opt-out state.
   *
   * An opted-out entry has no live run and is never scheduled. Only the owner's opt-out API and the ensure rules set or
   * clear it, and only for entries whose script sets `allowOwnerOptOut`.
   *
   * @dbxModelVariable optOutAt
   */
  oat?: Maybe<Date>;
  /**
   * Run number of the live run. This is the fence: only a run with this number may write back. Null when idle.
   *
   * @dbxModelVariable runNumber
   */
  rn?: Maybe<NotificationTaskBotRunNumber>;
  /**
   * Key of the live run's NotificationTask.
   *
   * @dbxModelVariable runTaskKey
   */
  nk?: Maybe<NotificationTaskKey>;
  /**
   * When the live run is next due to run.
   *
   * @dbxModelVariable nextRunAt
   */
  nat?: Maybe<Date>;
  /**
   * When the last run finished.
   *
   * @dbxModelVariable lastRunAt
   */
  lat?: Maybe<Date>;
  /**
   * When the last submission happened. The cadence anchor for scripts.
   *
   * @dbxModelVariable lastSubmittedAt
   */
  lsat?: Maybe<Date>;
  /**
   * Run number of the last submission. Used as an idempotency marker so a re-run step never submits twice.
   *
   * @dbxModelVariable lastSubmittedRunNumber
   */
  lsr?: Maybe<NotificationTaskBotRunNumber>;
  /**
   * Lifetime submission count.
   *
   * @dbxModelVariable submissionCount
   */
  sc: number;
  /**
   * Consecutive failure count. Goes up for each lost run (found by repair) and each run whose cleanup reports FAILED,
   * and is reset by a run that completes with any other outcome, or by a resume.
   *
   * @dbxModelVariable failureCount
   */
  fc: number;
  /**
   * Bounded run history, oldest first.
   *
   * @dbxModelVariable history
   */
  h: NotificationTaskBotEntryHistoryItem<HD>[];
}

/**
 * Firestore sub-object converter for {@link NotificationTaskBotEmbeddedScriptEntry}.
 */
export const firestoreNotificationTaskBotEmbeddedScriptEntry = firestoreSubObject<NotificationTaskBotEmbeddedScriptEntry>({
  objectField: {
    fields: {
      i: firestoreString(),
      t: firestoreString(),
      s: firestoreEnum<NotificationTaskBotEntryState>({ default: NotificationTaskBotEntryState.ENABLED }),
      cat: firestoreDate(),
      d: optionalFirestorePassthroughJsonField(),
      pat: optionalFirestoreDate(),
      pr: optionalFirestoreString(),
      pu: optionalFirestoreDate(),
      rpr: optionalFirestoreString(),
      oat: optionalFirestoreDate(),
      rn: optionalFirestoreNumber(),
      nk: optionalFirestoreString(),
      nat: optionalFirestoreDate(),
      lat: optionalFirestoreDate(),
      lsat: optionalFirestoreDate(),
      lsr: optionalFirestoreNumber(),
      sc: firestoreNumber({ default: 0 }),
      fc: firestoreNumber({ default: 0 }),
      h: firestoreObjectArray({ objectField: firestoreNotificationTaskBotEntryHistoryItem })
    }
  }
});

// MARK: NotificationTaskBot
/**
 * A generic per-model bot. Attaches to any model and holds embedded script entries that each run as a series of
 * unique NotificationTasks, fenced by run number.
 *
 * The document ID is the two-way flat key of the attached model (see {@link notificationTaskBotIdForModel}). The
 * attached model key is always stored in {@link m}; never infer it from the id, since model ids may contain `_`.
 *
 * All writes are read-modify-write inside a transaction, because the converter rewrites the whole {@link e} array.
 *
 * @dbxModel
 * @dbxModelGroup Notification
 * @dbxModelRead admin-only
 * @dbxModelArchetype composite-key-root
 * @dbxModelArchetype embedded-sub-objects
 * @dbxModelCompositeKey from=* encoding=two-way
 */
export interface NotificationTaskBot {
  /**
   * Creation date of this bot document.
   *
   * @dbxModelVariable createdAt
   */
  cat: Date;
  /**
   * Model key of the model this bot is attached to.
   *
   * @dbxModelVariable modelKey
   */
  m: FirestoreModelKey;
  /**
   * Ownership key of the bot's owner: the same key the attached model's NotificationBox uses (e.g. `'pr/<uid>'`).
   *
   * Only the owner may opt out of (or back into) the bot's script groups. With no owner, nobody can opt out and the
   * bot keeps running.
   *
   * @dbxModelVariable ownerKey
   */
  o?: Maybe<FirebaseAuthOwnershipKey>;
  /**
   * Run counter for the whole bot. Only ever goes up, so run ids and external keys never repeat, even when an entry is
   * removed and re-added.
   *
   * @dbxModelVariable runCounter
   */
  rc: number;
  /**
   * The bot's script entries.
   *
   * @dbxModelVariable entries
   */
  e: NotificationTaskBotEmbeddedScriptEntry[];
  /**
   * The soonest {@link NotificationTaskBotEmbeddedScriptEntry.nat} among entries with a live run. Kept for the repair
   * query and for display.
   *
   * @dbxModelVariable nextRunAt
   */
  nat?: Maybe<Date>;
}

/**
 * Role required to run a bot entry on demand.
 */
export type NotificationTaskBotRunRole = 'run';

/**
 * Role required to read and change the bot's owner opt-outs.
 *
 * Granted to the bot's owner only, and never implied by admin access: an admin has no way to undo an owner's opt-out,
 * so admins may read opt-outs but never change them. The owner gets ONLY this role (no `read`), so the full bot
 * document is never returned to them.
 *
 * Kept separate from `'owner'`, which is treated as an admin-level role.
 */
export type NotificationTaskBotOptOutRole = 'optOut';

/**
 * NotificationTaskBot roles.
 */
export type NotificationTaskBotRoles = GrantedReadRole | GrantedUpdateRole | NotificationTaskBotRunRole | NotificationTaskBotOptOutRole;

export class NotificationTaskBotDocument extends AbstractFirestoreDocument<NotificationTaskBot, NotificationTaskBotDocument, typeof notificationTaskBotIdentity> {
  get modelIdentity() {
    return notificationTaskBotIdentity;
  }
}

/**
 * Firestore snapshot converter for {@link NotificationTaskBot} documents.
 */
export const notificationTaskBotConverter = snapshotConverterFunctions<NotificationTaskBot>({
  fields: {
    cat: firestoreDate(),
    m: firestoreModelKeyString,
    o: optionalFirestoreString(),
    rc: firestoreNumber({ default: 0 }),
    e: firestoreObjectArray({ objectField: firestoreNotificationTaskBotEmbeddedScriptEntry }),
    nat: optionalFirestoreDate()
  }
});

/**
 * Creates a Firestore collection reference for {@link NotificationTaskBot} documents.
 *
 * @param context - Firestore context to create the collection reference from.
 * @returns A typed collection reference for NotificationTaskBot documents.
 */
export function notificationTaskBotCollectionReference(context: FirestoreContext): CollectionReference<NotificationTaskBot> {
  return context.collection(notificationTaskBotIdentity.collectionName);
}

/**
 * Typed Firestore collection for {@link NotificationTaskBot} documents.
 */
export type NotificationTaskBotFirestoreCollection = FirestoreCollection<NotificationTaskBot, NotificationTaskBotDocument>;

/**
 * Creates a typed {@link NotificationTaskBotFirestoreCollection} bound to the given Firestore context.
 *
 * @param firestoreContext - Firestore context to bind the collection to.
 * @returns A typed Firestore collection for NotificationTaskBot documents.
 */
export function notificationTaskBotFirestoreCollection(firestoreContext: FirestoreContext): NotificationTaskBotFirestoreCollection {
  return firestoreContext.firestoreCollection({
    modelIdentity: notificationTaskBotIdentity,
    converter: notificationTaskBotConverter,
    collection: notificationTaskBotCollectionReference(firestoreContext),
    makeDocument: (accessor, documentAccessor) => new NotificationTaskBotDocument(accessor, documentAccessor),
    firestoreContext
  });
}
