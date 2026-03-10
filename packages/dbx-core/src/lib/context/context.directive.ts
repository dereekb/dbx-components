import { Directive, effect, inject, input } from '@angular/core';
import { DbxAppContextService } from './context.service';
import { type DbxAppContextState } from './context';
import { type Maybe } from '@dereekb/util';

/**
 * Sets the application's {@link DbxAppContextState} when the input value changes.
 *
 * Dispatches to the NgRx store via {@link DbxAppContextService}. Commonly placed
 * on route-level components to declare which context the route belongs to.
 *
 * @example
 * ```html
 * <div [dbxAppContextState]="'app'">
 *   <!-- App-level content rendered when context is 'app' -->
 * </div>
 * ```
 *
 * @example
 * ```html
 * <router-outlet dbxAppContextState="public"></router-outlet>
 * ```
 */
@Directive({
  selector: '[dbxAppContextState]',
  standalone: true
})
export class DbxAppContextStateDirective {
  readonly dbxAppContextStateService = inject(DbxAppContextService);

  readonly state = input<Maybe<DbxAppContextState>>(undefined, { alias: 'dbxAppContextState' });

  protected readonly _stateEffect = effect(() => {
    const state = this.state();

    if (state != null) {
      this.dbxAppContextStateService.setState(state);
    }
  });
}
