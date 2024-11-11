import { distinctUntilChanged, filter, map, switchMap, combineLatest, BehaviorSubject, Observable, EMPTY, exhaustMap, takeUntil, Subject, tap, shareReplay, throttleTime } from 'rxjs';
import { Directive, Host, Input, OnDestroy, inject } from '@angular/core';
import { AbstractSubscriptionDirective } from '@dereekb/dbx-core';
import { DbxFormState, DbxFormStateRef, DbxMutableForm } from '../form';
import { Maybe } from '@dereekb/util';
import { asObservable, ObservableOrValue, cleanup, errorOnEmissionsInPeriod } from '@dereekb/rxjs';

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
              let valueObs = value$;

              if (mode === 'always') {
                valueObs = valueObs.pipe(
                  throttleTime(10, undefined, { leading: true, trailing: true }),
                  errorOnEmissionsInPeriod({
                    period: 1000,
                    maxEmissionsPerPeriod: 50,
                    onError: () => {
                      console.error('dbxFormSourceObservableFromStream: Error thrown due to too many emissions. There may be an unintentional loop being triggered by dbxFormSource. Typically this can occur in cases where the dbxFormSource directive is used at the same time as dbxFormValueChange directive and the same value is being pushed.');
                    }
                  })
                );
              }

              return valueObs;
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
 * - always: always copy data when the data observable emits a value. Has a throttle of 20ms to prevent too many emissions. If emissions occur in a manner that appears to be a loop (more than 30 emissions in 1 second), then an error is thrown and warning printed to the console.
 * - every: equal to always, but has no throttle or error message warning.
 */
export type DbxFormSourceDirectiveMode = 'reset' | 'always' | 'every';

/**
 * Used with a FormComponent to set the value based on the input value.
 */
@Directive({
  selector: '[dbxFormSource]'
})
export class DbxFormSourceDirective<T> extends AbstractSubscriptionDirective implements OnDestroy {
  readonly form = inject(DbxMutableForm<T>, { host: true });

  private _mode = new BehaviorSubject<DbxFormSourceDirectiveMode>('reset');

  constructor() {
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
