import { Directive, Host, ViewContainerRef, Input } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { HookResult, Transition, TransitionService } from '@uirouter/core';
import { ActionContextStoreSourceInstance } from '@dereekb/dbx-core';
import { DbNgxActionTransitionSafetyType, DbNgxActionTransitionSafetyDirective } from '@dereekb/dbx-web';
import { DbNgxActionFormDirective } from '../form.action.directive';

/**
 * Extension of DbNgxActionTransitionSafetyDirective that forces the form to update first.
 * 
 * NOTE: Only works with UIRouter
 */
@Directive({
  selector: '[dbxActionFormSafety]',
})
export class DbNgxActionFormSafetyDirective<T, O> extends DbNgxActionTransitionSafetyDirective<T, O> {

  @Input('dbxActionFormSafety')
  override inputSafetyType?: DbNgxActionTransitionSafetyType;

  constructor(
    @Host() public readonly appActionForm: DbNgxActionFormDirective<T>,
    source: ActionContextStoreSourceInstance<T, O>,
    transitionService: TransitionService,
    viewContainerRef: ViewContainerRef,
    dialog: MatDialog
  ) {
    super(source, transitionService, viewContainerRef, dialog);
  }

  protected override _handleOnBeforeTransition(transition: Transition): HookResult {
    this.appActionForm.form.forceFormUpdate();
    return super._handleOnBeforeTransition(transition);
  }

}
