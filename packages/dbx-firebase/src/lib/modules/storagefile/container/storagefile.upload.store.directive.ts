import { Directive, inject, input, OnDestroy } from '@angular/core';
import { skipAllInitialMaybe, SubscriptionObject } from '@dereekb/rxjs';
import { DbxFirebaseStorageFileUploadStore, DbxFirebaseStorageFileUploadStoreAllowedTypes } from '../store';
import { Maybe } from '@dereekb/util';
import { toObservable } from '@angular/core/rxjs-interop';
import { shareReplay } from 'rxjs';

/**
 * Directive that provides a DbxFirebaseStorageFileUploadStore, and sync's the inputs to the store.
 */
@Directive({
  selector: '[dbxFirebaseStorageFileUploadStore]',
  exportAs: 'dbxFirebaseStorageFileUploadStore',
  providers: [DbxFirebaseStorageFileUploadStore],
  standalone: true
})
export class DbxFirebaseStorageFileUploadStoreDirective implements OnDestroy {
  private readonly _allowedSub = new SubscriptionObject();
  private readonly _multiSub = new SubscriptionObject();

  readonly uploadStore = inject(DbxFirebaseStorageFileUploadStore);

  readonly isMultiUploadAllowed = input<Maybe<boolean>>();
  readonly fileTypesAccepted = input<Maybe<DbxFirebaseStorageFileUploadStoreAllowedTypes>>();

  readonly fileTypesAccepted$ = toObservable(this.fileTypesAccepted).pipe(skipAllInitialMaybe(), shareReplay(1));
  readonly isMultiUploadAllowed$ = toObservable(this.isMultiUploadAllowed).pipe(skipAllInitialMaybe(), shareReplay(1));

  constructor() {
    this._allowedSub.subscription = this.fileTypesAccepted$.subscribe((x) => this.uploadStore.setFileTypesAccepted(x));
    this._multiSub.subscription = this.isMultiUploadAllowed$.subscribe((x) => this.uploadStore.setIsMultiUploadAllowed(x));
  }

  ngOnDestroy(): void {
    this._allowedSub.destroy();
    this._multiSub.destroy();
  }
}
