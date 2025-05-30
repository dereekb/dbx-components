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
  selector: '[dbxActionPreSuccess]',
  standalone: true
})
export class DbxActionPreSuccessDirective extends AbstractIfDirective {
  private readonly _store = inject(DbxActionContextStoreSourceInstance);

  readonly hideFor = input<Maybe<number>, Maybe<number> | ''>(undefined, { alias: 'dbxActionPreSuccess', transform: transformEmptyStringInputToUndefined });

  readonly show$ = this._store.isSuccess$.pipe(
    exhaustMap((success) => {
      if (success) {
        return emitDelayObs(false, true, this.hideFor());
      } else {
        return of(true);
      }
    }),
    shareReplay(1)
  );
}
