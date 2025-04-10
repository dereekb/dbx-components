import { Observable } from 'rxjs';
import { Directive, OnDestroy, inject, input } from '@angular/core';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { DbxMutableForm } from '../../form/form';
import { LoadingState, MaybeObservableOrValue, filterMaybe, maybeValueFromObservableOrValue, valueFromFinishedLoadingState } from '@dereekb/rxjs';
import { dbxFormSourceObservableFromStream, DbxFormSourceDirectiveMode } from './form.input.directive';
import { Maybe } from '@dereekb/util';
import { toObservable } from '@angular/core/rxjs-interop';

const DEFAULT_DBX_FORM_LOADING_SOURCE_DIRECTIVE_MODE: DbxFormSourceDirectiveMode = 'reset';

/**
 * Used with a FormComponent to set the value from a LoadingState when the value is available.
 *
 * Only passes non-null values from the source.
 */
@Directive({
  selector: '[dbxFormLoadingSource]',
  standalone: true
})
export class DbxFormLoadingSourceDirective<T extends object = object> extends AbstractSubscriptionDirective implements OnDestroy {
  readonly form = inject(DbxMutableForm<T>, { host: true });

  readonly dbxFormLoadingSourceMode = input<DbxFormSourceDirectiveMode, Maybe<DbxFormSourceDirectiveMode>>(DEFAULT_DBX_FORM_LOADING_SOURCE_DIRECTIVE_MODE, { transform: (x) => x ?? DEFAULT_DBX_FORM_LOADING_SOURCE_DIRECTIVE_MODE });
  readonly dbxFormLoadingSource = input<MaybeObservableOrValue<LoadingState<T>>>();

  readonly mode$ = toObservable(this.dbxFormLoadingSourceMode);
  readonly source$: Observable<Maybe<T>> = toObservable(this.dbxFormLoadingSource).pipe(maybeValueFromObservableOrValue(), filterMaybe(), valueFromFinishedLoadingState());

  constructor() {
    super();
    this.sub = dbxFormSourceObservableFromStream(this.form.stream$, this.source$, this.mode$).subscribe((x) => {
      this.form.setValue(x);
    });
  }
}
