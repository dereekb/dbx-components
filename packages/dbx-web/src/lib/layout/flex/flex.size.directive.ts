import { Directive, input, computed } from '@angular/core';
import { type DbxFlexSize } from './flex';

/**
 * Applies a `dbx-flex-{size}` CSS class to the host element based on the given {@link DbxFlexSize} value.
 * Use within a {@link DbxFlexGroupDirective} to control how much row width this element occupies.
 *
 * @dbxWebComponent
 * @dbxWebSlug flex-size
 * @dbxWebCategory layout
 * @dbxWebRelated flex-group
 * @dbxWebSkillRefs dbx__ref__dbx-ui-building-blocks
 * @dbxWebMinimalExample ```html
 * <div dbxFlexSize="1"></div>
 * ```
 *
 * @example
 * ```html
 * <div dbxFlexGroup>
 *   <div dbxFlexSize="2">Twice as wide</div>
 *   <div dbxFlexSize="1">Narrow</div>
 * </div>
 * ```
 */
@Directive({
  selector: '[dbxFlexSize]',
  host: {
    '[class]': 'cssClassSignal()'
  },
  standalone: true
})
export class DbxFlexSizeDirective {
  /**
   * The flex size to apply, from 1 (1/6 width) to 6 (full width).
   */
  readonly dbxFlexSize = input.required<DbxFlexSize>();
  readonly cssClassSignal = computed(() => `dbx-flex-${this.dbxFlexSize()}`);
}
