import {
  type FormSpace,
  type FormSpaceDocument,
  type FormSpaceFirestoreCollections,
  FormSpaceProcessingState,
  FormSpaceState,
  type FormSpaceSubmissionNotificationTaskData,
  type FormSpaceSubmissionSubtask,
  type FormSpaceSubmissionSubtaskMetadata,
  type FormSpaceType,
  FORM_SPACE_SUBMISSION_NOTIFICATION_TASK_TYPE,
  getDocumentSnapshotData,
  notificationTaskComplete
} from '@dereekb/firebase';
import { cachedGetter, type Getter, type Maybe } from '@dereekb/util';
import { type NotificationTaskServiceTaskHandlerConfig } from '../notification/notification.task.service.handler';
import {
  type NotificationTaskSubtaskCleanupInstructions,
  type NotificationTaskSubtaskFlowEntry,
  type NotificationTaskSubtaskInput,
  type NotificationTaskSubtaskResult,
  type NotificationTaskSubtaskNotificationTaskHandlerConfig,
  type NotificationTaskSubtaskProcessorConfig,
  notificationTaskSubTaskMissingRequiredDataTermination,
  notificationTaskSubtaskNotificationTaskHandlerFactory
} from '../notification/notification.task.subtask.handler';

/**
 * @module formspace.task.service.handler
 *
 * The submission-processing handler: one NotificationTask type dispatching, by {@link FormSpaceType}, to
 * the app's registered processors.
 *
 * This is a thin specialization of {@link notificationTaskSubtaskNotificationTaskHandlerFactory}, exactly
 * as `storageFileProcessingNotificationTaskHandler` is — the checkpoint / retry / delay semantics are the
 * framework's, and the only thing FormSpace supplies is "how to load the space" and "what to write when
 * processing concludes".
 */

/**
 * Input handed to every FormSpace submission subtask.
 *
 * @template M - subtask metadata type
 * @template S - subtask checkpoint string type
 */
export interface FormSpaceSubmissionSubtaskInput<M extends FormSpaceSubmissionSubtaskMetadata = FormSpaceSubmissionSubtaskMetadata, S extends FormSpaceSubmissionSubtask = FormSpaceSubmissionSubtask> extends NotificationTaskSubtaskInput<FormSpaceSubmissionNotificationTaskData<M, S>, M, S> {
  /**
   * The FormSpaceDocument being processed.
   */
  readonly formSpaceDocument: FormSpaceDocument;
  /**
   * Loads the FormSpace, memoized for the duration of one task run.
   *
   * Still a getter rather than the value, so a processor reads it the same way whether or not the handler
   * happened to have it already. It resolves the snapshot the run's attempt fence was checked against, so
   * every checkpoint in one run sees one consistent space.
   */
  readonly loadFormSpace: Getter<Promise<FormSpace>>;
}

/**
 * Result of a FormSpace submission subtask.
 */
export type FormSpaceSubmissionSubtaskResult<M extends FormSpaceSubmissionSubtaskMetadata = FormSpaceSubmissionSubtaskMetadata, S extends FormSpaceSubmissionSubtask = FormSpaceSubmissionSubtask> = NotificationTaskSubtaskResult<M, S>;

/**
 * One entry in a FormSpace submission processor's checkpoint flow.
 */
export type FormSpaceSubmissionSubtaskFlowEntry<M extends FormSpaceSubmissionSubtaskMetadata = FormSpaceSubmissionSubtaskMetadata, S extends FormSpaceSubmissionSubtask = FormSpaceSubmissionSubtask> = NotificationTaskSubtaskFlowEntry<
  FormSpaceSubmissionSubtaskInput<M, S>,
  FormSpaceSubmissionNotificationTaskData<M, S>,
  M,
  S
>;

/**
 * What a FormSpace submission processor asks the cleanup step to write.
 */
export interface FormSpaceSubmissionSubtaskCleanupOutput extends NotificationTaskSubtaskCleanupInstructions {
  /**
   * The processing state to leave the FormSpace in. Defaults to SUCCESS.
   */
  readonly nextProcessingState?: Maybe<FormSpaceProcessingState>;
  /**
   * Whether to move the space to ARCHIVED as part of cleanup. Defaults to false.
   */
  readonly archive?: Maybe<boolean>;
}

/**
 * A processor for one {@link FormSpaceType}, keyed by that type as its subtask target.
 *
 * @template M - subtask metadata type
 * @template S - subtask checkpoint string type
 */
export type FormSpaceSubmissionProcessorConfig<M extends FormSpaceSubmissionSubtaskMetadata = FormSpaceSubmissionSubtaskMetadata, S extends FormSpaceSubmissionSubtask = FormSpaceSubmissionSubtask> = NotificationTaskSubtaskProcessorConfig<
  FormSpaceSubmissionSubtaskInput<M, S>,
  FormSpaceSubmissionSubtaskCleanupOutput,
  FormSpaceSubmissionNotificationTaskData<M, S>,
  M,
  S
>;

/**
 * Configuration for {@link formSpaceSubmissionNotificationTaskHandler}.
 */
export interface FormSpaceSubmissionNotificationTaskHandlerConfig extends Omit<NotificationTaskSubtaskNotificationTaskHandlerConfig<FormSpaceSubmissionSubtaskInput, FormSpaceSubmissionSubtaskCleanupOutput, FormSpaceSubmissionNotificationTaskData>, 'processors'> {
  /**
   * The per-type processors.
   */
  readonly processors: FormSpaceSubmissionProcessorConfig[];
  /**
   * Accessor for the FormSpace collection.
   */
  readonly formSpaceFirestoreCollections: FormSpaceFirestoreCollections;
}

/**
 * The cleanup instructions applied when a processor asks for none: mark the submission successful.
 *
 * @returns The default cleanup instructions.
 */
export const formSpaceSubmissionNotificationTaskHandlerDefaultCleanup = (): FormSpaceSubmissionSubtaskCleanupOutput => {
  return {
    cleanupSuccess: true,
    nextProcessingState: FormSpaceProcessingState.SUCCESS,
    archive: false
  };
};

/**
 * Creates the {@link NotificationTaskServiceTaskHandlerConfig} that processes FormSpace submissions.
 *
 * @param config - Handler configuration including the per-type processors and the FormSpace collection.
 * @returns A NotificationTaskServiceTaskHandlerConfig wired for FormSpace submission processing.
 *
 * @example
 * ```ts
 * const handler = formSpaceSubmissionNotificationTaskHandler({
 *   processors: [demoExampleFormSpaceProcessor],
 *   validate: DEMO_FORM_SPACE_TYPE_CONFIGS.map((x) => x.formSpaceType),
 *   formSpaceFirestoreCollections: context
 * });
 * ```
 */
export function formSpaceSubmissionNotificationTaskHandler(config: FormSpaceSubmissionNotificationTaskHandlerConfig): NotificationTaskServiceTaskHandlerConfig<FormSpaceSubmissionNotificationTaskData> {
  const { formSpaceFirestoreCollections } = config;
  const formSpaceDocumentAccessor = formSpaceFirestoreCollections.formSpaceCollection.documentAccessor();

  return notificationTaskSubtaskNotificationTaskHandlerFactory<FormSpaceSubmissionSubtaskInput, FormSpaceSubmissionSubtaskCleanupOutput, FormSpaceSubmissionNotificationTaskData, FormSpaceSubmissionSubtaskMetadata, FormSpaceSubmissionSubtask>({
    taskType: FORM_SPACE_SUBMISSION_NOTIFICATION_TASK_TYPE,
    subtaskHandlerFunctionName: 'formSpaceSubmissionNotificationTaskHandler',
    inputFunction: async (data: FormSpaceSubmissionNotificationTaskData) => {
      const formSpaceDocument = formSpaceDocumentAccessor.loadDocumentForId(data.formSpace);

      // Read up front rather than lazily. A task has to be checked against the submission ATTEMPT it was
      // created for before it is allowed to do anything, and that check needs the document — so `data.t`,
      // which used to let a later run dispatch without reading at all, is now only the record of the
      // subtask target rather than a way to avoid the read.
      const formSpace = await getDocumentSnapshotData(formSpaceDocument, true);

      if (!formSpace) {
        // the space was deleted out from under the task; terminate rather than retry forever
        throw notificationTaskSubTaskMissingRequiredDataTermination();
      }

      // THE ATTEMPT FENCE. A reopen advances `rc`, and the resubmission that follows keys a task document
      // of its own — which leaves THIS one, created for the superseded attempt, still queued. Allowed to
      // run it would process the reopened space's new content and its cleanup would write `ps` / `cpat` /
      // `pn` over the attempt actually in force. Terminating is the honest outcome: there is nothing left
      // for this task to be about, which is exactly what the missing-required-data termination means.
      //
      // Fenced on `rc` alone, never on `s`: a processor is allowed to move the space to ARCHIVED during
      // its own cleanup checkpoint, so a state check here would abort the very run that archived it. A
      // task created before attempt-keying existed carries no `rc` and is not fenced, so a task in flight
      // across the upgrade still completes.
      if (data.rc != null && data.rc !== formSpace.rc) {
        throw notificationTaskSubTaskMissingRequiredDataTermination();
      }

      const loadFormSpace = cachedGetter(async () => formSpace);

      // the type is the subtask target, and is re-copied onto the metadata by buildUpdateMetadata
      const target: FormSpaceType = data.t ?? formSpace.t;

      return {
        target,
        formSpaceDocument,
        loadFormSpace
      };
    },
    buildUpdateMetadata: (baseUpdateMetadata, input) => {
      return {
        ...baseUpdateMetadata,
        t: input.target
      };
    },
    defaultCleanup: formSpaceSubmissionNotificationTaskHandlerDefaultCleanup,
    cleanupFunction: async function (input, cleanupInstructions: FormSpaceSubmissionSubtaskCleanupOutput) {
      const { formSpaceDocument } = input;
      const { nextProcessingState, archive } = cleanupInstructions;

      const updateTemplate: Partial<FormSpace> = {
        ps: nextProcessingState ?? FormSpaceProcessingState.SUCCESS,
        cpat: new Date(),
        pn: null // clear reference
      };

      if (archive) {
        updateTemplate.s = FormSpaceState.ARCHIVED;
      }

      await formSpaceDocument.update(updateTemplate);

      return notificationTaskComplete();
    }
  })(config);
}
