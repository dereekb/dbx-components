import { OnDestroy, Input, Directive, inject } from '@angular/core';
import { emitDelayObs } from '@dereekb/rxjs';
import { Maybe } from '@dereekb/util';
import { of, exhaustMap, shareReplay } from 'rxjs';
import { AbstractIfDirective } from '../../../view/if.directive';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';

/**
 * Structural directive that displays the content when the store is working.
 *
 * Can specify a period in milliseconds that shows how long to show up after working for a particular number of seconds.
 */
@Directive({
  selector: '[dbxActionIsWorking]'
})
export class DbxActionIsWorkingDirective extends AbstractIfDirective implements OnDestroy {
  @Input('dbxActionIsWorking')
  showAfter?: Maybe<number> | '';

  readonly show$ = inject(DbxActionContextStoreSourceInstance).isWorking$.pipe(
    exhaustMap((isWorking) => {
      if (isWorking && this.showAfter) {
        return emitDelayObs(false, true, this.showAfter || undefined);
      } else {
        return of(isWorking);
      }
    }),
    shareReplay(1)
  );
}
