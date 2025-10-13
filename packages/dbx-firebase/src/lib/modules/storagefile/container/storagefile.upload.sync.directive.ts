import { Directive, inject, OnDestroy } from '@angular/core';
import { SubscriptionObject } from '@dereekb/rxjs';
import { DbxFirebaseStorageFileUploadStore } from '../store';
import { DbxFileUploadComponent } from '@dereekb/dbx-web';

/**
 * Directive that syncs a DbxFirebaseStorageFileUploadStore's configuration to a DbxFileUploadComponent.
 */
@Directive({
  selector: '[dbxFirebaseStorageFileUploadSync]',
  exportAs: 'dbxFirebaseStorageFileUploadSync',
  standalone: true
})
export class DbxFirebaseStorageFileUploadSyncDirective implements OnDestroy {
  private readonly _allowedSub = new SubscriptionObject();
  private readonly _multiSub = new SubscriptionObject();
  private readonly _filesSub = new SubscriptionObject();

  readonly uploadStore = inject(DbxFirebaseStorageFileUploadStore);
  readonly uploadComponent = inject(DbxFileUploadComponent);

  constructor() {
    this._allowedSub.subscription = this.uploadStore.fileTypesAllowed$.subscribe((x) => this.uploadComponent.setAccept(x));
    this._multiSub.subscription = this.uploadStore.isMultiUploadAllowed$.subscribe((x) => this.uploadComponent.setMultiple(x));
    this._filesSub.subscription = this.uploadComponent.filesChanged.subscribe((files) => this.uploadStore.setFiles(files.matchResult.accepted));
  }

  ngOnDestroy(): void {
    this._allowedSub.destroy();
    this._multiSub.destroy();
    this._filesSub.destroy();
  }
}
