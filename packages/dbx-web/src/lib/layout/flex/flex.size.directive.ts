import { Directive, input, computed } from '@angular/core';
import { type DbxFlexSize } from './flex';

/**
 * Applies a `dbx-flex-{size}` CSS class to the host element based on the given {@link DbxFlexSize} value.
 * Use within a {@link DbxFlexGroupDirective} to control how much row width this element occupies.
 *
 * @example
 * ```html
 * <div dbxFlexGroup>
 *   <div [dbxFlexSize]="4">Two-thirds width</div>
 *   <div [dbxFlexSize]="2">One-third width</div>
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
