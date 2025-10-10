import { Injectable, OnDestroy } from '@angular/core';
import { FileAcceptFilterTypeString } from '@dereekb/dbx-web';
import { FirebaseStorageAccessorFile, StoragePathInput } from '@dereekb/firebase';
import { distinctUntilHasDifferentValues, filterMaybe } from '@dereekb/rxjs';
import { ArrayOrValue, asArray, Maybe, MimeTypeWithoutParameters, PercentDecimal, PercentNumber, SlashPathTypedFileSuffix } from '@dereekb/util';
import { ComponentStore } from '@ngrx/component-store';
import { distinctUntilChanged, filter, map, shareReplay } from 'rxjs';
import { StorageFileUploadFilesFinalResult } from '../container';

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
 * The accepted file types for the upload.
 *
 * If unset, then all file types are accepted.
 */
export type DbxFirebaseStorageFileUploadStoreAllowedTypes = FileAcceptFilterTypeString[];

/**
 * The progress of a file being uploaded.
 *
 * File progresses are automatically created for all files when one file's progress is
 */
export interface DbxFirebaseStorageFileUploadStoreFileProgress<T = unknown> {
  /**
   * The file being uploaded.
   */
  readonly file: File;
  /**
   * The accessor file for the file, if available.
   */
  readonly fileRef?: Maybe<FirebaseStorageAccessorFile>;
  /**
   * The upload reference info for the file, if available.
   */
  readonly uploadRef?: Maybe<T>;
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
  readonly progress?: Maybe<PercentDecimal>;
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

  // Files Step
  /**
   * The current file(s) to upload.
   */
  readonly files?: Maybe<File[]>;

  // Upload Step
  /**
   * The progress of the upload for each file.
   *
   * Only set while one or more files are being uploaded.
   */
  readonly uploadProgress?: Maybe<DbxFirebaseStorageFileUploadStoreFileProgress[]>;

  /**
   * If true, the upload handler is working.
   */
  readonly isUploadHandlerWorking?: Maybe<boolean>;

  // Upload Result
  /**
   * The final upload result for the files.
   *
   * Only set after the upload has completed.
   */
  readonly uploadResult?: Maybe<StorageFileUploadFilesFinalResult>;
}

/**
 * Store used for selecting a specific NotificationItem from a list of notification items.
 */
@Injectable()
export class DbxFirebaseStorageFileUploadStore extends ComponentStore<DbxFirebaseStorageFileUploadStoreState> implements OnDestroy {
  constructor() {
    super({});
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
  readonly currentFiles$ = this.select((state) => state.files).pipe(distinctUntilChanged(), shareReplay(1));
  readonly files$ = this.currentFiles$.pipe(filterMaybe());

  readonly isUploadHandlerWorking$ = this.select((state) => state.isUploadHandlerWorking).pipe(distinctUntilChanged(), shareReplay(1));
  readonly uploadProgress$ = this.select((state) => state.uploadProgress).pipe(distinctUntilChanged(), shareReplay(1));
  readonly currentUploadResult$ = this.select((state) => state.uploadResult).pipe(distinctUntilChanged(), shareReplay(1));
  readonly uploadResult$ = this.currentUploadResult$.pipe(filterMaybe());

  // MARK: State Changes
  readonly setComponentFileTypesAccepted = this.updater((state, componentFileTypesAccepted: Maybe<DbxFirebaseStorageFileUploadStoreAllowedTypes>) => ({ ...state, componentFileTypesAccepted }));
  readonly setIsComponentMultiUploadAllowed = this.updater((state, isComponentMultiUploadAllowed: Maybe<boolean>) => ({ ...state, isComponentMultiUploadAllowed }));

  readonly setUploadPath = this.updater((state, uploadPath: Maybe<StoragePathInput>) => ({ ...state, uploadPath }));
  readonly setFileTypesAccepted = this.updater((state, fileTypesAccepted: Maybe<ArrayOrValue<FileAcceptFilterTypeString>>) => ({ ...state, fileTypesAccepted: fileTypesAccepted ? asArray(fileTypesAccepted) : undefined }));

  /**
   * Sets the file list to upload.
   *
   * If the upload handler is working, the file list cannot be changed.
   */
  readonly setFiles = this.updater((state, files: Maybe<File[]>) => ({ ...state, files: state.isUploadHandlerWorking ? state.files : files }));
  readonly setIsMultiUploadAllowed = this.updater((state, isMultiUploadAllowed: Maybe<boolean>) => ({ ...state, isMultiUploadAllowed }));

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

  /**
   * Sets the upload result.
   */
  readonly setUploadResult = this.updater((state, uploadResult: Maybe<StorageFileUploadFilesFinalResult>) => ({ ...state, isUploadHandlerWorking: false, uploadProgress: undefined, uploadResult }));
}

export function updateUploadStorageFileStoreStateWithUploadProgress(state: DbxFirebaseStorageFileUploadStoreState, uploadProgress: ArrayOrValue<DbxFirebaseStorageFileUploadStoreFileProgress>): DbxFirebaseStorageFileUploadStoreState {
  const { uploadProgress: currentUploadProgress } = state;

  const newUploadProgress = asArray(uploadProgress);
  const newUploadProgressMap = new Map(newUploadProgress.map((progress) => [progress.file, progress]));

  const updatedUploadProgress = (currentUploadProgress ?? []).map((progress) => {
    const newProgress = newUploadProgressMap.get(progress.file);
    return newProgress ?? progress;
  });

  return { ...state, uploadProgress: updatedUploadProgress };
}
