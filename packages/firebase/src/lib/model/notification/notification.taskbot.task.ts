/**
 * @module notification.taskbot.task
 *
 * The NotificationTask that executes a single run of a {@link NotificationTaskBotEmbeddedScriptEntry}.
 *
 * ONE task type for every script. The task's SUBTASK TARGET is the {@link NotificationTaskBotScriptType}, so a new
 * script registers a processor rather than a task type.
 *
 * ONE task per RUN, not one looping task per entry. The entry holds the durable state and each run is a fresh unique
 * task whose id embeds the run number. A finished run is only marked done, so reusing an id would re-derive a finished
 * document; keying by the bot's monotonic run counter keeps every run a document of its own.
 *
 * Runs are created inside the library's bot transactions only. Never create one with
 * `createOrRunUniqueNotificationDocument`: sending never checks `d`, so it would re-run a finished run.
 */
import { type Maybe, type UnixDateTimeMillisecondsNumber } from '@dereekb/util';
import { childFirestoreModelKey, type FirestoreModelKey, firestoreModelKey } from '../../common';
import { notificationBoxIdentity, notificationIdentity } from './notification';
import { createNotificationTaskTemplate, type CreateNotificationTaskTemplate } from './notification.create.task';
import { notificationBoxIdForModel, type NotificationTaskBotEntryId, type NotificationTaskBotId, type NotificationTaskBotKey, type NotificationTaskBotRunNumber, notificationTaskBotRunNotificationTaskUniqueId, type NotificationTaskKey, type NotificationTaskType } from './notification.id';
import { type NotificationTaskBotRunTrigger, type NotificationTaskBotScriptType } from './notification.taskbot';
import { type NotificationTaskSubtaskCheckpointString, type NotificationTaskSubtaskData, type NotificationTaskSubtaskMetadata } from './notification.task.subtask';

/**
 * NotificationTask type identifier for a NotificationTaskBot run.
 */
export const NOTIFICATION_TASK_BOT_RUN_NOTIFICATION_TASK_TYPE: NotificationTaskType = 'NTBR';

/**
 * Checkpoint string for a NotificationTaskBot run subtask.
 */
export type NotificationTaskBotRunSubtask = NotificationTaskSubtaskCheckpointString;

/**
 * Arbitrary metadata carried between a NotificationTaskBot run's subtasks.
 */
export type NotificationTaskBotRunSubtaskMetadata = NotificationTaskSubtaskMetadata;

/**
 * Data payload for a NotificationTaskBot run NotificationTask.
 *
 * Task data is stored as passthrough json, so times are stored as unix milliseconds.
 *
 * @template M - subtask metadata type
 * @template S - subtask checkpoint string type
 */
export interface NotificationTaskBotRunNotificationTaskData<M extends NotificationTaskBotRunSubtaskMetadata = NotificationTaskBotRunSubtaskMetadata, S extends NotificationTaskBotRunSubtask = NotificationTaskBotRunSubtask> extends NotificationTaskSubtaskData<M, S> {
  /**
   * The bot's id.
   */
  readonly b: NotificationTaskBotId;
  /**
   * The entry id.
   */
  readonly i: NotificationTaskBotEntryId;
  /**
   * The entry's script type, which is also the subtask target.
   */
  readonly t: NotificationTaskBotScriptType;
  /**
   * The run number. Must match the entry's live run number for the run to do anything.
   */
  readonly rn: NotificationTaskBotRunNumber;
  /**
   * What triggered the run.
   */
  readonly tr: NotificationTaskBotRunTrigger;
  /**
   * When the run was scheduled to run.
   */
  readonly sa: UnixDateTimeMillisecondsNumber;
  /**
   * True if {@link sa} is an explicit time. The script's due check is skipped for explicit runs.
   */
  readonly x?: Maybe<boolean>;
}

/**
 * Input for {@link notificationTaskBotRunNotificationTaskTemplate}.
 */
export interface NotificationTaskBotRunNotificationTaskTemplateInput {
  /**
   * Key of the model the bot is attached to. The run is created in that model's NotificationBox.
   */
  readonly model: FirestoreModelKey;
  /**
   * The bot's key. Used as the task's target model.
   */
  readonly botKey: NotificationTaskBotKey;
  /**
   * The bot's id.
   */
  readonly botId: NotificationTaskBotId;
  readonly entryId: NotificationTaskBotEntryId;
  readonly scriptType: NotificationTaskBotScriptType;
  readonly runNumber: NotificationTaskBotRunNumber;
  readonly trigger: NotificationTaskBotRunTrigger;
  /**
   * When the run should run.
   */
  readonly sendAt: Date;
  /**
   * Whether {@link sendAt} is an explicit time.
   */
  readonly explicit?: Maybe<boolean>;
}

/**
 * Returns the key of the NotificationTask for a single run of a bot entry.
 *
 * @param input - The attached model key, bot id, entry id and run number.
 * @returns The run task's full model key.
 */
export function notificationTaskBotRunNotificationTaskKey(input: Pick<NotificationTaskBotRunNotificationTaskTemplateInput, 'model' | 'botId' | 'entryId' | 'runNumber'>): NotificationTaskKey {
  const { model, botId, entryId, runNumber } = input;
  const notificationBoxKey = firestoreModelKey(notificationBoxIdentity, notificationBoxIdForModel(model));
  return childFirestoreModelKey(notificationBoxKey, notificationIdentity, notificationTaskBotRunNotificationTaskUniqueId(botId, entryId, runNumber));
}

/**
 * Creates a {@link CreateNotificationTaskTemplate} for a single NotificationTaskBot run.
 *
 * The task lives in the attached model's NotificationBox and is unique to the run.
 *
 * @param input - The run's details.
 * @returns A CreateNotificationTaskTemplate for the run task.
 */
export function notificationTaskBotRunNotificationTaskTemplate(input: NotificationTaskBotRunNotificationTaskTemplateInput): CreateNotificationTaskTemplate {
  const { model, botKey, botId, entryId, scriptType, runNumber, trigger, sendAt, explicit } = input;

  const data: NotificationTaskBotRunNotificationTaskData = {
    b: botId,
    i: entryId,
    t: scriptType,
    rn: runNumber,
    tr: trigger,
    sa: sendAt.getTime(),
    x: explicit || undefined
  };

  return createNotificationTaskTemplate({
    type: NOTIFICATION_TASK_BOT_RUN_NOTIFICATION_TASK_TYPE,
    notificationModel: model,
    targetModel: botKey,
    data,
    sat: sendAt,
    unique: notificationTaskBotRunNotificationTaskUniqueId(botId, entryId, runNumber),
    overrideExistingTask: true
  });
}

// MARK: All Tasks
/**
 * All NotificationTask types used by the NotificationTaskBot system.
 */
export const ALL_NOTIFICATION_TASK_BOT_NOTIFICATION_TASK_TYPES: NotificationTaskType[] = [NOTIFICATION_TASK_BOT_RUN_NOTIFICATION_TASK_TYPE];
