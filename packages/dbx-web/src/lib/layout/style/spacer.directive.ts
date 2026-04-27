import { Directive } from '@angular/core';

/**
 * Adds flexible spacing between sibling elements in a flex container.
 *
 * @dbxWebComponent
 * @dbxWebSlug spacer
 * @dbxWebCategory layout
 * @dbxWebRelated bar, button-spacer
 * @dbxWebSkillRefs dbx__ref__dbx-ui-building-blocks
 * @dbxWebMinimalExample ```html
 * <dbx-spacer></dbx-spacer>
 * ```
 *
 * @example
 * ```html
 * <dbx-bar>
 *   <span>Title</span>
 *   <dbx-spacer></dbx-spacer>
 *   <button mat-button>Action</button>
 * </dbx-bar>
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
