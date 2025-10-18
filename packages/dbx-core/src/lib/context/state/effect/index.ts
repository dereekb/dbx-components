import { type OnRunEffects, Actions, type EffectNotification, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { type Observable, exhaustMap, filter, takeUntil } from 'rxjs';
import { type DbxAppContextState } from '../../context';
import { onDbxAppContext } from '../';
import { type IterableOrValue, iterableToSet } from '@dereekb/util';
import { inject } from '@angular/core';

// MARK: Abstract Context Effects
/**
 * Abstract effects class that only runs/allows effects when the DbxAppContextState in the ngrx state matches input activeState value.
 */
export abstract class AbstractOnDbxAppContextStateEffects<S = unknown> implements OnRunEffects {
  protected readonly actions$ = inject(Actions);
  protected readonly store = inject(Store<S>);

  /**
   * The set of state(s) to activate on.
   */
  private _activeStatesSet: Set<DbxAppContextState>;

  constructor(activeStates: IterableOrValue<DbxAppContextState>) {
    this._activeStatesSet = iterableToSet(activeStates);
  }

  /**
   * Configures all actions of the sub-class to only activate when the DbxAppContextState in App
   *
   * @param resolvedEffects$
   * @returns
   */
  ngrxOnRunEffects(resolvedEffects$: Observable<EffectNotification>): Observable<EffectNotification> {
    return this.actions$.pipe(
      ofType(onDbxAppContext.DbxAppContextActions.setState),
      filter(({ state }) => {
        return this._activeStatesSet.has(state);
      }),
      exhaustMap(() =>
        resolvedEffects$.pipe(
          takeUntil(
            this.actions$.pipe(
              ofType(onDbxAppContext.DbxAppContextActions.setState),
              filter(({ state }) => !this._activeStatesSet.has(state))
            )
          )
        )
      )
    );
  }
}
