import { distinctUntilChanged, filter, map, switchMap, combineLatest, Observable, EMPTY, exhaustMap, takeUntil, Subject, tap, shareReplay, throttleTime, Subscription } from 'rxjs';
import { Directive, effect, inject, input } from '@angular/core';
import { DbxFormState, DbxFormStateRef, DbxMutableForm } from '../form';
import { type Maybe } from '@dereekb/util';
import { asObservable, ObservableOrValue, cleanup, errorOnEmissionsInPeriod } from '@dereekb/rxjs';
import { cleanSubscription } from '@dereekb/dbx-core';

export function dbxFormSourceObservable<T>(form: DbxMutableForm, inputObs: ObservableOrValue<T>, modeObs: Observable<DbxFormSourceDirectiveMode>): Observable<T> {
  return dbxFormSourceObservableFromStream(form.stream$, inputObs, modeObs);
}

export function dbxFormSourceObservableFromStream<T>(streamObs: Observable<DbxFormStateRef>, inputObs: ObservableOrValue<T>, modeObs: ObservableOrValue<DbxFormSourceDirectiveMode>): Observable<T> {
  const value$ = asObservable(inputObs).pipe(shareReplay(1)); // catch/share the latest emission

  const state$ = streamObs.pipe(
    map((x) => x.state),
    distinctUntilChanged()
  );

  const mode$ = asObservable(modeObs).pipe(distinctUntilChanged());

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
                tap(([_, send]) => {
                  firstValueSent = true;
                  if (!send) {
                    doneSubject.next(undefined);
                  }
                }),
                filter(([_, send]) => send),
                map(([value, _]) => value),
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
  selector: '[dbxFormSource]',
  standalone: true
})
export class DbxFormSourceDirective<T = unknown> {
  readonly form = inject(DbxMutableForm<T>, { host: true });

  readonly dbxFormSourceMode = input<Maybe<DbxFormSourceDirectiveMode>>();
  readonly dbxFormSource = input<Maybe<ObservableOrValue<Maybe<Partial<T>>>>>();

  protected readonly _effectSub = cleanSubscription();
  protected readonly _setFormSourceObservableEffect = effect(
    () => {
      const formSource = this.dbxFormSource();
      const mode: DbxFormSourceDirectiveMode = this.dbxFormSourceMode() ?? 'reset';

      let subscription: Maybe<Subscription>;

      if (formSource) {
        subscription = dbxFormSourceObservableFromStream(this.form.stream$, formSource, mode).subscribe((x) => {
          this.form.setValue(x);
        });
      }

      this._effectSub.setSub(subscription);
    },
    { allowSignalWrites: true }
  );
}
