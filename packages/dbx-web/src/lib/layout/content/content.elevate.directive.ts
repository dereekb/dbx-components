import { Directive, input } from '@angular/core';

/**
 * Applies elevation (box-shadow) styling to the host element, giving it a raised card appearance.
 * Elevation is enabled by default and can be toggled off.
 *
 * @dbxWebComponent
 * @dbxWebSlug content-elevate
 * @dbxWebCategory layout
 * @dbxWebRelated content-box, content-pit
 * @dbxWebSkillRefs dbx__ref__dbx-ui-building-blocks
 * @dbxWebMinimalExample ```html
 * <dbx-content-elevate>Body</dbx-content-elevate>
 * ```
 *
 * @example
 * ```html
 * <div dbxContentElevate>Highlighted block</div>
 * ```
 */
@Directive({
  selector: 'dbx-content-elevate,[dbxContentElevate]',
  host: {
    class: 'd-block',
    '[class.dbx-content-elevate]': 'elevate()'
  },
  standalone: true
})
export class DbxContentElevateDirective {
  readonly elevate = input<boolean>(true);
}
