import { computed, Directive, inject, input } from '@angular/core';
import { emitDelayObs } from '@dereekb/rxjs';
import { type Maybe } from '@dereekb/util';
import { of, exhaustMap, shareReplay } from 'rxjs';
import { AbstractIfDirective } from '../../../view/if.directive';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';
import { transformEmptyStringInputToUndefined } from '../../../util/input';

/**
 * Structural directive that displays the content when the store is working.
 *
 * Can specify a period in milliseconds that shows how long to show up after working for a particular number of seconds.
 */
@Directive({
  selector: '[dbxActionWorking],[dbxActionIsWorking]',
  standalone: true
})
export class DbxActionIsWorkingDirective extends AbstractIfDirective {
  private readonly _store = inject(DbxActionContextStoreSourceInstance);

  readonly hideAfter = input<Maybe<number>, Maybe<number> | ''>(undefined, { alias: 'dbxActionWorking', transform: transformEmptyStringInputToUndefined });
  readonly hideAfterIsWorking = input<Maybe<number>, Maybe<number> | ''>(undefined, { alias: 'dbxActionIsWorking', transform: transformEmptyStringInputToUndefined });

  readonly hideAfterSignal = computed(() => {
    const hideAfter = this.hideAfter();
    const hideAfterIsWorking = this.hideAfterIsWorking();
    return hideAfter ?? hideAfterIsWorking;
  });

  readonly show$ = this._store.isWorking$.pipe(
    exhaustMap((isWorking) => {
      const hideAfter = this.hideAfterSignal();

      if (isWorking && hideAfter != null) {
        return emitDelayObs(true, false, hideAfter);
      } else {
        return of(isWorking);
      }
    }),
    shareReplay(1)
  );
}
