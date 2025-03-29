import { OnDestroy, Input, Directive, inject } from '@angular/core';
import { emitDelayObs } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { of, exhaustMap, shareReplay } from 'rxjs';
import { AbstractIfDirective } from '../../../view/if.directive';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';

/**
 * Structural directive that displays the content when the store has a success value.
 *
 * Can be configured to show for a temporary period.
 */
@Directive({
  selector: '[dbxActionHasSuccess]',
  standalone: true
})
export class DbxActionHasSuccessDirective extends AbstractIfDirective implements OnDestroy {
  @Input('dbxActionHasSuccess')
  hideAfter?: Maybe<number> | '';

  readonly show$ = inject(DbxActionContextStoreSourceInstance).isSuccess$.pipe(
    exhaustMap((success) => {
      if (success) {
        return emitDelayObs(true, false, this.hideAfter || undefined);
      } else {
        return of(false);
      }
    }),
    shareReplay(1)
  );
}
