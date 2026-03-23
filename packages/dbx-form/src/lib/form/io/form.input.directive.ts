import { combineLatest, distinctUntilChanged, filter, first, map, switchMap, type Observable, EMPTY, exhaustMap, shareReplay, throttleTime, type Subscription } from 'rxjs';
import { Directive, effect, inject, input } from '@angular/core';
import { DbxFormState, type DbxFormStateRef, DbxMutableForm } from '../form';
import { type Maybe } from '@dereekb/util';
import { asObservable, type ObservableOrValue, errorOnEmissionsInPeriod } from '@dereekb/rxjs';
import { cleanSubscription } from '@dereekb/dbx-core';

/**
 * Creates an observable that pipes input values to a form based on the specified mode.
 *
 * This is a convenience wrapper around {@link dbxFormSourceObservableFromStream} that
 * extracts the stream from the form instance.
 *
 * @param form - The mutable form to derive stream state from.
 * @param inputObs - The source observable or value to pipe into the form.
 * @param modeObs - Observable controlling when values are forwarded (reset, always, or every).
 * @returns An observable of values to be set on the form.
 */
export function dbxFormSourceObservable<T>(form: DbxMutableForm, inputObs: ObservableOrValue<T>, modeObs: Observable<DbxFormSourceDirectiveMode>): Observable<T> {
  return dbxFormSourceObservableFromStream(form.stream$, inputObs, modeObs);
}

/**
 * Creates an observable that pipes input values to a form based on the form's stream state and the specified mode.
 *
 * - `'reset'`: Only forwards the value when the form enters the RESET state.
 * - `'always'`: Forwards values while not initializing, with throttling and loop detection.
 * - `'every'`: Forwards values while not initializing, without throttling or loop protection.
 *
 * @param streamObs - Observable of the form's state stream.
 * @param inputObs - The source observable or value to pipe into the form.
 * @param modeObs - Observable or value controlling when values are forwarded.
 * @returns An observable of values to be set on the form.
 */
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
        // Reset mode: forward exactly one value each time the form enters RESET state,
        // then ignore subsequent source changes until the next reset.
        return state$.pipe(
          exhaustMap((state: DbxFormState) => {
            if (state === DbxFormState.RESET) {
              return value$.pipe(first());
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
 * Modes that define when to copy data from the source to the form.
 *
 * - `'reset'`: Only copy data when the form is reset.
 * - `'always'`: Always copy data when the data observable emits a value. Has a throttle of 20ms to prevent too many emissions. If emissions occur in a manner that appears to be a loop (more than 30 emissions in 1 second), then an error is thrown and warning printed to the console.
 * - `'every'`: Equal to always, but has no throttle or error message warning.
 */
export type DbxFormSourceDirectiveMode = 'reset' | 'always' | 'every';

/**
 * Directive that sets a form's value based on an input observable or value source.
 *
 * Supports different modes for when the value is forwarded to the form:
 * - `'reset'` (default): Only sets the form value when the form is reset.
 * - `'always'`: Sets the form value on every emission, with throttling and loop detection.
 * - `'every'`: Sets the form value on every emission, without throttling.
 *
 * @selector `[dbxFormSource]`
 *
 * @typeParam T - The form value type.
 */
@Directive({
  selector: '[dbxFormSource]',
  standalone: true
})
export class DbxFormSourceDirective<T = unknown> {
  readonly form = inject(DbxMutableForm<T>, { host: true });

  /**
   * The mode controlling when the source value is forwarded to the form.
   */
  readonly dbxFormSourceMode = input<Maybe<DbxFormSourceDirectiveMode>>();

  /**
   * The source value or observable to pipe into the form.
   */
  readonly dbxFormSource = input<Maybe<ObservableOrValue<Maybe<Partial<T>>>>>();

  protected readonly _effectSub = cleanSubscription();
  protected readonly _setFormSourceObservableEffect = effect(() => {
    const formSource = this.dbxFormSource();
    const mode: DbxFormSourceDirectiveMode = this.dbxFormSourceMode() ?? 'reset';

    let subscription: Maybe<Subscription>;

    if (formSource) {
      // Guard against the feedback loop where setValue() calls resetForm() internally,
      // which triggers a new RESET state on stream$, causing another value to be forwarded.
      // The flag is set before setValue and cleared on the next microtask, so the synchronous
      // stream$ emissions from the feedback reset are filtered out.
      let isSettingValue = false;
      const guardedStream$ = this.form.stream$.pipe(filter(() => !isSettingValue));

      subscription = dbxFormSourceObservableFromStream(guardedStream$, formSource, mode).subscribe((x) => {
        isSettingValue = true;
        this.form.setValue(x);
        Promise.resolve().then(() => (isSettingValue = false));
      });
    }

    this._effectSub.setSub(subscription);
  });
}
