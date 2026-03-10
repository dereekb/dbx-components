import { Directive, inject, input } from '@angular/core';
import { emitDelayObs } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { of, exhaustMap, shareReplay } from 'rxjs';
import { AbstractIfDirective } from '../../../view/if.directive';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { transformEmptyStringInputToUndefined } from '../../../util/input';

/**
 * Structural directive that conditionally renders its content when the action has resolved successfully.
 *
 * Optionally accepts a number (in milliseconds) to auto-hide the content after the specified
 * duration, useful for showing temporary success messages that fade away.
 *
 * @example
 * ```html
 * <div dbxAction>
 *   <div *dbxActionHasSuccess>Saved successfully!</div>
 * </div>
 * ```
 *
 * @example
 * ```html
 * <!-- Show success message for 3 seconds -->
 * <div dbxAction>
 *   <div *dbxActionHasSuccess="3000">Saved!</div>
 * </div>
 * ```
 *
 * @see {@link DbxActionPreSuccessDirective} for showing content before success.
 * @see {@link DbxActionSuccessHandlerDirective} for executing a function on success.
 */
@Directive({
  selector: '[dbxActionHasSuccess]',
  standalone: true
})
export class DbxActionHasSuccessDirective extends AbstractIfDirective {
  private readonly _store = inject(DbxActionContextStoreSourceInstance);

  readonly hideAfter = input<Maybe<number>, Maybe<number> | ''>(undefined, { alias: 'dbxActionHasSuccess', transform: transformEmptyStringInputToUndefined });

  readonly show$ = this._store.isSuccess$.pipe(
    exhaustMap((success) => {
      if (success) {
        return emitDelayObs(true, false, this.hideAfter());
      } else {
        return of(false);
      }
    }),
    shareReplay(1)
  );
}
