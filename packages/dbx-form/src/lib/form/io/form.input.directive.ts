import { distinctUntilChanged, filter, first, map, switchMap, combineLatest, BehaviorSubject, Observable } from 'rxjs';
import { Directive, Host, Input, OnDestroy } from '@angular/core';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { DbxFormState, DbxMutableForm } from '../form';
import { Maybe } from '@dereekb/util';
import { asObservable, ObservableOrValue } from '@dereekb/rxjs';

export function dbxFormSourceObservable<T>(form: DbxMutableForm, inputObs: ObservableOrValue<T>, mode$: Observable<DbxFormSourceDirectiveMode>): Observable<T> {
  const observable = asObservable(inputObs);

  return combineLatest([
    observable.pipe(distinctUntilChanged()),
    mode$.pipe(distinctUntilChanged())
  ]).pipe(
    switchMap(([value, mode]) => form.stream$.pipe(
      // wait for the form to finish initializing.
      filter((x) => x.state !== DbxFormState.INITIALIZING),
      // if mode is reset, then filter out changes until the form is reset again.
      filter((x) => ((mode === 'reset') ? (x.state === DbxFormState.RESET) : true)),
      first(),
      map(() => value)
    )),
  );
}

/**
 * DbxFormSourceDirective modes that define when to copy data from the source.
 * 
 * - reset: only copy data when the form is reset.
 * - always: always copy data when the data observable emits a value.
 */
export type DbxFormSourceDirectiveMode = 'reset' | 'always';

/**
 * Used with a FormComponent to set the value based on the input value.
 */
@Directive({
  selector: '[dbxFormSource]'
})
export class DbxFormSourceDirective<T extends object = object> extends AbstractSubscriptionDirective implements OnDestroy {

  private _mode = new BehaviorSubject<DbxFormSourceDirectiveMode>('reset');

  constructor(@Host() public readonly form: DbxMutableForm) {
    super();
  }

  @Input('dbxFormSourceMode')
  get mode(): DbxFormSourceDirectiveMode {
    return this._mode.value;
  }

  set mode(mode: DbxFormSourceDirectiveMode) {
    this._mode.next(mode);
  }

  @Input('dbxFormSource')
  set obs(obs: Maybe<ObservableOrValue<Maybe<Partial<T>>>>) {
    this.setObs(obs);
  }

  private setObs(inputObs: Maybe<ObservableOrValue<Maybe<Partial<T>>>>): void {
    let subscription;

    if (inputObs) {
      subscription = dbxFormSourceObservable(this.form, inputObs, this._mode).subscribe((x) => {
        this.form.setValue(x);
      });
    }

    this.sub = subscription;
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._mode.complete();
  }

}
