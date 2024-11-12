import { Directive, OnInit, OnDestroy, Input, inject } from '@angular/core';
import { addSeconds, isPast } from 'date-fns';
import { Observable, of, combineLatest, exhaustMap, catchError, delay, filter, first, map, switchMap, BehaviorSubject, distinctUntilChanged } from 'rxjs';
import { DbxActionContextStoreSourceInstance, DbxActionValueOnTriggerResult } from '@dereekb/dbx-core';
import { SubscriptionObject, LockSet, IsModifiedFunction, IsValidFunction, ObservableOrValue, asObservable } from '@dereekb/rxjs';
import { DbxFormState, DbxMutableForm } from '../../form/form';
import { MapFunction } from '@dereekb/util';

export const APP_ACTION_FORM_DISABLED_KEY = 'dbx_action_form';

export type DbxActionFormMapValueFunction<T, O> = MapFunction<T, ObservableOrValue<DbxActionValueOnTriggerResult<O>>>;

/**
 * Used with an action to bind a form to an action as it's value source.
 *
 * If the form has errors when the action is trigger, it will reject the action.
 *
 * If the source is not considered modified, the trigger will be ignored.
 */
@Directive({
  selector: '[dbxActionForm]'
})
export class DbxActionFormDirective<T = object, O = T> implements OnInit, OnDestroy {
  readonly form = inject(DbxMutableForm<T>, { host: true });
  readonly source = inject(DbxActionContextStoreSourceInstance<O, unknown>);

  readonly lockSet = new LockSet();

  /**
   * Optional validator that checks whether or not the value is
   * ready to send before the context store is marked enabled.
   */
  @Input()
  dbxActionFormValidator?: IsValidFunction<T>;

  /**
   * Optional function that checks whether or not the value has been modified.
   */
  @Input()
  dbxActionFormModified?: IsModifiedFunction<T>;

  /**
   * Optional function that maps the form's value to the source's value.
   */
  @Input()
  dbxActionFormMapValue?: DbxActionFormMapValueFunction<T, O>;

  private _formDisabledWhileWorking = new BehaviorSubject<boolean>(true);

  private _triggeredSub = new SubscriptionObject();
  private _isCompleteSub = new SubscriptionObject();
  private _isWorkingSub = new SubscriptionObject();

  constructor() {
    if (this.form.lockSet) {
      this.lockSet.addChildLockSet(this.form.lockSet, 'form');
    }

    this.lockSet.addChildLockSet(this.source.lockSet, 'source');
  }

  @Input()
  get formDisabledOnWorking() {
    return this._formDisabledWhileWorking.value;
  }

  set formDisabledOnWorking(formDisabledOnWorking: boolean) {
    this._formDisabledWhileWorking.next(Boolean(formDisabledOnWorking ?? true));
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

              let obs: Observable<DbxActionValueOnTriggerResult<O>>;

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
      .subscribe((result: DbxActionValueOnTriggerResult<O>) => {
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

              let validatorObs: Observable<boolean>;

              const initialIsValidCheck = event.isComplete;
              if (initialIsValidCheck) {
                validatorObs = this.dbxActionFormValidator ? this.dbxActionFormValidator(value) : of(true);
              } else {
                validatorObs = of(false);
              }

              let modifiedObs: Observable<boolean>;

              const isConsideredModified = event.pristine === false && isProbablyTouched;
              if (isConsideredModified) {
                modifiedObs = this.dbxActionFormModified ? this.dbxActionFormModified(value) : of(true);
              } else {
                modifiedObs = of(false);
              }

              return combineLatest([validatorObs, modifiedObs]).pipe(
                first(),
                map(([valid, modified]: [boolean, boolean]) => ({ valid, modified, value, event }))
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
    this._isWorkingSub.subscription = combineLatest([this.source.isWorking$, this._formDisabledWhileWorking])
      .pipe(
        map(([isWorking, lockOnWorking]: [boolean, boolean]) => lockOnWorking && isWorking),
        distinctUntilChanged()
      )
      .subscribe((disable) => {
        this.form.setDisabled(APP_ACTION_FORM_DISABLED_KEY, disable);
      });
  }

  ngOnDestroy(): void {
    this.source.enable(APP_ACTION_FORM_DISABLED_KEY);
    this.lockSet.destroyOnNextUnlock(() => {
      this._triggeredSub.destroy();
      this._isCompleteSub.destroy();
      this._isWorkingSub.destroy();
      this._formDisabledWhileWorking.complete();
      this.form.setDisabled(APP_ACTION_FORM_DISABLED_KEY, false);
    });
  }

  protected preCheckReadyValue(value: T): Observable<boolean> {
    const validatorObs: Observable<boolean> = this.dbxActionFormValidator ? this.dbxActionFormValidator(value) : of(true);
    const modifiedObs: Observable<boolean> = this.dbxActionFormModified ? this.dbxActionFormModified(value) : of(true);

    return combineLatest([validatorObs, modifiedObs]).pipe(
      first(),
      map(([valid, modified]: [boolean, boolean]) => valid && modified)
    );
  }

  protected readyValue(value: T): Observable<DbxActionValueOnTriggerResult<O>> {
    if (this.dbxActionFormMapValue) {
      return asObservable(this.dbxActionFormMapValue(value));
    } else {
      return of({ value: value as unknown as O });
    }
  }
}
