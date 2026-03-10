import { Directive } from '@angular/core';

/**
 * Sets the host element to fill the full page height with page-level content styling.
 * Similar to `DbxContentDirective` but applies the `dbx-content-page` class for page-specific layout.
 *
 * @example
 * ```html
 * <dbx-content-page>
 *   <p>Full-page content layout.</p>
 * </dbx-content-page>
 *
 * <div dbxContentPage>
 *   <p>Attribute usage on any element.</p>
 * </div>
 * ```
 */
@Directive({
  selector: 'dbx-content-page,[dbxContentPage]',
  host: {
    class: 'd-block dbx-content-page'
  },
  standalone: true
})
export class DbxContentPageDirective {}
