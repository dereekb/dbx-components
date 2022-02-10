import { Observable, combineLatest } from 'rxjs';
import { Directive, Host, Input } from '@angular/core';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { DbxFormState, DbxMutableForm } from '../../form/form';
import { LoadingState } from '@dereekb/rxjs';
import { distinctUntilChanged, filter, first, map } from 'rxjs/operators';

/**
 * Used with a FormComponent to set the value from a LoadingState when the value is available.
 */
@Directive({
  selector: '[dbxFormLoadingSource]'
})
export class DbxFormLoadingSourceDirective<T extends object = any> extends AbstractSubscriptionDirective {

  constructor(@Host() public readonly form: DbxMutableForm) {
    super();
  }

  /**
   * Sets a LoadingContext that is watched for the loading state.
   */
  @Input('dbxFormLoadingSource')
  set obs(obs: Observable<LoadingState<T>>) {
    this._setObs(obs);
  }

  private _setObs(obs: Observable<LoadingState<T>>): void {
    let subscription;

    if (obs) {
      subscription = combineLatest([
        // Emit the first time initializing isn't there.
        this.form.stream$.pipe(
          filter((x) => x.state !== DbxFormState.INITIALIZING),
          first()
        ),
        obs
      ]).pipe(
        map((x) => x[1]),
        filter((x) => Boolean(x)),
        distinctUntilChanged((x, y) => x.value === y.value),
      ).subscribe((x) => {
        if (!x.error && !x.loading) {
          // console.log('Setting value: ', x.model);
          this.form.setValue(x.value);
        }
      });
    }

    this.sub = subscription;
  }

}
