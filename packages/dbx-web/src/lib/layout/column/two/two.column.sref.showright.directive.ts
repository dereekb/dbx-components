import { Directive, inject } from '@angular/core';
import { cleanSubscription, DbxRouterService, isSegueRefActive } from '@dereekb/dbx-core';
import { TwoColumnsContextStore } from './two.column.store';
import { shareReplay, distinctUntilChanged, Subscription } from 'rxjs';
import { isNot } from '@dereekb/rxjs';

/**
 * Used with a DbxTwoColumnComponent to control showing right when the current route is a child of the backRef.
 */
@Directive({
  selector: '[dbxTwoColumnSrefShowRight]',
  standalone: true
})
export class DbxTwoColumnSrefShowRightDirective {
  private readonly _twoColumnsContextStore = inject(TwoColumnsContextStore);
  private readonly _dbxRouterService = inject(DbxRouterService);

  readonly showRight$ = this._twoColumnsContextStore.backRef$.pipe(
    // Only show right when the backRef is not exactly active
    isSegueRefActive({ dbxRouterService: this._dbxRouterService, activeExactly: true }),
    isNot(),
    distinctUntilChanged(),
    shareReplay(1)
  );

  constructor() {
    cleanSubscription(this._twoColumnsContextStore.setShowRight(this.showRight$) as Subscription);
  }
}
