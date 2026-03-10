import { Directive } from '@angular/core';
import { DbxActionButtonTriggerDirective } from './action.button.trigger.directive';
import { cleanSubscription } from '../../rxjs/subscription';

/**
 * Links a {@link DbxButton} to an action context, synchronizing the button's
 * disabled and working states with the action's lifecycle and forwarding
 * button clicks as action triggers.
 *
 * Extends {@link DbxActionButtonTriggerDirective} by also binding working/disabled state.
 *
 * @example
 * ```html
 * <div dbxAction>
 *   <button dbxButton dbxActionButton [text]="'Submit'">Submit</button>
 * </div>
 * ```
 */
@Directive({
  selector: '[dbxActionButton]',
  standalone: true
})
export class DbxActionButtonDirective extends DbxActionButtonTriggerDirective {
  constructor() {
    super();

    cleanSubscription(
      this.source.isWorkingOrWorkProgress$.subscribe((working) => {
        this.dbxButton.setWorking(working);
      })
    );

    cleanSubscription(
      this.source.isDisabled$.subscribe((disabled) => {
        this.dbxButton.setDisabled(disabled);
      })
    );
  }
}
