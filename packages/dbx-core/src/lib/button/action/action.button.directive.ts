import { safeDetectChanges } from '../../util/view';
import { Directive, Host, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { DbxButton } from '../button';
import { DbxActionContextStoreSourceInstance } from '../../action/action.store.source';
import { DbxActionButtonTriggerDirective } from './action.button.trigger.directive';
import { SubscriptionObject } from '@dereekb/rxjs';

/**
 * Context used for linking a button to an ActionContext.
 */
@Directive({
  selector: '[dbxActionButton]'
})
export class DbxActionButtonDirective extends DbxActionButtonTriggerDirective implements OnInit, OnDestroy {
  private _workingSub = new SubscriptionObject();
  private _disabledSub = new SubscriptionObject();

  constructor(@Host() button: DbxButton, source: DbxActionContextStoreSourceInstance, private readonly cdRef: ChangeDetectorRef) {
    super(button, source);
  }

  override ngOnInit(): void {
    super.ngOnInit();

    this._workingSub.subscription = this.source.isWorking$.subscribe((working) => {
      this.button.working = working;
      safeDetectChanges(this.cdRef);
    });

    this._disabledSub.subscription = this.source.isDisabled$.subscribe((disabled) => {
      this.button.disabled = disabled;
      safeDetectChanges(this.cdRef);
    });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._workingSub.destroy();
    this._disabledSub.destroy();
  }
}
