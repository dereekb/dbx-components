import { OnRunEffects, Actions, EffectNotification, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { Observable, exhaustMap, filter, takeUntil } from 'rxjs';
import { DbxAppContextState } from '../../context';
import { onDbxAppContext } from '../';
import { ArrayOrValue } from '@dereekb/util';

// MARK: Abstract Context Effects
/**
 * Abstract effects class that only runs/allows effects when the DbxAppContextState in the ngrx state matches input activeState value.
 */
export abstract class AbstractOnDbxAppContextStateEffects<S = unknown> implements OnRunEffects {
  private _activeStatesSet: Set<DbxAppContextState>;

  constructor(
    /**
     * The state(s) to activate on.
     */
    activeStates: ArrayOrValue<DbxAppContextState>,
    /**
     * ngrx Actions
     */
    protected readonly actions$: Actions,
    /**
     * ngrx Store
     */
    protected readonly store: Store<S>
  ) {
    this._activeStatesSet = new Set(activeStates);
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
