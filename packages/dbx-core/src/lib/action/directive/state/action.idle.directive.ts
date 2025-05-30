import { Directive, inject, input } from '@angular/core';
import { emitDelayObs } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { of, exhaustMap, shareReplay } from 'rxjs';
import { AbstractIfDirective } from '../../../view/if.directive';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { transformEmptyStringInputToUndefined } from '../../../util/input';

/**
 * Structural directive that displays the content before the store has success.
 *
 * Can be configured to hide for a temporary period.
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
      if (idle) {
        return emitDelayObs(true, false, this.hideAfter());
      } else {
        return of(false);
      }
    }),
    shareReplay(1)
  );
}
