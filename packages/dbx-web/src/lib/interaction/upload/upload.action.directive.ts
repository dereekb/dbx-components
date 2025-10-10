import { Directive, OnInit, OnDestroy, inject, Type } from '@angular/core';
import { SubscriptionObject } from '@dereekb/rxjs';
import { DbxActionContextStoreSourceInstance } from '@dereekb/dbx-core';
import { DbxFileUploadActionCompatable } from './upload.action';

/**
 * Context used for linking a button to an ActionContext.
 */
@Directive({
  selector: '[dbxFileUploadActionSync]',
  standalone: true
})
export class DbxFileUploadActionSyncDirective implements OnInit, OnDestroy {
  readonly source = inject(DbxActionContextStoreSourceInstance);
  readonly uploadCompatable = inject<DbxFileUploadActionCompatable>(DbxFileUploadActionCompatable);

  private readonly _workingSub = new SubscriptionObject();
  private readonly _disabledSub = new SubscriptionObject();

  ngOnInit(): void {
    this._workingSub.subscription = this.source.isWorking$.subscribe((working) => {
      this.uploadCompatable.setWorking(working);
    });

    this._disabledSub.subscription = this.source.isDisabled$.subscribe((disabled) => {
      this.uploadCompatable.setDisabled(disabled);
    });
  }

  ngOnDestroy(): void {
    this._workingSub.destroy();
    this._disabledSub.destroy();
  }
}
