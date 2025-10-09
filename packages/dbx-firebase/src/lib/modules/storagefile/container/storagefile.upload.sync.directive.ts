import { Directive, inject, input, OnDestroy } from '@angular/core';
import { skipAllInitialMaybe, SubscriptionObject } from '@dereekb/rxjs';
import { DbxFirebaseStorageFileUploadStore, DbxFirebaseStorageFileUploadStoreAllowedTypes } from '../store';
import { Maybe } from '@dereekb/util';
import { toObservable } from '@angular/core/rxjs-interop';
import { shareReplay } from 'rxjs';
import { DbxFileUploadComponent } from '@dereekb/dbx-web';

/**
 * Direction that syncs a DbxFirebaseStorageFileUploadStore's configuration to a DbxFileUploadComponent.
 */
@Directive({
  selector: '[dbxFirebaseStorageFileUploadSync]',
  exportAs: 'dbxFirebaseStorageFileUploadSync',
  providers: [DbxFirebaseStorageFileUploadStore],
  standalone: true
})
export class DbxFirebaseStorageFileUploadSyncDirective implements OnDestroy {
  private readonly _allowedSub = new SubscriptionObject();
  private readonly _multiSub = new SubscriptionObject();

  readonly uploadStore = inject(DbxFirebaseStorageFileUploadStore);
  readonly uploadComponent = inject(DbxFileUploadComponent);

  constructor() {
    this._allowedSub.subscription = this.uploadStore.fileTypesAllowed$.subscribe((x) => this.uploadComponent.setAccept(x));
    this._multiSub.subscription = this.uploadStore.isMultiUploadAllowed$.subscribe((x) => this.uploadComponent.setMultiple(x));
  }

  ngOnDestroy(): void {
    this._allowedSub.destroy();
    this._multiSub.destroy();
  }
}
