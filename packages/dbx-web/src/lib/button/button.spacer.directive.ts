import { Directive } from '@angular/core';

/**
 * Adds inline spacing between adjacent buttons. Can be used as an element or attribute.
 *
 * @example
 * ```html
 * <dbx-button text="Cancel"></dbx-button>
 * <dbx-button-spacer></dbx-button-spacer>
 * <dbx-button text="Save" raised></dbx-button>
 * ```
 *
 * @example
 * ```html
 * <span dbxButtonSpacer></span>
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
