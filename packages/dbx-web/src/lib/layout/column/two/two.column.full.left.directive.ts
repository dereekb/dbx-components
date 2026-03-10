import { Directive, inject, input, effect } from '@angular/core';
import { isNotFalse, type Maybe } from '@dereekb/util';
import { TwoColumnsContextStore } from './two.column.store';

/**
 * Enables full-left mode on a {@link DbxTwoColumnComponent}, allowing the left column to expand
 * to fill the entire width when the right column is not visible.
 *
 * The directive value defaults to `true` when applied without a binding.
 *
 * @example
 * ```html
 * <dbx-two-column dbxTwoColumnFullLeft>
 *   <div left>Expands to full width when right is hidden</div>
 *   <div right>Detail content</div>
 * </dbx-two-column>
 * ```
 */
@Directive({
  selector: '[dbxTwoColumnFullLeft]',
  standalone: true
})
export class DbxTwoColumnFullLeftDirective {
  private readonly _twoColumnsContextStore = inject(TwoColumnsContextStore);

  /**
   * Whether to enable full-left mode. Defaults to `true`.
   */
  readonly fullLeft = input<boolean, Maybe<boolean | ''>>(true, { alias: 'dbxTwoColumnFullLeft', transform: isNotFalse });

  protected readonly _fullLeftEffect = effect(() => {
    this._twoColumnsContextStore.setFullLeft(this.fullLeft());
  });
}
