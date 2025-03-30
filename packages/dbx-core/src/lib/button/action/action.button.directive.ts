import { safeDetectChanges } from '../../util/view';
import { Directive, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { DbxActionButtonTriggerDirective } from './action.button.trigger.directive';
import { SubscriptionObject } from '@dereekb/rxjs';

/**
 * Context used for linking a button to an ActionContext.
 */
@Directive({
  selector: '[dbxActionButton]',
  standalone: true
})
export class DbxActionButtonDirective extends DbxActionButtonTriggerDirective implements OnInit, OnDestroy {
  private readonly cdRef = inject(ChangeDetectorRef);

  private _workingSub = new SubscriptionObject();
  private _disabledSub = new SubscriptionObject();

  override ngOnInit(): void {
    super.ngOnInit();

    this._workingSub.subscription = this.source.isWorking$.subscribe((working) => {
      this.dbxButton.working = working;
      safeDetectChanges(this.cdRef);
    });

    this._disabledSub.subscription = this.source.isDisabled$.subscribe((disabled) => {
      this.dbxButton.disabled = disabled;
      safeDetectChanges(this.cdRef);
    });
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._workingSub.destroy();
    this._disabledSub.destroy();
  }
}
