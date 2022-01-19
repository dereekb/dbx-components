import { Observable, combineLatest } from 'rxjs';
import { Directive, Host, Input } from '@angular/core';
import { AbstractSubscriptionDirective } from '@dereekb/ngx-core';
import { DbNgxForm, DbNgxFormState } from '../form/form';
import { distinctUntilChanged, filter, first, map } from 'rxjs/operators';

/**
 * Used with a FormComponent to set the value based on the input value.
 */
@Directive({
  selector: '[dbxFormSource]'
})
export class DbNgxFormSourceDirective<T extends object = any> extends AbstractSubscriptionDirective {

  constructor(@Host() public readonly form: DbNgxForm) {
    super();
  }

  /**
   * Sets a LoadingContext that is watched for the loading state.
   */
  @Input('dbxFormSource')
  set obs(obs: Observable<T>) {
    this._setObs(obs);
  }

  private _setObs(obs: Observable<T>): void {
    let subscription;

    if (obs) {
      subscription = combineLatest([
        // Emit the first time initializing isn't there.
        this.form.stream$.pipe(
          filter((x) => x.state !== DbNgxFormState.INITIALIZING),
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
