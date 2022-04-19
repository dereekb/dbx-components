import { OnRunEffects, Actions, EffectNotification, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { exhaustMap, filter, takeUntil } from 'rxjs/operators';
import { DbxAppContextState } from '../../context';
import { onDbxAppContext } from '../';

// MARK: Abstract Context Effects
/**
 * Abstract effects class that only runs/allows effects when the DbxAppContextState in the ngrx state matches input activeState value.
 */
export abstract class AbstractOnDbxAppContextStateEffects<S> implements OnRunEffects {

  constructor(
    /**
     * The state to activate on.
     */
    private readonly activeState: DbxAppContextState,
    /**
     * ngrx Actions
     */
    protected readonly actions$: Actions,
    /**
     * ngrx Store
     */
    protected readonly store: Store<S>
  ) { }

  /**
   * Configures all actions of the sub-class to only activate when the DbxAppContextState in App
   * 
   * @param resolvedEffects$ 
   * @returns 
   */
  ngrxOnRunEffects(resolvedEffects$: Observable<EffectNotification>): Observable<EffectNotification> {
    return this.actions$.pipe(
      ofType(onDbxAppContext.DbxAppContextActions.dbxAppContextSetState),
      filter((x) => x.state === this.activeState),
      exhaustMap(() =>
        resolvedEffects$.pipe(
          takeUntil(
            this.actions$.pipe(
              ofType(onDbxAppContext.DbxAppContextActions.dbxAppContextSetState),
              filter((x) => x.state !== this.activeState),
            )
          )
        )
      )
    );
  }

}
