import { Directive } from '@angular/core';

/**
 * Adds flexible spacing between sibling elements in a flex container.
 *
 * @example
 * ```html
 * <div class="dbx-flex">
 *   <span>Left</span>
 *   <dbx-spacer></dbx-spacer>
 *   <span>Right</span>
 * </div>
 * ```
 */
@Directive({
  selector: 'dbx-spacer, [dbxSpacer]',
  host: {
    class: 'dbx-spacer'
  },
  standalone: true
})
export class DbxSpacerDirective {}
