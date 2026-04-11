import { Directive, inject, input } from '@angular/core';
import { emitDelayObs } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { of, exhaustMap, shareReplay } from 'rxjs';
import { AbstractIfDirective } from '../../../view/if.directive';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { transformEmptyStringInputToUndefined } from '../../../util/input';

/**
 * Structural directive that renders its content while the action has not yet succeeded.
 *
 * The content is visible during all states before success (IDLE, TRIGGERED, WORKING, etc.)
 * and is hidden once the action resolves successfully. Optionally accepts a number (in milliseconds)
 * specifying how long to keep the content hidden after success before showing it again.
 *
 * This is the inverse of {@link DbxActionHasSuccessDirective}.
 *
 * @example
 * ```html
 * <div dbxAction>
 *   <div *dbxActionPreSuccess>Not yet saved.</div>
 * </div>
 * ```
 *
 * @example
 * ```html
 * <!-- Re-show content 2 seconds after success -->
 * <div dbxAction>
 *   <div *dbxActionPreSuccess="2000">Not yet saved.</div>
 * </div>
 * ```
 *
 * @see {@link DbxActionHasSuccessDirective} for showing content on success.
 */
@Directive({
  selector: '[dbxActionPreSuccess]',
  standalone: true
})
export class DbxActionPreSuccessDirective extends AbstractIfDirective {
  private readonly _store = inject(DbxActionContextStoreSourceInstance);

  readonly hideFor = input<Maybe<number>, Maybe<number> | ''>(undefined, { alias: 'dbxActionPreSuccess', transform: transformEmptyStringInputToUndefined });

  readonly show$ = this._store.isSuccess$.pipe(
    exhaustMap((success) => {
      return success ? emitDelayObs(false, true, this.hideFor()) : of(true);
    }),
    shareReplay(1)
  );
}
