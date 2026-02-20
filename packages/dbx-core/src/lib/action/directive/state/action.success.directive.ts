import { Directive, inject, input } from '@angular/core';
import { emitDelayObs } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { of, exhaustMap, shareReplay } from 'rxjs';
import { AbstractIfDirective } from '../../../view/if.directive';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { transformEmptyStringInputToUndefined } from '../../../util/input';

/**
 * Structural directive that displays the content when the store has a success value.
 *
 * Can be configured to show for a temporary period.
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
