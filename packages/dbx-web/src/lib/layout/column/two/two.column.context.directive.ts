import { Directive, effect, inject, input } from '@angular/core';
import { isDefinedAndNotFalse, type Maybe } from '@dereekb/util';
import { provideTwoColumnsContext, TwoColumnsContextStore } from './two.column.store';

/**
 * Structural directive that provides a new {@link TwoColumnsContextStore} instance to its descendants.
 * Use this to create an isolated two-column context scope.
 *
 * Optionally controls the right column visibility via the `showRight` input.
 *
 * @example
 * ```html
 * <div dbxTwoColumnContext [showRight]="hasDetail">
 *   <dbx-two-column>
 *     <div left>Sidebar</div>
 *     <div right>Detail content</div>
 *   </dbx-two-column>
 * </div>
 * ```
 */
@Directive({
  selector: '[dbxTwoColumnContext]',
  providers: provideTwoColumnsContext(),
  standalone: true
})
export class DbxTwoColumnContextDirective {
  readonly twoColumnsContextStore = inject(TwoColumnsContextStore, { self: true });

  /**
   * Override for the right column visibility state. When set, overrides the store's default `showRight` value.
   */
  readonly showRight = input<Maybe<boolean>, Maybe<boolean | ''>>(undefined, { transform: isDefinedAndNotFalse });

  protected readonly _showRightEffect = effect(() => {
    this.twoColumnsContextStore.setShowRightOverride(this.showRight());
  });
}
