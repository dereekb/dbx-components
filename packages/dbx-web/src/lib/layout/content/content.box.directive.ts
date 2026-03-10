import { Directive, input } from '@angular/core';

/**
 * Wraps content in a box container with optional elevation (card-like shadow) and wide layout.
 * Both `elevate` and `wide` default to `true`.
 *
 * @example
 * ```html
 * <dbx-content-box>
 *   <p>Elevated wide box content.</p>
 * </dbx-content-box>
 *
 * <div dbxContentBox [elevate]="false" [wide]="false">
 *   <p>Flat, non-wide box content.</p>
 * </div>
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
