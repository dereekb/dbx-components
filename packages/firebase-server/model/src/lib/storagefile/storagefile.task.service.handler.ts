import {
  type StorageFileProcessingNotificationTaskData,
  type StorageFilePurpose,
  type StorageFileProcessingSubtaskMetadata,
  type NotificationTaskServiceHandleNotificationTaskResult,
  type StorageFileProcessingSubtask,
  notificationTaskComplete,
  type StorageFileDocument,
  type StorageFile,
  type DocumentDataWithIdAndKey,
  StorageFileProcessingState,
  type StorageFileFirestoreCollections,
  type StoredFileReader,
  storedFileReaderFactory,
  type StoragePath,
  type FirebaseStorageAccessor,
  copyStoragePath,
  getDocumentSnapshotData,
  STORAGE_FILE_PROCESSING_NOTIFICATION_TASK_TYPE
} from '@dereekb/firebase';
import { type NotificationTaskServiceTaskHandlerConfig } from '../notification/notification.task.service.handler';
import { cachedGetter, Configurable, type Maybe } from '@dereekb/util';
import { markStorageFileForDeleteTemplate, type StorageFileQueueForDeleteTime } from './storagefile.util';
import { NotificationTaskSubtaskCleanupInstructions, NotificationTaskSubtaskFlowEntry, NotificationTaskSubtaskInput, notificationTaskSubTaskMissingRequiredDataTermination, NotificationTaskSubtaskNotificationTaskHandlerConfig, notificationTaskSubtaskNotificationTaskHandlerFactory, NotificationTaskSubtaskProcessorConfig } from '../notification/notification.task.subtask.handler';

/**
 * Input for a StorageFileProcessingPurposeSubtask.
 */
export interface StorageFileProcessingPurposeSubtaskInput<M extends StorageFileProcessingSubtaskMetadata = any, S extends StorageFileProcessingSubtask = StorageFileProcessingSubtask> extends NotificationTaskSubtaskInput<StorageFileProcessingNotificationTaskData<M, S>, M, S> {
  /**
   * The retrieved purpose.
   *
   * @deprecated use target instead.
   */
  readonly purpose: StorageFilePurpose;
  /**
   * The associated StorageFileDocument.
   */
  readonly storageFileDocument: StorageFileDocument;
  /**
   * Function to load the StorageFileDocument's data.
   *
   * If the document no longer exists, an error is thrown that immediately terminates the subtask and marks the task as complete.
   */
  readonly loadStorageFile: () => Promise<DocumentDataWithIdAndKey<StorageFile>>;
  /**
   * The accessor for the uploaded file details.
   */
  readonly fileDetailsAccessor: StoredFileReader;
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
export interface StorageFileProcessingPurposeSubtaskFlowEntry<M extends StorageFileProcessingSubtaskMetadata = any, S extends StorageFileProcessingSubtask = StorageFileProcessingSubtask> extends NotificationTaskSubtaskFlowEntry<StorageFileProcessingPurposeSubtaskInput<M, S>, StorageFileProcessingNotificationTaskData<M, S>, M, S> {}

/**
 * The output cleanup configuration.
 */
export interface StorageFileProcessingPurposeSubtaskCleanupOutput extends NotificationTaskSubtaskCleanupInstructions {
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
  readonly queueForDelete?: Maybe<false | StorageFileQueueForDeleteTime>;
}

/**
 * Similar to NotificationTaskServiceTaskHandlerConfig, but instead targets a specific StorageFilePurpose.
 *
 * The flows behave the same way.
 */
export type StorageFileProcessingPurposeSubtaskProcessorConfig<M extends StorageFileProcessingSubtaskMetadata = any, S extends StorageFileProcessingSubtask = StorageFileProcessingSubtask> =
  | NotificationTaskSubtaskProcessorConfig<StorageFileProcessingPurposeSubtaskInput<M, S>, StorageFileProcessingPurposeSubtaskCleanupOutput, StorageFileProcessingNotificationTaskData<M, S>>
  | (Omit<NotificationTaskSubtaskProcessorConfig<StorageFileProcessingPurposeSubtaskInput<M, S>, StorageFileProcessingPurposeSubtaskCleanupOutput, StorageFileProcessingNotificationTaskData<M, S>>, 'target'> & {
      /**
       * @deprecated use target instead.
       */
      readonly purpose?: Maybe<StorageFilePurpose>;
    });

export interface StorageFileProcessingNotificationTaskHandlerConfig extends Omit<NotificationTaskSubtaskNotificationTaskHandlerConfig<StorageFileProcessingPurposeSubtaskInput, StorageFileProcessingPurposeSubtaskCleanupOutput, StorageFileProcessingNotificationTaskData>, 'processors'> {
  /**
   * The input processors.
   */
  readonly processors: StorageFileProcessingPurposeSubtaskProcessorConfig[];
  /**
   * FirebaseStorageAccessor
   */
  readonly storageAccessor: FirebaseStorageAccessor;
  /**
   * Accessor for StorageFileDocument.
   */
  readonly storageFileFirestoreCollections: StorageFileFirestoreCollections;
}

/**
 * Creates a NotificationTaskServiceTaskHandlerConfig that handles the StorageFileProcessingNotificationTask.
 */
export function storageFileProcessingNotificationTaskHandler(config: StorageFileProcessingNotificationTaskHandlerConfig): NotificationTaskServiceTaskHandlerConfig<StorageFileProcessingNotificationTaskData> {
  const { processors: inputProcessors, storageAccessor, storageFileFirestoreCollections } = config;
  const storageFileDocumentAccessor = storageFileFirestoreCollections.storageFileCollection.documentAccessor();
  const makeFileDetailsAccessor = storedFileReaderFactory();

  // COMPAT: Sets target if unset and purpose is set. Use until purpose is removed.
  inputProcessors.forEach((x) => {
    if (!(x as any).target) {
      if ((x as any).purpose) {
        (x as any).target = (x as any).purpose;
      } else {
        throw new Error('StorageFileProcessingPurposeSubtaskProcessorConfig must have a target or purpose.');
      }
    }
  });

  function defaultCleanup(): StorageFileProcessingPurposeSubtaskCleanupOutput {
    return {
      cleanupSuccess: true,
      nextProcessingState: StorageFileProcessingState.SUCCESS,
      queueForDelete: true
    };
  }

  return notificationTaskSubtaskNotificationTaskHandlerFactory<StorageFileProcessingPurposeSubtaskInput, StorageFileProcessingPurposeSubtaskCleanupOutput, StorageFileProcessingNotificationTaskData, StorageFileProcessingSubtaskMetadata, StorageFileProcessingSubtask>({
    taskType: STORAGE_FILE_PROCESSING_NOTIFICATION_TASK_TYPE,
    subtaskHandlerFunctionName: 'storageFileProcessingNotificationTaskHandler',
    inputFunction: async (data: StorageFileProcessingNotificationTaskData) => {
      const storageFileDocument = await storageFileDocumentAccessor.loadDocumentForId(data.storageFile);

      const loadStorageFile = cachedGetter(async () => {
        const storageFile = await getDocumentSnapshotData(storageFileDocument, true);

        if (!storageFile) {
          throw notificationTaskSubTaskMissingRequiredDataTermination();
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

      const input = {
        purpose: purpose!,
        target: purpose!,
        loadStorageFile,
        fileDetailsAccessor,
        storageFileDocument
      };

      return input;
    },
    buildUpdateMetadata: (baseUpdateMetadata, input) => {
      const { purpose } = input;

      return {
        ...baseUpdateMetadata,
        // always re-copy the purpose/storagePath for the next run so StorageFile does not have to be reloaded
        p: purpose,
        storagePath: copyStoragePath(input.fileDetailsAccessor.input)
      };
    },
    defaultCleanup,
    cleanupFunction: async function (input, cleanupInstructions: StorageFileProcessingPurposeSubtaskCleanupOutput) {
      const { storageFileDocument } = input;
      const { nextProcessingState, queueForDelete } = cleanupInstructions;

      let updateTemplate: Partial<StorageFile> = {
        ps: nextProcessingState ?? StorageFileProcessingState.SUCCESS,
        pcat: new Date(), // set new cleanup/completion date
        pn: null // clear reference
      };

      if (queueForDelete != null && queueForDelete !== false) {
        updateTemplate = {
          ...updateTemplate,
          ...markStorageFileForDeleteTemplate(queueForDelete)
        };
      }

      await storageFileDocument.update(updateTemplate);
      return notificationTaskComplete();
    }
  })(config as any); // COMPAT: remove once purpose is removed from StorageFileProcessingPurposeSubtaskProcessorConfig, and the types match.
}
