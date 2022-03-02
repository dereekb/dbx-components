import { Directive, Host, OnInit } from '@angular/core';
import { AbstractSubscriptionDirective } from '../../subscription';
import { DbNgxButton } from '../button';
import { ActionContextStoreSourceInstance } from '../../action/action.store.source';

/**
 * Context used for linking a button to an ActionContext and only look for triggers.
 */
@Directive({
  selector: '[dbxActionButtonTrigger]'
})
export class DbNgxActionButtonTriggerDirective extends AbstractSubscriptionDirective implements OnInit {

  constructor(@Host() public readonly button: DbNgxButton, public readonly source: ActionContextStoreSourceInstance) {
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
