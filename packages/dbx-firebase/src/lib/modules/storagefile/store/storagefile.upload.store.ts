import { Injectable, OnDestroy } from '@angular/core';
import { StoragePathInput } from '@dereekb/firebase';
import { distinctUntilHasDifferentValues } from '@dereekb/rxjs';
import { ArrayOrValue, asArray, Maybe, MimeTypeWithoutParameters, SlashPathFile, SlashPathTypedFileSuffix } from '@dereekb/util';
import { ComponentStore } from '@ngrx/component-store';
import { distinctUntilChanged, map, shareReplay } from 'rxjs';

/**
 * The stage of the upload process.
 *
 * - configuration: The initial stage where the upload store is being configured.
 * - files: The stage where the files are to be selected.
 * - uploading: The stage where the files are being uploaded.
 * - success: The stage where the files have been successfully uploaded.
 * - error: The stage where the upload has failed.
 */
export type DbxFirebaseStorageFileUploadStoreUploadStage = 'configuration' | 'files' | 'uploading' | 'success' | 'error';

/**
 * Function used to generate file names for the uploaded files.
 *
 * If not set, the file name will be used as is.
 */
export type DbxFirebaseStorageFileUploadStoreFileNameFactory = (file: File) => SlashPathFile;

/**
 * The accepted file types for the upload.
 *
 * If unset, then all file types are accepted.
 */
export type DbxFirebaseStorageFileUploadStoreAllowedTypes = (MimeTypeWithoutParameters | SlashPathTypedFileSuffix)[];

/**
 * The progress of a file being uploaded.
 *
 * File progresses are automatically created for all files when one file's progress is
 */
export interface DbxFirebaseStorageFileUploadStoreFileProgress {
  /**
   * The file being uploaded.
   */
  readonly file: File;
  /**
   * The number of bytes that have been transferred for this file.
   */
  readonly bytesTransferred?: Maybe<number>;
  /**
   * The total number of bytes to be uploaded.
   */
  readonly totalBytes?: Maybe<number>;
  /**
   * The progress of the upload.
   *
   * If unset, then the file has not started uploading.
   */
  readonly progress?: Maybe<number>;
  /**
   * If true, the upload has failed for this file.
   */
  readonly failed?: boolean;
  /**
   * The error that occurred during the upload for this file.
   */
  readonly error?: unknown;
}

export interface DbxFirebaseStorageFileUploadStoreState {
  // Component Configuration
  /**
   * The default accepted file types for the upload.
   *
   * This may be set by the component.
   */
  readonly componentFileTypesAccepted?: Maybe<DbxFirebaseStorageFileUploadStoreAllowedTypes>;

  /**
   * If true, the component allows multiple files to be selected.
   *
   * Defaults to undefined.
   */
  readonly isComponentMultiUploadAllowed?: Maybe<boolean>;

  // Configuration Step
  /**
   * The accepted file types for the upload.
   *
   * Is used to filter the files that can be selected for upload.
   *
   * Overrides the componentFileTypesAccepted value if set.
   */
  readonly fileTypesAccepted?: Maybe<DbxFirebaseStorageFileUploadStoreAllowedTypes>;

  /**
   * If true, allow selecting multiple files for upload.
   *
   * If isComponentMultiUploadAllowed is false, then this value is ignored.
   */
  readonly isMultiUploadAllowed?: Maybe<boolean>;

  /**
   * Path to upload the file(s) to.
   *
   * Must be set before uploading.
   */
  readonly uploadPath?: Maybe<StoragePathInput>;

  /**
   * Used to generate file names for the uploaded files.
   *
   * If not set, the file name will be used as is.
   */
  readonly fileNameFactory: DbxFirebaseStorageFileUploadStoreFileNameFactory;

  // Files Step
  /**
   * The current file(s) to upload.
   */
  readonly fileList?: Maybe<FileList>;

  // Upload Step
  /**
   * If true, then the upload is allowed to begin.
   *
   * This value is typically watched by the upload handler.
   */
  readonly startUpload?: Maybe<boolean>;

  /**
   * If true, the upload handler is working.
   */
  readonly isUploadHandlerWorking?: Maybe<boolean>;

  /**
   * The progress of the upload for each file.
   *
   * Only set while one or more files are being uploaded.
   */
  readonly uploadProgress?: Maybe<DbxFirebaseStorageFileUploadStoreFileProgress[]>;
}

export const DBX_FIREBASE_UPLOAD_STORAGE_FILESTORE_DEFAULT_FILENAME_FACTORY: DbxFirebaseStorageFileUploadStoreFileNameFactory = (file) => file.name;

/**
 * Store used for selecting a specific NotificationItem from a list of notification items.
 */
@Injectable()
export class DbxFirebaseStorageFileUploadStore extends ComponentStore<DbxFirebaseStorageFileUploadStoreState> implements OnDestroy {
  constructor() {
    super({
      fileNameFactory: DBX_FIREBASE_UPLOAD_STORAGE_FILESTORE_DEFAULT_FILENAME_FACTORY
    });
  }

  // MARK: Accessors
  readonly componentFileTypesAccepted$ = this.select((state) => state.componentFileTypesAccepted);
  readonly isComponentMultiUploadAllowed$ = this.select((state) => state.isComponentMultiUploadAllowed).pipe(distinctUntilChanged(), shareReplay(1));

  readonly fileTypesAllowed$ = this.select((state) => state.fileTypesAccepted ?? state.componentFileTypesAccepted ?? []).pipe(distinctUntilHasDifferentValues(), shareReplay(1));
  readonly fileTypesAcceptString$ = this.fileTypesAllowed$.pipe(
    map((x) => x.join(',')),
    distinctUntilChanged(),
    shareReplay(1)
  );
  readonly isMultiUploadAllowed$ = this.select((state) => state.isComponentMultiUploadAllowed !== false && state.isMultiUploadAllowed).pipe(distinctUntilChanged(), shareReplay(1));

  readonly uploadPath$ = this.select((state) => state.uploadPath).pipe(distinctUntilChanged(), shareReplay(1));
  readonly fileNameFactory$ = this.select((state) => state.fileNameFactory).pipe(distinctUntilChanged(), shareReplay(1));
  readonly fileList$ = this.select((state) => state.fileList).pipe(distinctUntilChanged(), shareReplay(1));
  readonly uploadProgress$ = this.select((state) => state.uploadProgress).pipe(distinctUntilChanged(), shareReplay(1));

  // MARK: State Changes
  readonly setComponentFileTypesAccepted = this.updater((state, componentFileTypesAccepted: Maybe<DbxFirebaseStorageFileUploadStoreAllowedTypes>) => ({ ...state, componentFileTypesAccepted }));
  readonly setIsComponentMultiUploadAllowed = this.updater((state, isComponentMultiUploadAllowed: Maybe<boolean>) => ({ ...state, isComponentMultiUploadAllowed }));

  readonly setFileNameFactory = this.updater((state, fileNameFactory: DbxFirebaseStorageFileUploadStoreFileNameFactory) => ({ ...state, fileNameFactory }));
  readonly setUploadPath = this.updater((state, uploadPath: Maybe<StoragePathInput>) => ({ ...state, uploadPath }));
  readonly setFileTypesAccepted = this.updater((state, fileTypesAccepted: Maybe<DbxFirebaseStorageFileUploadStoreAllowedTypes>) => ({ ...state, fileTypesAccepted }));

  /**
   * Sets the file list to upload.
   *
   * If the upload handler is working, the file list cannot be changed.
   */
  readonly setFileList = this.updater((state, fileList: Maybe<FileList>) => ({ ...state, fileList: state.isUploadHandlerWorking ? state.fileList : fileList }));
  readonly setIsMultiUploadAllowed = this.updater((state, isMultiUploadAllowed: Maybe<boolean>) => ({ ...state, isMultiUploadAllowed }));

  /**
   * Flags the uploading to begin.
   *
   * Once the upload handler is flagged, it cannot be unset until the upload handler has finished.
   */
  readonly setStartUpload = this.updater((state, startUpload: boolean) => ({ ...state, startUpload: state.startUpload || startUpload }));

  /**
   * Flags the upload handler to begin working.
   *
   * Once the upload handler is flagged, it cannot be unset until the upload handler has finished.
   */
  readonly setIsUploadHandlerWorking = this.updater((state, isUploadHandlerWorking: boolean) => ({ ...state, isUploadHandlerWorking }));

  /**
   * Updates the upload progress for one or more files.
   */
  readonly updateUploadProgress = this.updater((state, uploadProgress: ArrayOrValue<DbxFirebaseStorageFileUploadStoreFileProgress>) => updateUploadStorageFileStoreStateWithUploadProgress(state, uploadProgress));
}

export function updateUploadStorageFileStoreStateWithUploadProgress(state: DbxFirebaseStorageFileUploadStoreState, uploadProgress: ArrayOrValue<DbxFirebaseStorageFileUploadStoreFileProgress>): DbxFirebaseStorageFileUploadStoreState {
  const { uploadProgress: currentUploadProgress } = state;

  const newUploadProgress = asArray(uploadProgress);
  const newUploadProgressMap = new Map(newUploadProgress.map((progress) => [progress.file, progress]));

  // todo: create a

  return state;
}
