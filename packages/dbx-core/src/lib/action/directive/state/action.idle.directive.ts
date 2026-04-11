import { Directive, inject, input } from '@angular/core';
import { emitDelayObs } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { of, exhaustMap, shareReplay } from 'rxjs';
import { AbstractIfDirective } from '../../../view/if.directive';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { transformEmptyStringInputToUndefined } from '../../../util/input';

/**
 * Structural directive that conditionally renders its content when the action is idle.
 *
 * Optionally accepts a number (in milliseconds) to auto-hide the content after the specified
 * duration, even if the action is still idle. Useful for showing initial instructions that
 * should disappear after a timeout.
 *
 * @example
 * ```html
 * <div dbxAction>
 *   <div *dbxActionIdle>Ready to submit.</div>
 * </div>
 * ```
 *
 * @example
 * ```html
 * <!-- Hide idle content after 5 seconds -->
 * <div dbxAction>
 *   <div *dbxActionIdle="5000">Ready to submit.</div>
 * </div>
 * ```
 *
 * @see {@link DbxActionIsWorkingDirective} for showing content when working.
 * @see {@link DbxActionHasSuccessDirective} for showing content on success.
 */
@Directive({
  selector: '[dbxActionIdle]',
  standalone: true
})
export class DbxActionIdleDirective extends AbstractIfDirective {
  private readonly _store = inject(DbxActionContextStoreSourceInstance);

  readonly hideAfter = input<Maybe<number>, Maybe<number> | ''>(undefined, { alias: 'dbxActionIdle', transform: transformEmptyStringInputToUndefined });

  readonly show$ = this._store.idle$.pipe(
    exhaustMap((idle) => {
      return idle ? emitDelayObs(true, false, this.hideAfter()) : of(false);
    }),
    shareReplay(1)
  );
}
