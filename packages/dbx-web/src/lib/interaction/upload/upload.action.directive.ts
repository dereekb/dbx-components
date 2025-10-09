import { Directive, OnInit, OnDestroy, inject, Type, Provider, forwardRef } from '@angular/core';
import { SubscriptionObject } from '@dereekb/rxjs';
import { DbxActionContextStoreSourceInstance } from '@dereekb/dbx-core';
import { Maybe } from '@dereekb/util';
import { FileArrayAcceptMatchConfig } from './upload.accept';

export abstract class DbxUploadActionCompatable {
  abstract setDisabled(disabled?: Maybe<boolean>): void;
  abstract setWorking(working?: Maybe<boolean>): void;
  abstract setMultiple(multiple?: Maybe<boolean>): void;
  abstract setAccept(accept?: Maybe<FileArrayAcceptMatchConfig['accept']>): void;
}

/**
 * Context used for linking a button to an ActionContext.
 */
@Directive({
  selector: '[dbxUploadAction]',
  standalone: true
})
export class DbxUploadButtonDirective implements OnInit, OnDestroy {
  readonly source = inject(DbxActionContextStoreSourceInstance);
  readonly uploadCompatable = inject<DbxUploadActionCompatable>(DbxUploadActionCompatable);

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
