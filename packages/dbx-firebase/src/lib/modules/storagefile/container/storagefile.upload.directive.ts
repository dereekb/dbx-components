import { Directive, OnDestroy, inject, input } from '@angular/core';
import { FilterMap, skipAllInitialMaybe } from '@dereekb/rxjs';
import { DbxFirebaseStorageFileUploadStore, DbxFirebaseStorageFileUploadStoreAllowedTypes } from '../store';
import { Maybe } from '@dereekb/util';
import { toObservable } from '@angular/core/rxjs-interop';
import { shareReplay } from 'rxjs';

/**
 * Direction that provides a DbxFirebaseStorageFileUploadStore.
 */
@Directive({
  selector: '[dbxFirebaseStorageFileUpload]',
  exportAs: 'dbxFirebaseStorageFileUpload',
  providers: [DbxFirebaseStorageFileUploadStore],
  standalone: true
})
export class DbxFirebaseStorageFileUploadDirective {
  readonly uploadStore = inject(DbxFirebaseStorageFileUploadStore);

  readonly fileTypesAccepted = input<Maybe<DbxFirebaseStorageFileUploadStoreAllowedTypes>>();
  readonly isMultiUploadAllowed = input<Maybe<boolean>>();

  readonly fileTypesAccepted$ = toObservable(this.fileTypesAccepted).pipe(skipAllInitialMaybe(), shareReplay(1));
  readonly isMultiUploadAllowed$ = toObservable(this.isMultiUploadAllowed).pipe(skipAllInitialMaybe(), shareReplay(1));

  constructor() {
    this.uploadStore.setFileTypesAccepted(this.fileTypesAccepted$);
    this.uploadStore.setIsMultiUploadAllowed(this.isMultiUploadAllowed$);
  }
}
