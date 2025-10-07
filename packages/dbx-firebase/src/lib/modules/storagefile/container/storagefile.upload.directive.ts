import { Directive, effect, inject, input, OnDestroy } from '@angular/core';
import { skipAllInitialMaybe, tapLog } from '@dereekb/rxjs';
import { DbxFirebaseStorageFileUploadStore, DbxFirebaseStorageFileUploadStoreAllowedTypes, DbxFirebaseStorageFileUploadStoreFileProgress } from '../store';
import { Maybe } from '@dereekb/util';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, shareReplay } from 'rxjs';
import { dbxFirebaseStorageFileUploadStoreUploadHandler, DbxFirebaseStorageFileUploadStoreUploadHandler, StorageFileUploadHandler } from './storagefile.upload.handler';

/**
 * Direction that provides a DbxFirebaseStorageFileUploadStore.
 */
@Directive({
  selector: '[dbxFirebaseStorageFileUpload]',
  exportAs: 'dbxFirebaseStorageFileUpload',
  providers: [DbxFirebaseStorageFileUploadStore],
  standalone: true
})
export class DbxFirebaseStorageFileUploadDirective implements OnDestroy {
  private _uploadStoreUploadHandler: Maybe<DbxFirebaseStorageFileUploadStoreUploadHandler>;

  readonly uploadStore = inject(DbxFirebaseStorageFileUploadStore);

  readonly uploadHandler = input<Maybe<StorageFileUploadHandler>>();

  readonly fileTypesAccepted = input<Maybe<DbxFirebaseStorageFileUploadStoreAllowedTypes>>();
  readonly isMultiUploadAllowed = input<Maybe<boolean>>();

  readonly fileTypesAccepted$ = toObservable(this.fileTypesAccepted).pipe(skipAllInitialMaybe(), shareReplay(1));
  readonly isMultiUploadAllowed$ = toObservable(this.isMultiUploadAllowed).pipe(skipAllInitialMaybe(), shareReplay(1));

  readonly _uploadHandlerEffect = effect(
    () => {
      const uploadHandler = this.uploadHandler();
      let setNewUploadHandler = Boolean(uploadHandler);

      if (this._uploadStoreUploadHandler) {
        setNewUploadHandler = this._uploadStoreUploadHandler.uploadHandler !== uploadHandler;

        if (setNewUploadHandler) {
          this._destroyUploadHandler();
        }
      }

      if (uploadHandler && setNewUploadHandler) {
        this._uploadStoreUploadHandler = dbxFirebaseStorageFileUploadStoreUploadHandler({
          uploadHandler,
          uploadStore: this.uploadStore,
          maxParallelUploads: 3
        });

        this._uploadStoreUploadHandler.init();
      }
    },
    {
      allowSignalWrites: true
    }
  );

  constructor() {
    this.uploadStore.setFileTypesAccepted(this.fileTypesAccepted$);
    this.uploadStore.setIsMultiUploadAllowed(this.isMultiUploadAllowed$);

    this.uploadStore.state$.pipe(tapLog('state')).subscribe();
  }

  ngOnDestroy(): void {
    this._destroyUploadHandler();
  }

  private _destroyUploadHandler() {
    if (this._uploadStoreUploadHandler != null) {
      this._uploadStoreUploadHandler.destroy();
      delete this._uploadStoreUploadHandler;
    }
  }
}
