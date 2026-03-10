import { computed, Directive, inject, input } from '@angular/core';
import { emitDelayObs } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { of, exhaustMap, shareReplay } from 'rxjs';
import { AbstractIfDirective } from '../../../view/if.directive';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { transformEmptyStringInputToUndefined } from '../../../util/input';

/**
 * Structural directive that conditionally renders its content while the action is in a working state.
 *
 * Optionally accepts a number (in milliseconds) to auto-hide the content after a specified duration,
 * even if the action is still working. This is useful for showing brief "loading" indicators
 * that should disappear after a timeout.
 *
 * @example
 * ```html
 * <div dbxAction>
 *   <div *dbxActionWorking>Loading...</div>
 * </div>
 * ```
 *
 * @example
 * ```html
 * <!-- Hide after 3 seconds even if still working -->
 * <div dbxAction>
 *   <div *dbxActionIsWorking="3000">Loading...</div>
 * </div>
 * ```
 *
 * @see {@link DbxActionIdleDirective} for showing content when idle.
 */
@Directive({
  selector: '[dbxActionWorking],[dbxActionIsWorking]',
  standalone: true
})
export class DbxActionIsWorkingDirective extends AbstractIfDirective {
  private readonly _store = inject(DbxActionContextStoreSourceInstance);

  readonly hideAfter = input<Maybe<number>, Maybe<number> | ''>(undefined, { alias: 'dbxActionWorking', transform: transformEmptyStringInputToUndefined });
  readonly hideAfterIsWorking = input<Maybe<number>, Maybe<number> | ''>(undefined, { alias: 'dbxActionIsWorking', transform: transformEmptyStringInputToUndefined });

  readonly hideAfterSignal = computed(() => {
    const hideAfter = this.hideAfter();
    const hideAfterIsWorking = this.hideAfterIsWorking();
    return hideAfter ?? hideAfterIsWorking;
  });

  readonly show$ = this._store.isWorking$.pipe(
    exhaustMap((isWorking) => {
      const hideAfter = this.hideAfterSignal();

      if (isWorking && hideAfter != null) {
        return emitDelayObs(true, false, hideAfter);
      } else {
        return of(isWorking);
      }
    }),
    shareReplay(1)
  );
}
