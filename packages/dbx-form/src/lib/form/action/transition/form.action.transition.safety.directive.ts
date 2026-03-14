import { Directive, effect, inject, input } from '@angular/core';
import { type HookResult, type Transition } from '@uirouter/core';
import { type DbxActionTransitionSafetyType, DbxActionTransitionSafetyDirective } from '@dereekb/dbx-web';
import { DbxActionFormDirective } from '../form.action.directive';

/**
 * Extension of {@link DbxActionTransitionSafetyDirective} that forces the form to update before
 * evaluating transition safety. This ensures the latest form state is considered when deciding
 * whether to block or allow a route transition.
 *
 * NOTE: Only works with UIRouter.
 *
 * @selector `[dbxActionFormSafety]`
 *
 * @typeParam T - The form value type.
 * @typeParam O - The output value type passed to the action source.
 */
@Directive({
  selector: '[dbxActionFormSafety]',
  standalone: true
})
export class DbxActionFormSafetyDirective<T, O> extends DbxActionTransitionSafetyDirective<T, O> {
  readonly dbxActionForm = inject(DbxActionFormDirective<T>, { host: true });

  /**
   * The safety type that controls when transitions are blocked.
   *
   * Defaults to `'auto'`, which blocks transitions when the form has unsaved changes.
   */
  readonly dbxActionFormSafety = input<DbxActionTransitionSafetyType>('auto');

  protected readonly _dbxActionFormSafetyUpdateEffect = effect(() => this._safetyType.next(this.dbxActionFormSafety()));

  protected override _handleOnBeforeTransition(transition: Transition): HookResult {
    this.dbxActionForm.form.forceFormUpdate();
    return super._handleOnBeforeTransition(transition);
  }
}
