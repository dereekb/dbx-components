import { Directive, inject, output } from '@angular/core';
import { cleanSubscription } from '@dereekb/dbx-core';
import { TwoColumnsContextStore } from './two.column.store';

/**
 * Listens for back navigation events from the {@link TwoColumnsContextStore} and emits them as an output event.
 * Attach this directive to any element within a two-column context to respond to back button presses.
 *
 * @example
 * ```html
 * <div dbxTwoColumnContext>
 *   <div (dbxTwoColumnBack)="onBackNavigation()">
 *     <dbx-two-column>
 *       <div left>Sidebar</div>
 *       <dbx-two-column-right>Detail</dbx-two-column-right>
 *     </dbx-two-column>
 *   </div>
 * </div>
 * ```
 */
@Directive({
  selector: '[dbxTwoColumnBack]',
  standalone: true
})
export class DbxTwoColumnBackDirective {
  readonly twoColumnsContextStore = inject(TwoColumnsContextStore);

  /**
   * Emits when a back navigation event is triggered from the two-column context store.
   */
  readonly dbxTwoColumnBack = output();

  constructor() {
    cleanSubscription(this.twoColumnsContextStore.back$.subscribe(() => this.dbxTwoColumnBack.emit()));
  }

  public backClicked(): void {
    this.twoColumnsContextStore.back();
  }
}
