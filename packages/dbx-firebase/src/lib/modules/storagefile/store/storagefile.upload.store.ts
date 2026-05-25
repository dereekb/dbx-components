import { Injectable } from '@angular/core';
import { type FileAcceptFilterTypeString } from '@dereekb/dbx-web';
import { type FirebaseStorageAccessorFile, type StoragePathInput } from '@dereekb/firebase';
import { distinctUntilHasDifferentValues, filterMaybe } from '@dereekb/rxjs';
import { type ArrayOrValue, asArray, type Maybe, type PercentDecimal, type PromiseOrValue } from '@dereekb/util';
import { ComponentStore } from '@ngrx/component-store';
import { combineLatest, distinctUntilChanged, from, map, type Observable, of, shareReplay, switchMap } from 'rxjs';
import { type StorageFileUploadFilesEvent, type StorageFileUploadFilesFinalResult } from '../container';

/**
 * Per-file transform applied to each entry of `rawFiles` before it reaches `files$`
 * and the upload pipeline. Lets callers plug in client-side compression, resizing,
 * renaming, etc.
 *
 * If the modifier throws or rejects, `files$` propagates the error — fail-closed
 * by default. Callers that prefer fail-open behavior should swallow inside the
 * modifier and return the original file.
 */
export type DbxFirebaseStorageFileUploadFileModifier = (file: File) => PromiseOrValue<File>;

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
   * The current raw file(s) to upload (before the modifier is applied).
   */
  readonly rawFiles?: Maybe<File[]>;

  /**
   * Optional per-file modifier applied to every `rawFiles` entry before it flows out through `files$`.
   */
  readonly fileModifier?: Maybe<DbxFirebaseStorageFileUploadFileModifier>;

  // Upload Step
  /**
   * The progress of the upload for each file.
   *
   * Only set while one or more files are being uploaded.
   */
  readonly latestProgressEvent?: Maybe<StorageFileUploadFilesEvent>;

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
export class DbxFirebaseStorageFileUploadStore extends ComponentStore<DbxFirebaseStorageFileUploadStoreState> {
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
  readonly rawFiles$ = this.select((state) => state.rawFiles).pipe(distinctUntilChanged(), shareReplay(1));
  readonly fileModifier$ = this.select((state) => state.fileModifier).pipe(distinctUntilChanged(), shareReplay(1));

  readonly files$: Observable<File[]> = combineLatest([this.rawFiles$.pipe(filterMaybe()), this.fileModifier$]).pipe(
    switchMap(([rawFiles, modifier]) => {
      let result$: Observable<File[]>;

      if (!modifier || rawFiles.length === 0) {
        result$ = of(rawFiles);
      } else {
        result$ = from(Promise.all(rawFiles.map((file) => Promise.resolve(modifier(file)))));
      }

      return result$;
    }),
    shareReplay(1)
  );

  readonly isUploadHandlerWorking$ = this.select((state) => state.isUploadHandlerWorking).pipe(distinctUntilChanged(), shareReplay(1));
  readonly latestProgressEvent$ = this.select((state) => state.latestProgressEvent).pipe(distinctUntilChanged(), shareReplay(1));
  readonly currentUploadResult$ = this.select((state) => state.uploadResult).pipe(distinctUntilChanged(), shareReplay(1));
  readonly uploadResult$ = this.currentUploadResult$.pipe(filterMaybe());

  // MARK: State Changes
  readonly setComponentFileTypesAccepted = this.updater((state, componentFileTypesAccepted: Maybe<DbxFirebaseStorageFileUploadStoreAllowedTypes>) => ({ ...state, componentFileTypesAccepted }));
  readonly setIsComponentMultiUploadAllowed = this.updater((state, isComponentMultiUploadAllowed: Maybe<boolean>) => ({ ...state, isComponentMultiUploadAllowed }));

  readonly setUploadPath = this.updater((state, uploadPath: Maybe<StoragePathInput>) => ({ ...state, uploadPath }));
  readonly setFileTypesAccepted = this.updater((state, fileTypesAccepted: Maybe<ArrayOrValue<FileAcceptFilterTypeString>>) => ({ ...state, fileTypesAccepted: fileTypesAccepted ? asArray(fileTypesAccepted) : undefined }));

  /**
   * Sets the raw file list to upload.
   *
   * If the upload handler is working, the rawFiles list cannot be changed.
   */
  readonly setRawFiles = this.updater((state, rawFiles: Maybe<File[]>) => ({ ...state, rawFiles: state.isUploadHandlerWorking ? state.rawFiles : rawFiles }));

  /**
   * Sets the per-file modifier applied to each entry of `rawFiles` before it flows through `files$`.
   *
   * Pass `null` / `undefined` to clear the modifier.
   */
  readonly setFileModifier = this.updater((state, fileModifier: Maybe<DbxFirebaseStorageFileUploadFileModifier>) => ({ ...state, fileModifier }));
  readonly setIsMultiUploadAllowed = this.updater((state, isMultiUploadAllowed: Maybe<boolean>) => ({ ...state, isMultiUploadAllowed }));

  /**
   * Flags the upload handler to begin working.
   *
   * Once the upload handler is flagged, it cannot be unset until the upload handler has finished.
   */
  readonly setIsUploadHandlerWorking = this.updater((state, isUploadHandlerWorking: boolean) => ({ ...state, isUploadHandlerWorking }));

  /**
   * Sets the latest progress event.
   */
  readonly setLatestProgressEvent = this.updater((state, latestProgressEvent: Maybe<StorageFileUploadFilesEvent>) => ({ ...state, latestProgressEvent }));

  /**
   * Updates the upload progress for one or more files.
   */
  // readonly updateUploadProgress = this.updater((state, uploadProgress: ArrayOrValue<DbxFirebaseStorageFileUploadStoreFileProgress>) => updateUploadStorageFileStoreStateWithUploadProgress(state, uploadProgress));

  /**
   * Sets the upload result.
   */
  readonly setUploadResult = this.updater((state, uploadResult: Maybe<StorageFileUploadFilesFinalResult>) => ({ ...state, isUploadHandlerWorking: false, uploadProgress: undefined, uploadResult }));
}

// TODO: Consider moving this back, but might not be needed...
/*
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
*/
