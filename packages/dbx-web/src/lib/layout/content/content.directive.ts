import { Directive } from '@angular/core';

/**
 * Sets the host element to fill the available page height. Use as a wrapper for page-level content blocks.
 *
 * @example
 * ```html
 * <dbx-content>
 *   <p>This content fills the page height.</p>
 * </dbx-content>
 *
 * <div dbxContent>
 *   <p>Attribute usage on any element.</p>
 * </div>
 * ```
 */
@Directive({
  selector: 'dbx-content,[dbxContent]',
  host: {
    class: 'd-block dbx-content'
  },
  standalone: true
})
export class DbxContentDirective {}
