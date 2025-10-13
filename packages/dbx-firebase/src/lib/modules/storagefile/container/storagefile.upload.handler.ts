import { catchError, map, Observable, of, shareReplay } from 'rxjs';
import { DbxFirebaseStorageFileUploadStoreFileProgress } from '../store';
import { DbxFirebaseStorageService } from '../../../storage/firebase.storage.service';
import { IndexNumber, Maybe, PercentDecimal, PercentNumber, PromiseOrValue, runAsyncTasksForValues, separateValues } from '@dereekb/util';
import { MultiSubscriptionObject } from '@dereekb/rxjs';
import { FirebaseStorageAccessorFile, StorageCustomMetadata, StoragePathInput, StorageUploadOptions, StorageUploadTask } from '@dereekb/firebase';

/**
 * Creates a new observable for uploading a file.
 */
export type StorageFileUploadHandlerFunction = (file: File) => Promise<StorageFileUploadHandlerInstance>;

export interface StorageFileUploadHandlerInstance extends Pick<StorageUploadTask<FirebaseStorageAccessorFile>, 'taskRef' | 'pause' | 'resume' | 'cancel'> {
  /**
   * The upload observable.
   *
   * Must be subscribed to in order for the upload to begin.
   */
  readonly upload: Observable<DbxFirebaseStorageFileUploadStoreFileProgress>;
}

/**
 * Handles uploading files.
 */
export interface StorageFileUploadHandler {
  /**
   * Uploads a file, and returns the file progress as it is uploading.
   */
  readonly uploadFile: StorageFileUploadHandlerFunction;
}

/**
 * Configuration for a single file upload.
 */
export interface StorageFileUploadConfig {
  /**
   * Path for where to upload the file to
   */
  readonly storagePath: StoragePathInput;
  /**
   * Upload options for the file.
   *
   * Resumable is not supported.
   */
  readonly uploadOptions?: StorageFileUploadConfigOptions;
  /**
   * Custom metadata for the file.
   *
   * Is merged with uploadOptions's metadata.
   */
  readonly customMetadata?: StorageCustomMetadata;
}

/**
 * StorageFileUploadConfig upload options.
 */
export type StorageFileUploadConfigOptions = Omit<StorageUploadOptions, 'resumable'>;

/**
 * Function used to generate file names for the uploaded files.
 *
 * If not set, the file name will be used as is.
 */
export type StorageFileUploadConfigFactory = (file: File) => PromiseOrValue<StorageFileUploadConfig>;

/**
 * Configuration for StorageFileUploadHandler().
 */
export interface StorageFileUploadHandlerConfig {
  readonly storageService: DbxFirebaseStorageService;
  readonly storageFileUploadConfigFactory: StorageFileUploadConfigFactory;
}

/**
 * Default implementation of StorageFileUploadHandler.
 */
export function storageFileUploadHandler(config: StorageFileUploadHandlerConfig): StorageFileUploadHandler {
  const { storageService, storageFileUploadConfigFactory } = config;

  let resumable: Maybe<StorageUploadTask>;

  return {
    uploadFile: async (file) => {
      const storageFileUploadConfig = await storageFileUploadConfigFactory(file);

      const { storagePath } = storageFileUploadConfig;
      const storageAccessorFile = storageService.file(storagePath);

      const upload = new Observable<DbxFirebaseStorageFileUploadStoreFileProgress>((x) => {
        if (storageAccessorFile.uploadResumable) {
          resumable = storageAccessorFile.uploadResumable(file);

          // subscribe to the event by piping this observable to it
          resumable
            .streamSnapshotEvents()
            .pipe(
              map((x) => {
                const { bytesTransferred, totalBytes } = x;

                const progress: DbxFirebaseStorageFileUploadStoreFileProgress = {
                  file,
                  fileRef: storageAccessorFile,
                  uploadRef: resumable,
                  bytesTransferred,
                  totalBytes,
                  progress: bytesTransferred / totalBytes
                };

                return progress;
              })
            )
            .pipe(
              catchError((error) => {
                // if an error occurs, catch it and emit it as a progress
                const progress: DbxFirebaseStorageFileUploadStoreFileProgress = {
                  file,
                  fileRef: storageAccessorFile,
                  uploadRef: resumable,
                  error,
                  failed: true
                };

                return of(progress);
              })
            )
            .subscribe(x);
        } else {
          throw new Error('uploadResumable() function was unavailable.');
        }
      }).pipe(shareReplay(1));

      const instance: StorageFileUploadHandlerInstance = {
        upload,
        taskRef: storageAccessorFile,
        pause: () => resumable?.pause() ?? false,
        resume: () => resumable?.resume() ?? false,
        cancel: () => resumable?.cancel() ?? false
      };

      return instance;
    }
  };
}

// MARK: Upload Files
export interface StorageFileUploadFilesInput {
  readonly uploadHandler: StorageFileUploadHandler;
  /**
   * Files to upload
   */
  readonly files: File[];
  /**
   * The number of max parallel uploads to perform at a time.
   *
   * Defaults to 3
   */
  readonly maxParallelUploads?: number;
}

export interface StorageFileUploadFilesInstance {
  /**
   * Cancels the upload of the remaining files.
   */
  cancel(): void;
  /**
   * The upload observable.
   *
   * Must be subscribed to in order for the upload to begin.
   */
  readonly upload: Observable<StorageFileUploadFilesEvent>;
}

export interface StorageFileUploadFilesEvent {
  /**
   * All files being uploaded
   */
  readonly allFiles: File[];
  /**
   * Returns true if all files have been uploaded.
   *
   * The result value should be available.
   */
  readonly isComplete: boolean;
  /**
   * Returns true if the upload was canceled.
   */
  readonly isCanceled?: Maybe<boolean>;
  /**
   * The overall progress of all files being uploaded.
   */
  readonly overallProgress: PercentNumber;
  /**
   * The upload progress that triggered this event.
   */
  readonly uploadProgress?: Maybe<DbxFirebaseStorageFileUploadStoreFileProgress>;
  /**
   * The final result.
   *
   * Set when the final file has been uploaded or failed.
   */
  readonly result?: StorageFileUploadFilesFinalResult;
  /**
   * The number of files that are still uploading or queued for upload.
   */
  readonly incompleteFileCount: number;
  /**
   * The number of files that are active.
   */
  readonly activeFileCount: number;
  /**
   * The number of files that are done.
   */
  readonly doneFileCount: number;
}

export interface StorageFileUploadFilesFinalResult {
  readonly startTime: Date;
  readonly endTime: Date;
  readonly fileResults: StorageFileUploadFilesFinalFileResult[];
  readonly successFileResults: StorageFileUploadFilesFinalFileResult[];
  readonly errorFileResults: StorageFileUploadFilesFinalFileResult[];
}

export interface StorageFileUploadFilesFinalFileResult {
  /**
   * The start time of the file upload.
   */
  readonly startTime: Date;
  /**
   * The end time of the file upload, or when it failed or was canceled.
   */
  readonly endTime: Date;
  /**
   * The file that was uploaded.
   */
  readonly file: File;
  /**
   * The accessor file for the file, if available.
   *
   * Is generally available if success is true.
   */
  readonly fileRef?: Maybe<FirebaseStorageAccessorFile>;
  /**
   * True if the file was uploaded successfully.
   */
  readonly success: boolean;
  /**
   * Error if the file failed to upload.
   */
  readonly error?: Maybe<unknown>;
  /**
   * True if the file upload was cancelled.
   */
  readonly canceled?: Maybe<boolean>;
}

/**
 * Uploads files using the provided upload handler and files.
 *
 * An observable is returned that emits the latest file events from any file that is being uploaded.
 *
 * @param input
 * @returns
 */
export function storageFileUploadFiles(input: StorageFileUploadFilesInput): StorageFileUploadFilesInstance {
  const { uploadHandler, files, maxParallelUploads: inputMaxParallelUploads } = input;
  const maxParallelTasks = inputMaxParallelUploads ?? 3;

  const multiUploadsSubscriptionObject = new MultiSubscriptionObject();

  // begin the upload for each file
  const allFiles = Array.from(files);

  // unsubscribe from all previous uploads
  multiUploadsSubscriptionObject.unsub();

  interface UpdateUploadProgressInput {
    /**
     * The file index number.
     */
    readonly index: IndexNumber;
    /**
     * The next progress event, if applicable.
     */
    readonly nextProgress?: Maybe<DbxFirebaseStorageFileUploadStoreFileProgress>;
    /**
     * An error that occured, if applicable.
     */
    readonly error?: Maybe<unknown>;
    /**
     * Passed as true when the upload task is done.
     *
     * Does not specify whether or not success was achieved or not.
     */
    readonly fileUploadTaskDone?: boolean;
    /**
     * True if the upload was canceled.
     */
    readonly canceled?: boolean;
  }

  interface FileUploadDetails {
    readonly file: File;
    /**
     * The current upload instance for the file.
     *
     * Set if the file is currently uploading.
     */
    uploadInstance?: StorageFileUploadHandlerInstance;
    fileRef?: Maybe<FirebaseStorageAccessorFile>;
    startTime?: Date;
    endTime?: Date;
    success?: boolean;
    canceled?: Maybe<boolean>;
    error?: Maybe<unknown>;
  }

  const allFilesAndLatestProgress: Maybe<DbxFirebaseStorageFileUploadStoreFileProgress>[] = new Array(allFiles.length);
  const allFilesAndDetails: FileUploadDetails[] = allFiles.map((file) => ({ file }));
  const overallProgressPerCompletedFile: PercentDecimal = (1 / allFilesAndLatestProgress.length) as PercentDecimal;

  /**
   * Once set, any new file upload task that hits this will return an cancel failure.
   */
  let flaggedCancel = false;

  const cancel = () => {
    flaggedCancel = true;
  };

  const upload = new Observable<StorageFileUploadFilesEvent>((subscriber) => {
    const overallStartTime = new Date();

    const incompleteFileFileIndexes = new Set<IndexNumber>(allFiles.map((_, index) => index));
    const activeFileIndexes = new Set<IndexNumber>();
    const doneFileIndexes = new Set<IndexNumber>();
    let latestOverallProgress: PercentNumber = 0;

    function onStartFileUpload(index: IndexNumber, uploadInstance: StorageFileUploadHandlerInstance) {
      activeFileIndexes.add(index);
      allFilesAndDetails[index].startTime = new Date();
      allFilesAndDetails[index].uploadInstance = uploadInstance;
      allFilesAndDetails[index].fileRef = uploadInstance.taskRef;
    }

    function onStartFileUploadFlaggedCancelled(index: IndexNumber) {
      allFilesAndDetails[index].startTime = new Date();

      // immediately mark it done
      _markFileUploadDone(index, true);

      // emit new progress event
      _emitEvent();
    }

    function _markFileUploadDone(fileIndex: IndexNumber, error?: Maybe<unknown>) {
      doneFileIndexes.add(fileIndex); // add to done file indexes
      activeFileIndexes.delete(fileIndex); // remove from active file indexes if it exists
      incompleteFileFileIndexes.delete(fileIndex); // remove from incomplete file indexes

      // update details
      allFilesAndDetails[fileIndex].endTime = new Date();
      allFilesAndDetails[fileIndex].success = !error;
      allFilesAndDetails[fileIndex].error = error;
    }

    function updateUploadProgress(input: UpdateUploadProgressInput) {
      const { index: fileIndex, nextProgress, fileUploadTaskDone, error } = input;

      let nextOverallProgress = latestOverallProgress;
      const nextProgressPercent = fileUploadTaskDone ? 100 : (nextProgress?.progress ?? 0) * 100;

      // update the overall progress percentage
      if (nextProgressPercent) {
        // update the overall percentage
        const previousProgress = allFilesAndLatestProgress[fileIndex];
        const previousProgressPercent = previousProgress?.progress != null ? previousProgress.progress * 100 : 0;
        const progressPercentChange = nextProgressPercent - previousProgressPercent;

        // increase overall progress by the change
        nextOverallProgress += progressPercentChange * overallProgressPerCompletedFile;
      }

      // update the file progress
      if (nextProgress) {
        // update the latest FileProgress
        allFilesAndLatestProgress[fileIndex] = nextProgress;

        // only set fileRef once
        if (!allFilesAndDetails[fileIndex].fileRef) {
          allFilesAndDetails[fileIndex].fileRef = nextProgress.fileRef;
        }
      }

      // if complete, update the indexes and details
      if (fileUploadTaskDone) {
        _markFileUploadDone(fileIndex, error);
      }

      // update the overall progress
      latestOverallProgress = nextOverallProgress;

      // emit the event to send it
      _emitEvent(nextProgress);
    }

    function _emitEvent(nextProgress?: Maybe<DbxFirebaseStorageFileUploadStoreFileProgress>) {
      const isComplete = incompleteFileFileIndexes.size === 0;

      let overallProgress = latestOverallProgress;
      let result: Maybe<StorageFileUploadFilesFinalResult> = undefined;

      if (isComplete) {
        overallProgress = 100; // set to 100%
        const overallEndTime = new Date();

        const fileResults = allFiles.map((file, index) => {
          const result: StorageFileUploadFilesFinalFileResult = {
            startTime: allFilesAndDetails[index].startTime as Date,
            endTime: allFilesAndDetails[index].endTime as Date,
            file,
            fileRef: allFilesAndDetails[index].fileRef,
            success: !allFilesAndDetails[index].error,
            error: allFilesAndDetails[index].error
          };

          return result;
        });

        const { included: successFileResults, excluded: errorFileResults } = separateValues(fileResults, (x) => x.success);

        // all are done, set the result on the next event
        result = {
          startTime: overallStartTime,
          endTime: overallEndTime,
          successFileResults,
          errorFileResults,
          fileResults
        };
      }

      const nextEvent: StorageFileUploadFilesEvent = {
        allFiles,
        isComplete,
        overallProgress,
        uploadProgress: nextProgress,
        incompleteFileCount: incompleteFileFileIndexes.size,
        activeFileCount: activeFileIndexes.size,
        doneFileCount: doneFileIndexes.size,
        result
      };

      subscriber.next(nextEvent);
    }

    async function runUploadTaskForFile([file, index]: readonly [File, IndexNumber]) {
      if (flaggedCancel) {
        onStartFileUploadFlaggedCancelled(index);
        return Promise.resolve();
      }

      return new Promise<void>((resolve) => {
        const updateFileUploadProgress = (nextProgress: DbxFirebaseStorageFileUploadStoreFileProgress) => {
          // update the progress
          updateUploadProgress({
            index,
            nextProgress
          });
        };

        const updateFileUploadProgressWithUncaughtError = (error: unknown) => {
          // error occurred, update the progress with the error
          updateUploadProgress({
            index,
            error,
            fileUploadTaskDone: true
          });

          // always resolve, never reject
          resolve();
        };

        const completeFileUploadProgress = () => {
          updateUploadProgress({
            index,
            fileUploadTaskDone: true
          });

          resolve();
        };

        // upload the file, subscribe to the progress
        try {
          uploadHandler
            .uploadFile(file)
            .then((uploadInstance) => {
              // add to active file indexes
              onStartFileUpload(index, uploadInstance);

              const uploadSubscription = uploadInstance.upload.subscribe({
                next: updateFileUploadProgress,
                error: updateFileUploadProgressWithUncaughtError,
                complete: completeFileUploadProgress
              });

              multiUploadsSubscriptionObject.addSubs(uploadSubscription);
            })
            .catch(updateFileUploadProgressWithUncaughtError);
        } catch (error) {
          updateFileUploadProgressWithUncaughtError(error);
        }
      });
    }

    // run upload task for each file
    const fileTuples = allFiles.map((file, index) => [file, index] as const);

    runAsyncTasksForValues(fileTuples, runUploadTaskForFile, {
      maxParallelTasks,
      retriesAllowed: 0 // no retries allowed
    }).then(() => {
      // all tasks are finished. Complete the subscriber.
      console.log('complete');
      subscriber.complete();
    });
  }).pipe(shareReplay(1));

  const instance: StorageFileUploadFilesInstance = {
    cancel,
    upload
  };

  return instance;
}
