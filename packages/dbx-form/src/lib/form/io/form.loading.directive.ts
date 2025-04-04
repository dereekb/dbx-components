import { Subscription } from 'rxjs';
import { Directive, OnDestroy, effect, inject, input } from '@angular/core';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { DbxMutableForm } from '../../form/form';
import { ObservableOrValue, isLoadingStateFinishedLoading } from '@dereekb/rxjs';
import { dbxFormSourceObservableFromStream, DbxFormSourceDirectiveMode } from './form.input.directive';
import { Maybe } from '@dereekb/util';

/**
 * Used with a FormComponent to set the value from a LoadingState when the value is available.
 */
@Directive({
  selector: '[dbxFormLoadingSource]',
  standalone: true
})
export class DbxFormLoadingSourceDirective<T extends object = object> extends AbstractSubscriptionDirective implements OnDestroy {
  readonly form = inject(DbxMutableForm<T>, { host: true });

  readonly dbxFormLoadingSourceMode = input<Maybe<DbxFormSourceDirectiveMode>>();
  readonly dbxFormLoadingSource = input<Maybe<ObservableOrValue<Maybe<Partial<T>>>>>();

  protected readonly _setFormSourceObservableEffect = effect(() => {
    const formSource = this.dbxFormLoadingSource();
    const mode: DbxFormSourceDirectiveMode = this.dbxFormLoadingSourceMode() ?? 'reset';

    let subscription: Maybe<Subscription>;

    if (formSource) {
      subscription = dbxFormSourceObservableFromStream(this.form.stream$, formSource, mode).subscribe((x) => {
        if (isLoadingStateFinishedLoading(x)) {
          this.form.setValue(x);
        }
      });
    }

    this.sub = subscription;
  });
}
