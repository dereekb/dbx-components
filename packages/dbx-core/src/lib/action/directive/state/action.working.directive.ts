import { Directive, inject, input } from '@angular/core';
import { emitDelayObs } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { of, exhaustMap, shareReplay } from 'rxjs';
import { AbstractIfDirective } from '../../../view/if.directive';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';

/**
 * Structural directive that displays the content when the store is working.
 *
 * Can specify a period in milliseconds that shows how long to show up after working for a particular number of seconds.
 */
@Directive({
  selector: '[dbxActionIsWorking]',
  standalone: true
})
export class DbxActionIsWorkingDirective extends AbstractIfDirective {
  private readonly _store = inject(DbxActionContextStoreSourceInstance);

  readonly showAfter = input<Maybe<number>, Maybe<number> | ''>(undefined, { alias: 'dbxActionIsWorking', transform: (value) => (value === '' ? undefined : value) });

  readonly show$ = this._store.isWorking$.pipe(
    exhaustMap((isWorking) => {
      const showAfter = this.showAfter();

      if (isWorking && showAfter) {
        return emitDelayObs(false, true, showAfter);
      } else {
        return of(isWorking);
      }
    }),
    shareReplay(1)
  );
}
