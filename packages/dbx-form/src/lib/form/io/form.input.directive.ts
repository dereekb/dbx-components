import { Observable, combineLatest } from 'rxjs';
import { Directive, Host, Input } from '@angular/core';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { DbxForm, DbxFormState, DbxMutableForm } from '../form';
import { distinctUntilChanged, filter, first, map } from 'rxjs/operators';
import { Maybe } from '@dereekb/util';

/**
 * Used with a FormComponent to set the value based on the input value.
 */
@Directive({
  selector: '[dbxFormSource]'
})
export class DbxFormSourceDirective<T extends object = any> extends AbstractSubscriptionDirective {

  constructor(@Host() public readonly form: DbxMutableForm) {
    super();
  }

  /**
   * Sets a LoadingContext that is watched for the loading state.
   */
  @Input('dbxFormSource')
  set obs(obs: Observable<Maybe<Partial<T>>>) {
    this._setObs(obs);
  }

  private _setObs(obs: Observable<Maybe<Partial<T>>>): void {
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
        distinctUntilChanged((x, y) => x === y),
      ).subscribe((x) => {
        this.form.setValue(x);
      });
    }

    this.sub = subscription;
  }

}
