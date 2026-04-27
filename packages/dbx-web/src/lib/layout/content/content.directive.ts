import { Directive } from '@angular/core';

/**
 * Sets the host element to fill the available page height. Use as a wrapper for page-level content blocks.
 *
 * @dbxWebComponent
 * @dbxWebSlug content
 * @dbxWebCategory layout
 * @dbxWebRelated content-container, content-page, content-box
 * @dbxWebSkillRefs dbx__ref__dbx-ui-building-blocks
 * @dbxWebMinimalExample ```html
 * <dbx-content>Body</dbx-content>
 * ```
 *
 * @example
 * ```html
 * <div dbxContent>
 *   <p>Standard content body</p>
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
