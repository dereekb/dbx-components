import { Directive, Host, OnInit, OnDestroy, Input } from '@angular/core';
import { addSeconds, isPast } from 'date-fns';
import { Observable, of, combineLatest, exhaustMap } from 'rxjs';
import { catchError, filter, first, map, switchMap } from 'rxjs/operators';
import { ActionContextStoreSourceInstance } from '@dereekb/dbx-core';
import { ReadableError } from '@dereekb/util';
import { SubscriptionObject, LockSet } from '@dereekb/rxjs';
import { DbxForm, DbxFormState } from '../../form/form';

export interface DbxActionFormTriggerResult {
  value?: any;
  reject?: ReadableError;
}

export type DbxActionFormValidateFn<T = any> = (value: T) => Observable<boolean>;
export type DbxActionFormModifiedFn<T = any> = (value: T) => Observable<boolean>;

export const APP_ACTION_FORM_DISABLED_KEY = 'actionForm';

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
export class DbxActionFormDirective<T = any> implements OnInit, OnDestroy {

  readonly lockSet = new LockSet();

  /**
   * Optional validator that checks whether or not the value is
   * ready to send before the context store is marked enabled.
   */
  @Input()
  appActionFormValidator?: DbxActionFormValidateFn<T>;

  /**
   * Optional function that checks whether or not the value has been modified.
   */
  @Input()
  appActionFormModified?: DbxActionFormModifiedFn<T>;

  private _triggeredSub = new SubscriptionObject();
  private _isCompleteSub = new SubscriptionObject();

  constructor(@Host() public readonly form: DbxForm, public readonly source: ActionContextStoreSourceInstance<object, any>) {
    if (form.lockSet) {
      this.lockSet.addChildLockSet(form.lockSet, 'form');
    }

    this.lockSet.addChildLockSet(source.lockSet, 'source');
  }

  ngOnInit(): void {

    // Pass data from the form to the source when triggered.
    this._triggeredSub.subscription = this.source.triggered$.pipe(
      switchMap(() => this.form.stream$.pipe(
        first(),
        exhaustMap(({ isComplete }) => {
          const doNothing = {}; // nothing, form not complete

          let obs: Observable<DbxActionFormTriggerResult>;

          if (isComplete) {
            obs = this.form.getValue().pipe(
              first(),
              exhaustMap((value) => this.preCheckReadyValue(value).pipe(
                first(),
                switchMap((canContinue) => {
                  if (canContinue) {
                    return this.readyValue(value).pipe(first());
                  } else {
                    return of(doNothing);
                  }
                }),
                catchError((error) => of({ error } as DbxActionFormTriggerResult))
              )));
          } else {
            obs = of(doNothing);
          }

          return obs;
        })))
    ).subscribe((result: DbxActionFormTriggerResult) => {
      if (result.reject) {
        this.source.reject(result.reject);
      } else if (result.value != null) {
        this.source.readyValue(result.value);
      } else {
        // value isn't ready
      }
    });

    // Update the enabled/disabled state
    this._isCompleteSub.subscription = this.form.stream$.pipe(
      filter((x) => x.state !== DbxFormState.INITIALIZING),
      switchMap((event) => {
        return this.form.getValue().pipe(
          first(),
          exhaustMap((value) => {

            // Use both changes count and whether or not something was in the past to guage whether or not the item has been touched.
            // Angular Form's untouched is whether or not focus has been lost but we can still recieve value updates.
            // More than a certain amount of updates implies that it is being typed into.
            const isProbablyTouched = !event.untouched ||
              ((event.changesCount ?? 0) > 3 && isPast(addSeconds(event.lastResetAt ?? new Date(), 2)));

            let validatorObs: Observable<boolean>;

            const initialIsValidCheck = event.isComplete;
            if (initialIsValidCheck) {
              validatorObs = (this.appActionFormValidator) ? this.appActionFormValidator(value) : of(true);
            } else {
              validatorObs = of(false);
            }

            let modifiedObs: Observable<boolean>;

            const isConsideredModified = (event.pristine === false && isProbablyTouched);
            if (isConsideredModified) {
              modifiedObs = (this.appActionFormModified) ? this.appActionFormModified(value) : of(true);
            } else {
              modifiedObs = of(false);
            }

            return combineLatest([
              validatorObs,
              modifiedObs
            ]).pipe(
              first(),
              map(([valid, modified]: [boolean, boolean]) => ({ valid, modified, value, event }))
            )
          }));
      })
    ).subscribe(({ valid, modified, value, event }) => {

      console.log('x: ', value, event, valid, modified);

      // Update Modified State
      this.source.setIsModified(modified);

      // Disable if the form is not yet complete/valid.
      this.source.enable(APP_ACTION_FORM_DISABLED_KEY, valid);
    });

    // TODO: Watch the working state and stop allowing input on working..?
    // TODO: Watch the disabled state for when another disabled key disables this form.
  }

  ngOnDestroy(): void {
    this.source.enable(APP_ACTION_FORM_DISABLED_KEY);
    this.lockSet.destroyOnNextUnlock(() => {
      this._triggeredSub.destroy();
      this._isCompleteSub.destroy();
    });
  }

  protected preCheckReadyValue(value: T): Observable<boolean> {
    let validatorObs: Observable<boolean> = (this.appActionFormValidator) ? this.appActionFormValidator(value) : of(true);
    let modifiedObs: Observable<boolean> = (this.appActionFormModified) ? this.appActionFormModified(value) : of(true);

    return combineLatest([
      validatorObs,
      modifiedObs
    ]).pipe(
      first(),
      map(([valid, modified]: [boolean, boolean]) => valid && modified)
    );
  }

  protected readyValue(value: T): Observable<DbxActionFormTriggerResult> {
    return of({ value });
  }

}
