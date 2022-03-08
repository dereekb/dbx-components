import { Directive, Host, ViewContainerRef, Input } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { HookResult, Transition, TransitionService } from '@uirouter/core';
import { DbxActionContextStoreSourceInstance } from '@dereekb/dbx-core';
import { DbxActionTransitionSafetyType, DbxActionTransitionSafetyDirective } from '@dereekb/dbx-web';
import { DbxActionFormDirective } from '../form.action.directive';

/**
 * Extension of DbxActionTransitionSafetyDirective that forces the form to update first.
 * 
 * NOTE: Only works with UIRouter
 */
@Directive({
  selector: '[dbxActionFormSafety]',
})
export class DbxActionFormSafetyDirective<T, O> extends DbxActionTransitionSafetyDirective<T, O> {

  @Input('dbxActionFormSafety')
  override inputSafetyType?: DbxActionTransitionSafetyType;

  constructor(
    @Host() public readonly appActionForm: DbxActionFormDirective<T>,
    source: DbxActionContextStoreSourceInstance<T, O>,
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
