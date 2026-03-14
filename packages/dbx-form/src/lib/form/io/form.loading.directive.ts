import { type Observable } from 'rxjs';
import { Directive, inject, input } from '@angular/core';
import { cleanSubscription } from '@dereekb/dbx-core';
import { DbxMutableForm } from '../../form/form';
import { type LoadingState, type MaybeObservableOrValue, filterMaybe, maybeValueFromObservableOrValue, valueFromFinishedLoadingState } from '@dereekb/rxjs';
import { dbxFormSourceObservableFromStream, type DbxFormSourceDirectiveMode } from './form.input.directive';
import { type Maybe } from '@dereekb/util';
import { toObservable } from '@angular/core/rxjs-interop';

/**
 * Default mode for the {@link DbxFormLoadingSourceDirective}, which only passes values on form reset.
 */
const DEFAULT_DBX_FORM_LOADING_SOURCE_DIRECTIVE_MODE: DbxFormSourceDirectiveMode = 'reset';

/**
 * Directive that sets a form's value from a {@link LoadingState} source once loading is complete.
 *
 * Only passes non-null values from the source. Extracts the value from the finished loading state
 * and forwards it to the form using the configured mode.
 *
 * @selector `[dbxFormLoadingSource]`
 *
 * @typeParam T - The form value type (must extend object).
 */
@Directive({
  selector: '[dbxFormLoadingSource]',
  standalone: true
})
export class DbxFormLoadingSourceDirective<T extends object = object> {
  readonly form = inject(DbxMutableForm<T>, { host: true });

  /**
   * The mode controlling when the loading source value is forwarded to the form.
   *
   * Defaults to `'reset'`.
   */
  readonly dbxFormLoadingSourceMode = input<DbxFormSourceDirectiveMode, Maybe<DbxFormSourceDirectiveMode>>(DEFAULT_DBX_FORM_LOADING_SOURCE_DIRECTIVE_MODE, { transform: (x) => x ?? DEFAULT_DBX_FORM_LOADING_SOURCE_DIRECTIVE_MODE });

  /**
   * The loading state source to observe. The form value is set once loading finishes with a non-null value.
   */
  readonly dbxFormLoadingSource = input<MaybeObservableOrValue<LoadingState<T>>>();

  readonly mode$ = toObservable(this.dbxFormLoadingSourceMode);
  readonly source$: Observable<Maybe<T>> = toObservable(this.dbxFormLoadingSource).pipe(maybeValueFromObservableOrValue(), filterMaybe(), valueFromFinishedLoadingState());

  constructor() {
    cleanSubscription(
      dbxFormSourceObservableFromStream(this.form.stream$, this.source$, this.mode$).subscribe((x) => {
        this.form.setValue(x);
      })
    );
  }
}
