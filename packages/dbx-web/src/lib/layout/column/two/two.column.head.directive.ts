import { Directive, input } from '@angular/core';
import { type Maybe } from '@dereekb/util';

/**
 * Header bar directive for two-column layouts. Sits at the top of a column's content area
 * and provides a flex container for navigation elements, titles, and action buttons.
 *
 * @example
 * ```html
 * <dbx-two-column-head [block]="false" [full]="true">
 *   <span>Header Title</span>
 *   <button mat-icon-button>Action</button>
 * </dbx-two-column-head>
 * ```
 */
@Directive({
  selector: 'dbx-two-column-head,[dbxTwoColumnHead],.dbx-two-column-head',
  host: {
    class: 'd-flex dbx-two-column-head',
    '[class.d-block]': 'block()',
    '[class.full]': 'full()'
  },
  standalone: true
})
export class DbxTwoColumnColumnHeadDirective {
  /**
   * Whether the header should use block-level display instead of flex.
   */
  readonly block = input<Maybe<boolean>>(false);

  /**
   * Whether the header should expand to full width.
   */
  readonly full = input<Maybe<boolean>>(false);
}
