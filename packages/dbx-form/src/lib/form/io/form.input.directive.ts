import { distinctUntilChanged, filter, map, switchMap, combineLatest, BehaviorSubject, Observable, EMPTY, exhaustMap, takeUntil, Subject, tap, shareReplay } from 'rxjs';
import { Directive, Host, Input, OnDestroy } from '@angular/core';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { DbxFormState, DbxFormStateRef, DbxMutableForm } from '../form';
import { Maybe } from '@dereekb/util';
import { asObservable, ObservableOrValue, cleanup } from '@dereekb/rxjs';

export function dbxFormSourceObservable<T>(form: DbxMutableForm, inputObs: ObservableOrValue<T>, mode$: Observable<DbxFormSourceDirectiveMode>): Observable<T> {
  return dbxFormSourceObservableFromStream(form.stream$, inputObs, mode$);
}

export function dbxFormSourceObservableFromStream<T>(stream$: Observable<DbxFormStateRef>, inputObs: ObservableOrValue<T>, mode$: Observable<DbxFormSourceDirectiveMode>): Observable<T> {
  const value$ = asObservable(inputObs).pipe(shareReplay(1)); // catch/share the latest emission

  const state$ = stream$.pipe(
    map((x) => x.state),
    distinctUntilChanged()
  );

  return combineLatest([mode$, value$]).pipe(
    map((x) => x[0]),
    distinctUntilChanged(),
    switchMap((mode: DbxFormSourceDirectiveMode) => {
      if (mode === 'reset') {
        // reset only
        return state$.pipe(
          exhaustMap((state: DbxFormState) => {
            if (state === DbxFormState.RESET) {
              let firstValueSent = false;
              const doneSubject = new Subject();

              return combineLatest([value$, state$]).pipe(
                map(([value, state]) => {
                  if (!firstValueSent || state === DbxFormState.RESET) {
                    return [value, true] as [T, boolean]; // always forward the first value.
                  } else {
                    return [value, false] as [T, boolean];
                  }
                }),
                tap(([value, send]) => {
                  firstValueSent = true;
                  if (!send) {
                    doneSubject.next(undefined);
                  }
                }),
                filter(([value, send]) => send),
                map((x) => x[0]),
                takeUntil(doneSubject),
                cleanup(() => {
                  doneSubject.complete();
                })
              );
            } else {
              return EMPTY;
            }
          })
        );
      } else {
        // pass any updated value while not initializing.
        return state$.pipe(
          map((x) => x === DbxFormState.INITIALIZING),
          distinctUntilChanged(),
          switchMap((initializing: boolean) => {
            if (initializing) {
              return EMPTY;
            } else {
              return value$;
            }
          })
        );
      }
    })
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
export class DbxFormSourceDirective<T> extends AbstractSubscriptionDirective implements OnDestroy {
  private _mode = new BehaviorSubject<DbxFormSourceDirectiveMode>('reset');

  constructor(@Host() public readonly form: DbxMutableForm<T>) {
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
      subscription = dbxFormSourceObservableFromStream(this.form.stream$, inputObs, this._mode).subscribe((x) => {
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
