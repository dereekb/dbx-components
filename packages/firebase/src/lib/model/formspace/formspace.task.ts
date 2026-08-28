import { type Maybe } from '@dereekb/util';
import { createNotificationTaskTemplate, type CreateNotificationTaskTemplate } from '../notification/notification.create.task';
import { type NotificationTaskSubtaskCheckpointString, type NotificationTaskSubtaskData, type NotificationTaskSubtaskMetadata } from '../notification/notification.task.subtask';
import { type NotificationTaskType } from '../notification/notification.id';
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
}

/**
 * Input for {@link formSpaceSubmissionNotificationTaskTemplate}.
 */
export interface FormSpaceSubmissionNotificationTaskInput<M extends FormSpaceSubmissionSubtaskMetadata = FormSpaceSubmissionSubtaskMetadata> extends Omit<FormSpaceSubmissionNotificationTaskData<M>, 'formSpace' | 't' | 'sfps'> {
  readonly formSpaceDocument: FormSpaceDocument;
  readonly overrideExistingTask?: Maybe<boolean>;
}

/**
 * Creates a {@link CreateNotificationTaskTemplate} for a FormSpace submission task.
 *
 * The task is UNIQUE to the FormSpace: a space submits once, and a second template for the same space must
 * resolve to the same document rather than racing a second processor against the first.
 *
 * @param input - The target FormSpaceDocument and optional subtask data.
 * @returns A CreateNotificationTaskTemplate for the submission task.
 *
 * @example
 * ```ts
 * const template = formSpaceSubmissionNotificationTaskTemplate({ formSpaceDocument: doc });
 * ```
 */
export function formSpaceSubmissionNotificationTaskTemplate(input: FormSpaceSubmissionNotificationTaskInput): CreateNotificationTaskTemplate {
  const { formSpaceDocument, overrideExistingTask } = input;

  return createNotificationTaskTemplate({
    type: FORM_SPACE_SUBMISSION_NOTIFICATION_TASK_TYPE,
    targetModel: formSpaceDocument,
    data: {
      formSpace: formSpaceDocument.id,
      d: input.sd
    },
    unique: true,
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
