import { Directive } from '@angular/core';

/**
 * Adds inline spacing between adjacent buttons. Can be used as an element or attribute.
 *
 * @dbxWebComponent
 * @dbxWebSlug button-spacer
 * @dbxWebCategory button
 * @dbxWebRelated bar, spacer, button
 * @dbxWebSkillRefs dbx__ref__dbx-ui-building-blocks
 * @dbxWebMinimalExample ```html
 * <dbx-button-spacer></dbx-button-spacer>
 * ```
 *
 * @example
 * ```html
 * <dbx-bar>
 *   <dbx-button text="Save" raised></dbx-button>
 *   <dbx-button-spacer></dbx-button-spacer>
 *   <dbx-button text="Cancel"></dbx-button>
 * </dbx-bar>
 * ```
 */
@Directive({
  selector: 'dbx-button-spacer,[dbxButtonSpacer]',
  host: {
    class: 'dbx-button-spacer d-inline'
  },
  standalone: true
})
export class DbxButtonSpacerDirective {}
