import { Directive, input } from '@angular/core';

/**
 * Wraps content in a box container with optional elevation (card-like shadow) and wide layout.
 * Both `elevate` and `wide` default to `true`.
 *
 * @dbxWebComponent
 * @dbxWebSlug content-box
 * @dbxWebCategory layout
 * @dbxWebRelated content, content-elevate, content-pit
 * @dbxWebSkillRefs dbx__ref__dbx-ui-building-blocks
 * @dbxWebMinimalExample ```html
 * <div dbxContentBox>Body</div>
 * ```
 *
 * @example
 * ```html
 * <dbx-content-box>
 *   <p>Summary content</p>
 * </dbx-content-box>
 * ```
 */
@Directive({
  selector: 'dbx-content-box, [dbxContentBox]',
  host: {
    class: 'd-block dbx-content-box',
    '[class.dbx-content-elevate]': 'elevate()',
    '[class.dbx-content-box-wide]': 'wide()'
  },
  standalone: true
})
export class DbxContentBoxDirective {
  readonly elevate = input<boolean>(true);
  readonly wide = input<boolean>(true);
}
