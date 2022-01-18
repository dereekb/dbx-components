import { Directive, Host, OnInit, OnDestroy, ViewContainerRef, Input } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { HookResult, Transition, TransitionHookFn, TransitionService } from '@uirouter/core';
import { ActionContextStoreSourceInstance } from '../action/action';
import { DbNgxActionTransitionSafetyDirective, DbNgxActionTransitionSafetyType } from '../action/transition.safety.directive';
import { DbNgxActionFormDirective } from './form.action.directive';

/**
 * Extension of DbNgxActionTransitionSafetyDirective that forces the form to update first.
 */
@Directive({
  selector: '[dbxActionFormSafety]',
})
export class DbNgxActionFormSafetyDirective<T, O> extends DbNgxActionTransitionSafetyDirective<T, O> {

  @Input('dbxActionFormSafety')
  inputSafetyType?: DbNgxActionTransitionSafetyType;

  constructor(
    source: ActionContextStoreSourceInstance<T, O>,
    @Host() public readonly appActionForm: DbNgxActionFormDirective<T>,
    protected readonly transitionService: TransitionService,
    protected readonly viewContainerRef: ViewContainerRef,
    protected readonly dialog: MatDialog
  ) {
    super(source, transitionService, viewContainerRef, dialog);
  }

  protected _handleOnBeforeTransition(transition: Transition): HookResult {
    this.appActionForm.form.forceFormUpdate();
    return super._handleOnBeforeTransition(transition);
  }

}
