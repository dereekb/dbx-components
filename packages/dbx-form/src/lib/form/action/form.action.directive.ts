import { Directive, OnInit, inject, input } from '@angular/core';
import { addSeconds, isPast } from 'date-fns';
import { Observable, of, combineLatest, exhaustMap, catchError, delay, filter, first, map, switchMap, distinctUntilChanged, shareReplay } from 'rxjs';
import { DbxActionContextStoreSourceInstance, DbxActionValueGetterResult, cleanLockSet } from '@dereekb/dbx-core';
import { SubscriptionObject, IsModifiedFunction, IsValidFunction, ObservableOrValue, asObservable, IsEqualFunction, makeIsModifiedFunctionObservable } from '@dereekb/rxjs';
import { DbxFormState, DbxMutableForm } from '../../form/form';
import { IsModified, IsValid, MapFunction, Maybe } from '@dereekb/util';
import { toObservable } from '@angular/core/rxjs-interop';

export const APP_ACTION_FORM_DISABLED_KEY = 'dbx_action_form';

export type DbxActionFormMapValueFunction<T, O> = MapFunction<T, ObservableOrValue<DbxActionValueGetterResult<O>>>;

/**
 * Used with an action to bind a form to an action as it's value source.
 *
 * If the form has errors when the action is trigger, it will reject the action.
 *
 * If the source is not considered modified, the trigger will be ignored.
 */
@Directive({
  selector: '[dbxActionForm]',
  standalone: true
})
export class DbxActionFormDirective<T = object, O = T> implements OnInit {
  readonly form = inject(DbxMutableForm<T>, { host: true });
  readonly source = inject(DbxActionContextStoreSourceInstance<O, unknown>);

  readonly lockSet = cleanLockSet({
    onDestroy: () => {
      this.source.enable(APP_ACTION_FORM_DISABLED_KEY);
    },
    onLockSetDestroy: () => {
      this._triggeredSub.destroy();
      this._isCompleteSub.destroy();
      this._isWorkingSub.destroy();
      this.form.setDisabled(APP_ACTION_FORM_DISABLED_KEY, false);
    }
  });

  /**
   * Whether or not to disable the form while the action is working.
   *
   * Defaults to true.
   */
  readonly dbxActionFormDisabledOnWorking = input<Maybe<boolean>>(true);

  /**
   * Optional validator that checks whether or not the value is
   * ready to send before the context store is marked enabled.
   */
  readonly dbxActionFormIsValid = input<Maybe<IsValidFunction<T>>>();

  /**
   * Optional function that checks whether or not the value is still the same/equal.
   */
  readonly dbxActionFormIsEqual = input<Maybe<IsEqualFunction<T>>>();

  /**
   * Optional function that checks whether or not the value has been modified.
   *
   * If dbxActionFormIsEqual is provided, this will be ignored.
   */
  readonly dbxActionFormIsModified = input<Maybe<IsModifiedFunction<T>>>();

  /**
   * Optional function that maps the form's value to the source's value.
   */
  readonly dbxActionFormMapValue = input<Maybe<DbxActionFormMapValueFunction<T, O>>>();

  readonly dbxActionFormDisabledOnWorking$ = toObservable(this.dbxActionFormDisabledOnWorking);

  readonly isValidFunction$ = toObservable(this.dbxActionFormIsValid).pipe(
    map((x) => x ?? (() => of(true))),
    shareReplay(1)
  );
  readonly isModifiedFunction$: Observable<IsModifiedFunction<T>> = makeIsModifiedFunctionObservable({
    isModified: toObservable(this.dbxActionFormIsModified),
    isEqual: toObservable(this.dbxActionFormIsEqual)
  }).pipe(shareReplay(1));

  readonly mapValueFunction$: Observable<Maybe<DbxActionFormMapValueFunction<T, O>>> = toObservable(this.dbxActionFormMapValue);

  private readonly _triggeredSub = new SubscriptionObject();
  private readonly _isCompleteSub = new SubscriptionObject();
  private readonly _isWorkingSub = new SubscriptionObject();

  constructor() {
    if (this.form.lockSet) {
      this.lockSet.addChildLockSet(this.form.lockSet, 'form');
    }

    this.lockSet.addChildLockSet(this.source.lockSet, 'source');
  }

  ngOnInit(): void {
    // Pass data from the form to the source when triggered.
    this._triggeredSub.subscription = this.source.triggered$
      .pipe(
        switchMap(() =>
          this.form.stream$.pipe(
            first(),
            exhaustMap((stream) => {
              const { isComplete } = stream;
              const doNothing = {}; // nothing, form not complete

              let obs: Observable<DbxActionValueGetterResult<O>>;

              if (isComplete) {
                obs = this.form.getValue().pipe(
                  first(),
                  exhaustMap((value) =>
                    this.preCheckReadyValue(value).pipe(
                      first(),
                      switchMap((canContinue) => {
                        if (canContinue) {
                          return this.readyValue(value).pipe(first());
                        } else {
                          return of(doNothing);
                        }
                      }),
                      catchError((error) => of({ reject: error }))
                    )
                  )
                );
              } else {
                obs = of(doNothing);
              }

              return obs;
            })
          )
        )
      )
      .subscribe((result: DbxActionValueGetterResult<O>) => {
        if (result.reject) {
          this.source.reject(result.reject);
        } else if (result.value != null) {
          this.source.readyValue(result.value);
        } else {
          // value isn't ready
        }
      });

    // Update the enabled/disabled state
    this._isCompleteSub.subscription = this.form.stream$
      .pipe(
        delay(0),
        filter((x) => x.state !== DbxFormState.INITIALIZING),
        switchMap((event) => {
          return this.form.getValue().pipe(
            first(),
            exhaustMap((value) => {
              // Use both changes count and whether or not something was in the past to guage whether or not the item has been touched.
              // Angular Form's untouched is whether or not focus has been lost but we can still receive value updates.
              // More than a certain amount of updates implies that it is being typed into/used.
              // 3 changes and 2 seconds are arbitrary values derived from guesses about any slow/late changes that may come from external directives for setup.
              const isProbablyTouched = !event.untouched || ((event.changesCount ?? 0) > 3 && isPast(addSeconds(event.lastResetAt ?? new Date(), 2)));

              // create overrides
              const returnFalseFunction = () => of(false);

              const runIsValidCheck = event.isComplete;
              const isValidFunction: Maybe<IsValidFunction<T>> = runIsValidCheck ? undefined : returnFalseFunction;

              const isConsideredModified = event.pristine === false && isProbablyTouched;
              const isModifiedFunction: Maybe<IsModifiedFunction<T>> = isConsideredModified ? undefined : returnFalseFunction;

              return this.checkIsValidAndIsModified(value, { isValidFunction, isModifiedFunction }).pipe(
                map(([valid, modified]: [boolean, boolean]) => ({ valid, modified, value, event })),
                first()
              );
            })
          );
        })
      )
      .subscribe(({ valid, modified /*, value, event */ }) => {
        // console.log('x: ', value, event, valid, modified);

        // Update Modified State
        this.source.setIsModified(modified);

        // Disable if the form is not yet complete/valid.
        this.source.enable(APP_ACTION_FORM_DISABLED_KEY, valid);
      });

    // Watch the working state and disable form while working
    this._isWorkingSub.subscription = combineLatest([this.source.isWorking$, this.dbxActionFormDisabledOnWorking$])
      .pipe(
        map(([isWorking, disableFormWhileWorking]: [boolean, Maybe<boolean>]) => disableFormWhileWorking !== false && isWorking),
        distinctUntilChanged()
      )
      .subscribe((disable) => {
        this.form.setDisabled(APP_ACTION_FORM_DISABLED_KEY, disable);
      });
  }

  checkIsValidAndIsModified(value: T, overrides?: CheckValidAndModifiedOverrides<T>): Observable<[IsValid, IsModified]> {
    const { isModifiedFunction: overrideIsModifiedFunction, isValidFunction: overrideIsValidFunction } = overrides ?? {};
    const isValidFunctionObs = overrideIsValidFunction != null ? of(overrideIsValidFunction) : this.isValidFunction$;
    const isModifiedFunctionObs = overrideIsModifiedFunction != null ? of(overrideIsModifiedFunction) : this.isModifiedFunction$;

    return combineLatest([isValidFunctionObs, isModifiedFunctionObs]).pipe(
      switchMap(([isValid, isModified]) => {
        return combineLatest([isValid(value), isModified(value)]).pipe(map(([valid, modified]) => [valid, modified] as [boolean, boolean]));
      })
    );
  }

  protected preCheckReadyValue(value: T): Observable<[IsValid, IsModified]> {
    return this.checkIsValidAndIsModified(value);
  }

  protected readyValue(value: T): Observable<DbxActionValueGetterResult<O>> {
    return this.mapValueFunction$.pipe(
      switchMap((mapFunction) => {
        if (mapFunction) {
          return asObservable(mapFunction(value));
        } else {
          return of({ value: value as unknown as O });
        }
      })
    );
  }
}

interface CheckValidAndModifiedOverrides<T> {
  isModifiedFunction?: Maybe<IsModifiedFunction<T>>;
  isValidFunction?: Maybe<IsValidFunction<T>>;
}
