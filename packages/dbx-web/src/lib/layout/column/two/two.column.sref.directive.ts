import { Directive, effect, inject, input } from '@angular/core';
import { asSegueRef, type SegueRefOrSegueRefRouterLink } from '@dereekb/dbx-core';
import { type Maybe } from '@dereekb/util';
import { TwoColumnsContextStore } from './two.column.store';

/**
 * Sets the back-navigation reference on the {@link TwoColumnsContextStore} from a segue ref or router link.
 * This controls where the back button in {@link DbxTwoColumnRightComponent} navigates to.
 *
 * @example
 * ```html
 * <dbx-two-column [dbxTwoColumnSref]="'/items'">
 *   <div left>Sidebar</div>
 *   <dbx-two-column-right>Detail view with back to /items</dbx-two-column-right>
 * </dbx-two-column>
 * ```
 */
@Directive({
  selector: '[dbxTwoColumnSref]',
  standalone: true
})
export class DbxTwoColumnSrefDirective {
  private readonly _twoColumnsContextStore = inject(TwoColumnsContextStore);

  /**
   * The segue reference or router link to use as the back navigation target.
   */
  readonly dbxTwoColumnSref = input.required<Maybe<SegueRefOrSegueRefRouterLink>>();

  protected readonly _dbxTwoColumnSrefEffect = effect(() => {
    const sref = this.dbxTwoColumnSref();
    const segueRef = sref ? asSegueRef(sref) : undefined;
    this._twoColumnsContextStore.setBackRef(segueRef);
  });
}
