import { Directive } from '@angular/core';

/**
 * Sets the host element to fill the full page height with page-level content styling.
 * Similar to `DbxContentDirective` but applies the `dbx-content-page` class for page-specific layout.
 *
 * @dbxWebComponent
 * @dbxWebSlug content-page
 * @dbxWebCategory layout
 * @dbxWebRelated content-container, section-page
 * @dbxWebSkillRefs dbx__ref__dbx-ui-building-blocks
 * @dbxWebMinimalExample ```html
 * <dbx-content-page>Page</dbx-content-page>
 * ```
 *
 * @example
 * ```html
 * <div dbxContentPage>
 *   <dbx-section-page header="Dashboard"><p>...</p></dbx-section-page>
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
