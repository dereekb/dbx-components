import { Observable, combineLatest } from 'rxjs';
import { Directive, Host, Input } from '@angular/core';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { DbxForm, DbxFormState, DbxMutableForm } from '../form';
import { distinctUntilChanged, filter, first, map } from 'rxjs/operators';
import { Maybe } from '@dereekb/util';
import { asObservable, ObservableOrValue } from '@dereekb/rxjs';

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

  @Input('dbxFormSource')
  set obs(obs: Maybe<ObservableOrValue<Maybe<Partial<T>>>>) {
    this.setObs(obs);
  }

  private setObs(obs: Maybe<ObservableOrValue<Maybe<Partial<T>>>>): void {
    let subscription;

    if (obs) {
      const observable = asObservable(obs);

      subscription = combineLatest([
        // Emit the first time initializing isn't there.
        this.form.stream$.pipe(
          filter((x) => x.state !== DbxFormState.INITIALIZING),
          first()
        ),
        observable
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
