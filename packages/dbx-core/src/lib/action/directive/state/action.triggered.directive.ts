import { Directive, inject, input } from '@angular/core';
import { emitDelayObs } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { of, exhaustMap, shareReplay } from 'rxjs';
import { AbstractIfDirective } from '../../../view/if.directive';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { transformEmptyStringInputToUndefined } from '../../../util/input';

/**
 * Structural directive that conditionally renders its content when the action has been triggered.
 *
 * Shows content during the TRIGGERED state (after trigger, before value-ready/working).
 * Optionally accepts a number (in milliseconds) to auto-hide the content after the specified duration.
 *
 * @example
 * ```html
 * <div dbxAction>
 *   <div *dbxActionTriggered>Preparing...</div>
 * </div>
 * ```
 *
 * @see {@link DbxActionIsWorkingDirective} for content shown during the working state.
 */
@Directive({
  selector: '[dbxActionTriggered]',
  standalone: true
})
export class DbxActionTriggeredDirective extends AbstractIfDirective {
  private readonly _store = inject(DbxActionContextStoreSourceInstance);

  readonly hideAfter = input<Maybe<number>, Maybe<number> | ''>(undefined, { alias: 'dbxActionTriggered', transform: transformEmptyStringInputToUndefined });

  readonly show$ = this._store.triggered$.pipe(
    exhaustMap((triggered) => {
      return triggered ? emitDelayObs(true, false, this.hideAfter()) : of(false);
    }),
    shareReplay(1)
  );
}
