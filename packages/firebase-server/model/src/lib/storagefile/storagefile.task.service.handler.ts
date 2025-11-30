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
  STORAGE_FILE_PROCESSING_NOTIFICATION_TASK_TYPE,
  STORAGE_FILE_GROUP_ZIP_STORAGE_FILE_PURPOSE,
  STORAGE_FILE_GROUP_ZIP_STORAGE_FILE_PURPOSE_CREATE_ZIP_SUBTASK,
  StorageFileGroupZipStorageFileMetadata,
  StorageFileGroupZipStorageFileProcessingSubtask,
  StorageFileGroupZipStorageFileProcessingSubtaskMetadata,
  loadDocumentsForIds,
  getDocumentSnapshotDataPairs,
  notificationTaskDelayRetry,
  completeSubtaskProcessingAndScheduleCleanupTaskResult,
  notificationSubtaskComplete,
  STORAGE_FILE_GROUP_ZIP_INFO_JSON_FILE_NAME
} from '@dereekb/firebase';
import { type NotificationTaskServiceTaskHandlerConfig } from '../notification/notification.task.service.handler';
import { cachedGetter, documentFileExtensionForMimeType, MS_IN_HOUR, performAsyncTasks, pushArrayItemsIntoArray, slashPathDetails, useCallback, ZIP_MIME_TYPE, type Maybe } from '@dereekb/util';
import { markStorageFileForDeleteTemplate, type StorageFileQueueForDeleteTime } from './storagefile.util';
import { type NotificationTaskSubtaskCleanupInstructions, type NotificationTaskSubtaskFlowEntry, type NotificationTaskSubtaskInput, notificationTaskSubTaskMissingRequiredDataTermination, type NotificationTaskSubtaskNotificationTaskHandlerConfig, notificationTaskSubtaskNotificationTaskHandlerFactory, type NotificationTaskSubtaskProcessorConfig } from '../notification/notification.task.subtask.handler';
import * as archiver from 'archiver';

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
export type StorageFileProcessingPurposeSubtaskFlowEntry<M extends StorageFileProcessingSubtaskMetadata = any, S extends StorageFileProcessingSubtask = StorageFileProcessingSubtask> = NotificationTaskSubtaskFlowEntry<StorageFileProcessingPurposeSubtaskInput<M, S>, StorageFileProcessingNotificationTaskData<M, S>, M, S>;

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

export type StorageFileProcessingPurposeSubtaskProcessorConfigWithTarget<M extends StorageFileProcessingSubtaskMetadata = any, S extends StorageFileProcessingSubtask = StorageFileProcessingSubtask> = NotificationTaskSubtaskProcessorConfig<StorageFileProcessingPurposeSubtaskInput<M, S>, StorageFileProcessingPurposeSubtaskCleanupOutput, StorageFileProcessingNotificationTaskData<M, S>>;

/**
 * Similar to NotificationTaskServiceTaskHandlerConfig, but instead targets a specific StorageFilePurpose.
 *
 * The flows behave the same way.
 */
export type StorageFileProcessingPurposeSubtaskProcessorConfig<M extends StorageFileProcessingSubtaskMetadata = any, S extends StorageFileProcessingSubtask = StorageFileProcessingSubtask> =
  | StorageFileProcessingPurposeSubtaskProcessorConfigWithTarget<M, S>
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
   * Configuration for the StorageFileGroup processors.
   *
   * If false, does not add the StorageFileGroup processors.
   */
  readonly allStorageFileGroupProcessorConfig?: Maybe<Omit<AllStorageFileGroupStorageFileProcessingPurposeSubtaskProcessorsConfig, 'storageFileFirestoreCollections' | 'storageAccessor'> | false>;
  /**
   * Accessor for StorageFileDocument.
   */
  readonly storageFileFirestoreCollections: StorageFileFirestoreCollections;
  /**
   * FirebaseStorageAccessor
   */
  readonly storageAccessor: FirebaseStorageAccessor;
}

/**
 * Creates a NotificationTaskServiceTaskHandlerConfig that handles the StorageFileProcessingNotificationTask.
 */
export function storageFileProcessingNotificationTaskHandler(config: StorageFileProcessingNotificationTaskHandlerConfig): NotificationTaskServiceTaskHandlerConfig<StorageFileProcessingNotificationTaskData> {
  const { processors: inputProcessors, storageAccessor, storageFileFirestoreCollections, allStorageFileGroupProcessorConfig } = config;
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
      queueForDelete: false // do not queue for delete automatically
    };
  }

  const processors = [...inputProcessors] as StorageFileProcessingPurposeSubtaskProcessorConfigWithTarget<StorageFileProcessingSubtaskMetadata, StorageFileProcessingSubtask>[];

  if (allStorageFileGroupProcessorConfig !== false) {
    const storageFileGroupProcessors = allStorageFileGroupStorageFileProcessingPurposeSubtaskProcessors({
      ...allStorageFileGroupProcessorConfig,
      storageFileFirestoreCollections,
      storageAccessor
    });
    pushArrayItemsIntoArray(processors, storageFileGroupProcessors);
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
  })({
    ...config,
    processors
  });
}

// MARK: StorageFileGroup Processors
export interface AllStorageFileGroupStorageFileProcessingPurposeSubtaskProcessorsConfig extends StorageFileGroupStorageFileProcessingPurposeSubtaskProcessorsConfig {
  /**
   * Whether or not to exclude zip processing.
   *
   * Defaults to false.
   */
  readonly excludeZipProcessing?: boolean;
}

export function allStorageFileGroupStorageFileProcessingPurposeSubtaskProcessors(config: AllStorageFileGroupStorageFileProcessingPurposeSubtaskProcessorsConfig): StorageFileProcessingPurposeSubtaskProcessorConfigWithTarget[] {
  const { excludeZipProcessing } = config;

  const processors: StorageFileProcessingPurposeSubtaskProcessorConfigWithTarget[] = [];

  if (!excludeZipProcessing) {
    processors.push(storageFileGroupZipStorageFileProcessingPurposeSubtaskProcessor(config));
  }

  return processors;
}

export interface StorageFileGroupStorageFileProcessingPurposeSubtaskProcessorsConfig {
  readonly storageFileFirestoreCollections: StorageFileFirestoreCollections;
  readonly storageAccessor: FirebaseStorageAccessor;
}

export function storageFileGroupZipStorageFileProcessingPurposeSubtaskProcessor(config: StorageFileGroupStorageFileProcessingPurposeSubtaskProcessorsConfig): StorageFileProcessingPurposeSubtaskProcessorConfigWithTarget<StorageFileGroupZipStorageFileProcessingSubtaskMetadata, StorageFileGroupZipStorageFileProcessingSubtask> {
  const { storageFileFirestoreCollections, storageAccessor } = config;
  const { storageFileCollection, storageFileGroupCollection } = storageFileFirestoreCollections;

  const storageFileGroupZipProcessorConfig: StorageFileProcessingPurposeSubtaskProcessorConfig<StorageFileGroupZipStorageFileProcessingSubtaskMetadata, StorageFileGroupZipStorageFileProcessingSubtask> = {
    target: STORAGE_FILE_GROUP_ZIP_STORAGE_FILE_PURPOSE,
    flow: [
      {
        subtask: STORAGE_FILE_GROUP_ZIP_STORAGE_FILE_PURPOSE_CREATE_ZIP_SUBTASK,
        fn: async (input) => {
          const { storageFileDocument, fileDetailsAccessor } = input;

          const storageFile = await input.loadStorageFile();
          const storageFileMetadata = storageFile.d as StorageFileGroupZipStorageFileMetadata;
          const storageFileGroupId = storageFileMetadata?.sfg;

          let result: NotificationTaskServiceHandleNotificationTaskResult<StorageFileGroupZipStorageFileProcessingSubtaskMetadata, StorageFileGroupZipStorageFileProcessingSubtask>;

          async function flagStorageFileForDeletion() {
            await storageFileDocument.update(markStorageFileForDeleteTemplate());
            return notificationTaskComplete();
          }

          if (storageFileGroupId) {
            const storageFileGroupDocument = storageFileGroupCollection.documentAccessor().loadDocumentForId(storageFileGroupId);
            const storageFileGroup = await storageFileGroupDocument.snapshotData();

            if (storageFileGroup) {
              const storageFileIdsToZip = storageFileGroup.f.map((x) => x.s);
              const storageFilesToZip = loadDocumentsForIds(storageFileCollection.documentAccessor(), storageFileIdsToZip);
              const storageFileDataPairsToZip = await getDocumentSnapshotDataPairs(storageFilesToZip);

              let flagCleanFileAssociations: Maybe<boolean> = undefined;

              // create a new file
              const zipFileAccessor = storageAccessor.file(fileDetailsAccessor.input);

              if (zipFileAccessor.uploadStream && zipFileAccessor.getStream) {
                const uploadStream = zipFileAccessor.uploadStream({
                  contentType: ZIP_MIME_TYPE
                });

                const startedAt = new Date();
                const newArchive = archiver('zip', { zlib: { level: 9 } });

                // pipe the archive to the upload stream
                newArchive.pipe(uploadStream, { end: true });

                // upload each of the files to the archive
                await performAsyncTasks(
                  storageFileDataPairsToZip,
                  async (storageFileDataPair) => {
                    const { data: storageFile } = storageFileDataPair;

                    if (storageFile) {
                      // make sure it references the storage file group
                      const referencesStorageFileGroup = storageFile.g.some((x) => x === storageFileGroupId);

                      if (referencesStorageFileGroup) {
                        const fileAccessor = storageAccessor.file(storageFile);
                        const metadata = await fileAccessor.getMetadata().catch(() => null);

                        if (metadata) {
                          const fileSlashPathDetails = slashPathDetails(metadata.name);
                          let name: string;

                          if (fileSlashPathDetails.typedFile) {
                            name = fileSlashPathDetails.typedFile;
                          } else {
                            const untypedName = fileSlashPathDetails.fileName ?? `sf_${storageFile.id}`;

                            // attempt to recover from a missing file name by using the content type
                            if (metadata.contentType) {
                              const extension = documentFileExtensionForMimeType(metadata.contentType);
                              name = extension ? `${untypedName}.${extension}` : untypedName;
                            } else {
                              name = untypedName;
                            }
                          }

                          const fileStream = fileAccessor.getStream!();

                          await useCallback((x) => {
                            // append the file to the archive
                            newArchive.append(fileStream, {
                              name
                            });

                            // if the stream errors, call back
                            fileStream.on('error', (e) => x(e));

                            // when the stream finishes, call back
                            fileStream.on('finish', () => x());
                          });
                        } else {
                          flagCleanFileAssociations = true;
                        }
                      } else {
                        flagCleanFileAssociations = true;
                      }
                    }
                  },
                  {
                    maxParallelTasks: 3 // only stream three files concurrently to the archive to avoid issues with memory usage
                  }
                );

                const finishedAt = new Date();

                // create the info.json file
                const infoJson = {
                  sfg: storageFileGroupId,
                  sf: storageFileIdsToZip,
                  s: startedAt.toISOString(),
                  f: finishedAt.toISOString()
                };

                newArchive.append(JSON.stringify(infoJson), {
                  name: STORAGE_FILE_GROUP_ZIP_INFO_JSON_FILE_NAME
                });

                // finalize the archive
                await newArchive.finalize();

                // update the StorageFileGroup
                await storageFileGroupDocument.update({
                  zat: finishedAt,
                  c: flagCleanFileAssociations
                });

                // schedule/run the cleanup task
                result = notificationSubtaskComplete({
                  canRunNextCheckpoint: true
                });
              } else {
                // uploadStream is not available for some reason? Should never occur.
                console.warn('storageFileGroupZipStorageFileProcessingPurposeSubtaskProcessor(): uploadStream is not available for some reason while creating a new zip.');
                result = notificationTaskDelayRetry(MS_IN_HOUR);
              }
            } else {
              // storage file group no longer exists. Flag the StorageFile for deletion.
              result = await flagStorageFileForDeletion();
            }
          } else {
            // improperly configured StorageFile for this type. Flag the StorageFile for deletion.
            result = await flagStorageFileForDeletion();
          }

          return result;
        }
      }
    ]
  };

  return storageFileGroupZipProcessorConfig;
}
