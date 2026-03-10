import { Directive, inject } from '@angular/core';
import { cleanSubscription } from '../../rxjs';
import { DbxButton } from '../button';
import { DbxActionContextStoreSourceInstance } from '../../action/action.store.source';

/**
 * Links a {@link DbxButton} click to an action context trigger, without synchronizing
 * disabled or working states. Use {@link DbxActionButtonDirective} for full state binding.
 *
 * @example
 * ```html
 * <div dbxAction>
 *   <button dbxButton dbxActionButtonTrigger>Trigger Only</button>
 * </div>
 * ```
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
