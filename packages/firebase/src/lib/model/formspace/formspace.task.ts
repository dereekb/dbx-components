import { type Maybe } from '@dereekb/util';
import { createNotificationTaskTemplate, type CreateNotificationTaskTemplate } from '../notification/notification.create.task';
import { type NotificationTaskSubtaskCheckpointString, type NotificationTaskSubtaskData, type NotificationTaskSubtaskMetadata } from '../notification/notification.task.subtask';
import { type NotificationTaskType, type NotificationTaskUniqueId, notificationTaskUniqueId } from '../notification/notification.id';
import { type FormSpaceDocument } from './formspace';
import { type FormSpaceId, type FormSpaceType } from './formspace.id';

/**
 * @module formspace.task
 *
 * The NotificationTask that processes a submitted FormSpace.
 *
 * ONE task type for every form type. The task's SUBTASK TARGET is the {@link FormSpaceType}, so a new form
 * type registers a processor rather than a task type — the same specialization
 * `StorageFileProcessingNotificationTask` already does by purpose.
 *
 * ONE task per SUBMISSION ATTEMPT, not per space. A unique task's document id is derived and permanent, and
 * a completed task is only marked done (`d`) — it lingers until the cleanup sweep collects it. So a space
 * that is reopened and resubmitted would re-derive the id of its own finished task, and
 * `createOrRunUniqueNotificationDocument` would find it already there and do nothing at all: the space
 * would sit in QUEUED_FOR_PROCESSING pointing at a dead document forever. Keying the id by the space's
 * reopen count is what keeps each attempt a document of its own, and the first attempt keeps the exact id
 * it has always had.
 */

/**
 * NotificationTask type identifier for FormSpace submission processing.
 */
export const FORM_SPACE_SUBMISSION_NOTIFICATION_TASK_TYPE: NotificationTaskType = 'FSPS';

/**
 * Checkpoint string for a FormSpace submission subtask.
 */
export type FormSpaceSubmissionSubtask = NotificationTaskSubtaskCheckpointString;

/**
 * Arbitrary metadata carried between a FormSpace submission's subtasks.
 */
export type FormSpaceSubmissionSubtaskMetadata = NotificationTaskSubtaskMetadata;

/**
 * Data payload for a FormSpace submission NotificationTask.
 *
 * @template M - subtask metadata type
 * @template S - subtask checkpoint string type
 */
export interface FormSpaceSubmissionNotificationTaskData<M extends FormSpaceSubmissionSubtaskMetadata = FormSpaceSubmissionSubtaskMetadata, S extends FormSpaceSubmissionSubtask = FormSpaceSubmissionSubtask> extends NotificationTaskSubtaskData<M, S> {
  /**
   * The FormSpaceDocument id.
   */
  readonly formSpace: FormSpaceId;
  /**
   * The FormSpace's type, which is also the subtask target.
   *
   * Retrieved from the FormSpace the first time the task runs and re-copied onto the metadata afterwards,
   * so subsequent runs do not re-read the document only to learn which processor to dispatch to.
   */
  readonly t?: Maybe<FormSpaceType>;
  /**
   * The space's reopen count when this task was created — the submission ATTEMPT this task belongs to.
   *
   * The handler compares it against the space's current count and terminates when they differ. Without
   * that fence a task left over from a superseded attempt would process the reopened space's new content
   * and its cleanup would write `ps`/`cpat`/`pn` over the attempt actually in force. Absent on a task
   * created before attempt-keying existed, which is read as "do not fence".
   */
  readonly rc?: Maybe<number>;
}

/**
 * Input for {@link formSpaceSubmissionNotificationTaskTemplate}.
 */
export interface FormSpaceSubmissionNotificationTaskInput<M extends FormSpaceSubmissionSubtaskMetadata = FormSpaceSubmissionSubtaskMetadata> extends Omit<FormSpaceSubmissionNotificationTaskData<M>, 'formSpace' | 't' | 'sfps' | 'rc'> {
  readonly formSpaceDocument: FormSpaceDocument;
  /**
   * The space's current reopen count — the attempt this task is for. Defaults to 0, the first submission.
   */
  readonly reopenCount?: Maybe<number>;
  readonly overrideExistingTask?: Maybe<boolean>;
}

/**
 * Input for {@link formSpaceSubmissionNotificationTaskUniqueId}.
 */
export interface FormSpaceSubmissionNotificationTaskUniqueIdInput {
  readonly formSpaceId: FormSpaceId;
  /**
   * The attempt's reopen count. Defaults to 0, the first submission.
   */
  readonly reopenCount?: Maybe<number>;
}

/**
 * Returns the unique NotificationTask document id processing one SUBMISSION ATTEMPT of a FormSpace.
 *
 * The first attempt is the bare {@link notificationTaskUniqueId}, unsuffixed, so a space submitted before
 * reopening existed keeps the exact document it already has. Every attempt after a reopen appends its
 * count, which is what stops a resubmit from colliding with the finished task of the attempt before it.
 *
 * The `r` between the separators keeps the suffix from ever being able to produce a `__` run, whatever a
 * FormSpace id happens to contain — Firestore reserves ids wrapped in double underscores, and staying well
 * clear of them costs one character.
 *
 * Exported so a caller that has to LOCATE an attempt's task — a test asserting which document a resubmit
 * created, or tooling inspecting a stuck submission — derives the id the same way the template does. The
 * reopen action deliberately does not need it: the superseded attempt's task is left alone, either already
 * done and awaiting the cleanup sweep or still queued and about to fence itself off.
 *
 * @param input - The FormSpace id and the attempt's reopen count.
 * @returns The unique notification task id.
 *
 * @example
 * ```ts
 * formSpaceSubmissionNotificationTaskUniqueId({ formSpaceId: 'abc' }); // 'abc_FSPS'
 * formSpaceSubmissionNotificationTaskUniqueId({ formSpaceId: 'abc', reopenCount: 2 }); // 'abc_FSPS_r2'
 * ```
 *
 * @__NO_SIDE_EFFECTS__
 */
export function formSpaceSubmissionNotificationTaskUniqueId(input: FormSpaceSubmissionNotificationTaskUniqueIdInput): NotificationTaskUniqueId {
  const { formSpaceId } = input;
  const reopenCount = input.reopenCount ?? 0;
  const baseId = notificationTaskUniqueId(formSpaceId, FORM_SPACE_SUBMISSION_NOTIFICATION_TASK_TYPE);
  return reopenCount > 0 ? `${baseId}_r${reopenCount}` : baseId;
}

/**
 * Creates a {@link CreateNotificationTaskTemplate} for a FormSpace submission task.
 *
 * The task is UNIQUE to one submission ATTEMPT of the FormSpace. Within an attempt that uniqueness is what
 * makes a second template resolve to the same document rather than racing a second processor against the
 * first; across attempts, {@link formSpaceSubmissionNotificationTaskUniqueId} keys them apart so a resubmit
 * after a reopen gets a document — and a checkpoint flow — of its own.
 *
 * @param input - The target FormSpaceDocument, its reopen count, and optional subtask data.
 * @returns A CreateNotificationTaskTemplate for the submission task.
 *
 * @example
 * ```ts
 * const template = formSpaceSubmissionNotificationTaskTemplate({ formSpaceDocument: doc, reopenCount: formSpace.rc });
 * ```
 */
export function formSpaceSubmissionNotificationTaskTemplate(input: FormSpaceSubmissionNotificationTaskInput): CreateNotificationTaskTemplate {
  const { formSpaceDocument, overrideExistingTask } = input;
  const reopenCount = input.reopenCount ?? 0;

  return createNotificationTaskTemplate({
    type: FORM_SPACE_SUBMISSION_NOTIFICATION_TASK_TYPE,
    targetModel: formSpaceDocument,
    data: {
      formSpace: formSpaceDocument.id,
      rc: reopenCount,
      d: input.sd
    },
    unique: formSpaceSubmissionNotificationTaskUniqueId({ formSpaceId: formSpaceDocument.id, reopenCount }),
    overrideExistingTask
  });
}

// MARK: All Tasks
/**
 * All NotificationTask types used by the FormSpace system.
 *
 * Register these with the notification task service so an unhandled type is caught at wiring time rather
 * than at the first submission.
 */
export const ALL_FORM_SPACE_NOTIFICATION_TASK_TYPES: NotificationTaskType[] = [FORM_SPACE_SUBMISSION_NOTIFICATION_TASK_TYPE];
