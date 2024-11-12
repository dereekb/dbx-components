import { Directive, Input, inject } from '@angular/core';
import { HookResult, Transition } from '@uirouter/core';
import { DbxActionTransitionSafetyType, DbxActionTransitionSafetyDirective } from '@dereekb/dbx-web';
import { DbxActionFormDirective } from '../form.action.directive';

/**
 * Extension of DbxActionTransitionSafetyDirective that forces the form to update first.
 *
 * NOTE: Only works with UIRouter
 */
@Directive({
  selector: '[dbxActionFormSafety]'
})
export class DbxActionFormSafetyDirective<T, O> extends DbxActionTransitionSafetyDirective<T, O> {
  readonly dbxActionForm = inject(DbxActionFormDirective<T>, { host: true });

  @Input('dbxActionFormSafety')
  override inputSafetyType?: DbxActionTransitionSafetyType = 'auto';

  protected override _handleOnBeforeTransition(transition: Transition): HookResult {
    this.dbxActionForm.form.forceFormUpdate();
    return super._handleOnBeforeTransition(transition);
  }
}
