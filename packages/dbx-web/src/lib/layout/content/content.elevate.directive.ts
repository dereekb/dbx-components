import { Directive, input } from '@angular/core';

/**
 * Applies elevation (box-shadow) styling to the host element, giving it a raised card appearance.
 * Elevation is enabled by default and can be toggled off.
 *
 * @example
 * ```html
 * <dbx-content-elevate>
 *   <p>Elevated content with shadow.</p>
 * </dbx-content-elevate>
 *
 * <div dbxContentElevate [elevate]="false">
 *   <p>Flat content, no elevation.</p>
 * </div>
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
