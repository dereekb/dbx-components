import { Directive, inject } from '@angular/core';
import { cleanSubscription, DbxRouterService, isSegueRefActive } from '@dereekb/dbx-core';
import { TwoColumnsContextStore } from './two.column.store';
import { shareReplay, distinctUntilChanged, type Subscription } from 'rxjs';
import { isNot } from '@dereekb/rxjs';

/**
 * Automatically shows the right column when the current route is a child of the configured `backRef`.
 *
 * Works with {@link DbxTwoColumnSrefDirective} to determine when the user has navigated away from
 * the back reference route, and shows the right column accordingly.
 *
 * @example
 * ```html
 * <dbx-two-column [dbxTwoColumnSref]="'/items'" dbxTwoColumnSrefShowRight>
 *   <div left>Item list</div>
 *   <dbx-two-column-right>Item detail (shown on child routes)</dbx-two-column-right>
 * </dbx-two-column>
 * ```
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
