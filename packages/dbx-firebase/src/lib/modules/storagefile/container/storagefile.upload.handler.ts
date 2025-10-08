import { catchError, combineLatest, filter, map, Observable, of } from 'rxjs';
import { DbxFirebaseStorageFileUploadStore, DbxFirebaseStorageFileUploadStoreFileProgress } from '../store';
import { DbxFirebaseStorageService } from '../../../storage/firebase.storage.service';
import { Destroyable, Initialized, runAsyncTasksForValues } from '@dereekb/util';
import { filterMaybe, MultiSubscriptionObject, SubscriptionObject } from '@dereekb/rxjs';
import { StoragePathInput } from '@dereekb/firebase';

/**
 * Creates a new observable for uploading a file.
 */
export type StorageFileUploadHandlerFunction = (file: File) => Observable<DbxFirebaseStorageFileUploadStoreFileProgress>;

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
 * Function used to generate file names for the uploaded files.
 *
 * If not set, the file name will be used as is.
 */
export type StorageFileUploadStoragePathFactory = (file: File) => StoragePathInput;

/**
 * Configuration for StorageFileUploadHandler().
 */
export interface StorageFileUploadHandlerConfig {
  readonly storageService: DbxFirebaseStorageService;
  readonly storagePathFactory: StorageFileUploadStoragePathFactory;
}

/**
 * Default implementation of StorageFileUploadHandler.
 */
export function storageFileUploadHandler(config: StorageFileUploadHandlerConfig): StorageFileUploadHandler {
  const { storageService, storagePathFactory } = config;

  return {
    uploadFile: (file) => {
      const storagePath = storagePathFactory(file);
      const storageAccessorFile = storageService.file(storagePath);

      return new Observable((x) => {
        if (storageAccessorFile.uploadResumable) {
          const resumable = storageAccessorFile.uploadResumable(file);

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
      });
    }
  };
}

// MARK:  DbxFirebaseStorageFileUploadStoreUploadHandler
export interface DbxFirebaseStorageFileUploadStoreUploadHandlerConfig {
  readonly uploadHandler: StorageFileUploadHandler;
  readonly uploadStore: DbxFirebaseStorageFileUploadStore;
  /**
   * The number of max parallel uploads to perform at a time.
   *
   * Defaults to 3
   */
  readonly maxParallelUploads?: number;
}

export interface DbxFirebaseStorageFileUploadStoreUploadHandler extends Initialized, Destroyable {
  /**
   * The internal upload handler.
   */
  readonly uploadHandler: StorageFileUploadHandler;
  /**
   * The upload store.
   */
  readonly uploadStore: DbxFirebaseStorageFileUploadStore;
}

export function dbxFirebaseStorageFileUploadStoreUploadHandler(config: DbxFirebaseStorageFileUploadStoreUploadHandlerConfig): DbxFirebaseStorageFileUploadStoreUploadHandler {
  const { uploadHandler, uploadStore, maxParallelUploads: inputMaxParallelUploads } = config;
  const startUploadSubscriptionObject = new SubscriptionObject();
  const multiUploadsSubscriptionObject = new MultiSubscriptionObject();

  const maxParallelTasks = inputMaxParallelUploads ?? 3;

  return {
    uploadHandler,
    uploadStore,
    init() {
      startUploadSubscriptionObject.subscription = combineLatest([
        uploadStore.startUpload$,
        uploadStore.files$.pipe(
          filterMaybe(),
          filter((x) => (x?.length ?? 0) > 0)
        )
      ]).subscribe(([startUpload, fileList]) => {
        // begin the upload for each file
        const allFiles = Array.from(fileList);

        // set working has started
        uploadStore.setIsUploadHandlerWorking(true);

        // unsubscribe from all previous uploads
        multiUploadsSubscriptionObject.unsub();

        runAsyncTasksForValues(
          allFiles,
          async (file) => {
            return new Promise<void>((resolve, reject) => {
              // upload the file, subscribe to the progress
              try {
                const uploadSubscription = uploadHandler.uploadFile(file).subscribe({
                  next: (progress) => {
                    uploadStore.updateUploadProgress(progress);
                  },
                  error: (error) => {
                    uploadStore.updateUploadProgress({
                      file,
                      error
                    });
                  },
                  complete: () => resolve()
                });

                multiUploadsSubscriptionObject.addSubs(uploadSubscription);
              } catch (error) {
                // error occurred, update the progress
                uploadStore.updateUploadProgress({
                  file,
                  error
                });

                reject(error);
              }
            });
          },
          {
            maxParallelTasks,
            retriesAllowed: 0 // no retries allowed
          }
        ).then(() => {
          // set working has finished
          uploadStore.setIsUploadHandlerWorking(false);
        });
      });
    },
    destroy() {
      // destroy the start upload subscription
      startUploadSubscriptionObject.destroy();

      // destroy the uploads subscriptions
      multiUploadsSubscriptionObject.destroy();
    }
  };
}
