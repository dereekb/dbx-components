import { Input, Directive, inject } from '@angular/core';
import { emitDelayObs } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { of, exhaustMap, shareReplay } from 'rxjs';
import { AbstractIfDirective } from '../../../view/if.directive';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';

/**
 * Structural directive that displays the content before the store has success.
 *
 * Can be configured to hide for a temporary period.
 */
@Directive({
  selector: '[dbxActionPreSuccess]'
})
export class DbxActionPreSuccessDirective extends AbstractIfDirective {
  @Input('dbxActionPreSuccess')
  hideFor?: Maybe<number> | '';

  readonly show$ = inject(DbxActionContextStoreSourceInstance).isSuccess$.pipe(
    exhaustMap((success) => {
      if (success) {
        return emitDelayObs(false, true, this.hideFor || undefined);
      } else {
        return of(true);
      }
    }),
    shareReplay(1)
  );
}
