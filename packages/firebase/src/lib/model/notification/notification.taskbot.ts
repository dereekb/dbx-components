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
  return firestoreModelKey(notificationTaskBotIdentity, notificationTaskBotIdForModel(readFirestoreModelKey(model) as FirestoreModelKey));
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
   * The run was skipped.
   */
  SKIPPED = 3,
  /**
   * The run failed.
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
   * When the entry was paused. A paused entry has no live run.
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
   * Consecutive failure count. Reset whenever a run completes.
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
 * NotificationTaskBot roles.
 */
export type NotificationTaskBotRoles = GrantedReadRole | GrantedUpdateRole | NotificationTaskBotRunRole;

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
