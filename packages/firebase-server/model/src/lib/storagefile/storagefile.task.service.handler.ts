import {
  StorageFileProcessingNotificationTaskData,
  StorageFileProcessingNotificationTaskCheckpoint,
  StorageFilePurpose,
  STORAGE_FILE_PROCESSING_NOTIFICATION_TASK_TYPE,
  NotificationTask,
  notificationTaskDelayRetry,
  StorageFileProcessingSubtaskMetadata,
  NotificationTaskServiceHandleNotificationTaskResult,
  StorageFileProcessingSubtask,
  notificationTaskComplete,
  StorageFileDocument,
  FirestoreDocumentAccessor,
  StorageFile,
  notificationTaskPartiallyComplete,
  NotificationTaskCheckpointString,
  delayCompletion,
  StorageFileState,
  StorageFileProcessingState,
  DEFAULT_MAX_STORAGE_FILE_PROCESSING_CLEANUP_RETRY_ATTEMPTS,
  DEFAULT_STORAGE_FILE_PROCESSING_CLEANUP_RETRY_DELAY,
  FirestoreDocumentAccessorRef,
  StorageFileFirestoreCollections,
  StoredFileReader,
  storedFileReaderFactory,
  StoragePath,
  FirebaseStorageAccessor,
  copyStoragePath
} from '@dereekb/firebase';
import { NotificationTaskServiceTaskHandlerFlowEntry, NotificationTaskServiceTaskHandlerConfig } from '../notification/notification.task.service.handler';
import { asArray, cachedGetter, dateFromDateOrTimeNumber, Maybe, Milliseconds, PromiseOrValue, separateValues, unique } from '@dereekb/util';
import { BaseError } from 'make-error';
import { removeFromCompletionsArrayWithTaskResult } from '../notification/notification.task.service.util';

/**
 * Input for a StorageFileProcessingPurposeSubtask.
 */
export interface StorageFileProcessingPurposeSubtaskInput<M extends StorageFileProcessingSubtaskMetadata = any, S extends StorageFileProcessingSubtask = StorageFileProcessingSubtask> {
  /**
   * The root NotificationTask.
   *
   * The data is always guranteed.
   */
  readonly notificationTask: Omit<NotificationTask<StorageFileProcessingNotificationTaskData<M>>, 'data'> & Required<Pick<NotificationTask<StorageFileProcessingNotificationTaskData<M>>, 'data'>>;
  /**
   * The retrieved purpose.
   */
  readonly purpose: StorageFilePurpose;
  /**
   * List of completed subtasks.
   */
  readonly completedSubtasks: S[];
  /**
   * The associated StorageFileDocument.
   */
  readonly storageFileDocument: StorageFileDocument;
  /**
   * Function to load the StorageFileDocument's data.
   *
   * If the document no longer exists, an error is thrown that immediately terminates the subtask and marks the task as complete.
   */
  readonly loadStorageFile: () => Promise<StorageFile>;
  /**
   * The accessor for the uploaded file details.
   */
  readonly fileDetailsAccessor: StoredFileReader;
  /**
   * The current metadata for the subtask.
   */
  readonly subtaskData?: Maybe<M>;
}

/**
 * Result of a StorageFileProcessingPurposeSubtask.
 */
export type StorageFileProcessingPurposeSubtaskResult<M extends StorageFileProcessingSubtaskMetadata = any, S extends StorageFileProcessingSubtask = StorageFileProcessingSubtask> = NotificationTaskServiceHandleNotificationTaskResult<M, S>;

/**
 * A StorageFileProcessingPurposeSubtask is a function that handles a specific StorageFilePurpose subtask.
 */
export type StorageFileProcessingPurposeSubtask<M extends StorageFileProcessingSubtaskMetadata = any, S extends StorageFileProcessingSubtask = StorageFileProcessingSubtask> = (input: StorageFileProcessingPurposeSubtaskInput<M>) => Promise<StorageFileProcessingPurposeSubtaskResult<M, S>>;

/**
 * Similar to NotificationTaskServiceTaskHandlerFlowEntry, but used in StorageFileProcessingPurposeTaskProcessorConfig as part of the flow.
 */
export interface StorageFileProcessingPurposeSubtaskFlowEntry<M extends StorageFileProcessingSubtaskMetadata = any, S extends StorageFileProcessingSubtask = StorageFileProcessingSubtask> {
  /**
   * The subtask this flow entry represents.
   */
  readonly subtask: S;
  /**
   * The subtask function
   */
  readonly fn: StorageFileProcessingPurposeSubtask<M, S>;
}

/**
 * The output cleanup configuration.
 */
export interface StorageFileProcessingPurposeSubtaskCleanupOutput {
  /**
   * Whether or not the cleanup was successful. If false, the task will be delayed until the cleanup can be retried.
   *
   * Defaults to true.
   */
  readonly cleanupSuccess?: boolean;
  /**
   * How long to delay the retry of the cleanup after cleanup fails.
   *
   * Ignored if cleanupSuccess is not false.
   */
  readonly delayRetryUntil?: NotificationTaskServiceHandleNotificationTaskResult['delayUntil'];
  /**
   * The next processing state for the StorageFile.
   *
   * Defaults to StorageFileProcessingState.SUCCESS.
   *
   * Ignored if cleanupSuccess is false.
   */
  readonly nextProcessingState?: Maybe<StorageFileProcessingState.SUCCESS | StorageFileProcessingState.ARCHIVED | StorageFileProcessingState.FAILED>;
  /**
   * If true, flags the StorageFile for deletion. Can pass the milliseconds or Date to set a specific deletion time.
   *
   * Ignored if cleanupSuccess is false.
   */
  readonly queueForDelete?: Maybe<boolean | Milliseconds | Date>;
}

/**
 * Cleanup function for a StorageFileProcessingPurposeSubtask.
 *
 * This is called during the cleanup step.
 */
export type StorageFileProcessingPurposeSubtaskCleanupFunction<M extends StorageFileProcessingSubtaskMetadata = any, S extends StorageFileProcessingSubtask = StorageFileProcessingSubtask> = (input: StorageFileProcessingPurposeSubtaskInput<M, S>) => PromiseOrValue<StorageFileProcessingPurposeSubtaskCleanupOutput>;

/**
 * Similar to NotificationTaskServiceTaskHandlerConfig, but instead targets a specific StorageFilePurpose.
 *
 * The flows behave the same way.
 */
export interface StorageFileProcessingPurposeSubtaskProcessorConfig<M extends StorageFileProcessingSubtaskMetadata = any, S extends StorageFileProcessingSubtask = StorageFileProcessingSubtask> {
  readonly purpose: StorageFilePurpose;
  /**
   * The order/flow of checkpoints and handler functions.
   *
   * When handling a notification task, if the checkpoint has already been completed then the entry will be skipped.
   */
  readonly flow: StorageFileProcessingPurposeSubtaskFlowEntry<M, S>[];
  /**
   * Optional cleanup function for the subtask.
   *
   * If not provided, the default cleanup actions will take place, which is:
   * - Set the StorageFileProcessingState to SUCCESS
   * - Flag the StorageFile for deletion
   */
  readonly cleanup?: StorageFileProcessingPurposeSubtaskCleanupFunction<M, S>;
}

export interface StorageFileProcessingNotificationTaskHandlerConfig {
  /**
   * List of processable StorageFilePurpose values for the app. Used for verifying that all StorageFilePurpose values are handled.
   */
  readonly validate?: StorageFilePurpose[];
  /**
   * List of handlers for StorageFilePurpose values.
   */
  readonly processors: StorageFileProcessingPurposeSubtaskProcessorConfig<any, any>[];
  /**
   * FirebaseStorageAccessor
   */
  readonly storageAccessor: FirebaseStorageAccessor;
  /**
   * Accessor for StorageFileDocument.
   */
  readonly storageFileFirestoreCollections: StorageFileFirestoreCollections;
  /**
   * The maximum number of times to delay the cleanup step of a StorageFileProcessingNotificationTask.
   *
   * Defaults to DEFAULT_MAX_STORAGE_FILE_PROCESSING_CLEANUP_RETRY_ATTEMPTS.
   */
  readonly maxCleanupRetryAttempts?: Maybe<number>;
  /**
   * The amount of time to delay the cleanup step of a StorageFileProcessingNotificationTask.
   *
   * Defaults to DEFAULT_STORAGE_FILE_PROCESSING_CLEANUP_RETRY_DELAY.
   */
  readonly cleanupRetryDelay?: Maybe<Milliseconds>;
}

/**
 * Creates a NotificationTaskServiceTaskHandlerConfig that handles the StorageFileProcessingNotificationTask.
 */
export function storageFileProcessingNotificationTaskHandler(config: StorageFileProcessingNotificationTaskHandlerConfig): NotificationTaskServiceTaskHandlerConfig<StorageFileProcessingNotificationTaskData, StorageFileProcessingNotificationTaskCheckpoint> {
  const { processors: inputProcessors, storageAccessor, storageFileFirestoreCollections, maxCleanupRetryAttempts: inputMaxCleanupRetryAttempts, cleanupRetryDelay: inputCleanupRetryDelay } = config;
  const storageFileDocumentAccessor = storageFileFirestoreCollections.storageFileCollection.documentAccessor();
  const maxCleanupRetryAttempts = inputMaxCleanupRetryAttempts ?? DEFAULT_MAX_STORAGE_FILE_PROCESSING_CLEANUP_RETRY_ATTEMPTS;
  const cleanupRetryDelay = inputCleanupRetryDelay ?? DEFAULT_STORAGE_FILE_PROCESSING_CLEANUP_RETRY_DELAY;
  const makeFileDetailsAccessor = storedFileReaderFactory();

  const processors: Record<StorageFilePurpose, StorageFileProcessingPurposeSubtaskProcessor> = {};

  type StorageFileProcessingPurposeSubtaskProcessorProcessFunction<M extends StorageFileProcessingSubtaskMetadata = any, S extends StorageFileProcessingSubtask = StorageFileProcessingSubtask> = (input: StorageFileProcessingPurposeSubtaskInput<M, S>) => Promise<NotificationTaskServiceHandleNotificationTaskResult<StorageFileProcessingNotificationTaskData<M, S>, StorageFileProcessingNotificationTaskCheckpoint>>;
  interface StorageFileProcessingPurposeSubtaskProcessor<M extends StorageFileProcessingSubtaskMetadata = any, S extends StorageFileProcessingSubtask = StorageFileProcessingSubtask> {
    readonly process: StorageFileProcessingPurposeSubtaskProcessorProcessFunction<M, S>;
    readonly cleanup?: StorageFileProcessingPurposeSubtaskCleanupFunction<M, S>;
  }

  inputProcessors.forEach((processorConfig) => {
    const { purpose } = processorConfig;
    processors[purpose] = processorFunctionForConfig(processorConfig);
  });

  function completeProcessingAndScheduleCleanup(): NotificationTaskServiceHandleNotificationTaskResult<StorageFileProcessingNotificationTaskData<any, any>, StorageFileProcessingNotificationTaskCheckpoint> {
    return notificationTaskPartiallyComplete(['processing']);
  }

  function defaultCleanupOutput(): StorageFileProcessingPurposeSubtaskCleanupOutput {
    return {
      cleanupSuccess: true,
      nextProcessingState: StorageFileProcessingState.SUCCESS,
      queueForDelete: true
    };
  }

  /**
   * Structure is similar to notificationTaskService(), but contained to handle the subtasks.
   */
  function processorFunctionForConfig<M extends StorageFileProcessingSubtaskMetadata = any, S extends StorageFileProcessingSubtask = StorageFileProcessingSubtask>(processorConfig: StorageFileProcessingPurposeSubtaskProcessorConfig<M, S>): StorageFileProcessingPurposeSubtaskProcessor<M, S> {
    const { flow: inputFlows, cleanup } = processorConfig;
    const { included: subtaskFlows, excluded: nonSubtaskFlows } = separateValues(inputFlows, (x) => x.subtask != null);

    if (inputFlows.length === 0) {
      throw new Error('storageFileProcessingNotificationTaskHandler(): StorageFileProcessingPurposeSubtaskProcessorConfig must have at least one flow entry.');
    } else if (nonSubtaskFlows.length > 1) {
      throw new Error('storageFileProcessingNotificationTaskHandler(): StorageFileProcessingPurposeSubtaskProcessorConfig must not have more than one non-subtask flow.');
    }

    const allKnownSubtasks = unique(inputFlows.map((x) => x.subtask));

    return {
      process: async (input: StorageFileProcessingPurposeSubtaskInput<M, S>) => {
        const { notificationTask, completedSubtasks, subtaskData, purpose } = input;

        let fn: Maybe<StorageFileProcessingPurposeSubtask<M, S>>;

        switch (completedSubtasks.length) {
          case 0:
            fn = (nonSubtaskFlows[0] ?? subtaskFlows[0])?.fn as Maybe<StorageFileProcessingPurposeSubtask<M, S>>;
            break;
          default:
            const completedSubtasksSet = new Set(completedSubtasks);
            /**
             * Find the next flow function that hasn't had its checkpoint completed yet.
             */
            const nextSubtask = subtaskFlows.find((x) => !completedSubtasksSet.has(x.subtask));
            fn = nextSubtask?.fn as Maybe<StorageFileProcessingPurposeSubtask<M, S>>;
            break;
        }

        let result: NotificationTaskServiceHandleNotificationTaskResult<StorageFileProcessingNotificationTaskData<M, S>, StorageFileProcessingNotificationTaskCheckpoint>;

        if (fn) {
          /*
           * This section is similar to handleNotificationTask() in notification.action.server.ts,
           * but is modified to handle the subtasks. The main difference is the attempt count is maintained,
           * and instead is available via the normal NotificationTask attempts details.
           */

          const subtaskResult: NotificationTaskServiceHandleNotificationTaskResult<M, S> = await fn(input);
          const { completion: subtaskCompletion, updateMetadata: subtaskUpdateMetadata, delayUntil } = subtaskResult;

          let allSubtasksDone = false;
          let sfps: S[] = completedSubtasks;

          // update the task metadata to reflect the changes
          switch (subtaskCompletion) {
            case true:
              allSubtasksDone = true;
              break;
            case false:
              // remove any completions, if applicable
              sfps = removeFromCompletionsArrayWithTaskResult(sfps, subtaskResult);
              break;
            default:
              sfps = unique([
                ...removeFromCompletionsArrayWithTaskResult(sfps, subtaskResult), // remove any completions, if applicable
                ...asArray(subtaskCompletion)
              ]);

              const completedSubtasksSet = new Set(sfps);
              const incompleteSubtasks = allKnownSubtasks.filter((x) => !completedSubtasksSet.has(x));

              allSubtasksDone = incompleteSubtasks.length === 0;
              break;
          }

          /**
           * This is updating the metadata for the NotificationTask, which has a nested data
           */
          const updateMetadata: StorageFileProcessingNotificationTaskData<M, S> = {
            ...(notificationTask.data as StorageFileProcessingNotificationTaskData<M, S>),
            // always re-copy the purpose/storagePath for the next run so StorageFile does not have to be reloaded
            p: purpose,
            storagePath: copyStoragePath(input.fileDetailsAccessor.input),
            sfps,
            sd: {
              ...subtaskData,
              ...subtaskUpdateMetadata
            } as M
          };

          result = {
            completion: allSubtasksDone ? ['processing'] : delayCompletion(), // return processing until all subtasks are complete.
            updateMetadata,
            delayUntil // delay is passed through
          };
        } else {
          // no more subtasks to process, and no metadata changes. Mark as processing complete and continue.
          result = completeProcessingAndScheduleCleanup();
        }

        return result;
      },
      cleanup
    };
  }

  async function _initializeWithTaskData(data: StorageFileProcessingNotificationTaskData) {
    const storageFileDocument = await storageFileDocumentAccessor.loadDocumentForId(data.storageFile);

    const loadStorageFile = cachedGetter(async () => {
      const storageFile = await storageFileDocument.snapshotData();

      if (!storageFile) {
        throw new StorageFileDocumentNoLongerAvailable();
      }

      return storageFile;
    });

    let purpose = data?.p;

    if (!purpose) {
      // attempt to load the purpose from the storage file, if it exists.
      purpose = await loadStorageFile().then((x) => x.p);
    }

    let storagePath: StoragePath;

    if (data.storagePath) {
      storagePath = data.storagePath;
    } else {
      storagePath = await loadStorageFile().then((x) => ({ bucketId: x.bucketId, pathString: x.pathString }));
    }

    const file = storageAccessor.file(storagePath);
    const fileDetailsAccessor = makeFileDetailsAccessor(file);

    return {
      purpose,
      loadStorageFile,
      fileDetailsAccessor,
      storageFileDocument
    };
  }

  const result: NotificationTaskServiceTaskHandlerConfig<StorageFileProcessingNotificationTaskData, StorageFileProcessingNotificationTaskCheckpoint> = {
    type: STORAGE_FILE_PROCESSING_NOTIFICATION_TASK_TYPE,
    flow: [
      {
        checkpoint: 'processing',
        fn: async (notificationTask: NotificationTask<StorageFileProcessingNotificationTaskData>) => {
          const { data } = notificationTask;

          let result: NotificationTaskServiceHandleNotificationTaskResult;

          if (data) {
            try {
              const { purpose, storageFileDocument, loadStorageFile, fileDetailsAccessor } = await _initializeWithTaskData(data);

              if (purpose) {
                const processor = processors[purpose];

                if (processor) {
                  const { sd: subtaskData, sfps: completedSubtasks } = data;

                  const input: StorageFileProcessingPurposeSubtaskInput = {
                    notificationTask: notificationTask as StorageFileProcessingPurposeSubtaskInput['notificationTask'],
                    completedSubtasks: completedSubtasks ?? [],
                    purpose,
                    subtaskData,
                    storageFileDocument,
                    fileDetailsAccessor,
                    loadStorageFile
                  };

                  result = await processor.process(input);
                } else {
                  // processor is unknown. Complete the task.
                  result = completeProcessingAndScheduleCleanup();
                }
              } else {
                // purpose is unknown. Complete the task.
                result = completeProcessingAndScheduleCleanup();
              }
            } catch (e) {
              if (e instanceof StorageFileDocumentNoLongerAvailable) {
                // Catch loading the StorageFileDocument's data.

                // Task is complete if the document no longer exists. Nothing to cleanup.
                result = notificationTaskComplete();
              } else {
                // rethrow the error
                throw e;
              }
            }
          } else {
            // Improperly configured task. Complete immediately.
            result = notificationTaskComplete();
          }

          return result;
        }
      },
      {
        checkpoint: 'cleanup',
        fn: async (notificationTask: NotificationTask<StorageFileProcessingNotificationTaskData>) => {
          const { data } = notificationTask;

          let result: NotificationTaskServiceHandleNotificationTaskResult;

          if (data) {
            try {
              const { purpose, storageFileDocument, loadStorageFile, fileDetailsAccessor } = await _initializeWithTaskData(data);

              let cleanupOutput: StorageFileProcessingPurposeSubtaskCleanupOutput;

              if (purpose) {
                const processor = processors[purpose];

                if (processor && processor.cleanup) {
                  const { sd: subtaskData, sfps: completedSubtasks } = data;

                  const input: StorageFileProcessingPurposeSubtaskInput = {
                    notificationTask: notificationTask as StorageFileProcessingPurposeSubtaskInput['notificationTask'],
                    completedSubtasks: completedSubtasks ?? [],
                    purpose,
                    subtaskData,
                    storageFileDocument,
                    fileDetailsAccessor,
                    loadStorageFile
                  };

                  cleanupOutput = await processor.cleanup(input);
                } else {
                  // processor is unknown. Complete the task.
                  cleanupOutput = defaultCleanupOutput();
                }
              } else {
                // purpose is unknown. Complete the task.
                cleanupOutput = defaultCleanupOutput();
              }

              if (cleanupOutput.cleanupSuccess === false && notificationTask.currentCheckpointSendAttempts <= maxCleanupRetryAttempts) {
                result = notificationTaskDelayRetry(cleanupOutput.delayRetryUntil ?? cleanupRetryDelay);
              } else {
                let updateTemplate: Partial<StorageFile> = {
                  ps: cleanupOutput.nextProcessingState ?? StorageFileProcessingState.SUCCESS,
                  pcat: new Date(), // set new cleanup/completion date
                  pn: null // clear reference
                };

                if (cleanupOutput.queueForDelete != null && cleanupOutput.queueForDelete !== false) {
                  updateTemplate.sdat = cleanupOutput.queueForDelete === true ? new Date() : dateFromDateOrTimeNumber(cleanupOutput.queueForDelete);
                  updateTemplate.fs = StorageFileState.QUEUED_FOR_DELETE;
                }

                await storageFileDocument.update(updateTemplate);
                result = notificationTaskComplete();
              }
            } catch (e) {
              if (e instanceof StorageFileDocumentNoLongerAvailable) {
                // Task is complete if the document no longer exists. Nothing to cleanup or act on.
                result = notificationTaskComplete();
              } else {
                // rethrow the error
                throw e;
              }
            }
          } else {
            // Improperly configured task. Complete immediately.
            result = notificationTaskComplete();
          }

          return result;
        }
      }
    ]
  };

  return result;
}

// MARK: Internally Handled Errors
class StorageFileDocumentNoLongerAvailable extends BaseError {}
