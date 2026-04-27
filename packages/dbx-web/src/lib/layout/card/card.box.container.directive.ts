import { Directive } from '@angular/core';

/**
 * Adds content padding around a card box section.
 *
 * Can be used as an element or as an attribute directive on any host element.
 *
 * @dbxWebComponent
 * @dbxWebSlug card-box-container
 * @dbxWebCategory card
 * @dbxWebRelated card-box
 * @dbxWebSkillRefs dbx__ref__dbx-ui-building-blocks
 * @dbxWebMinimalExample ```html
 * <div dbxCardBoxContainer><dbx-card-box></dbx-card-box></div>
 * ```
 *
 * @example
 * ```html
 * <dbx-card-box-container>
 *   <dbx-card-box header="One"></dbx-card-box>
 *   <dbx-card-box header="Two"></dbx-card-box>
 * </dbx-card-box-container>
 * ```
 */
@Directive({
  selector: 'dbx-card-box-container, [dbxCardBoxContainer]',
  host: {
    class: 'd-block dbx-card-box-container'
  },
  standalone: true
})
export class DbxCardBoxContainerDirective {}
