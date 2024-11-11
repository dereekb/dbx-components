import { Directive, Host, OnInit, inject } from '@angular/core';
import { AbstractSubscriptionDirective } from '../../subscription';
import { DbxButton } from '../button';
import { DbxActionContextStoreSourceInstance } from '../../action/action.store.source';

/**
 * Context used for linking a button to an ActionContext and only look for triggers.
 */
@Directive({
  selector: '[dbxActionButtonTrigger]'
})
export class DbxActionButtonTriggerDirective extends AbstractSubscriptionDirective implements OnInit {
  readonly button = inject(DbxButton, { host: true });
  readonly source = inject(DbxActionContextStoreSourceInstance);

  constructor() {
    super();
  }

  ngOnInit(): void {
    this.sub = this.button.clicked$.subscribe(() => {
      this._buttonClicked();
    });
  }

  protected _buttonClicked(): void {
    this.source.trigger();
  }
}
