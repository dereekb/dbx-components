import { OnDestroy, Input, TemplateRef, ViewContainerRef, Directive } from '@angular/core';
import { emitDelayObs } from '@dereekb/rxjs';
import { Maybe } from '@dereekb/util';
import { of, exhaustMap, shareReplay } from 'rxjs';
import { AbstractIfDirective } from '../../../view/if.directive';
import { DbxActionContextStoreSourceInstance } from '../../action.store.source';

/**
 * Structural directive that displays the content when the store has a success value.
 */
@Directive({
  selector: '[dbxActionHasSuccess]'
})
export class DbxActionHasSuccessDirective extends AbstractIfDirective implements OnDestroy {

  @Input('dbxActionHasSuccess')
  hideAfter?: Maybe<number> | '';

  readonly show$ = this.source.isSuccess$.pipe(
    exhaustMap((success) => {
      if (success) {
        return emitDelayObs(true, false, this.hideAfter || undefined);
      } else {
        return of(false);
      }
    }),
    shareReplay(1)
  );

  constructor(templateRef: TemplateRef<unknown>, viewContainer: ViewContainerRef, public readonly source: DbxActionContextStoreSourceInstance) {
    super(templateRef, viewContainer);
  }

}
