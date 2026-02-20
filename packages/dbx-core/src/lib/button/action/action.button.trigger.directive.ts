import { Directive, inject } from '@angular/core';
import { cleanSubscription } from '../../rxjs';
import { DbxButton } from '../button';
import { DbxActionContextStoreSourceInstance } from '../../action/action.store.source';

/**
 * Context used for linking a button to an ActionContext and only look for triggers.
 */
@Directive({
  selector: '[dbxActionButtonTrigger]',
  standalone: true
})
export class DbxActionButtonTriggerDirective {
  readonly dbxButton = inject(DbxButton, { host: true });
  readonly source = inject(DbxActionContextStoreSourceInstance);

  constructor() {
    cleanSubscription(
      this.dbxButton.clicked$.subscribe(() => {
        this._buttonClicked();
      })
    );
  }

  protected _buttonClicked(): void {
    this.source.trigger();
  }
}
