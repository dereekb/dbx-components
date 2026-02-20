import { Directive } from '@angular/core';
import { DbxActionButtonTriggerDirective } from './action.button.trigger.directive';
import { cleanSubscription } from '../../rxjs/subscription';

/**
 * Context used for linking a button to an ActionContext.
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
