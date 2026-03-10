import { Directive } from '@angular/core';

/**
 * Adds inline spacing sized for icons, typically used to align text that sits next to icon-bearing siblings.
 *
 * @example
 * ```html
 * <dbx-icon-spacer></dbx-icon-spacer>
 * <span>Text aligned with icon spacing</span>
 * ```
 */
@Directive({
  selector: 'dbx-icon-spacer,[dbxIconSpacer]',
  host: {
    class: 'dbx-icon-spacer d-inline'
  },
  standalone: true
})
export class DbxIconSpacerDirective {}
