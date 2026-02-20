import { Directive, inject, input } from '@angular/core';
import { skipAllInitialMaybe } from '@dereekb/rxjs';
import { DbxFirebaseStorageFileUploadStore } from '../store';
import { ArrayOrValue, Maybe } from '@dereekb/util';
import { toObservable } from '@angular/core/rxjs-interop';
import { shareReplay } from 'rxjs';
import { FileAcceptFilterTypeString } from '@dereekb/dbx-web';
import { cleanSubscription } from '@dereekb/dbx-core';

/**
 * Directive that provides a DbxFirebaseStorageFileUploadStore, and sync's the inputs to the store.
 */
@Directive({
  selector: '[dbxFirebaseStorageFileUploadStore]',
  exportAs: 'dbxFirebaseStorageFileUploadStore',
  providers: [DbxFirebaseStorageFileUploadStore],
  standalone: true
})
export class DbxFirebaseStorageFileUploadStoreDirective {
  readonly uploadStore = inject(DbxFirebaseStorageFileUploadStore);

  readonly multipleUpload = input<Maybe<boolean>>();
  readonly fileTypesAccepted = input<Maybe<ArrayOrValue<FileAcceptFilterTypeString>>>();

  readonly fileTypesAccepted$ = toObservable(this.fileTypesAccepted).pipe(skipAllInitialMaybe(), shareReplay(1));
  readonly isMultiUploadAllowed$ = toObservable(this.multipleUpload).pipe(skipAllInitialMaybe(), shareReplay(1));

  constructor() {
    cleanSubscription(this.fileTypesAccepted$.subscribe((x) => this.uploadStore.setFileTypesAccepted(x)));
    cleanSubscription(this.isMultiUploadAllowed$.subscribe((x) => this.uploadStore.setIsMultiUploadAllowed(x)));
  }
}
