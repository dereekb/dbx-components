import { Directive, effect, inject, input, OnDestroy } from '@angular/core';
import { HookResult, Transition } from '@uirouter/core';
import { DbxActionTransitionSafetyType, DbxActionTransitionSafetyDirective } from '@dereekb/dbx-web';
import { DbxActionFormDirective } from '../form.action.directive';

/**
 * Extension of DbxActionTransitionSafetyDirective that forces the form to update first.
 *
 * NOTE: Only works with UIRouter
 */
@Directive({
  selector: '[dbxActionFormSafety]',
  standalone: true
})
export class DbxActionFormSafetyDirective<T, O> extends DbxActionTransitionSafetyDirective implements OnDestroy<T, O> {
  readonly dbxActionForm = inject(DbxActionFormDirective<T>, { host: true });

  readonly dbxActionFormSafety = input<DbxActionTransitionSafetyType>('auto');

  protected readonly _dbxActionFormSafetyUpdateEffect = effect(() => this._safetyType.next(this.dbxActionFormSafety()));

  protected override _handleOnBeforeTransition(transition: Transition): HookResult {
    this.dbxActionForm.form.forceFormUpdate();
    return super._handleOnBeforeTransition(transition);
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._dbxActionFormSafetyUpdateEffect.destroy();
  }
}
